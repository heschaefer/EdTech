import { expect, semViolacoesGraves, test } from '../fixtures';

const CURRICULO = {
  objetivo: 'Desenvolvedor back-end',
  links: [],
  habilidadesTecnicas: ['TypeScript', 'PostgreSQL'],
  habilidadesComportamentais: [],
  disponibilidade: [],
  formacoes: [],
  experiencias: [],
  cursos: [],
  idiomas: [],
  projetos: [],
};

test.describe('Candidatos da empresa @empresa', () => {
  test('EMP-08 lista candidatos com contagem por etapa; aluno desligado aparece como inativo, sem perfil', async ({ page, api, entrarComo, sessao }) => {
    const a = await api.cenario({ comCandidatura: true });
    const b = await api.cenario();
    const alunoB = await sessao(b.aluno);
    expect((await alunoB.post(`/vagas/${a.vaga.id}/candidaturas`)).status()).toBe(201);
    const facB = await sessao(b.faculdade);
    expect((await facB.patch(`/faculdade/alunos/${b.aluno.id}/status`, { status: 'INATIVO', motivo: 'Trancou a matrícula' })).ok()).toBeTruthy();

    await entrarComo(a.empresa);
    await page.goto(`/empresa/vagas/${a.vaga.id}`);
    await page.getByRole('link', { name: 'Ver candidatos (1)' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(a.vaga.funcao);
    await semViolacoesGraves(page);

    const etapas = page.getByRole('list', { name: 'Candidatos em processo por etapa' }).getByRole('listitem');
    await expect(etapas.nth(0)).toHaveText(/Inscrição recebida\s*1$/);
    await expect(etapas.nth(1)).toHaveText(/Entrevista\s*0$/);

    const inativo = page.getByRole('row', { name: new RegExp(b.aluno.nome) });
    await expect(inativo).toContainText('Aluno inativo');
    await expect(inativo.getByRole('link')).toHaveCount(0);
    await expect(page.getByRole('row', { name: new RegExp(a.aluno.nome) }).getByRole('link', { name: a.aluno.nome })).toBeVisible();

    // Filtros: status e etapa.
    await page.getByLabel('Status', { exact: true }).selectOption({ label: 'Em processo' });
    await expect(page.getByRole('row', { name: new RegExp(b.aluno.nome) })).toHaveCount(0);
    await page.getByLabel('Etapa', { exact: true }).selectOption({ label: 'Entrevista' });
    await expect(page.getByText('Nenhum candidato encontrado.')).toBeVisible();
  });

  test('EMP-09 abre o perfil do candidato com o currículo atual e sem CPF @smoke', async ({ page, api, entrarComo, sessao }) => {
    const c = await api.cenario({ comCandidatura: true });
    const aluno = await sessao(c.aluno);
    expect((await aluno.patch('/alunos/me', { telefone: '11987654321' })).ok()).toBeTruthy();
    expect((await aluno.put('/alunos/me/curriculo', CURRICULO)).ok()).toBeTruthy();

    await entrarComo(c.empresa);
    await page.goto(`/empresa/vagas/${c.vaga.id}/candidatos`);
    await page.getByRole('link', { name: c.aluno.nome }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.aluno.nome);
    await semViolacoesGraves(page);
    await expect(page.getByText(c.aluno.email)).toBeVisible();
    await expect(page.getByText('(11) 98765-4321')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Currículo' })).toBeVisible();
    // D4: a versão atual do currículo.
    await expect(page.getByText('Desenvolvedor back-end')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Habilidades' })).toContainText('TypeScript');
    const corpo = await page.locator('body').innerText();
    expect(corpo).not.toContain(c.aluno.cpf);
    expect(corpo).not.toMatch(/CPF/i);
  });

  test('EMP-10 move o candidato de etapa e marca não selecionado; o aluno é avisado', async ({ page, api, entrarComo }) => {
    const c = await api.cenario({ comCandidatura: true });
    await entrarComo(c.empresa);
    await page.goto(`/empresa/candidaturas/${c.candidaturaId}`);

    await page.getByLabel('Mover para a etapa').selectOption({ label: '2. Entrevista' });
    await page.getByRole('button', { name: 'Mover' }).click();
    await expect(page.getByRole('status')).toHaveText('Candidato movido para Entrevista. O aluno foi avisado.');
    await expect(page.getByRole('list', { name: 'Linha do tempo' })).toContainText('Mudança de etapa: Entrevista');

    await api.rodarJob('enviar-emails');
    const email = await api.ultimoEmailPara(c.aluno.email, { assunto: /avançou/ });
    expect(email.Subject).toContain('Entrevista');

    await page.getByRole('button', { name: 'Não selecionar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByRole('status')).toHaveText('Candidatura finalizada como não selecionada. O aluno foi avisado.');
    await expect(page.getByRole('button', { name: 'Não selecionar' })).toHaveCount(0);
    await expect(page.getByLabel('Mover para a etapa')).toHaveCount(0);

    await api.rodarJob('enviar-emails');
    expect((await api.ultimoEmailPara(c.aluno.email, { assunto: /encerrada/ })).Subject).toContain(c.vaga.funcao);
  });

  test('EMP-11 encerra a vaga escolhendo os selecionados, revisa o resumo e todos recebem a devolutiva @smoke', async ({ page, api, entrarComo, sessao }) => {
    const a = await api.cenario({ comCandidatura: true });
    const b = await api.cenario();
    const alunoB = await sessao(b.aluno);
    expect((await alunoB.post(`/vagas/${a.vaga.id}/candidaturas`)).status()).toBe(201);

    await entrarComo(a.empresa);
    await page.goto(`/empresa/vagas/${a.vaga.id}`);
    await page.getByRole('link', { name: 'Encerrar vaga' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Encerrar vaga');
    await page.getByRole('checkbox', { name: `Selecionar ${b.aluno.nome}` }).check();
    await page.getByRole('button', { name: 'Revisar encerramento' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Resumo do encerramento');
    await semViolacoesGraves(page);
    await expect(page.getByRole('list', { name: 'Selecionados', exact: true })).toHaveText(b.aluno.nome);
    await expect(page.getByRole('list', { name: 'Não selecionados' })).toHaveText(a.aluno.nome);
    await page.getByRole('button', { name: 'Confirmar encerramento' }).click();

    await expect(page).toHaveURL(new RegExp(`/empresa/vagas/${a.vaga.id}\\?encerrada=1`));
    await expect(page.getByRole('status').filter({ hasText: 'Vaga encerrada' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Encerrar vaga' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0);

    await api.rodarJob('enviar-emails');
    expect((await api.ultimoEmailPara(b.aluno.email, { assunto: /selecionado/ })).Subject).toContain(a.vaga.funcao);
    expect((await api.ultimoEmailPara(a.aluno.email, { assunto: /encerrada/ })).Subject).toContain(a.vaga.funcao);
    const historicoB = await (await alunoB.get('/alunos/me/candidaturas?aba=historico')).json();
    expect(historicoB.data[0]).toMatchObject({ status: 'SELECIONADO' });
  });
});
