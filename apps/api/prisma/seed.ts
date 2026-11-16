import { PrismaClient } from '@prisma/client';
import { seedBase } from '../src/seed/base';

const prisma = new PrismaClient();

seedBase(prisma)
  .then(() => console.log('Seed base aplicado: admin e áreas de formação.'))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
