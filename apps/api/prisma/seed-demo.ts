import { PrismaClient } from '@prisma/client';
import { seedDemo } from '../src/seed/demo';
import { CONTAS_DEMO, SENHA_DEMO } from '../src/seed/demo-dados';

/**
 * `pnpm db:seed:demo [--reset]` (seção 10.1). Recusa NODE_ENV=production; `--reset` apaga tudo antes.
 */
const prisma = new PrismaClient();
const reset = process.argv.includes('--reset');

seedDemo(prisma, { reset })
  .then((r) => {
    console.log('Dados de demonstração criados:', r);
    console.log(`Contas (senha ${SENHA_DEMO}):`);
    for (const [papel, email] of Object.entries(CONTAS_DEMO)) console.log(`  ${papel.padEnd(16)} ${email}`);
    console.log('  admin            admin@vagas.local (2FA: segredo TOTP no README)');
  })
  .catch((e: Error) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
