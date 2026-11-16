import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { authenticator } from 'otplib';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/bootstrap';
import { recarregarEnv } from '../src/config/env';
import { conexaoRedis, FILA_EMAILS } from '../src/modules/email/redis';
import type { Email } from '../src/modules/email/templates';
import { PrismaService } from '../src/prisma/prisma.service';
import { ADMIN_PADRAO } from '../src/seed/base';

export const API = '/api/v1';

/** Cada arquivo de teste tem o próprio process.env no Jest; envExtra vale para o arquivo todo. */
export async function criarApp(envExtra: Record<string, string> = {}): Promise<INestApplication> {
  Object.assign(process.env, envExtra);
  recarregarEnv();
  const modulo = await Test.createTestingModule({ imports: [AppModule.registrar()] }).compile();
  const app = configurarApp(modulo.createNestApplication<NestExpressApplication>({ logger: ['error'] }));
  await app.init();
  return app;
}

/** Agente com cookies persistentes que envia o X-CSRF-Token como o front faz. */
export class Cliente {
  readonly agent: TestAgent;
  constructor(readonly app: INestApplication) {
    this.agent = request.agent(app.getHttpServer());
  }

  csrf(): string {
    const c = this.agent.jar.getCookie('csrf', { domain: '127.0.0.1', path: '/', secure: false, script: true });
    return c?.value ?? '';
  }

  get(url: string) {
    return this.agent.get(API + url);
  }
  post(url: string, body?: object) {
    return this.agent.post(API + url).set('X-CSRF-Token', this.csrf()).send(body);
  }
  patch(url: string, body?: object) {
    return this.agent.patch(API + url).set('X-CSRF-Token', this.csrf()).send(body);
  }
  delete(url: string, body?: object) {
    return this.agent.delete(API + url).set('X-CSRF-Token', this.csrf()).send(body);
  }

  async login(email: string, senha: string, totp?: string) {
    const res = await this.agent.post(`${API}/auth/login`).send({ email, senha, ...(totp ? { totp } : {}) });
    if (res.status !== 200) throw new Error(`login falhou (${res.status}): ${JSON.stringify(res.body)}`);
    return res;
  }

  loginAdmin() {
    return this.login(ADMIN_PADRAO.email, ADMIN_PADRAO.senha, authenticator.generate(ADMIN_PADRAO.totp));
  }
}

export type Cenario = {
  aluno: { id: string; usuarioId: string; email: string; senha: string; nome: string; cpf: string };
  empresa: { id: string; usuarioId: string; email: string; senha: string };
  faculdade: { id: string; usuarioId: string; email: string; senha: string; dominio: string };
  curso: { id: string; nome: string };
  turma: { id: string };
  vaga: { id: string; funcao: string; prazo: string };
  candidaturaId?: string;
};

export async function cenario(app: INestApplication, opcoes: object = {}): Promise<Cenario> {
  const res = await request(app.getHttpServer()).post(`${API}/__test__/cenarios`).send(opcoes);
  if (res.status !== 201) throw new Error(`cenario falhou: ${JSON.stringify(res.body)}`);
  return res.body;
}

export const prisma = (app: INestApplication) => app.get(PrismaService);

/** Lê os e-mails enfileirados para o worker (sem precisar de SMTP). */
export async function emailsPara(para: string): Promise<Email[]> {
  const conexao = conexaoRedis();
  const fila = new Queue<Email>(FILA_EMAILS, { connection: conexao });
  try {
    const jobs = await fila.getJobs(['waiting', 'delayed', 'active', 'completed', 'failed', 'prioritized']);
    return jobs
      .filter((j) => j?.data?.para === para)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((j) => j.data);
  } finally {
    await fila.close();
    await conexao.quit();
  }
}

export const tokenDoEmail = (email: Email) => /token=([\w-]+)/.exec(email.texto)?.[1] ?? '';
