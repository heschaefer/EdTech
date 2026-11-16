import { expect, semViolacoesGraves, test } from '../fixtures';

const horasAtras = (h: number) => new Date(Date.now() - h * 3600_000);

test.describe('Ciclo de vida da vaga @jobs', () => {
  test('JOB-01 JOB-02 vaga sem ação encerra 72 h após o prazo e avisa o aluno @jobs', async ({ page, api, entrarComo }) => {
    const { aluno, vaga } = await api.cenario({ comCandidatura: true });

    await api.moverPrazo(vaga.id, horasAtras(1));
    await api.rodarJob('expirar-prazos', vaga.id);
    await api.moverPrazo(vaga.id, horasAtras(73));
    await api.rodarJob('encerrar-automatico', vaga.id);
    await api.rodarJob('enviar-emails');

    await entrarComo(aluno);
    await page.goto('/aluno/candidaturas?aba=historico');
    await expect(page.getByRole('row', { name: new RegExp(vaga.funcao) })).toContainText('Não selecionado');
    expect((await api.ultimoEmailPara(aluno.email, { assunto: /encerrada/ })).Subject).toContain('encerrada');
  });

  test('JOB-01 EMP-12 prazo vencido: a empresa é avisada com os atalhos e prorroga pela notificação @jobs @empresa', async ({ page, api, entrarComo }) => {
    const c = await api.cenario({ comCandidatura: true });
    await api.moverPrazo(c.vaga.id, horasAtras(1));
    await api.rodarJob('expirar-prazos', c.vaga.id);

    await entrarComo(c.empresa);
    await page.goto('/empresa/vagas');
    await expect(page.getByRole('link', { name: 'Notificações: 1 não lida' })).toBeVisible();
    await page.getByRole('link', { name: 'Notificações: 1 não lida' }).click();
    await semViolacoesGraves(page);
    const aviso = page.getByRole('list', { name: 'Notificações' }).getByRole('listitem').filter({ hasText: `Prazo vencido: ${c.vaga.funcao}` });
    await expect(aviso).toContainText('encerrada automaticamente em');
    await expect(aviso.getByRole('link', { name: /^Encerrar/ })).toHaveAttribute('href', `/empresa/vagas/${c.vaga.id}/encerrar`);

    await aviso.getByRole('link', { name: /^Prorrogar/ }).click();
    await expect(page).toHaveURL(new RegExp(`/empresa/vagas/${c.vaga.id}#prorrogar`));
    await expect(page.getByRole('alert').filter({ hasText: 'O prazo venceu' })).toBeVisible();
    await expect(page.getByLabel('Novo prazo')).toBeFocused();
    const novo = new Date(Date.now() + 15 * 24 * 3600_000).toISOString().slice(0, 10);
    await page.getByLabel('Novo prazo').fill(novo);
    await page.getByRole('button', { name: 'Prorrogar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Prazo prorrogado' })).toBeVisible();
    await expect(page.getByText('Aberta', { exact: true })).toBeVisible();
    // Abrir pelo atalho marcou a notificação como lida.
    await expect(page.getByRole('link', { name: 'Notificações', exact: true })).toBeVisible();
  });

  test('JOB-03 a empresa recebe o lembrete 24 h antes do encerramento automático, uma única vez @jobs', async ({ page, api, entrarComo }) => {
    const c = await api.cenario();
    await api.moverPrazo(c.vaga.id, horasAtras(1));
    await api.rodarJob('expirar-prazos', c.vaga.id);
    await api.moverPrazo(c.vaga.id, horasAtras(49));
    await api.rodarJob('lembrete', c.vaga.id);
    await api.rodarJob('lembrete', c.vaga.id);
    await api.rodarJob('enviar-emails');

    await entrarComo(c.empresa);
    await page.goto('/empresa/notificacoes');
    const lista = page.getByRole('list', { name: 'Notificações' });
    await expect(lista.getByRole('listitem').filter({ hasText: `Lembrete: ${c.vaga.funcao}` })).toHaveCount(1);
    await expect(lista.getByRole('listitem')).toHaveCount(2); // prazo vencido + lembrete
    expect((await api.ultimoEmailPara(c.empresa.email, { assunto: /Lembrete/ })).Subject).toContain('será encerrada em 24 h');
  });
});
