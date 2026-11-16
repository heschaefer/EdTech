import { expect, semViolacoesGraves, test } from '../fixtures';
import { cnpjValido, sufixo } from '../helpers';

test.describe('Admin @admin', () => {
  test.beforeEach(async ({ api, entrarComo }) => {
    const admin = await api.admin();
    await entrarComo({ email: admin.email, senha: admin.senha, totp: admin.codigo() });
  });

  test('ADM-01 FAC-01 cria faculdade, convite chega e a faculdade define a senha @smoke', async ({ page, api, browser }) => {
    const s = sufixo();
    const email = `contato@uni${s}.edu.br`;
    await page.goto('/admin/faculdades');
    await semViolacoesGraves(page);
    await page.getByRole('button', { name: 'Nova faculdade' }).click();
    await page.getByLabel('CNPJ', { exact: true }).fill(cnpjValido());
    await page.getByLabel('Razão social').fill(`Universidade ${s} S.A.`);
    await page.getByLabel('Nome fantasia').fill(`Uni ${s}`);
    await page.getByLabel('Telefone').fill('(11) 3333-4444');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Domínios estudantis').fill(`aluno.uni${s}.edu.br`);
    await page.getByRole('button', { name: 'Criar e enviar convite' }).click();
    await expect(page.getByRole('status')).toContainText(`o convite foi enviado para ${email}`);
    await page.getByLabel('Buscar por nome, CNPJ ou domínio').fill(`Uni ${s}`);
    await expect(page.getByRole('row', { name: new RegExp(`Uni ${s}`) })).toContainText('Convite pendente');

    // FAC-01: a faculdade abre o link do convite em outro navegador.
    const convite = await api.ultimoEmailPara(email, { assunto: /Convite/ });
    const faculdade = await (await browser.newContext()).newPage();
    await faculdade.goto(await api.linkDoEmail(convite.ID));
    await faculdade.getByLabel('Nova senha').fill('Faculdade#2026');
    await faculdade.getByLabel('Confirmação da senha').fill('Faculdade#2026');
    await faculdade.getByRole('button', { name: 'Salvar senha' }).click();
    await expect(faculdade.getByRole('status')).toContainText('conta ativada');
  });

  test('ADM-01 domínio de provedor público é recusado no campo', async ({ page }) => {
    await page.goto('/admin/faculdades');
    await page.getByRole('button', { name: 'Nova faculdade' }).click();
    await page.getByLabel('CNPJ', { exact: true }).fill(cnpjValido());
    await page.getByLabel('Razão social').fill('Uni Gmail');
    await page.getByLabel('Nome fantasia').fill('Uni Gmail');
    await page.getByLabel('Telefone').fill('1133334444');
    await page.getByLabel('E-mail').fill(`contato@${sufixo()}.edu.br`);
    await page.getByLabel('Domínios estudantis').fill('gmail.com');
    await page.getByRole('button', { name: 'Criar e enviar convite' }).click();
    await expect(page.getByText('Domínio de provedor público não é aceito')).toBeVisible();
  });

  test('ADM-02 inativa e reativa a faculdade; domínios são geridos na ficha', async ({ page, api, request }) => {
    const c = await api.cenario();
    await page.goto('/admin/faculdades');
    await page.getByLabel('Buscar por nome, CNPJ ou domínio').fill(c.faculdade.dominio);
    const linha = page.getByRole('row', { name: new RegExp(c.faculdade.dominio.replace(/\./g, '\\.')) });
    await linha.getByRole('link').click();
    await semViolacoesGraves(page);

    const extra = `pos.${sufixo()}.edu.br`;
    await page.getByLabel('Novo domínio').fill(extra);
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: extra })).toBeVisible();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Inativar faculdade' }).click();
    await expect(page.getByRole('status')).toHaveText('Faculdade inativada.');
    // Outro contexto: page.request trocaria os cookies do navegador do admin.
    const login = await request.post('/api/v1/auth/login', { data: { email: c.aluno.email, senha: c.aluno.senha } });
    expect((await login.json()).painel).toBe('/aluno/trocar-faculdade');

    await page.getByRole('button', { name: 'Reativar faculdade' }).click();
    await expect(page.getByRole('status')).toHaveText('Faculdade reativada.');
  });

  test('ADM-03 cria, renomeia e inativa área de formação', async ({ page }) => {
    const nome = `Área ${sufixo()}`;
    await page.goto('/admin/areas');
    await semViolacoesGraves(page);
    await page.getByLabel('Nova área').fill(nome);
    await page.getByRole('button', { name: 'Criar área' }).click();
    const linha = page.getByRole('row', { name: new RegExp(nome) });
    await expect(linha).toContainText('Ativa');

    await linha.getByRole('button', { name: `Renomear ${nome}` }).click();
    await page.getByLabel('Novo nome').fill(`${nome} 2`);
    await page.getByRole('button', { name: 'Salvar' }).click();
    const renomeada = page.getByRole('row', { name: new RegExp(`${nome} 2`) });
    await renomeada.getByRole('button', { name: `Inativar ${nome} 2` }).click();
    await expect(renomeada).toContainText('Inativa');
  });

  test('ADM-04 aprova a empresa pendente; ela recebe o resultado por e-mail e pode publicar', async ({ page, api, browser }) => {
    const empresa = await api.empresaPendente();
    await page.goto('/admin/empresas');
    await semViolacoesGraves(page);
    await page.getByLabel('Buscar por nome, CNPJ ou e-mail').fill(empresa.nomeFantasia);
    await page.getByRole('button', { name: `Ver dados de ${empresa.nomeFantasia}` }).click();
    await expect(page.getByText('Avenida Paulista, 1000')).toBeVisible();
    await page.getByRole('button', { name: `Aprovar ${empresa.nomeFantasia}` }).click();
    await expect(page.getByRole('status').filter({ hasText: `${empresa.nomeFantasia} aprovada.` })).toBeVisible();

    await api.rodarJob('enviar-emails');
    expect((await api.ultimoEmailPara(empresa.email, { assunto: /Cadastro aprovado/ })).Subject).toBe('Cadastro aprovado');

    const emp = await (await browser.newContext()).newPage();
    await emp.request.post('/api/v1/auth/login', { data: { email: empresa.email, senha: empresa.senha } });
    await emp.goto('/empresa/vagas');
    await expect(emp.getByRole('link', { name: 'Nova vaga' })).toBeVisible();
  });

  test('ADM-04 reprova com motivo; a empresa vê o motivo e pede nova análise', async ({ page, api, browser }) => {
    const empresa = await api.empresaPendente();
    await page.goto('/admin/empresas');
    await page.getByLabel('Buscar por nome, CNPJ ou e-mail').fill(empresa.nomeFantasia);
    await page.getByRole('button', { name: `Reprovar ${empresa.nomeFantasia}` }).click();
    await page.getByLabel('Motivo da reprovação').fill('Ramo de atuação genérico');
    await page.getByRole('button', { name: 'Confirmar reprovação' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'reprovada' })).toBeVisible();

    const emp = await (await browser.newContext()).newPage();
    await emp.request.post('/api/v1/auth/login', { data: { email: empresa.email, senha: empresa.senha } });
    await emp.goto('/empresa/perfil');
    await expect(emp.getByRole('alert').filter({ hasText: 'Ramo de atuação genérico' })).toBeVisible();
    await emp.getByLabel('Ramo de atuação').fill('Energia solar residencial');
    await emp.getByRole('button', { name: 'Salvar perfil' }).click();
    await emp.getByRole('button', { name: 'Solicitar nova análise' }).click();
    await expect(emp.getByRole('status').filter({ hasText: 'Cadastro em análise' })).toBeVisible();
  });

  test('ADM-05 inativar a empresa pausa as vagas abertas', async ({ page, api, request }) => {
    const c = await api.cenario();
    await page.goto('/admin/empresas');
    await page.getByLabel('Aprovação').selectOption('');
    await page.getByLabel('Buscar por nome, CNPJ ou e-mail').fill(c.empresa.email);
    const nome = (await page.getByRole('list', { name: 'Empresas' }).getByRole('heading').first().textContent())!;
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: `Inativar ${nome}` }).click();
    await expect(page.getByRole('status').filter({ hasText: 'vagas abertas pausadas' })).toBeVisible();
    const login = await request.post('/api/v1/auth/login', { data: { email: c.empresa.email, senha: c.empresa.senha } });
    expect(login.status()).toBe(401);
  });
});
