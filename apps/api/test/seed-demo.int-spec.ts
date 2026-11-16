import type { INestApplication } from '@nestjs/common';
import { authenticator } from 'otplib';
import { PrismaClient } from '@prisma/client';
import { ADMIN_PADRAO } from '../src/seed/base';
import { seedDemo } from '../src/seed/demo';
import { CONTAS_DEMO, SENHA_DEMO } from '../src/seed/demo-dados';
import { Cliente, criarApp, prisma } from './util';

/** Seção 10.1: o seed de demonstração simula a plataforma em uso e respeita todas as regras. */
describe('Seed de demonstração (seção 10.1)', () => {
  let app: INestApplication;
  let db: PrismaClient;
  const agora = new Date();

  beforeAll(async () => {
    app = await criarApp();
    db = prisma(app) as unknown as PrismaClient;
    await seedDemo(db, { agora, reset: true });
  }, 120_000);
  afterAll(() => app.close());

  it('10.1 cria o conteúdo da tabela: faculdades, cursos, empresas, vagas, alunos e candidaturas', async () => {
    expect(await db.faculdade.count()).toBe(3);
    expect(await db.faculdade.findMany({ where: { ativa: false }, select: { nomeFantasia: true } })).toEqual([{ nomeFantasia: 'Instituto Aurora' }]);
    expect(await db.curso.count()).toBe(6);
    expect(await db.aula.count({ where: { semestre: { curso: { nome: 'Direito' } } } })).toBe(20);
    expect(await db.turma.count()).toBe(6 * 8);
    expect(await db.empresa.groupBy({ by: ['aprovacao'], _count: true, orderBy: { aprovacao: 'asc' } })).toEqual([
      { aprovacao: 'PENDENTE', _count: 1 },
      { aprovacao: 'APROVADA', _count: 4 },
      { aprovacao: 'REPROVADA', _count: 1 },
    ]);
    expect(await db.vaga.count()).toBe(15);
    const porStatus = Object.fromEntries((await db.vaga.groupBy({ by: ['status'], _count: true, orderBy: { status: 'asc' } })).map((g) => [g.status, g._count]));
    expect(porStatus).toMatchObject({ PAUSADA: 1, PRAZO_EXPIRADO: 1 });
    expect(porStatus.ABERTA).toBeGreaterThanOrEqual(9);
    expect(await db.vaga.count({ where: { motivoEncerramento: 'MANUAL' } })).toBeGreaterThanOrEqual(1);
    expect(await db.vaga.count({ where: { motivoEncerramento: 'AUTOMATICO' } })).toBeGreaterThanOrEqual(1);
    expect(await db.vaga.count({ where: { status: 'ABERTA', semestreMinimo: { not: null } } })).toBe(1);
    expect(await db.aluno.count()).toBe(40);
    expect(await db.aluno.count({ where: { motivoInativacao: 'DESLIGADO_PELA_FACULDADE' } })).toBe(2);
    expect(await db.curriculo.count()).toBe(39); // só o aluno novo está sem currículo
    const candidaturas = await db.candidatura.count();
    expect(candidaturas).toBeGreaterThanOrEqual(70);
    expect(candidaturas).toBeLessThanOrEqual(90);
    const status = new Set((await db.candidatura.groupBy({ by: ['status'], _count: true, orderBy: { status: 'asc' } })).map((g) => g.status));
    expect([...status].sort()).toEqual(['CANCELADA', 'EM_PROCESSO', 'NAO_SELECIONADO', 'SELECIONADO']);
  });

  it('10.1 datas relativas: uma vaga vence amanhã e a expirada venceu ontem', async () => {
    const em = (dias: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(agora.getTime() + dias * 86_400_000));
    const civil = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
    const abertas = await db.vaga.findMany({ where: { status: 'ABERTA' } });
    expect(abertas.some((v) => civil(v.prazo) === em(1))).toBe(true);
    const expirada = await db.vaga.findFirstOrThrow({ where: { status: 'PRAZO_EXPIRADO' } });
    expect(civil(expirada.prazo)).toBe(em(-1));
    expect(abertas.every((v) => v.prazo > agora)).toBe(true);
  });

  it('10.1 os dados respeitam as regras: estados, linha do tempo, inativos e notificações', async () => {
    // Seção 6: vaga encerrada não tem candidatura em processo; toda candidatura começa por CRIADA e anda em ordem.
    expect(await db.candidatura.count({ where: { status: 'EM_PROCESSO', vaga: { status: 'ENCERRADA' } } })).toBe(0);
    const todas = await db.candidatura.findMany({ include: { eventos: { orderBy: { criadoEm: 'asc' } }, vaga: { include: { areas: true } }, aluno: { include: { curso: true, usuario: true } } } });
    for (const c of todas) {
      expect(c.eventos[0].tipo).toBe('CRIADA');
      expect(c.eventos.at(-1)!.paraStatus).toBe(c.status);
      expect(c.eventos.every((e) => e.criadoEm <= agora)).toBe(true);
      // D1: só em vaga da área do curso.
      expect(c.vaga.areas.map((a) => a.areaId)).toContain(c.aluno.curso.areaId);
      // RN-22: aluno inativo não tem candidatura em processo.
      if (c.aluno.usuario.status === 'INATIVO') expect(c.status).not.toBe('EM_PROCESSO');
    }
    expect(await db.candidatura.count({ where: { motivoCancelamento: 'ALUNO_INATIVO' } })).toBeGreaterThanOrEqual(4);
    // Nenhuma notificação pendente de e-mail (nada vai ao Mailpit) e há não lidas.
    expect(await db.notificacao.count({ where: { emailEnviadoEm: null } })).toBe(0);
    expect(await db.notificacao.count({ where: { lidaEm: null } })).toBeGreaterThan(0);
  });

  it('10.1 as contas de demonstração entram com a senha do seed e mostram o que a aula pede', async () => {
    const entrar = async (email: string) => {
      const c = new Cliente(app);
      await c.login(email, SENHA_DEMO);
      return c;
    };
    const admin = new Cliente(app);
    await admin.login(ADMIN_PADRAO.email, ADMIN_PADRAO.senha, authenticator.generate(ADMIN_PADRAO.totp));
    expect((await admin.get('/admin/empresas?aprovacao=PENDENTE').expect(200)).body.data.map((e: { email: string }) => e.email)).toContain(CONTAS_DEMO.empresaPendente);

    const fac = await entrar(CONTAS_DEMO.faculdade);
    expect((await fac.get('/faculdade/alunos?pageSize=100').expect(200)).body.meta.total).toBe(24);

    const emp = await entrar(CONTAS_DEMO.empresa);
    const vagas = (await emp.get('/empresa/vagas').expect(200)).body as { status: string }[];
    expect(new Set(vagas.map((v) => v.status))).toEqual(new Set(['ABERTA', 'PAUSADA', 'PRAZO_EXPIRADO', 'ENCERRADA']));

    const pendente = await entrar(CONTAS_DEMO.empresaPendente);
    expect((await pendente.get('/me').expect(200)).body.aprovacao).toBe('PENDENTE');

    const ana = await entrar(CONTAS_DEMO.alunaAtiva);
    expect((await ana.get('/vagas').expect(200)).body.meta.total).toBeGreaterThanOrEqual(3);
    const andamento = (await ana.get('/alunos/me/candidaturas').expect(200)).body.data as { etapa: string }[];
    expect(new Set(andamento.map((c) => c.etapa)).size).toBeGreaterThan(1); // etapas diferentes
    expect((await ana.get('/alunos/me/candidaturas?aba=historico&status=SELECIONADO').expect(200)).body.meta.total).toBe(1);
    expect((await ana.get('/notificacoes/nao-lidas').expect(200)).body.naoLidas).toBeGreaterThan(0);

    const bruno = await entrar(CONTAS_DEMO.alunoHistorico);
    const hist = (await bruno.get('/alunos/me/candidaturas?aba=historico').expect(200)).body.data as { status: string }[];
    expect(hist.map((c) => c.status)).toEqual(expect.arrayContaining(['CANCELADA', 'NAO_SELECIONADO']));

    const carla = await entrar(CONTAS_DEMO.alunaDesligada);
    await carla.get('/vagas').expect(403);
    await carla.get('/alunos/me/candidaturas?aba=historico').expect(200);

    const diego = await entrar(CONTAS_DEMO.alunoNovo);
    expect((await diego.get('/alunos/me/curriculo').expect(200)).body.curriculo.objetivo).toBeNull();
  });

  it('10.1 é determinístico, recusa rodar duas vezes sem --reset e recusa produção', async () => {
    const nomes = async () => (await db.aluno.findMany({ orderBy: { nome: 'asc' }, select: { nome: true } })).map((a) => a.nome);
    const antes = await nomes();
    await expect(seedDemo(db, { agora })).rejects.toThrow('--reset');
    await seedDemo(db, { agora, reset: true });
    expect(await nomes()).toEqual(antes);

    const ambiente = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(seedDemo(db, { agora, reset: true })).rejects.toThrow('NODE_ENV=production');
    } finally {
      process.env.NODE_ENV = ambiente;
    }
    expect(await db.aluno.count()).toBe(40); // nada foi apagado
  }, 120_000);
});
