import { z } from 'zod';

const pem = z.string().min(1).transform((v) => v.replace(/\\n/g, '\n'));
const chave32 = z
  .string()
  .refine((v) => Buffer.from(v, 'base64').length === 32, 'precisa ser 32 bytes em base64');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  MAIL_FROM: z.string().default('Vagas Universitárias <nao-responda@vagas.local>'),
  JWT_PRIVATE_KEY: pem,
  JWT_PUBLIC_KEY: pem,
  JWT_KID: z.string().default('k1'),
  /** Chaves públicas antigas ainda aceitas (rotação via kid), JSON { kid: pem }. */
  JWT_PUBLIC_KEYS_ANTERIORES: z.string().optional(),
  DADOS_ENC_KEY: chave32,
  CPF_HMAC_KEY: chave32,
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  ENABLE_TEST_ROUTES: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** Desliga o rate limit (só para testes de integração que não o exercitam). */
  THROTTLE_DESLIGADO: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

let cache: Env | undefined;

export function env(): Env {
  if (!cache) {
    const r = envSchema.safeParse(process.env);
    if (!r.success) {
      const campos = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Variáveis de ambiente inválidas: ${campos}`);
    }
    cache = r.data;
  }
  return cache;
}

/** Só para testes: força reler o process.env. */
export const recarregarEnv = () => {
  cache = undefined;
};

/** Seção 8.3: módulo /__test__ só com NODE_ENV=test e ENABLE_TEST_ROUTES=true. */
export const rotasDeTesteAtivas = () => env().NODE_ENV === 'test' && env().ENABLE_TEST_ROUTES;
