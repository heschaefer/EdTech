import type { Page } from '@playwright/test';
import { expect, semViolacoesGraves, test } from '../fixtures';
import { cpfValido, sufixo } from '../helpers';

const SENHA = 'Xq9#mVt2!pL';

async function preencherPasso1(page: Page, dados: { nome?: string; cpf?: string; email: string; senha?: string }) {
  await page.getByLabel('Nome completo').fill(dados.nome ?? 'Bruna Lima');
  await page.getByLabel('CPF').fill(dados.cpf ?? cpfValido());
  await page.getByLabel('E-mail institucional').fill(dados.email);
  await page.getByLabel('E-mail institucional').blur();
  await page.getByLabel('Telefone').fill('11977776666');
  await page.getByLabel('Senha', { exact: true }).fill(dados.senha ?? SENHA);
  await page.getByLabel('Confirmação da senha').fill(dados.senha ?? SENHA);
}

test.describe('Cadastro do aluno @aluno', () => {
  test('ALU-01 AUTH-05 cadastro em 3 passos, verificação pelo e-mail e primeiro login @smoke', async ({ page, api }) => {
    const { faculdade, curso } = await api.cenario();
    const email = `bruna.${sufixo()}@${faculdade.dominio}`;
    await page.goto('/login');
    await page.getByRole('link', { name: 'Sou aluno e quero criar minha conta' }).click();
    await semViolacoesGraves(page);

    await preencherPasso1(page, { email });
    await page.getByRole('button', { name: 'Continuar' }).click();

    // RN-01: a faculdade aparece preenchida e bloqueada.
    await expect(page.getByLabel('Faculdade')).toHaveValue(new RegExp(`Faculdade Teste`));
    await expect(page.getByLabel('Faculdade')).toHaveAttribute('readonly', '');
    await page.getByLabel('Curso').selectOption({ label: curso.nome });
    await page.getByLabel('Turma (ano/período de ingresso)').selectOption({ label: '2025/1' });
    await page.getByLabel('Semestre atual').selectOption('2');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('É preciso aceitar os termos de uso e a política de privacidade')).toBeVisible();
    await page.getByLabel(/Li e aceito/).check();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByLabel('Objetivo profissional').fill('Estágio em desenvolvimento');
    await page.getByRole('button', { name: 'Concluir cadastro' }).click();
    await expect(page.getByRole('status')).toContainText(`Enviamos um link de verificação para ${email}`);

    // AUTH-05: o link chega no Mailpit e ativa a conta.
    const mensagem = await api.ultimoEmailPara(email, { assunto: /Confirme seu e-mail/ });
    await page.goto(await api.linkDoEmail(mensagem.ID));
    await expect(page.getByRole('status')).toContainText('E-mail confirmado');
    await page.getByRole('link', { name: 'Ir para o login' }).click();
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(SENHA);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/aluno/);
  });

  test('ALU-01 domínio não cadastrado para o cadastro', async ({ page }) => {
    await page.goto('/cadastro/aluno');
    await preencherPasso1(page, { email: `x.${sufixo()}@naousa.edu.br` });
    await expect(page.getByText('Sua faculdade ainda não usa a plataforma')).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { name: 'Dados pessoais' })).toBeVisible();
  });

  test('ALU-01 CPF inválido e senha fora da política mostram os erros nos campos', async ({ page, api }) => {
    const { faculdade } = await api.cenario();
    await page.goto('/cadastro/aluno');
    await preencherPasso1(page, { email: `c.${sufixo()}@${faculdade.dominio}`, cpf: '111.111.111-11', senha: 'abc' });
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('CPF inválido')).toBeVisible();
    for (const requisito of ['Entre 8 e 128 caracteres', 'Ao menos 1 letra maiúscula', 'Ao menos 1 número', 'Ao menos 1 caractere especial']) {
      await expect(page.getByText(requisito)).toBeVisible();
    }
  });

  test('ALU-01 RN-02 CPF já usado volta ao passo 1 com erro no campo CPF', async ({ page, api }) => {
    const { faculdade, curso } = await api.cenario();
    const outro = await api.cenario();
    await page.goto('/cadastro/aluno');
    await preencherPasso1(page, { email: `d.${sufixo()}@${faculdade.dominio}`, cpf: outro.aluno.cpf });
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Curso').selectOption({ label: curso.nome });
    await page.getByLabel('Turma (ano/período de ingresso)').selectOption({ label: '2025/1' });
    await page.getByLabel('Semestre atual').selectOption('1');
    await page.getByLabel(/Li e aceito/).check();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Pular e concluir' }).click();
    await expect(page.getByRole('heading', { name: 'Dados pessoais' })).toBeVisible();
    await expect(page.getByText('CPF já cadastrado')).toBeVisible();
  });
});

test.describe('Troca de faculdade @aluno', () => {
  test('ALU-12 aluna desligada confirma o e-mail da nova faculdade e volta a ficar ativa', async ({ page, api, entrarComo, browser }) => {
    const a = await api.cenario();
    const b = await api.cenario();

    // A faculdade A desliga a aluna (FAC-06).
    const facA = await (await browser.newContext()).newPage();
    await facA.request.post('/api/v1/auth/login', { data: { email: a.faculdade.email, senha: a.faculdade.senha } });
    const csrf = (await facA.context().cookies()).find((c) => c.name === 'csrf')!.value;
    const r = await facA.request.patch(`/api/v1/faculdade/alunos/${a.aluno.id}/status`, { data: { status: 'INATIVO', motivo: 'Transferência' }, headers: { 'X-CSRF-Token': csrf } });
    expect(r.status()).toBe(200);

    await entrarComo(a.aluno);
    await page.goto('/aluno');
    await expect(page).toHaveURL(/\/aluno\/trocar-faculdade$/);
    await expect(page.getByRole('status').filter({ hasText: 'Sua conta está inativa' })).toBeVisible();
    await semViolacoesGraves(page);

    const novoEmail = `ana.${sufixo()}@${b.faculdade.dominio}`;
    await page.getByLabel('E-mail institucional da nova faculdade').fill(novoEmail);
    await page.getByRole('button', { name: 'Enviar link de confirmação' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Enviamos um link' })).toBeVisible();

    const mensagem = await api.ultimoEmailPara(novoEmail, { assunto: /novo e-mail institucional/ });
    await page.goto(await api.linkDoEmail(mensagem.ID));
    await page.getByLabel('Curso').selectOption({ label: b.curso.nome });
    await page.getByLabel('Turma (ano/período de ingresso)').selectOption({ label: '2025/1' });
    await page.getByLabel('Semestre atual').selectOption('4');
    await page.getByRole('button', { name: 'Confirmar troca' }).click();
    await expect(page).toHaveURL(/\/aluno$/);

    await page.goto('/aluno/perfil');
    await expect(page.getByLabel('E-mail institucional')).toHaveValue(novoEmail);
  });
});
