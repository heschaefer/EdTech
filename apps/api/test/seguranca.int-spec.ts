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

  describe('SEG-01 matriz de acesso: toda rota × todo papel × anônimo', () => {
    const ID = '00000000-0000-4000-8000-000000000000';
    const TODOS = ['ALUNO', 'EMPRESA', 'FACULDADE', 'ADMIN'];
    type Metodo = 'get' | 'post' | 'patch' | 'put' | 'delete';
    // Seção 8.2: quem acessa cada rota. ":id" vira um UUID inexistente (o papel certo recebe 400/404/422, nunca 401/403).
    const MATRIZ: [Metodo, string, string[]][] = [
      ['get', '/me', TODOS],
      ['get', '/areas', TODOS],
      ['get', '/notificacoes', TODOS],
      ['get', '/notificacoes/nao-lidas', TODOS],
      ['patch', '/notificacoes/lidas', TODOS],
      ['patch', '/notificacoes/:id/lida', TODOS],
      // Admin
      ['get', '/admin/faculdades', ['ADMIN']],
      ['post', '/admin/faculdades', ['ADMIN']],
      ['get', '/admin/faculdades/:id', ['ADMIN']],
      ['patch', '/admin/faculdades/:id', ['ADMIN']],
      ['post', '/admin/faculdades/:id/dominios', ['ADMIN']],
      ['delete', '/admin/faculdades/:id/dominios', ['ADMIN']],
      ['post', '/admin/faculdades/:id/convite', ['ADMIN']],
      ['get', '/admin/areas', ['ADMIN']],
      ['post', '/admin/areas', ['ADMIN']],
      ['patch', '/admin/areas/:id', ['ADMIN']],
      ['delete', '/admin/areas/:id', ['ADMIN']],
      ['get', '/admin/empresas', ['ADMIN']],
      ['get', '/admin/empresas/:id', ['ADMIN']],
      ['patch', '/admin/empresas/:id', ['ADMIN']],
      ['post', '/admin/empresas/:id/aprovar', ['ADMIN']],
      ['post', '/admin/empresas/:id/reprovar', ['ADMIN']],
      ['get', '/admin/auditoria', ['ADMIN']],
      // Faculdade
      ['get', '/faculdade/me', ['FACULDADE']],
      ['patch', '/faculdade/me', ['FACULDADE']],
      ['get', '/faculdade/cursos', ['FACULDADE']],
      ['post', '/faculdade/cursos', ['FACULDADE']],
      ['get', '/faculdade/cursos/:id', ['FACULDADE']],
      ['patch', '/faculdade/cursos/:id', ['FACULDADE']],
      ['delete', '/faculdade/cursos/:id', ['FACULDADE']],
      ['get', '/faculdade/cursos/:id/semestres', ['FACULDADE']],
      ['post', '/faculdade/semestres/:id/aulas', ['FACULDADE']],
      ['patch', '/faculdade/aulas/:id', ['FACULDADE']],
      ['delete', '/faculdade/aulas/:id', ['FACULDADE']],
      ['get', '/faculdade/cursos/:id/turmas', ['FACULDADE']],
      ['post', '/faculdade/cursos/:id/turmas', ['FACULDADE']],
      ['patch', '/faculdade/turmas/:id', ['FACULDADE']],
      ['delete', '/faculdade/turmas/:id', ['FACULDADE']],
      ['get', '/faculdade/alunos', ['FACULDADE']],
      ['patch', '/faculdade/alunos/:id/status', ['FACULDADE']],
      // Aluno
      ['get', '/alunos/me', ['ALUNO']],
      ['patch', '/alunos/me', ['ALUNO']],
      ['patch', '/alunos/me/senha', ['ALUNO']],
      ['get', '/alunos/me/vinculo/opcoes', ['ALUNO']],
      ['patch', '/alunos/me/vinculo', ['ALUNO']],
      ['get', '/alunos/me/curriculo', ['ALUNO']],
      ['put', '/alunos/me/curriculo', ['ALUNO']],
      ['post', '/alunos/me/troca-faculdade', ['ALUNO']],
      ['get', '/alunos/me/troca-faculdade', ['ALUNO']],
      ['post', '/alunos/me/troca-faculdade/confirmar', ['ALUNO']],
      ['get', '/alunos/me/dados', ['ALUNO']],
      ['post', '/alunos/me/exclusao', ['ALUNO']],
      ['get', '/alunos/me/candidaturas', ['ALUNO']],
      ['get', '/vagas', ['ALUNO']],
      ['get', '/vagas/:id', ['ALUNO']],
      ['post', '/vagas/:id/candidaturas', ['ALUNO']],
      ['get', '/candidaturas/:id', ['ALUNO']],
      ['delete', '/candidaturas/:id', ['ALUNO']],
      // Empresa
      ['get', '/empresa/me', ['EMPRESA']],
      ['patch', '/empresa/me', ['EMPRESA']],
      ['post', '/empresa/me/solicitar-analise', ['EMPRESA']],
      ['get', '/empresa/vagas', ['EMPRESA']],
      ['post', '/empresa/vagas', ['EMPRESA']],
      ['get', '/empresa/vagas/:id', ['EMPRESA']],
      ['patch', '/empresa/vagas/:id', ['EMPRESA']],
      ['delete', '/empresa/vagas/:id', ['EMPRESA']],
      ['post', '/empresa/vagas/:id/pausar', ['EMPRESA']],
      ['post', '/empresa/vagas/:id/reativar', ['EMPRESA']],
      ['post', '/empresa/vagas/:id/prorrogar', ['EMPRESA']],
      ['post', '/empresa/vagas/:id/encerrar', ['EMPRESA']],
      ['get', '/empresa/vagas/:id/candidaturas', ['EMPRESA']],
      ['get', '/empresa/candidaturas/:id', ['EMPRESA']],
      ['patch', '/empresa/candidaturas/:id/etapa', ['EMPRESA']],
      ['post', '/empresa/candidaturas/:id/nao-selecionar', ['EMPRESA']],
    ];
    /** Rotas abertas (@Public), protegidas por rate limit e SameSite (seção 8.1). */
    const PUBLICAS: [Metodo, string][] = [
      ['get', '/saude'],
      ['get', '/faculdades/por-dominio'],
      ['post', '/auth/alunos'],
      ['post', '/auth/empresas'],
      ['post', '/auth/login'],
      ['post', '/auth/verificar-email'],
      ['post', '/auth/reenviar-verificacao'],
      ['post', '/auth/senha/esqueci'],
      ['post', '/auth/senha/redefinir'],
      ['post', '/auth/convite/aceitar'],
    ];
    /** Dependem do próprio cookie de sessão; cobertas por AUTH-02, AUTH-03 e SEG-03. */
    const SESSAO: [Metodo, string][] = [
      ['post', '/auth/refresh'],
      ['post', '/auth/logout'],
    ];
    const chave = (m: string, u: string) => `${m.toUpperCase()} ${u}`;
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

    it('SEG-01 inventário: toda rota registrada está na matriz, é pública declarada ou é de sessão; nada sobra na matriz', () => {
      const express = app.getHttpAdapter().getInstance();
      const registradas = new Set<string>(
        (express.router ?? express._router).stack
          .filter((l: { route?: { path: string } }) => l.route?.path.startsWith(API) && !l.route.path.startsWith(`${API}/__test__`))
          .flatMap((l: { route: { path: string; methods: Record<string, boolean> } }) =>
            Object.keys(l.route.methods).filter((m) => m !== '_all').map((m) => chave(m, l.route.path.slice(API.length))),
          ),
      );
      const classificadas = new Set([...MATRIZ.map(([m, u]) => chave(m, u)), ...PUBLICAS.map(([m, u]) => chave(m, u)), ...SESSAO.map(([m, u]) => chave(m, u))]);
      expect([...registradas].filter((r) => !classificadas.has(r)).sort()).toEqual([]);
      expect([...classificadas].filter((r) => !registradas.has(r)).sort()).toEqual([]);
    });

    it.each(MATRIZ.map(([metodo, url, permitidos]) => ({ metodo, url, permitidos })))('SEG-01 $metodo $url: anônimo 401, papel errado 403', async ({ metodo, url, permitidos }) => {
      const alvo = url.replace(':id', ID);
      await request(app.getHttpServer())[metodo](API + alvo).expect(401);
      for (const papel of TODOS) {
        const res = await clientes[papel][metodo](alvo, metodo === 'get' ? undefined : {});
        if (permitidos.includes(papel)) {
          expect([401, 403]).not.toContain(res.status);
          expect(res.status).toBeLessThan(500);
        } else expect(res.status).toBe(403);
      }
    });

    it.each(PUBLICAS.map(([metodo, url]) => ({ metodo, url })))('SEG-01 $metodo $url é pública: anônimo não recebe 401/403', async ({ metodo, url }) => {
      const res = await request(app.getHttpServer())[metodo](API + url).send({});
      expect([401, 403]).not.toContain(res.status);
      expect(res.status).toBeLessThan(500);
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
      // ASVS 8.2.1: nada da API fica em cache.
      expect(res.headers['cache-control']).toBe('no-store');
    }
  });

  it('SEG-07 corpo JSON acima de 100 kB é recusado com 413 em problem+json', async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.com', senha: 'x'.repeat(120_000) }));
    expect(res.status).toBe(413);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.text).not.toMatch(/at \w+ \(/); // sem stack trace
    // JSON malformado é erro do cliente (400), não do servidor.
    const malformado = await request(app.getHttpServer()).post(`${API}/auth/login`).set('Content-Type', 'application/json').send('{"email":');
    expect(malformado.status).toBe(400);
    expect(malformado.body).toMatchObject({ status: 400 });
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
