import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { API, cenario, Cliente, criarApp, emailsPara, prisma, tokenDoEmail } from './util';

describe('Autenticação', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarApp();
    await request(app.getHttpServer()).post(`${API}/__test__/reset`).expect(204);
  });
  afterAll(() => app.close());

  describe('AUTH-01 login', () => {
    it('AUTH-01 usuário ATIVO recebe os cookies de sessão e o painel do papel', async () => {
      const { aluno } = await cenario(app);
      const res = await request(app.getHttpServer()).post(`${API}/auth/login`).send({ email: aluno.email.toUpperCase(), senha: aluno.senha }).expect(200);
      expect(res.body.painel).toBe('/aluno');
      const cookies = (res.headers['set-cookie'] as unknown as string[]).join('\n');
      expect(cookies).toMatch(/at=.*HttpOnly.*SameSite=Lax/i);
      expect(cookies).toMatch(/rt=.*Path=\/api\/v1\/auth.*HttpOnly.*SameSite=Strict/i);
      expect(cookies).toMatch(/csrf=/);
      expect(res.body.usuario).toMatchObject({ email: aluno.email, papel: 'ALUNO', nome: aluno.nome });
    });

    it('AUTH-01 e-mail ou senha errados → 401 com mensagem genérica', async () => {
      const { aluno } = await cenario(app);
      const errada = await request(app.getHttpServer()).post(`${API}/auth/login`).send({ email: aluno.email, senha: 'Errada@123' }).expect(401);
      const inexistente = await request(app.getHttpServer()).post(`${API}/auth/login`).send({ email: 'ninguem@x.com', senha: 'Errada@123' }).expect(401);
      expect(errada.body.detail).toBe('E-mail ou senha inválidos');
      expect(inexistente.body.detail).toBe('E-mail ou senha inválidos');
      expect(errada.headers['content-type']).toContain('application/problem+json');
    });

    it('AUTH-01 SEG-06 5 falhas seguidas bloqueiam 15 min, mesmo com a senha certa, e avisam por e-mail', async () => {
      const { aluno } = await cenario(app);
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).post(`${API}/auth/login`).send({ email: aluno.email, senha: 'Errada@123' }).expect(401);
      }
      const res = await request(app.getHttpServer()).post(`${API}/auth/login`).send({ email: aluno.email, senha: aluno.senha }).expect(401);
      expect(res.body.type).toBe('conta-bloqueada');
      const u = await prisma(app).usuario.findUniqueOrThrow({ where: { email: aluno.email } });
      expect(u.bloqueadoAte!.getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
      expect((await emailsPara(aluno.email))[0].assunto).toMatch(/bloqueada/);
    });

    it('AUTH-01 e-mail não verificado nega o login com opção de reenviar', async () => {
      const { aluno } = await cenario(app);
      await prisma(app).usuario.update({ where: { email: aluno.email }, data: { status: 'PENDENTE_VERIFICACAO' } });
      const res = await request(app.getHttpServer()).post(`${API}/auth/login`).send({ email: aluno.email, senha: aluno.senha }).expect(401);
      expect(res.body).toMatchObject({ type: 'email-nao-verificado', podeReenviar: true });
    });

    it('AUTH-01 RN-22 aluno INATIVO entra, mas só acessa rotas permitidas', async () => {
      const { aluno } = await cenario(app);
      await prisma(app).usuario.update({ where: { email: aluno.email }, data: { status: 'INATIVO' } });
      const c = new Cliente(app);
      const res = await c.login(aluno.email, aluno.senha);
      expect(res.body.painel).toBe('/aluno/trocar-faculdade');
      await c.get('/me').expect(200);
      await c.get('/areas').expect(403);
    });

    it('AUTH-01 admin exige o código TOTP', async () => {
      const semCodigo = await request(app.getHttpServer()).post(`${API}/auth/login`).send({ email: 'admin@vagas.local', senha: 'Demo@2026!' }).expect(401);
      expect(semCodigo.body).toMatchObject({ type: 'totp-obrigatorio', requer2fa: true });
      await request(app.getHttpServer()).post(`${API}/auth/login`).send({ email: 'admin@vagas.local', senha: 'Demo@2026!', totp: '000000' }).expect(401);
      const res = await new Cliente(app).loginAdmin();
      expect(res.body.painel).toBe('/admin');
    });
  });

  describe('AUTH-02 renovação de sessão', () => {
    it('AUTH-02 refresh válido emite novos cookies e o antigo deixa de valer', async () => {
      const { aluno } = await cenario(app);
      const c = new Cliente(app);
      await c.login(aluno.email, aluno.senha);
      const res = await c.post('/auth/refresh').expect(200);
      expect((res.headers['set-cookie'] as unknown as string[]).join()).toMatch(/at=.*rt=|rt=.*at=/s);
      await c.get('/me').expect(200);
    });

    it('AUTH-02 SEG-03 refresh reapresentado após rotação revoga a família inteira', async () => {
      const { aluno } = await cenario(app);
      const vitima = new Cliente(app);
      await vitima.login(aluno.email, aluno.senha);
      const rtAntigo = vitima.agent.jar.getCookie('rt', { domain: '127.0.0.1', path: '/api/v1/auth', secure: false, script: false })!.value;

      await vitima.post('/auth/refresh').expect(200);

      await request(app.getHttpServer()).post(`${API}/auth/refresh`).set('Cookie', `rt=${rtAntigo}`).expect(401);
      await vitima.post('/auth/refresh').expect(401);
    });

    it('AUTH-02 sem cookie rt → 401', async () => {
      await request(app.getHttpServer()).post(`${API}/auth/refresh`).expect(401);
    });
  });

  it('AUTH-03 logout revoga o refresh e limpa os cookies', async () => {
    const { aluno } = await cenario(app);
    const c = new Cliente(app);
    await c.login(aluno.email, aluno.senha);
    const rt = c.agent.jar.getCookie('rt', { domain: '127.0.0.1', path: '/api/v1/auth', secure: false, script: false })!.value;
    const res = await c.post('/auth/logout').expect(204);
    expect((res.headers['set-cookie'] as unknown as string[]).join()).toMatch(/at=;/);
    await request(app.getHttpServer()).post(`${API}/auth/refresh`).set('Cookie', `rt=${rt}`).expect(401);
  });

  describe('AUTH-04 esqueci a senha', () => {
    it('AUTH-04 responde sempre 202, exista ou não o e-mail', async () => {
      await request(app.getHttpServer()).post(`${API}/auth/senha/esqueci`).send({ email: 'nao.existe@x.com' }).expect(202);
      const { aluno } = await cenario(app);
      await request(app.getHttpServer()).post(`${API}/auth/senha/esqueci`).send({ email: aluno.email }).expect(202);
      expect(await emailsPara('nao.existe@x.com')).toHaveLength(0);
      expect((await emailsPara(aluno.email))[0].assunto).toBe('Redefinição de senha');
    });

    it('AUTH-04 link vale uma vez, troca a senha e revoga todas as sessões', async () => {
      const { aluno } = await cenario(app);
      const sessao = new Cliente(app);
      await sessao.login(aluno.email, aluno.senha);
      await request(app.getHttpServer()).post(`${API}/auth/senha/esqueci`).send({ email: aluno.email }).expect(202);
      const token = tokenDoEmail((await emailsPara(aluno.email))[0]);

      const nova = 'Nova#Senha2026';
      await request(app.getHttpServer()).post(`${API}/auth/senha/redefinir`).send({ token, senha: nova, confirmacao: nova }).expect(200);
      const reuso = await request(app.getHttpServer()).post(`${API}/auth/senha/redefinir`).send({ token, senha: nova, confirmacao: nova }).expect(400);
      expect(reuso.body.type).toBe('link-invalido');

      await sessao.post('/auth/refresh').expect(401);
      await new Cliente(app).login(aluno.email, nova);
    });

    it('AUTH-04 link expira em 1 h', async () => {
      const { aluno } = await cenario(app);
      await request(app.getHttpServer()).post(`${API}/auth/senha/esqueci`).send({ email: aluno.email }).expect(202);
      const token = tokenDoEmail((await emailsPara(aluno.email))[0]);
      const u = await prisma(app).usuario.findUniqueOrThrow({ where: { email: aluno.email } });
      const t = await prisma(app).tokenEmail.findFirstOrThrow({ where: { usuarioId: u.id, tipo: 'RESET_SENHA', usadoEm: null } });
      expect(t.expiraEm.getTime() - Date.now()).toBeLessThanOrEqual(3600_000);
      await prisma(app).tokenEmail.update({ where: { id: t.id }, data: { expiraEm: new Date(Date.now() - 1000) } });
      await request(app.getHttpServer()).post(`${API}/auth/senha/redefinir`).send({ token, senha: 'Nova#Senha2026', confirmacao: 'Nova#Senha2026' }).expect(400);
    });

    it('AUTH-04 RN-04 nova senha fora da política lista cada requisito', async () => {
      const res = await request(app.getHttpServer()).post(`${API}/auth/senha/redefinir`).send({ token: 'x'.repeat(43), senha: 'abc', confirmacao: 'abc' }).expect(400);
      const msgs = res.body.errors.filter((e: { campo: string }) => e.campo === 'senha').map((e: { mensagem: string }) => e.mensagem);
      expect(msgs).toEqual(expect.arrayContaining(['Entre 8 e 128 caracteres', 'Ao menos 1 letra maiúscula', 'Ao menos 1 número', 'Ao menos 1 caractere especial']));
    });
  });

  describe('AUTH-05 verificação de e-mail', () => {
    it('AUTH-05 link de verificação ativa a conta uma única vez e vale 24 h', async () => {
      const { aluno } = await cenario(app);
      await prisma(app).usuario.update({ where: { email: aluno.email }, data: { status: 'PENDENTE_VERIFICACAO', emailVerificadoEm: null } });
      await request(app.getHttpServer()).post(`${API}/auth/reenviar-verificacao`).send({ email: aluno.email }).expect(202);
      const token = tokenDoEmail((await emailsPara(aluno.email))[0]);
      const t = await prisma(app).tokenEmail.findFirstOrThrow({ where: { usuario: { email: aluno.email }, tipo: 'VERIFICACAO', usadoEm: null } });
      expect(Math.round((t.expiraEm.getTime() - Date.now()) / 3600_000)).toBe(24);

      await request(app.getHttpServer()).post(`${API}/auth/verificar-email`).send({ token }).expect(200);
      await request(app.getHttpServer()).post(`${API}/auth/verificar-email`).send({ token }).expect(400);
      const u = await prisma(app).usuario.findUniqueOrThrow({ where: { email: aluno.email } });
      expect(u.status).toBe('ATIVO');
      expect(u.emailVerificadoEm).not.toBeNull();
    });

    it('AUTH-05 reenvio para conta já ativa não envia nada e responde igual', async () => {
      const { aluno } = await cenario(app);
      await request(app.getHttpServer()).post(`${API}/auth/reenviar-verificacao`).send({ email: aluno.email }).expect(202);
      expect(await emailsPara(aluno.email)).toHaveLength(0);
    });
  });
});
