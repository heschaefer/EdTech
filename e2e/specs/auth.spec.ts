import { alerta, expect, semViolacoesGraves, test } from '../fixtures';

test.describe('Autenticação', () => {
  test('AUTH-01 login pela tela leva ao painel do papel @smoke', async ({ page, api }) => {
    const { aluno } = await api.cenario();
    await page.goto('/login');
    await semViolacoesGraves(page);
    await page.getByLabel('E-mail').fill(aluno.email);
    await page.getByLabel('Senha').fill(aluno.senha);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/aluno/);
    await expect(page.getByText(aluno.nome)).toBeVisible();
  });

  test('AUTH-01 senha errada mostra a mensagem genérica', async ({ page, api }) => {
    const { aluno } = await api.cenario();
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(aluno.email);
    await page.getByLabel('Senha').fill('Errada@123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(alerta(page, 'E-mail ou senha inválidos')).toBeVisible();
  });

  test('AUTH-01 admin informa o código do autenticador @admin', async ({ page, api }) => {
    const admin = await api.admin();
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(admin.email);
    await page.getByLabel('Senha').fill(admin.senha);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(alerta(page, 'código do autenticador')).toBeVisible();
    await page.getByLabel('Código do autenticador').fill(admin.codigo());
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/admin\/faculdades/);
  });

  test('AUTH-01 rota de outro papel redireciona para o próprio painel', async ({ page, api, entrarComo }) => {
    const { aluno } = await api.cenario();
    await entrarComo(aluno);
    await page.goto('/admin/faculdades');
    await expect(page).toHaveURL(/\/aluno$/);
  });

  test('AUTH-02 access token expirado é renovado pelo refresh sem pedir a senha', async ({ page, context, api, entrarComo }) => {
    const { aluno } = await api.cenario();
    await entrarComo(aluno);
    await context.clearCookies({ name: 'at' });
    await page.goto('/aluno');
    // O middleware manda para o login, que renova a sessão e volta.
    await expect(page).toHaveURL(/\/aluno$/);
    await expect(page.getByText(aluno.nome)).toBeVisible();
  });

  test('AUTH-03 sair revoga a sessão e volta ao login', async ({ page, api, entrarComo }) => {
    const { aluno } = await api.cenario();
    await entrarComo(aluno);
    await page.goto('/aluno');
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/aluno');
    await expect(page).toHaveURL(/\/login\?next=%2Faluno/);
  });

  test('AUTH-04 redefine a senha pelo link do e-mail', async ({ page, api }) => {
    const { aluno } = await api.cenario();
    await page.goto('/senha/esqueci');
    await page.getByLabel('E-mail').fill(aluno.email);
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await expect(page.getByRole('status')).toContainText('Se o e-mail estiver cadastrado');

    const email = await api.ultimoEmailPara(aluno.email, { assunto: /Redefinição/ });
    await page.goto(await api.linkDoEmail(email.ID));
    await page.getByLabel('Nova senha').fill('abc');
    await page.getByRole('button', { name: 'Salvar senha' }).click();
    await expect(page.getByText('Ao menos 1 letra maiúscula')).toBeVisible();
    await page.getByLabel('Nova senha').fill('Nova#Senha2026');
    await page.getByLabel('Confirmação da senha').fill('Nova#Senha2026');
    await page.getByRole('button', { name: 'Salvar senha' }).click();
    await expect(page.getByRole('status')).toContainText('Senha alterada');

    const res = await page.request.post('/api/v1/auth/login', { data: { email: aluno.email, senha: 'Nova#Senha2026' } });
    expect(res.status()).toBe(200);
  });
});
