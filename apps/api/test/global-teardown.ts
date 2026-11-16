import { rmSync } from 'node:fs';
import { ARQUIVO_ENV } from './global-setup';

export default async function globalTeardown() {
  const containers = (globalThis as Record<string, unknown>).__containers as { stop: () => Promise<unknown> }[] | undefined;
  await Promise.all((containers ?? []).map((c) => c.stop()));
  rmSync(ARQUIVO_ENV, { force: true });
}
