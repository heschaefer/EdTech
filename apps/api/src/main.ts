import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { criarApp } from './bootstrap';
import { env } from './config/env';

async function main() {
  const app = await criarApp();
  await app.listen(env().PORT, '0.0.0.0');
  new Logger('API').log(`API ouvindo em :${env().PORT} (NODE_ENV=${env().NODE_ENV})`);
}

void main();
