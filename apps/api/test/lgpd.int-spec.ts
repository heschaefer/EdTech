import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CifraService } from '../src/common/cripto/cifra.service';
import { API, cenario, Cliente, criarApp, prisma } from './util';

const CURRICULO = {
  objetivo: 'Analista de dados',
  links: [],
  habilidadesTecnicas: ['SQL'],
  habilidadesComportamentais: [],
  disponibilidade: [],
  formacoes: [],
  experiencias: [],
  cursos: [],
  idiomas: [],
  projetos: [],
};

describe('LGPD e auditoria (seção 8.4)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarApp();
    await request(app.getHttpServer()).post(`${API}/__test__/reset`).expect(204);
  });
  afterAll(() => app.close());

  async function logados(opcoes: object = {}) {
    const c = await cenario(app, opcoes);
    const emp = new Cliente(app);
    await emp.login(c.empresa.email, c.empresa.senha);
    const aluno = new Cliente(app);
    await aluno.login(c.aluno.email, c.aluno.senha);
    return { c, emp, aluno };
  }

  describe('Exportação dos dados do titular', () => {
    it('LGPD exporta em JSON os dados, o currículo, as candidaturas com eventos, as notificações e quem viu o perfil', async () => {
      const { c, emp, aluno } = await logados({ comCandidatura: true });
      await aluno.put('/alunos/me/curriculo', CURRICULO).expect(200);
      await emp.get(`/empresa/candidaturas/${c.candidaturaId}`).expect(200);
      await emp.post(`/empresa/candidaturas/${c.candidaturaId}/nao-selecionar`).expect(200);

      const r = await aluno.get('/alunos/me/dados').expect(200);
      expect(r.headers['content-disposition']).toBe('attachment; filename="meus-dados.json"');
      expect(r.headers['cache-control']).toBe('no-store');
      const empresa = await prisma(app).empresa.findUniqueOrThrow({ where: { id: c.empresa.id } });
      expect(r.body.titular).toMatchObject({ nome: c.aluno.nome, email: c.aluno.email, telefone: '11999998888', situacao: 'ATIVO', termos: { versao: '1' } });
      expect(r.body.titular.cpf).toBe(`***.${c.aluno.cpf.slice(3, 6)}.${c.aluno.cpf.slice(6, 9)}-**`);
      expect(JSON.stringify(r.body)).not.toContain(c.aluno.cpf);
      expect(r.body.vinculo).toMatchObject({ curso: c.curso.nome, turma: '2025/1', semestreAtual: 3 });
      expect(r.body.curriculo).toMatchObject({ objetivo: 'Analista de dados', habilidadesTecnicas: ['SQL'] });
      expect(r.body.candidaturas).toEqual([
        expect.objectContaining({ vaga: c.vaga.funcao, empresa: empresa.nomeFantasia, status: 'NAO_SELECIONADO', eventos: [expect.objectContaining({ tipo: 'CRIADA' }), expect.objectContaining({ tipo: 'NAO_SELECIONADO' })] }),
      ]);
      expect(r.body.notificacoes).toHaveLength(1);
      expect(r.body.acessosAoPerfil).toEqual([{ empresa: empresa.nomeFantasia, em: expect.any(String) }]);
      expect(await prisma(app).auditLog.count({ where: { acao: 'ALUNO_EXPORTOU_DADOS', usuarioId: c.aluno.usuarioId } })).toBe(1);
    });

    it('LGPD aluno inativo também exporta; outros papéis não acessam', async () => {
      const { c, emp, aluno } = await logados();
      const fac = new Cliente(app);
      await fac.login(c.faculdade.email, c.faculdade.senha);
      await fac.patch(`/faculdade/alunos/${c.aluno.id}/status`, { status: 'INATIVO', motivo: 'Trancou' }).expect(200);
      await aluno.get('/alunos/me/dados').expect(200);
      await emp.get('/alunos/me/dados').expect(403);
    });
  });

  describe('Exclusão com anonimização', () => {
    it('LGPD senha errada ou sem a confirmação não exclui nada', async () => {
      const { c, aluno } = await logados();
      const r = await aluno.post('/alunos/me/exclusao', { senha: 'errada', confirmacao: 'EXCLUIR' }).expect(422);
      expect(r.body.errors).toEqual([{ campo: 'senha', mensagem: 'Senha incorreta' }]);
      await aluno.post('/alunos/me/exclusao', { senha: c.aluno.senha, confirmacao: 'sim' }).expect(400);
      expect((await prisma(app).aluno.findUniqueOrThrow({ where: { id: c.aluno.id } })).anonimizadoEm).toBeNull();
    });

    it('LGPD anonimiza os dados pessoais, apaga currículo, sessões e notificações, e o acesso cai na hora', async () => {
      const { c, emp, aluno } = await logados({ comCandidatura: true });
      await aluno.put('/alunos/me/curriculo', CURRICULO).expect(200);
      // Uma candidatura finalizada (fica para os agregados) e uma em processo (é cancelada).
      await emp.post(`/empresa/candidaturas/${c.candidaturaId}/nao-selecionar`).expect(200);
      const outra = await cenario(app);
      const emProcesso = (await aluno.post(`/vagas/${outra.vaga.id}/candidaturas`).expect(201)).body.id;

      const r = await aluno.post('/alunos/me/exclusao', { senha: c.aluno.senha, confirmacao: 'EXCLUIR' }).expect(200);
      expect((r.headers['set-cookie'] as unknown as string[]).join()).toMatch(/at=;/);

      const a = await prisma(app).aluno.findUniqueOrThrow({ where: { id: c.aluno.id }, include: { usuario: true, curriculo: true } });
      expect(a).toMatchObject({ nome: 'Titular removido', telefone: '', cpfCifrado: '', curriculo: null, semestreAtual: 3, cursoId: c.curso.id });
      expect(a.anonimizadoEm).not.toBeNull();
      expect(a.usuario).toMatchObject({ senhaHash: null, status: 'INATIVO' });
      expect(a.usuario.email).toMatch(/^removido\.[0-9a-f]{16}@anonimizado\.invalid$/);
      // O CPF e o e-mail ficam livres para um novo cadastro.
      expect(await prisma(app).aluno.count({ where: { cpfHash: app.get(CifraService).hmac(c.aluno.cpf) } })).toBe(0);
      expect(await prisma(app).usuario.count({ where: { email: c.aluno.email } })).toBe(0);
      expect(await prisma(app).refreshToken.count({ where: { usuarioId: c.aluno.usuarioId } })).toBe(0);
      expect(await prisma(app).notificacao.count({ where: { usuarioId: c.aluno.usuarioId } })).toBe(0);

      expect((await prisma(app).candidatura.findUniqueOrThrow({ where: { id: emProcesso } })).status).toBe('CANCELADA');
      expect((await prisma(app).candidatura.findUniqueOrThrow({ where: { id: c.candidaturaId! } })).status).toBe('NAO_SELECIONADO');
      expect(await prisma(app).auditLog.count({ where: { acao: 'ALUNO_EXCLUIU_CONTA', entidadeId: c.aluno.id } })).toBe(1);

      // O login com o e-mail antigo falha (a sessão aberta é coberta no teste seguinte).
      await request(app.getHttpServer()).post(`${API}/auth/login`).send({ email: c.aluno.email, senha: c.aluno.senha }).expect(401);

      // A empresa vê a candidatura finalizada só como "Titular removido", sem perfil.
      const lista = (await emp.get(`/empresa/vagas/${c.vaga.id}/candidaturas`).expect(200)).body;
      expect(lista.data).toEqual([expect.objectContaining({ id: c.candidaturaId, status: 'NAO_SELECIONADO', alunoRemovido: true, aluno: { nome: 'Titular removido' } })]);
      expect(JSON.stringify(lista)).not.toContain(c.aluno.nome);
      await emp.get(`/empresa/candidaturas/${c.candidaturaId}`).expect(404);

      // A faculdade não vê mais o registro individual nem consegue reativá-lo.
      const fac = new Cliente(app);
      await fac.login(c.faculdade.email, c.faculdade.senha);
      expect((await fac.get('/faculdade/alunos').expect(200)).body.data).toEqual([]);
      await fac.patch(`/faculdade/alunos/${c.aluno.id}/status`, { status: 'ATIVO' }).expect(404);
    });

    it('LGPD sessão aberta antes da exclusão perde o acesso imediatamente', async () => {
      const { c } = await logados();
      const sessao1 = new Cliente(app);
      await sessao1.login(c.aluno.email, c.aluno.senha);
      const sessao2 = new Cliente(app);
      await sessao2.login(c.aluno.email, c.aluno.senha);
      await sessao1.post('/alunos/me/exclusao', { senha: c.aluno.senha, confirmacao: 'EXCLUIR' }).expect(200);
      await sessao2.get('/alunos/me').expect(401);
      await sessao2.get('/alunos/me/candidaturas').expect(401);
      await sessao2.agent.post(`${API}/auth/refresh`).expect(401);
    });

    it('LGPD RN-27 reativar a faculdade não reativa quem pediu exclusão', async () => {
      const { c, aluno } = await logados();
      const admin = new Cliente(app);
      await admin.loginAdmin();
      await admin.patch(`/admin/faculdades/${c.faculdade.id}`, { ativa: false }).expect(200);
      await aluno.post('/alunos/me/exclusao', { senha: c.aluno.senha, confirmacao: 'EXCLUIR' }).expect(200);
      await admin.patch(`/admin/faculdades/${c.faculdade.id}`, { ativa: true }).expect(200);
      const a = await prisma(app).aluno.findUniqueOrThrow({ where: { id: c.aluno.id }, include: { usuario: true } });
      expect(a.usuario.status).toBe('INATIVO');
      expect(a.anonimizadoEm).not.toBeNull();
    });
  });

  describe('Auditoria', () => {
    it('LGPD mudanças de status da vaga pela empresa e pelos jobs vão para a auditoria, com IP e autor', async () => {
      const { c, emp } = await logados();
      await emp.post(`/empresa/vagas/${c.vaga.id}/pausar`).expect(200);
      await request(app.getHttpServer()).post(`${API}/__test__/vagas/${c.vaga.id}/prazo`).send({ prazo: new Date(Date.now() - 3600_000).toISOString() }).expect(204);
      await request(app.getHttpServer()).post(`${API}/__test__/jobs/expirar-prazos`).send({ vagaId: c.vaga.id }).expect(200);
      await emp.post(`/empresa/vagas/${c.vaga.id}/encerrar`, {}).expect(200);

      const logs = await prisma(app).auditLog.findMany({ where: { entidade: 'Vaga', entidadeId: c.vaga.id }, orderBy: { criadoEm: 'asc' } });
      expect(logs.map((l) => [l.acao, l.usuarioId])).toEqual([
        ['EMPRESA_PAUSOU_VAGA', c.empresa.usuarioId],
        ['SISTEMA_EXPIROU_VAGA', null],
        ['EMPRESA_ENCERROU_VAGA', c.empresa.usuarioId],
      ]);
      expect(logs[0].ip).toBeTruthy();
      expect(logs[0].dados).toEqual({ de: 'ABERTA', para: 'PAUSADA' });
      expect(logs[2].dados).toMatchObject({ de: 'PRAZO_EXPIRADO', para: 'ENCERRADA', selecionados: 0, naoSelecionados: 0 });
    });

    it('LGPD o admin consulta a trilha de auditoria com filtros; outros papéis não', async () => {
      const { c, emp } = await logados({ comCandidatura: true });
      await emp.get(`/empresa/candidaturas/${c.candidaturaId}`).expect(200);
      const admin = new Cliente(app);
      await admin.loginAdmin();

      const r = (await admin.get(`/admin/auditoria?acao=EMPRESA_VIU_PERFIL&entidadeId=${c.candidaturaId}`).expect(200)).body;
      expect(r.meta.total).toBe(1);
      expect(r.data[0]).toMatchObject({ acao: 'EMPRESA_VIU_PERFIL', entidade: 'Candidatura', ator: { email: c.empresa.email, papel: 'EMPRESA' } });
      expect(r.acoes).toContain('EMPRESA_VIU_PERFIL');
      await emp.get('/admin/auditoria').expect(403);
    });
  });
});
