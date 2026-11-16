import { expect, semViolacoesGraves, test } from '../fixtures';

test.describe('Candidaturas do aluno', () => {
  test('ALU-07 candidata-se a vaga aberta da sua área @aluno @smoke', async ({ page, api, entrarComo }) => {
    const { aluno, vaga } = await api.cenario({ areaCurso: 'Tecnologia', areasVaga: ['Tecnologia'] });
    await entrarComo(aluno);

    await page.goto('/aluno/vagas');
    await page.getByRole('link', { name: vaga.funcao }).click();
    await page.getByRole('button', { name: 'Candidatar-me' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await semViolacoesGraves(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByRole('status')).toHaveText('Candidatura enviada');
    await expect(page.getByRole('button', { name: 'Candidatar-me' })).toHaveCount(0);

    await page.goto('/aluno/candidaturas');
    await semViolacoesGraves(page);
    const linha = page.getByRole('row', { name: new RegExp(vaga.funcao) });
    await expect(linha).toContainText('Em processo');
    await expect(linha).toContainText('Inscrição recebida');
  });

  test('ALU-07 vaga pausada não oferece candidatura e a API responde 409 @aluno', async ({ page, api, entrarComo, sessao }) => {
    const c = await api.cenario();
    const emp = await sessao(c.empresa);
    expect((await emp.post(`/empresa/vagas/${c.vaga.id}/pausar`)).ok()).toBeTruthy();
    await entrarComo(c.aluno);

    const r = await page.request.post(`/api/v1/vagas/${c.vaga.id}/candidaturas`, {
      headers: { 'X-CSRF-Token': (await page.context().cookies()).find((x) => x.name === 'csrf')!.value },
    });
    expect(r.status()).toBe(409);
    expect((await r.json()).detail).toBe('Esta vaga não aceita candidaturas');
  });

  test('ALU-08 remove a candidatura, que vai para o histórico, e se candidata de novo @aluno', async ({ page, api, entrarComo }) => {
    const { aluno, vaga } = await api.cenario({ comCandidatura: true });
    await entrarComo(aluno);

    await page.goto('/aluno/candidaturas');
    await page.getByRole('link', { name: vaga.funcao }).click();
    await page.getByRole('button', { name: 'Remover candidatura' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remover' }).click();
    await expect(page.getByRole('status')).toHaveText('Candidatura removida');
    await expect(page.getByRole('button', { name: 'Remover candidatura' })).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Linha do tempo' })).toContainText('Candidatura cancelada');

    await page.goto('/aluno/candidaturas');
    await expect(page.getByRole('row', { name: new RegExp(vaga.funcao) })).toHaveCount(0);
    await page.getByRole('link', { name: 'Histórico' }).last().click();
    await expect(page).toHaveURL(/aba=historico/);
    await expect(page.getByRole('row', { name: new RegExp(vaga.funcao) })).toContainText('Cancelada');

    // RN-10: com a vaga aberta, a mesma candidatura volta para a primeira etapa.
    await page.goto(`/aluno/vagas/${vaga.id}`);
    await page.getByRole('button', { name: 'Candidatar-me de novo' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByRole('status')).toHaveText('Candidatura enviada');
    await page.goto('/aluno/candidaturas');
    await expect(page.getByRole('row', { name: new RegExp(vaga.funcao) })).toContainText('Inscrição recebida · 1 de 2');
  });

  test('ALU-09 acompanha a etapa atual e a linha do tempo @aluno', async ({ page, api, entrarComo, sessao }) => {
    const c = await api.cenario({ comCandidatura: true });
    const emp = await sessao(c.empresa);
    const { etapas } = await (await emp.get(`/empresa/vagas/${c.vaga.id}`)).json();
    expect((await emp.patch(`/empresa/candidaturas/${c.candidaturaId}/etapa`, { etapaId: etapas[1].id })).ok()).toBeTruthy();

    await entrarComo(c.aluno);
    await page.goto('/aluno/candidaturas');
    const linha = page.getByRole('row', { name: new RegExp(c.vaga.funcao) });
    await expect(linha).toContainText('Entrevista · 2 de 2');
    await expect(linha).toContainText(/Empresa Teste/);

    await linha.getByRole('link').click();
    await semViolacoesGraves(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.vaga.funcao);
    await expect(page.getByRole('list', { name: 'Linha do tempo' }).getByRole('listitem')).toHaveCount(2);
    await expect(page.getByRole('list', { name: 'Linha do tempo' })).toContainText('Mudança de etapa: Entrevista');
    await expect(page.locator('[aria-current="step"]')).toContainText('Entrevista');
  });

  test('ALU-10 histórico lista as finalizadas e filtra por status @aluno', async ({ page, api, entrarComo, sessao }) => {
    const c = await api.cenario({ comCandidatura: true });
    const emp = await sessao(c.empresa);
    expect((await emp.post(`/empresa/candidaturas/${c.candidaturaId}/nao-selecionar`)).ok()).toBeTruthy();

    await entrarComo(c.aluno);
    await page.goto('/aluno/candidaturas?aba=historico');
    await semViolacoesGraves(page);
    await expect(page.getByRole('row', { name: new RegExp(c.vaga.funcao) })).toContainText('Não selecionado');

    await page.getByLabel('Filtrar por status').selectOption({ label: 'Cancelada' });
    await expect(page).toHaveURL(/status=CANCELADA/);
    await expect(page.getByRole('row', { name: new RegExp(c.vaga.funcao) })).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel('Filtrar por status')).toHaveValue('CANCELADA');

    await page.getByLabel('Filtrar por status').selectOption({ label: 'Não selecionado' });
    await expect(page.getByRole('row', { name: new RegExp(c.vaga.funcao) })).toBeVisible();
  });
});
