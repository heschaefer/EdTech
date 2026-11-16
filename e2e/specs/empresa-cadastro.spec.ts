import { expect, semViolacoesGraves, test } from '../fixtures';
import { cnpjValido, SENHA_PADRAO, sufixo } from '../helpers';

test.describe('Cadastro da empresa @empresa', () => {
  test('EMP-01 cadastro com ViaCEP, verificação do e-mail e aviso "Cadastro em análise" @smoke', async ({ page, api }) => {
    // ViaCEP simulado: o teste não depende da rede externa.
    await page.route('https://viacep.com.br/ws/**', (rota) =>
      rota.fulfill({ json: { cep: '01310-100', logradouro: 'Avenida Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP' } }),
    );
    const s = sufixo();
    const email = `rh@nuvem${s}.com.br`;
    await page.goto('/login');
    await page.getByRole('link', { name: 'Sou empresa e quero publicar vagas' }).click();
    await semViolacoesGraves(page);

    await page.getByLabel('Razão social').fill(`Nuvem ${s} Tecnologia LTDA`);
    await page.getByLabel('Nome fantasia').fill(`Nuvem ${s}`);
    await page.getByLabel('CNPJ').fill(cnpjValido());
    await page.getByLabel('Ramo de atuação').fill('Software');
    await page.getByLabel('Telefone').fill('1133334444');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(SENHA_PADRAO);
    await page.getByLabel('Confirmação da senha').fill(SENHA_PADRAO);
    await page.getByLabel('CEP').fill('01310100');
    await page.getByLabel('CEP').blur();
    // Preenchidos pelo CEP e ainda editáveis.
    await expect(page.getByLabel('Logradouro')).toHaveValue('Avenida Paulista');
    await expect(page.getByLabel('Bairro')).toHaveValue('Bela Vista');
    await expect(page.getByLabel('Cidade')).toHaveValue('São Paulo');
    await expect(page.getByLabel('UF')).toHaveValue('SP');
    await page.getByLabel('Logradouro').fill('Av. Paulista');
    await page.getByLabel('Número').fill('1000');
    await page.getByRole('button', { name: 'Criar conta da empresa' }).click();
    await expect(page.getByRole('status')).toContainText(`Enviamos um link de verificação para ${email}`);

    const mensagem = await api.ultimoEmailPara(email, { assunto: /Confirme seu e-mail/ });
    await page.goto(await api.linkDoEmail(mensagem.ID));
    await expect(page.getByRole('status')).toContainText('E-mail confirmado');

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(SENHA_PADRAO);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/empresa\/vagas/);
    await expect(page.getByRole('status').filter({ hasText: 'Cadastro em análise' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nova vaga' })).toHaveCount(0);
  });

  test('EMP-01 CNPJ inválido dá erro no campo', async ({ page }) => {
    await page.goto('/cadastro/empresa');
    await page.getByLabel('CNPJ').fill('11222333000182');
    await page.getByRole('button', { name: 'Criar conta da empresa' }).click();
    await expect(page.getByText('CNPJ inválido')).toBeVisible();
  });

  test('EMP-02 edita o perfil; o CNPJ fica só para leitura', async ({ page, api, entrarComo }) => {
    const { empresa } = await api.cenario();
    await entrarComo(empresa);
    await page.goto('/empresa/perfil');
    await semViolacoesGraves(page);
    await expect(page.getByLabel('CNPJ')).toHaveAttribute('readonly', '');
    await page.getByLabel('Nome fantasia').fill('Nuvem Azul Renovada');
    await page.getByLabel('Complemento (opcional)').fill('Conj. 42');
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Perfil salvo.' })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Complemento (opcional)')).toHaveValue('Conj. 42');
  });
});
