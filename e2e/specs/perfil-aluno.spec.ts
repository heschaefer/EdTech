import { expect, semViolacoesGraves, test } from '../fixtures';

test.describe('Perfil do aluno @aluno', () => {
  test('ALU-02 edita nome e telefone; CPF mascarado e e-mail só leitura', async ({ page, api, entrarComo }) => {
    const { aluno } = await api.cenario();
    await entrarComo(aluno);
    await page.goto('/aluno/perfil');
    await semViolacoesGraves(page);
    await expect(page.getByLabel('CPF')).toHaveValue(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
    await expect(page.getByLabel('E-mail institucional')).toHaveAttribute('readonly', '');

    await page.getByLabel('Nome completo').fill('Ana Paula Souza');
    await page.getByRole('button', { name: 'Salvar dados pessoais' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Dados pessoais salvos.' })).toBeVisible();
    await expect(page.getByRole('banner')).toContainText('Ana Paula Souza');
  });

  test('ALU-02 trocar a senha exige a senha atual', async ({ page, api, entrarComo }) => {
    const { aluno } = await api.cenario();
    await entrarComo(aluno);
    await page.goto('/aluno/perfil');
    await page.getByLabel('Senha atual').fill('Errada#123');
    await page.getByLabel('Nova senha', { exact: true }).fill('Nova#Senha2026');
    await page.getByLabel('Confirmação da nova senha').fill('Nova#Senha2026');
    await page.getByRole('button', { name: 'Trocar senha' }).click();
    await expect(page.getByText('Senha atual incorreta')).toBeVisible();

    await page.getByLabel('Senha atual').fill(aluno.senha);
    await page.getByRole('button', { name: 'Trocar senha' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Senha alterada' })).toBeVisible();
    // Esta sessão continua válida.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
  });

  test('ALU-03 troca o semestre e a turma dentro da própria faculdade', async ({ page, api, entrarComo }) => {
    const { aluno } = await api.cenario();
    await entrarComo(aluno);
    await page.goto('/aluno/perfil');
    await page.getByLabel('Semestre atual').selectOption('5');
    await page.getByRole('button', { name: 'Salvar vínculo' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Vínculo acadêmico atualizado.' })).toBeVisible();
    await expect(page.getByText('5º semestre').first()).toBeVisible();
  });

  test('ALU-04 preenche o currículo e a versão salva volta ao recarregar', async ({ page, api, entrarComo }) => {
    const { aluno } = await api.cenario();
    await entrarComo(aluno);
    await page.goto('/aluno/curriculo');
    await semViolacoesGraves(page);
    await expect(page.getByText(aluno.email)).toBeVisible();
    await expect(page.getByText(/previsão de conclusão 2028\/2/)).toBeVisible();

    await page.getByLabel('Objetivo profissional').fill('Estágio em back-end');
    await page.getByLabel('Habilidades técnicas (separe por vírgula)').fill('TypeScript, SQL');
    await page.getByRole('button', { name: 'Adicionar experiência' }).click();
    await page.getByLabel('Tipo da experiência 1').selectOption({ label: 'Monitoria' });
    await page.getByLabel('Organização da experiência 1').fill('Universidade');
    await page.getByLabel('Cargo da experiência 1').fill('Monitora de Cálculo');
    await page.getByLabel('Início da experiência 1').fill('2025-03-01');
    await page.getByRole('button', { name: 'Adicionar link' }).click();
    await page.getByLabel('Endereço do link 1').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Salvar currículo' }).click();
    await expect(page.getByText('Use um endereço http(s)').or(page.getByText('URL inválida'))).toBeVisible();

    await page.getByLabel('Endereço do link 1').fill('https://www.linkedin.com/in/ana');
    await page.getByLabel('Tarde').check();
    await page.getByRole('button', { name: 'Salvar currículo' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Currículo salvo' })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Objetivo profissional')).toHaveValue('Estágio em back-end');
    await expect(page.getByLabel('Cargo da experiência 1')).toHaveValue('Monitora de Cálculo');
    await expect(page.getByLabel('Tarde')).toBeChecked();
  });
});
