import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { API, cenario, criarApp } from './util';

describe('Segurança: rate limit', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarApp({ THROTTLE_DESLIGADO: 'false' });
  });
  afterAll(() => app.close());

  it('SEG-05 6º login em 1 min do mesmo IP + e-mail → 429', async () => {
    const { aluno } = await cenario(app);
    const tentar = () => request(app.getHttpServer()).post(`${API}/auth/login`).send({ email: aluno.email, senha: aluno.senha });
    for (let i = 0; i < 5; i++) expect((await tentar()).status).toBe(200);
    const sexto = await tentar();
    expect(sexto.status).toBe(429);
    expect(sexto.headers['content-type']).toContain('application/problem+json');
    // Outro e-mail do mesmo IP não é afetado.
    const outro = await cenario(app);
    await request(app.getHttpServer()).post(`${API}/auth/login`).send({ email: outro.aluno.email, senha: outro.aluno.senha }).expect(200);
  });

  it('AUTH-04 esqueci a senha limitado a 3/h por e-mail', async () => {
    const email = `limite.${Date.now()}@x.com`;
    for (let i = 0; i < 3; i++) await request(app.getHttpServer()).post(`${API}/auth/senha/esqueci`).send({ email }).expect(202);
    await request(app.getHttpServer()).post(`${API}/auth/senha/esqueci`).send({ email }).expect(429);
  });

  it('AUTH-05 reenvio de verificação limitado a 3 por hora', async () => {
    const email = `reenvio.${Date.now()}@x.com`;
    for (let i = 0; i < 3; i++) await request(app.getHttpServer()).post(`${API}/auth/reenviar-verificacao`).send({ email }).expect(202);
    await request(app.getHttpServer()).post(`${API}/auth/reenviar-verificacao`).send({ email }).expect(429);
  });
});
