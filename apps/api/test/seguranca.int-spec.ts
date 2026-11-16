import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync } from 'node:crypto';
import request from 'supertest';
import { API, cenario, Cliente, criarApp } from './util';

describe('Segurança', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarApp();
    await request(app.getHttpServer()).post(`${API}/__test__/reset`).expect(204);
  });
  afterAll(() => app.close());

  describe('SEG-01 matriz de acesso (cresce a cada fase)', () => {
    const rotas: { metodo: 'get' | 'post' | 'patch'; url: string; permitidos: string[] }[] = [
      { metodo: 'get', url: '/me', permitidos: ['ALUNO', 'EMPRESA', 'FACULDADE', 'ADMIN'] },
      { metodo: 'get', url: '/areas', permitidos: ['ALUNO', 'EMPRESA', 'FACULDADE', 'ADMIN'] },
      { metodo: 'get', url: '/admin/faculdades', permitidos: ['ADMIN'] },
      { metodo: 'post', url: '/admin/faculdades', permitidos: ['ADMIN'] },
      { metodo: 'get', url: '/admin/areas', permitidos: ['ADMIN'] },
      { metodo: 'post', url: '/admin/areas', permitidos: ['ADMIN'] },
      { metodo: 'get', url: '/faculdade/me', permitidos: ['FACULDADE'] },
      { metodo: 'patch', url: '/faculdade/me', permitidos: ['FACULDADE'] },
      { metodo: 'get', url: '/faculdade/cursos', permitidos: ['FACULDADE'] },
      { metodo: 'post', url: '/faculdade/cursos', permitidos: ['FACULDADE'] },
    ];
    const clientes: Record<string, Cliente> = {};

    beforeAll(async () => {
      const c = await cenario(app);
      for (const [papel, conta] of [['ALUNO', c.aluno], ['EMPRESA', c.empresa], ['FACULDADE', c.faculdade]] as const) {
        clientes[papel] = new Cliente(app);
        await clientes[papel].login(conta.email, conta.senha);
      }
      clientes.ADMIN = new Cliente(app);
      await clientes.ADMIN.loginAdmin();
    });

    it.each(rotas)('SEG-01 $metodo $url: anônimo 401, papel errado 403', async ({ metodo, url, permitidos }) => {
      await request(app.getHttpServer())[metodo](API + url).expect(401);
      for (const papel of ['ALUNO', 'EMPRESA', 'FACULDADE', 'ADMIN']) {
        const res = await clientes[papel][metodo](url, metodo === 'get' ? undefined : {});
        if (permitidos.includes(papel)) expect([200, 201, 400, 422]).toContain(res.status);
        else expect(res.status).toBe(403);
      }
    });
  });

  it('SEG-04 mutação sem header CSRF ou com valor diferente do cookie → 403', async () => {
    const admin = new Cliente(app);
    await admin.loginAdmin();
    await admin.agent.post(`${API}/admin/areas`).send({ nome: 'Sem CSRF' }).expect(403);
    await admin.agent.post(`${API}/admin/areas`).set('X-CSRF-Token', 'outro-valor').send({ nome: 'CSRF errado' }).expect(403);
    await admin.post('/admin/areas', { nome: `Com CSRF ${Date.now()}` }).expect(201);
  });

  it('SEG-07 cabeçalhos de segurança presentes nas respostas da API', async () => {
    for (const res of [await request(app.getHttpServer()).get(`${API}/saude`), await request(app.getHttpServer()).get(`${API}/me`)]) {
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['x-frame-options']).toBeDefined();
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-powered-by']).toBeUndefined();
    }
  });

  describe('SEG-10 JWT alterado, expirado ou com alg none → 401', () => {
    let tokenValido: string;

    beforeAll(async () => {
      const { aluno } = await cenario(app);
      const res = await request(app.getHttpServer()).post(`${API}/auth/login`).send({ email: aluno.email, senha: aluno.senha });
      tokenValido = /at=([^;]+)/.exec((res.headers['set-cookie'] as unknown as string[]).join())![1];
    });

    const comToken = (t: string) => request(app.getHttpServer()).get(`${API}/me`).set('Cookie', `at=${t}`);

    it('SEG-10 token válido passa', async () => {
      await comToken(tokenValido).expect(200);
    });

    it('SEG-10 payload alterado', async () => {
      const [h, p, s] = tokenValido.split('.');
      const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
      const alterado = Buffer.from(JSON.stringify({ ...claims, papel: 'ADMIN' })).toString('base64url');
      await comToken(`${h}.${alterado}.${s}`).expect(401);
    });

    it('SEG-10 alg none', async () => {
      const [, p] = tokenValido.split('.');
      const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT', kid: 'teste' })).toString('base64url');
      await comToken(`${h}.${p}.`).expect(401);
    });

    it('SEG-10 expirado', async () => {
      const jwt = new JwtService({});
      const claims = JSON.parse(Buffer.from(tokenValido.split('.')[1], 'base64url').toString());
      const expirado = jwt.sign(
        { sub: claims.sub, papel: claims.papel, status: claims.status, jti: 'x', iat: 1, exp: 2 },
        { algorithm: 'RS256', privateKey: process.env.JWT_PRIVATE_KEY!, keyid: 'teste' },
      );
      await comToken(expirado).expect(401);
    });

    it('SEG-10 assinado com outra chave', async () => {
      const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
      const { sub, papel, status } = JSON.parse(Buffer.from(tokenValido.split('.')[1], 'base64url').toString());
      const falso = new JwtService({}).sign({ sub, papel, status, jti: 'x' }, { algorithm: 'RS256', privateKey, keyid: 'teste', expiresIn: 600 });
      await comToken(falso).expect(401);
    });
  });
});
