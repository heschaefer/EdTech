import { expect, test } from '../../fixtures';

test('SEG-07 cabeçalhos de segurança nas páginas e na API @seguranca', async ({ request }) => {
  for (const caminho of ['/login', '/api/v1/saude']) {
    const res = await request.get(caminho);
    const h = res.headers();
    expect(h['x-content-type-options'], caminho).toBe('nosniff');
    expect(h['strict-transport-security'], caminho).toBeTruthy();
    expect(h['content-security-policy'], caminho).toBeTruthy();
  }
  const pagina = (await request.get('/login')).headers()['content-security-policy'];
  expect(pagina).toContain("frame-ancestors 'none'");
  expect(pagina).toMatch(/'nonce-[\w+/=]+'/);
});

test('SEG-03 refresh reapresentado após rotação revoga a família @seguranca', async ({ api, playwright, baseURL }) => {
  const { aluno } = await api.cenario();
  const vitima = await playwright.request.newContext({ baseURL });
  await vitima.post('/api/v1/auth/login', { data: { email: aluno.email, senha: aluno.senha } });
  const rtAntigo = (await vitima.storageState()).cookies.find((c) => c.name === 'rt')!;

  expect((await vitima.post('/api/v1/auth/refresh')).status()).toBe(200); // rotaciona

  const atacante = await playwright.request.newContext({ baseURL, storageState: { cookies: [rtAntigo], origins: [] } });
  expect((await atacante.post('/api/v1/auth/refresh')).status()).toBe(401);
  expect((await vitima.post('/api/v1/auth/refresh')).status()).toBe(401); // família inteira revogada
});
