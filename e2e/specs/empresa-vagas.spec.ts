import { expect, semViolacoesGraves, test } from '../fixtures';
import { diasAFrente, sufixo } from '../helpers';

test.describe('Vagas da empresa @empresa', () => {
  test('EMP-03 publica vaga presencial com cidade da empresa, etapas e áreas; o aluno da área a vê @smoke', async ({ page, api, entrarComo, browser }) => {
    const c = await api.cenario({ areaCurso: 'Tecnologia' });
    await entrarComo(c.empresa);
    const funcao = `Estágio em dados ${sufixo()}`;
    await page.goto('/empresa/vagas');
    await page.getByRole('link', { name: 'Nova vaga' }).click();
    await semViolacoesGraves(page);

    await page.getByLabel('Função').fill(funcao);
    await expect(page.getByLabel('Cidade da vaga')).toHaveValue('São Paulo');
    await page.getByLabel('Tecnologia').check();
    await page.getByLabel('Prazo para candidaturas').fill(diasAFrente(-1));
    await page.getByLabel('Atividades do dia a dia').fill('Montar painéis e pipelines.');
    await page.getByLabel('O que se espera (formação, experiência)').fill('SQL básico.');
    await page.getByLabel('Benefícios').fill('VR e VT.');
    await page.getByLabel('Cultura da empresa').fill('Remota primeiro.');
    await page.getByLabel('Salário mínimo (R$)').fill('1800');
    await page.getByLabel('Salário máximo (R$)').fill('2200');
    await page.getByLabel('Como funciona o processo seletivo').fill('Triagem, entrevista e teste.');
    await page.getByRole('button', { name: 'Adicionar etapa' }).click();
    await page.getByLabel('Etapa 3', { exact: true }).fill('Teste técnico');
    await page.getByRole('button', { name: 'Subir etapa 3' }).click();
    await page.getByRole('button', { name: 'Publicar vaga' }).click();
    // RN-11: prazo no passado.
    await expect(page.getByText('O prazo precisa ser uma data futura')).toBeVisible();

    await page.getByLabel('Prazo para candidaturas').fill(diasAFrente(20));
    await page.getByRole('button', { name: 'Publicar vaga' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Vaga publicada' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(funcao);
    await expect(page.getByRole('listitem').filter({ hasText: 'Teste técnico' })).toBeVisible();

    const aluno = await (await browser.newContext()).newPage();
    await aluno.request.post('/api/v1/auth/login', { data: { email: c.aluno.email, senha: c.aluno.senha } });
    await aluno.goto('/aluno/vagas');
    await expect(aluno.getByRole('link', { name: funcao })).toBeVisible();
  });

  test('EMP-04 edita a vaga; edição concorrente recebe aviso de versão', async ({ page, api, entrarComo, browser }) => {
    const c = await api.cenario();
    await entrarComo(c.empresa);
    await page.goto(`/empresa/vagas/${c.vaga.id}`);
    await page.getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Função').fill('Estágio editado');

    // Outra sessão da mesma empresa salva antes.
    const outra = await (await browser.newContext()).newPage();
    await outra.request.post('/api/v1/auth/login', { data: { email: c.empresa.email, senha: c.empresa.senha } });
    await outra.goto(`/empresa/vagas/${c.vaga.id}`);
    await outra.getByRole('button', { name: 'Editar' }).click();
    await outra.getByLabel('Benefícios').fill('Plano de saúde');
    await outra.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(outra.getByRole('status').filter({ hasText: 'Alterações salvas.' })).toBeVisible();

    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'alterada por outra pessoa' })).toBeVisible();
    await page.getByRole('button', { name: 'Recarregar a versão atual' }).click();
    await page.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByLabel('Benefícios')).toHaveValue('Plano de saúde');
    await page.getByLabel('Função').fill('Estágio editado');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Estágio editado');
  });

  test('EMP-05 pausar tira a vaga da lista do aluno; reativar devolve', async ({ page, api, entrarComo, browser }) => {
    const c = await api.cenario();
    await entrarComo(c.empresa);
    await page.goto(`/empresa/vagas/${c.vaga.id}`);
    await page.getByRole('button', { name: 'Pausar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Vaga pausada' })).toBeVisible();

    const aluno = await (await browser.newContext()).newPage();
    await aluno.request.post('/api/v1/auth/login', { data: { email: c.aluno.email, senha: c.aluno.senha } });
    await aluno.goto('/aluno/vagas');
    await expect(aluno.getByRole('link', { name: c.vaga.funcao })).toHaveCount(0);

    await page.getByRole('button', { name: 'Reativar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Vaga reativada.' })).toBeVisible();
    await aluno.reload();
    await expect(aluno.getByRole('link', { name: c.vaga.funcao })).toBeVisible();
  });

  test('EMP-06 vaga sem candidatura pode ser excluída; com candidatura o botão não aparece', async ({ page, api, entrarComo }) => {
    const comCand = await api.cenario({ comCandidatura: true });
    await entrarComo(comCand.empresa);
    await page.goto(`/empresa/vagas/${comCand.vaga.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Excluir' })).toHaveCount(0);

    const semCand = await api.cenario();
    await entrarComo(semCand.empresa);
    await page.goto(`/empresa/vagas/${semCand.vaga.id}`);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Excluir' }).click();
    await expect(page).toHaveURL(/\/empresa\/vagas$/);
    await expect(page.getByRole('link', { name: semCand.vaga.funcao })).toHaveCount(0);
  });

  test('EMP-07 prorroga o prazo; prazo além de 1 ano é recusado', async ({ page, api, entrarComo }) => {
    const c = await api.cenario();
    await entrarComo(c.empresa);
    await page.goto(`/empresa/vagas/${c.vaga.id}`);
    await page.getByLabel('Novo prazo').fill(diasAFrente(400));
    await page.getByRole('button', { name: 'Prorrogar' }).click();
    await expect(page.getByRole('alert').filter({ hasText: '1 ano' })).toBeVisible();
    const novo = diasAFrente(45);
    await page.getByLabel('Novo prazo').fill(novo);
    await page.getByRole('button', { name: 'Prorrogar' }).click();
    await expect(page.getByRole('status').filter({ hasText: `Prazo prorrogado para ${novo.split('-').reverse().join('/')}` })).toBeVisible();
  });
});
