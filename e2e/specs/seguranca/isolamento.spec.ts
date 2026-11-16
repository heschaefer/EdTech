import { expect, test } from '../../fixtures';

test.describe('Isolamento entre empresas e minimização de dados @seguranca', () => {
  test('SEG-02 empresa não acessa candidato, vaga ou candidatura de outra empresa @seguranca', async ({ api, sessao }) => {
    const a = await api.cenario({ comCandidatura: true });
    const b = await api.cenario();
    const empresaA = await sessao(a.empresa);
    const { etapas } = await (await empresaA.get(`/empresa/vagas/${a.vaga.id}`)).json();
    const empresaB = await sessao(b.empresa);

    expect((await empresaB.get(`/empresa/candidaturas/${a.candidaturaId}`)).status()).toBe(404);
    expect((await empresaB.get(`/empresa/vagas/${a.vaga.id}`)).status()).toBe(404);
    expect((await empresaB.get(`/empresa/vagas/${a.vaga.id}/candidaturas`)).status()).toBe(404);
    expect((await empresaB.patch(`/empresa/candidaturas/${a.candidaturaId}/etapa`, { etapaId: etapas[1].id })).status()).toBe(404);
    expect((await empresaB.post(`/empresa/candidaturas/${a.candidaturaId}/nao-selecionar`)).status()).toBe(404);
    // Nada mudou para a empresa dona.
    const lista = await (await empresaA.get(`/empresa/vagas/${a.vaga.id}/candidaturas`)).json();
    expect(lista.data).toEqual([expect.objectContaining({ id: a.candidaturaId, status: 'EM_PROCESSO', etapa: expect.objectContaining({ nome: 'Inscrição recebida' }) })]);
  });

  test('SEG-09 nenhuma resposta da API para a empresa contém o CPF (corpo inteiro) @seguranca', async ({ page, api, entrarComo }) => {
    const c = await api.cenario({ comCandidatura: true });
    const cpf = c.aluno.cpf;
    const formas = [cpf, `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`, `${cpf.slice(3, 6)}.${cpf.slice(6, 9)}`];
    const pendentes: Promise<string>[] = [];
    page.on('response', (r) => {
      if (r.url().includes('/api/v1/') && r.request().resourceType() === 'fetch') pendentes.push(r.text().catch(() => ''));
    });

    await entrarComo(c.empresa);
    await page.goto(`/empresa/vagas/${c.vaga.id}`);
    await page.getByRole('link', { name: /Ver candidatos/ }).click();
    await page.getByRole('link', { name: c.aluno.nome }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.aluno.nome);
    await page.getByLabel('Mover para a etapa').selectOption({ label: '2. Entrevista' });
    await page.getByRole('button', { name: 'Mover' }).click();
    await expect(page.getByRole('status')).toContainText('Candidato movido');

    const corpos = await Promise.all(pendentes);
    expect(corpos.length).toBeGreaterThanOrEqual(4);
    for (const corpo of corpos) {
      expect(corpo).not.toMatch(/cpf/i);
      for (const f of formas) expect(corpo).not.toContain(f);
    }
  });
});
