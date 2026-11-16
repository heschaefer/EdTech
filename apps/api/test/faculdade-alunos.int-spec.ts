import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { API, cenario, Cliente, criarApp, prisma } from './util';

describe('FAC-06 alunos da faculdade', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarApp();
    await request(app.getHttpServer()).post(`${API}/__test__/reset`).expect(204);
  });
  afterAll(() => app.close());

  async function faculdadeLogada(opcoes: object = {}) {
    const c = await cenario(app, opcoes);
    const fac = new Cliente(app);
    await fac.login(c.faculdade.email, c.faculdade.senha);
    return { c, fac };
  }

  it('FAC-06 lista os alunos com filtros e CPF mascarado, sem currículo', async () => {
    const { c, fac } = await faculdadeLogada();
    const r = (await fac.get(`/faculdade/alunos?cursoId=${c.curso.id}&turmaId=${c.turma.id}&semestre=3&status=ATIVO`).expect(200)).body;
    expect(r.meta.total).toBe(1);
    expect(r.data[0]).toMatchObject({ id: c.aluno.id, nome: c.aluno.nome, email: c.aluno.email, semestreAtual: 3, status: 'ATIVO' });
    expect(r.data[0].cpf).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
    expect(JSON.stringify(r)).not.toContain(c.aluno.cpf);
    expect(r.data[0]).not.toHaveProperty('curriculo');
    expect((await fac.get('/faculdade/alunos?semestre=5').expect(200)).body.meta.total).toBe(0);
    expect((await fac.get(`/faculdade/alunos?q=${encodeURIComponent(c.aluno.nome.slice(-6))}`).expect(200)).body.meta.total).toBe(1);
  });

  it('FAC-06 RN-22 D17 desligar exige motivo, inativa a conta, cancela as candidaturas em andamento e avisa a empresa', async () => {
    const { c, fac } = await faculdadeLogada({ comCandidatura: true });
    await fac.patch(`/faculdade/alunos/${c.aluno.id}/status`, { status: 'INATIVO' }).expect(400);
    const r = await fac.patch(`/faculdade/alunos/${c.aluno.id}/status`, { status: 'INATIVO', motivo: 'Trancou a matrícula' }).expect(200);
    expect(r.body).toMatchObject({ status: 'INATIVO', motivoInativacao: 'DESLIGADO_PELA_FACULDADE' });

    const cand = await prisma(app).candidatura.findUniqueOrThrow({ where: { id: c.candidaturaId! } });
    expect(cand).toMatchObject({ status: 'CANCELADA', motivoCancelamento: 'ALUNO_INATIVO' });
    expect(await prisma(app).notificacao.count({ where: { usuarioId: c.empresa.usuarioId, tipo: 'CANDIDATO_INATIVO' } })).toBe(1);
    const audit = await prisma(app).auditLog.findFirstOrThrow({ where: { acao: 'FACULDADE_DESLIGOU_ALUNO', entidadeId: c.aluno.id } });
    expect(audit.dados).toEqual({ motivo: 'Trancou a matrícula' });

    // RN-22: no login, o aluno só acessa a troca de faculdade e o histórico.
    const login = await request(app.getHttpServer()).post(`${API}/auth/login`).send({ email: c.aluno.email, senha: c.aluno.senha }).expect(200);
    expect(login.body.painel).toBe('/aluno/trocar-faculdade');

    await fac.patch(`/faculdade/alunos/${c.aluno.id}/status`, { status: 'INATIVO', motivo: 'De novo' }).expect(409);
  });

  it('FAC-06 reativa o aluno desligado; as candidaturas canceladas continuam canceladas', async () => {
    const { c, fac } = await faculdadeLogada({ comCandidatura: true });
    await fac.patch(`/faculdade/alunos/${c.aluno.id}/status`, { status: 'INATIVO', motivo: 'Engano' }).expect(200);
    const r = await fac.patch(`/faculdade/alunos/${c.aluno.id}/status`, { status: 'ATIVO' }).expect(200);
    expect(r.body).toMatchObject({ status: 'ATIVO', motivoInativacao: null });
    expect((await prisma(app).candidatura.findUniqueOrThrow({ where: { id: c.candidaturaId! } })).status).toBe('CANCELADA');
    await fac.patch(`/faculdade/alunos/${c.aluno.id}/status`, { status: 'ATIVO' }).expect(409);
  });

  it('FAC-06 SEG-01 aluno de outra faculdade → 404', async () => {
    const { fac } = await faculdadeLogada();
    const outra = await cenario(app);
    await fac.patch(`/faculdade/alunos/${outra.aluno.id}/status`, { status: 'INATIVO', motivo: 'Invasão' }).expect(404);
    expect((await fac.get('/faculdade/alunos').expect(200)).body.data.map((a: { id: string }) => a.id)).not.toContain(outra.aluno.id);
  });
});
