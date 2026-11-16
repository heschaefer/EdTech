import type { INestApplication } from '@nestjs/common';
import { gerarCnpj } from '@vagas/contracts';
import { randomInt } from 'node:crypto';
import request from 'supertest';
import { API, cenario, Cliente, criarApp, emailsPara, prisma, tokenDoEmail } from './util';

const cnpjNovo = () => gerarCnpj(String(randomInt(10_000_000, 99_999_999)) + '0001');
const sufixo = () => Math.random().toString(36).slice(2, 8);

describe('Admin', () => {
  let app: INestApplication;
  let admin: Cliente;

  beforeAll(async () => {
    app = await criarApp();
    await request(app.getHttpServer()).post(`${API}/__test__/reset`).expect(204);
    admin = new Cliente(app);
    await admin.loginAdmin();
  });
  afterAll(() => app.close());

  const novaFaculdade = (s = sufixo()) => ({
    cnpj: cnpjNovo(),
    razaoSocial: `Universidade ${s} S.A.`,
    nomeFantasia: `Uni ${s}`,
    telefone: '(11) 3333-4444',
    email: `contato@uni${s}.edu.br`,
    dominios: [`aluno.uni${s}.edu.br`],
  });

  describe('ADM-01 criar faculdade', () => {
    it('ADM-01 cria a faculdade e envia o convite FAC-01 por e-mail', async () => {
      const dados = novaFaculdade();
      const res = await admin.post('/admin/faculdades', dados).expect(201);
      expect(res.body).toMatchObject({ nomeFantasia: dados.nomeFantasia, dominios: dados.dominios, conviteAceito: false, ativa: true });
      const [email] = await emailsPara(dados.email);
      expect(email.assunto).toMatch(/Convite/);
      expect(await prisma(app).auditLog.count({ where: { acao: 'ADMIN_CRIOU_FACULDADE', entidadeId: res.body.id } })).toBe(1);
    });

    it('ADM-01 RN-20 CNPJ inválido ou já usado (inclusive por empresa) dá erro no campo', async () => {
      const invalido = await admin.post('/admin/faculdades', { ...novaFaculdade(), cnpj: '11222333000182' }).expect(400);
      expect(invalido.body.errors.map((e: { campo: string }) => e.campo)).toContain('cnpj');

      const { empresa } = await cenario(app);
      const cnpjEmpresa = (await prisma(app).empresa.findUniqueOrThrow({ where: { id: empresa.id } })).cnpj;
      const usado = await admin.post('/admin/faculdades', { ...novaFaculdade(), cnpj: cnpjEmpresa }).expect(422);
      expect(usado.body.errors).toEqual([{ campo: 'cnpj', mensagem: 'CNPJ já cadastrado' }]);
    });

    it('ADM-01 recusa domínio de provedor público ou já usado por outra faculdade', async () => {
      const publico = await admin.post('/admin/faculdades', { ...novaFaculdade(), dominios: ['gmail.com'] }).expect(400);
      expect(publico.body.errors[0]).toMatchObject({ campo: 'dominios.0' });

      const { faculdade } = await cenario(app);
      const usado = await admin.post('/admin/faculdades', { ...novaFaculdade(), dominios: [faculdade.dominio] }).expect(422);
      expect(usado.body.errors[0].campo).toBe('dominios.0');
    });

    it('ADM-01 lista as faculdades paginadas', async () => {
      const res = await admin.get('/admin/faculdades?page=1&pageSize=2').expect(200);
      expect(res.body.meta).toMatchObject({ page: 1, pageSize: 2 });
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe('FAC-01 primeiro acesso', () => {
    it('FAC-01 convite define a senha e ativa a conta; link vale 72 h e uma vez', async () => {
      const dados = novaFaculdade();
      await admin.post('/admin/faculdades', dados).expect(201);
      const token = tokenDoEmail((await emailsPara(dados.email))[0]);
      const t = await prisma(app).tokenEmail.findFirstOrThrow({ where: { usuario: { email: dados.email }, tipo: 'CONVITE' } });
      expect(Math.round((t.expiraEm.getTime() - Date.now()) / 3600_000)).toBe(72);

      // Sem senha, o login falha com a mensagem genérica.
      await request(app.getHttpServer()).post(`${API}/auth/login`).send({ email: dados.email, senha: 'Qualquer#123' }).expect(401);

      const senha = 'Faculdade#2026';
      await request(app.getHttpServer()).post(`${API}/auth/convite/aceitar`).send({ token, senha, confirmacao: senha }).expect(200);
      await request(app.getHttpServer()).post(`${API}/auth/convite/aceitar`).send({ token, senha, confirmacao: senha }).expect(400);
      const res = await new Cliente(app).login(dados.email, senha);
      expect(res.body.painel).toBe('/faculdade');
    });
  });

  describe('ADM-02 gerir faculdade', () => {
    it('ADM-02 adiciona e remove domínios; não remove o último', async () => {
      const f = (await admin.post('/admin/faculdades', novaFaculdade()).expect(201)).body;
      const extra = `pos.${sufixo()}.edu.br`;
      const comExtra = await admin.post(`/admin/faculdades/${f.id}/dominios`, { dominio: extra }).expect(201);
      expect(comExtra.body.dominios).toContain(extra);
      await admin.delete(`/admin/faculdades/${f.id}/dominios`, { dominio: extra }).expect(200);
      await admin.delete(`/admin/faculdades/${f.id}/dominios`, { dominio: f.dominios[0] }).expect(422);
    });

    it('ADM-02 reenvia o convite enquanto a senha não foi definida', async () => {
      const dados = novaFaculdade();
      const f = (await admin.post('/admin/faculdades', dados).expect(201)).body;
      await admin.post(`/admin/faculdades/${f.id}/convite`).expect(202);
      expect(await emailsPara(dados.email)).toHaveLength(2);
    });

    it('ADM-02 D19 RN-22 RN-27 inativar bloqueia o login da faculdade, inativa os alunos e cancela candidaturas; reativar devolve só esses alunos', async () => {
      const c = await cenario(app, { comCandidatura: true });
      // Aluno desligado antes pela faculdade não deve voltar ao reativar a faculdade.
      const desligado = await cenario(app);
      await prisma(app).aluno.update({ where: { id: desligado.aluno.id }, data: { faculdadeId: c.faculdade.id, motivoInativacao: 'DESLIGADO_PELA_FACULDADE' } });
      await prisma(app).usuario.update({ where: { id: desligado.aluno.usuarioId }, data: { status: 'INATIVO' } });

      await admin.patch(`/admin/faculdades/${c.faculdade.id}`, { ativa: false }).expect(200);

      await request(app.getHttpServer()).post(`${API}/auth/login`).send({ email: c.faculdade.email, senha: c.faculdade.senha }).expect(401);
      const aluno = await prisma(app).aluno.findUniqueOrThrow({ where: { id: c.aluno.id }, include: { usuario: true } });
      expect(aluno.usuario.status).toBe('INATIVO');
      expect(aluno.motivoInativacao).toBe('FACULDADE_INATIVA');
      const cand = await prisma(app).candidatura.findUniqueOrThrow({ where: { id: c.candidaturaId! }, include: { eventos: true } });
      expect(cand).toMatchObject({ status: 'CANCELADA', motivoCancelamento: 'ALUNO_INATIVO' });
      expect(cand.eventos.some((e) => e.tipo === 'CANCELADA')).toBe(true);
      expect(await prisma(app).notificacao.count({ where: { usuarioId: c.empresa.usuarioId, tipo: 'CANDIDATO_INATIVO' } })).toBe(1);

      await admin.patch(`/admin/faculdades/${c.faculdade.id}`, { ativa: true }).expect(200);
      const reativado = await prisma(app).usuario.findUniqueOrThrow({ where: { id: c.aluno.usuarioId } });
      const continuaInativo = await prisma(app).usuario.findUniqueOrThrow({ where: { id: desligado.aluno.usuarioId } });
      expect(reativado.status).toBe('ATIVO');
      expect(continuaInativo.status).toBe('INATIVO');
      await new Cliente(app).login(c.faculdade.email, c.faculdade.senha);
    });
  });

  describe('ADM-03 áreas de formação', () => {
    it('ADM-03 cria, renomeia e inativa áreas; nome é único', async () => {
      const nome = `Área ${sufixo()}`;
      const area = (await admin.post('/admin/areas', { nome }).expect(201)).body;
      await admin.post('/admin/areas', { nome: nome.toUpperCase() }).expect(422);
      await admin.patch(`/admin/areas/${area.id}`, { nome: `${nome} renomeada` }).expect(200);
      await admin.patch(`/admin/areas/${area.id}`, { ativa: false }).expect(200);

      const aluno = new Cliente(app);
      const c = await cenario(app);
      await aluno.login(c.aluno.email, c.aluno.senha);
      const visiveis = (await aluno.get('/areas').expect(200)).body.map((a: { id: string }) => a.id);
      expect(visiveis).not.toContain(area.id);
    });

    it('ADM-03 área em uso por curso ou vaga não pode ser excluída; sem uso, pode', async () => {
      const emUso = (await admin.get('/admin/areas').expect(200)).body.find((a: { nome: string }) => a.nome === 'Tecnologia');
      await cenario(app, { areaCurso: 'Tecnologia' });
      await admin.delete(`/admin/areas/${emUso.id}`).expect(409);
      const livre = (await admin.post('/admin/areas', { nome: `Livre ${sufixo()}` }).expect(201)).body;
      await admin.delete(`/admin/areas/${livre.id}`).expect(204);
    });
  });
});
