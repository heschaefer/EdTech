import { request, type FullConfig } from '@playwright/test';

/** Seção 11.1: chama /__test__/reset uma vez; cada teste cria seus próprios dados. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL;
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post('/api/v1/__test__/reset');
  if (!res.ok()) throw new Error(`reset falhou: ${res.status()} ${await res.text()}`);
  await ctx.dispose();
}
