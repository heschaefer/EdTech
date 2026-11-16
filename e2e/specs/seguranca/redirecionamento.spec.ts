import { expect, test } from '../../fixtures';

/** ASVS 5.1.5: o `?next=` do login só leva a caminhos internos. */
test.describe('Redirecionamento após o login @seguranca', () => {
  for (const malicioso of ['https://evil.example', '//evil.example', '/\\evil.example']) {
    test(`SEG-ASVS next=${malicioso} não leva para fora do site @seguranca`, async ({ page, api, baseURL }) => {
      const { aluno } = await api.cenario();
      await page.goto(`/login?next=${encodeURIComponent(malicioso)}`);
      await page.getByLabel('E-mail').fill(aluno.email);
      await page.getByLabel('Senha').fill(aluno.senha);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page).toHaveURL(/\/aluno/);
      expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
    });
  }

  test('SEG-ASVS next interno é respeitado @seguranca', async ({ page, api }) => {
    const { aluno } = await api.cenario();
    await page.goto(`/login?next=${encodeURIComponent('/aluno/candidaturas?aba=historico')}`);
    await page.getByLabel('E-mail').fill(aluno.email);
    await page.getByLabel('Senha').fill(aluno.senha);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/aluno\/candidaturas\?aba=historico/);
  });
});
