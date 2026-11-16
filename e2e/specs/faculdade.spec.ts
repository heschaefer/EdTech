import { alerta, expect, semViolacoesGraves, test } from '../fixtures';

const sufixo = () => Math.random().toString(36).slice(2, 7);

test.describe('Faculdade @faculdade', () => {
  test('FAC-02 edita os dados cadastrais; CNPJ e domínios só para leitura', async ({ page, api, entrarComo }) => {
    const { faculdade } = await api.cenario();
    await entrarComo(faculdade);
    await page.goto('/faculdade/perfil');
    await semViolacoesGraves(page);
    await expect(page.getByText(faculdade.dominio)).toBeVisible();
    await expect(page.getByLabel('CNPJ')).toHaveCount(0);

    await page.getByLabel('Nome fantasia').fill('Faculdade Renovada');
    await page.getByLabel('Telefone').fill('(11) 98888-7777');
    await page.getByRole('button', { name: 'Salvar dados' }).click();
    await expect(page.getByRole('status')).toHaveText('Dados salvos.');
    await page.reload();
    await expect(page.getByLabel('Nome fantasia')).toHaveValue('Faculdade Renovada');
  });

  test('FAC-03 cria curso com área e duração; os semestres aparecem na grade @smoke', async ({ page, api, entrarComo }) => {
    const { faculdade } = await api.cenario();
    await entrarComo(faculdade);
    const nome = `Direito ${sufixo()}`;
    await page.goto('/faculdade/cursos');
    await semViolacoesGraves(page);
    await page.getByRole('button', { name: 'Novo curso' }).click();
    await page.getByLabel('Nome do curso').fill(nome);
    await page.getByLabel('Área de formação').selectOption({ label: 'Direito' });
    await page.getByLabel('Duração (anos)').fill('5');
    await page.getByLabel('Ementa').fill('Formação jurídica com prática forense.');
    await page.getByRole('button', { name: 'Criar curso' }).click();
    await expect(page.getByRole('status')).toContainText(`Curso ${nome} criado com 10 semestres`);

    await page.getByRole('link', { name: nome }).click();
    await semViolacoesGraves(page);
    await expect(page.getByLabel('Semestre', { exact: true }).locator('option')).toHaveCount(10);
  });

  test('FAC-03 reduzir a duração abaixo do semestre de um aluno é bloqueado; curso com alunos só é inativado', async ({ page, api, entrarComo }) => {
    const { faculdade } = await api.cenario();
    await entrarComo(faculdade);
    await page.goto('/faculdade/cursos');
    await page.getByRole('row').nth(1).getByRole('link').click();

    page.on('dialog', (d) => d.accept());
    await page.getByLabel('Duração (anos)').fill('1');
    await page.getByRole('button', { name: 'Salvar curso' }).click();
    await expect(page.getByText('Há aluno no 3º semestre')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Excluir curso' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Inativar curso' }).click();
    await expect(page.getByRole('status')).toContainText('Curso inativado');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('(inativo)');
  });

  test('FAC-04 cadastra, ordena, edita e remove aulas do semestre', async ({ page, api, entrarComo }) => {
    const { faculdade, curso } = await api.cenario();
    await entrarComo(faculdade);
    await page.goto('/faculdade/cursos');
    await page.getByRole('link', { name: curso.nome }).click();

    await page.getByLabel('Semestre', { exact: true }).selectOption({ index: 1 });
    for (const nome of ['Algoritmos', 'Cálculo II']) {
      await page.getByLabel('Nome da nova aula').fill(nome);
      await page.getByLabel('Ementa da nova aula').fill(`Ementa de ${nome}`);
      await page.getByRole('button', { name: 'Adicionar aula' }).click();
      await expect(page.getByRole('status')).toHaveText(`Aula ${nome} adicionada.`);
    }
    const aulas = page.getByRole('list', { name: 'Aulas do 2º semestre (ano 1)' }).getByRole('listitem');
    await expect(aulas).toHaveCount(2);

    await page.getByRole('button', { name: 'Subir Cálculo II' }).click();
    await expect(aulas.first()).toContainText('1. Cálculo II');

    await page.getByRole('button', { name: 'Editar Algoritmos' }).click();
    await page.getByLabel('Nome da aula').fill('Algoritmos e Estruturas de Dados');
    await page.getByRole('button', { name: 'Salvar aula' }).click();
    await expect(aulas.nth(1)).toContainText('2. Algoritmos e Estruturas de Dados');

    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Remover Cálculo II' }).click();
    await expect(aulas).toHaveCount(1);
    await expect(aulas.first()).toContainText('1. Algoritmos e Estruturas de Dados');
  });

  test('FAC-05 cria turma única por ano e período; turma com alunos só é inativada', async ({ page, api, entrarComo }) => {
    const { faculdade, curso } = await api.cenario();
    await entrarComo(faculdade);
    await page.goto('/faculdade/cursos');
    await page.getByRole('link', { name: curso.nome }).click();

    await page.getByLabel('Ano de ingresso').fill('2026');
    await page.getByLabel('Período de ingresso').selectOption('2');
    await page.getByRole('button', { name: 'Criar turma' }).click();
    await expect(page.getByRole('row', { name: /2026\/2/ })).toBeVisible();

    await page.getByRole('button', { name: 'Criar turma' }).click();
    await expect(alerta(page, 'A turma 2026/2 já existe neste curso')).toBeVisible();

    // A turma 2025/1 do cenário tem um aluno: não há botão de excluir, só inativar.
    const comAluno = page.getByRole('row', { name: /2025\/1/ });
    await expect(comAluno.getByRole('button', { name: /Excluir/ })).toHaveCount(0);
    await comAluno.getByRole('button', { name: /Inativar/ }).click();
    await expect(comAluno).toContainText('Inativa');

    page.on('dialog', (d) => d.accept());
    await page.getByRole('row', { name: /2026\/2/ }).getByRole('button', { name: /Excluir/ }).click();
    await expect(page.getByRole('row', { name: /2026\/2/ })).toHaveCount(0);
  });
});
