import { expect, semViolacoesGraves, test } from '../fixtures';

const sufixo = () => Math.random().toString(36).slice(2, 8);
const cnpjValido = () => {
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('') + '0001';
  const dv = (b: string, pesos: number[]) => {
    const r = [...b].reduce((s, d, i) => s + Number(d) * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = dv(base, p1);
  return `${base}${d1}${dv(base + d1, [6, ...p1])}`;
};

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
});
