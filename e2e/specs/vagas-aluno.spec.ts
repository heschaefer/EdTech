import { expect, semViolacoesGraves, test } from '../fixtures';

test.describe('Vagas do aluno @aluno', () => {
  test('ALU-05 vaga de outra área não aparece nem abre pela URL @aluno', async ({ page, api, entrarComo }) => {
    const { aluno, vaga } = await api.cenario({ areaCurso: 'Direito', areasVaga: ['Tecnologia'] });
    await entrarComo(aluno);

    await page.goto('/aluno/vagas');
    await expect(page.getByRole('link', { name: vaga.funcao })).toHaveCount(0);
    expect((await page.request.get(`/api/v1/vagas/${vaga.id}`)).status()).toBe(404);
  });

  test('ALU-05 filtros ficam na URL e voltam ao recarregar; vaga candidatada tem selo @smoke', async ({ page, api, entrarComo }) => {
    const { aluno, vaga } = await api.cenario({ comCandidatura: true });
    await entrarComo(aluno);
    await page.goto('/aluno/vagas');
    await semViolacoesGraves(page);
    const card = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: vaga.funcao }) });
    await expect(card).toContainText('Candidatado');

    await page.getByLabel('Tipo').selectOption({ label: 'Estágio' });
    await page.getByLabel('Publicadas nos últimos').selectOption('7');
    await page.getByLabel('Função ou empresa').fill(vaga.funcao);
    await expect(page).toHaveURL(/tipo=ESTAGIO/);
    await expect(page).toHaveURL(/dias=7/);
    await expect(page).toHaveURL(/q=/);
    await expect(page.getByRole('link', { name: vaga.funcao })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Tipo')).toHaveValue('ESTAGIO');
    await expect(page.getByLabel('Função ou empresa')).toHaveValue(vaga.funcao);
    await expect(page.getByRole('link', { name: vaga.funcao })).toBeVisible();

    // Abrir o detalhe e voltar mantém os filtros.
    await page.getByRole('link', { name: vaga.funcao }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(vaga.funcao);
    await page.goBack();
    await expect(page.getByLabel('Publicadas nos últimos')).toHaveValue('7');
    await expect(page.getByRole('link', { name: vaga.funcao })).toBeVisible();

    await page.getByLabel('Tipo').selectOption({ label: 'CLT' });
    await expect(page.getByRole('link', { name: vaga.funcao })).toHaveCount(0);
  });

  test('ALU-06 detalhe mostra os campos e as etapas', async ({ page, api, entrarComo }) => {
    const { aluno, vaga } = await api.cenario();
    await entrarComo(aluno);
    await page.goto('/aluno/vagas');
    await page.getByRole('link', { name: vaga.funcao }).click();
    await semViolacoesGraves(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(vaga.funcao);
    for (const titulo of ['Atividades do dia a dia', 'O que se espera', 'Benefícios', 'Cultura da empresa', 'Processo seletivo', 'Etapas']) {
      await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
    }
    await expect(page.getByRole('list', { name: 'Etapas do processo seletivo' }).getByRole('listitem')).toHaveText(['Inscrição recebida', 'Entrevista']);
  });

  test('ALU-06 vaga pausada com candidatura abre em modo somente leitura', async ({ page, api, entrarComo, browser }) => {
    const c = await api.cenario({ comCandidatura: true });
    const emp = await (await browser.newContext()).newPage();
    await emp.request.post('/api/v1/auth/login', { data: { email: c.empresa.email, senha: c.empresa.senha } });
    const csrf = (await emp.context().cookies()).find((x) => x.name === 'csrf')!.value;
    expect((await emp.request.post(`/api/v1/empresa/vagas/${c.vaga.id}/pausar`, { headers: { 'X-CSRF-Token': csrf } })).ok()).toBeTruthy();

    await entrarComo(c.aluno);
    await page.goto(`/aluno/vagas/${c.vaga.id}`);
    await expect(page.getByRole('status').filter({ hasText: 'não está mais aberta' })).toBeVisible();
  });
});
