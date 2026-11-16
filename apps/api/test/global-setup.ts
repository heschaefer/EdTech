import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { execSync } from 'node:child_process';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const ARQUIVO_ENV = join(__dirname, '.env.int.json');

export default async function globalSetup() {
  const [pg, redis] = await Promise.all([new PostgreSqlContainer('postgres:17-alpine').start(), new RedisContainer('redis:7-alpine').start()]);
  (globalThis as Record<string, unknown>).__containers = [pg, redis];

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const env = {
    NODE_ENV: 'test',
    ENABLE_TEST_ROUTES: 'true',
    THROTTLE_DESLIGADO: 'true',
    COOKIE_SECURE: 'false',
    DATABASE_URL: pg.getConnectionUri(),
    REDIS_URL: redis.getConnectionUrl(),
    WEB_URL: 'http://localhost:3000',
    JWT_PRIVATE_KEY: privateKey,
    JWT_PUBLIC_KEY: publicKey,
    JWT_KID: 'teste',
    DADOS_ENC_KEY: randomBytes(32).toString('base64'),
    CPF_HMAC_KEY: randomBytes(32).toString('base64'),
  };
  execSync('npx prisma migrate deploy', { cwd: join(__dirname, '..'), env: { ...process.env, ...env }, stdio: 'ignore' });
  writeFileSync(ARQUIVO_ENV, JSON.stringify(env));
}
