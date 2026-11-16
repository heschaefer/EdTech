import { readFile } from 'node:fs/promises';
import { expect, semViolacoesGraves, test } from '../fixtures';

test.describe('LGPD: direitos do titular e auditoria (seção 8.4) @aluno @admin', () => {
  test('LGPD aluno baixa os próprios dados em JSON, com o CPF mascarado', async ({ page, api, entrarComo }) => {
    const c = await api.cenario({ comCandidatura: true });
    await entrarComo(c.aluno);
    await page.goto('/aluno');
    await page.getByRole('link', { name: 'Privacidade' }).click();
    await semViolacoesGraves(page);

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar meus dados' }).click()]);
    expect(download.suggestedFilename()).toBe('meus-dados.json');
    const dados = JSON.parse(await readFile((await download.path())!, 'utf8'));
    expect(dados.titular).toMatchObject({ nome: c.aluno.nome, email: c.aluno.email });
    expect(dados.titular.cpf).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
    expect(JSON.stringify(dados)).not.toContain(c.aluno.cpf);
    expect(dados.candidaturas).toHaveLength(1);
    await expect(page.getByRole('status')).toHaveText('Arquivo meus-dados.json gerado.');
  });

  test('LGPD aluno exclui a conta com senha e confirmação; os dados somem e o login deixa de funcionar @smoke', async ({ page, api, entrarComo, sessao }) => {
    const c = await api.cenario({ comCandidatura: true });
    await entrarComo(c.aluno);
    await page.goto('/aluno/privacidade');
    await page.getByRole('button', { name: 'Excluir minha conta' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo.getByRole('button', { name: 'Excluir definitivamente' })).toBeDisabled();
    await dialogo.getByLabel('Senha').fill('senha-errada');
    await dialogo.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR');
    await dialogo.getByRole('button', { name: 'Excluir definitivamente' }).click();
    await expect(dialogo.getByRole('alert')).toHaveText('Senha incorreta');

    await dialogo.getByLabel('Senha').fill(c.aluno.senha);
    await dialogo.getByRole('button', { name: 'Excluir definitivamente' }).click();
    await expect(page).toHaveURL(/\/login\?conta=excluida/);
    await expect(page.getByRole('status')).toContainText('Sua conta foi excluída');

    expect((await page.request.post('/api/v1/auth/login', { data: { email: c.aluno.email, senha: c.aluno.senha } })).status()).toBe(401);
    // A empresa perde o candidato (a candidatura em processo foi cancelada).
    const emp = await sessao(c.empresa);
    expect((await emp.get(`/empresa/candidaturas/${c.candidaturaId}`)).status()).toBe(404);
  });

  test('LGPD admin consulta a trilha de auditoria filtrando pela ação', async ({ page, api, entrarComo, sessao }) => {
    const c = await api.cenario();
    const emp = await sessao(c.empresa);
    expect((await emp.post(`/empresa/vagas/${c.vaga.id}/pausar`)).ok()).toBeTruthy();
    const admin = await api.admin();
    await entrarComo({ email: admin.email, senha: admin.senha, totp: admin.codigo() });

    await page.goto('/admin');
    await page.getByRole('link', { name: 'Auditoria' }).click();
    await page.getByLabel('Ação', { exact: true }).selectOption('EMPRESA_PAUSOU_VAGA');
    await page.getByLabel('Id do registro afetado').fill(c.vaga.id);
    const linha = page.getByRole('row').filter({ hasText: 'EMPRESA_PAUSOU_VAGA' });
    await expect(linha).toHaveCount(1);
    await expect(linha).toContainText(c.empresa.email);
    await expect(linha).toContainText('"para":"PAUSADA"');
    await semViolacoesGraves(page);
  });
});
