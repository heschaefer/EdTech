import type { INestApplication } from '@nestjs/common';
import { mensagemEncerrada, mensagemEtapa } from '@vagas/contracts';
import request from 'supertest';
import { API, cenario, Cliente, criarApp, prisma, type Cenario } from './util';

describe('Candidaturas', () => {
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

  /** Aluno de outro cenário (mesma área, Tecnologia) para ter vários candidatos na mesma vaga. */
  async function outroAluno(opcoes: object = {}) {
    const o = await cenario(app, opcoes);
    const cliente = new Cliente(app);
    await cliente.login(o.aluno.email, o.aluno.senha);
    return { o, cliente };
  }

  const notificacoesDe = (usuarioId: string) => prisma(app).notificacao.findMany({ where: { usuarioId }, orderBy: { criadaEm: 'asc' } });
  const etapasDa = (c: Cenario) => prisma(app).etapaSelecao.findMany({ where: { vagaId: c.vaga.id }, orderBy: { ordem: 'asc' } });

  describe('ALU-07 candidatar-se', () => {
    it('ALU-07 nasce EM_PROCESSO na primeira etapa e a empresa é notificada', async () => {
      const { c, aluno } = await logados();
      const r = await aluno.post(`/vagas/${c.vaga.id}/candidaturas`).expect(201);
      expect(r.body).toMatchObject({ status: 'EM_PROCESSO', etapa: 'Inscrição recebida · 1 de 2', vaga: { id: c.vaga.id, funcao: c.vaga.funcao }, podeRemover: true });
      expect(r.body.eventos).toEqual([expect.objectContaining({ tipo: 'CRIADA', paraStatus: 'EM_PROCESSO', etapaNome: 'Inscrição recebida' })]);

      const [n] = await notificacoesDe(c.empresa.usuarioId);
      expect(n).toMatchObject({ tipo: 'NOVA_CANDIDATURA', link: `/empresa/vagas/${c.vaga.id}/candidatos` });
      expect(n.mensagem).toContain(c.aluno.nome);
      // O detalhe da vaga passa a mostrar a candidatura e não oferece outra.
      const v = (await aluno.get(`/vagas/${c.vaga.id}`).expect(200)).body;
      expect(v).toMatchObject({ candidatura: { id: r.body.id, status: 'EM_PROCESSO' }, podeCandidatar: false });
    });

    it('ALU-07 RN-09 duplo clique ou requisições paralelas geram uma única candidatura', async () => {
      const { c, aluno } = await logados();
      const respostas = await Promise.all(Array.from({ length: 6 }, () => aluno.post(`/vagas/${c.vaga.id}/candidaturas`)));
      expect(respostas.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 200, 201]);
      expect(new Set(respostas.map((r) => r.body.id)).size).toBe(1);
      expect(await prisma(app).candidatura.count({ where: { vagaId: c.vaga.id } })).toBe(1);
      expect(await prisma(app).candidaturaEvento.count({ where: { candidatura: { vagaId: c.vaga.id } } })).toBe(1);
      expect(await notificacoesDe(c.empresa.usuarioId)).toHaveLength(1);
    });

    it('ALU-07 vaga PAUSADA, com prazo expirado ou ENCERRADA → 409 "Esta vaga não aceita candidaturas"', async () => {
      const pausada = await logados();
      await pausada.emp.post(`/empresa/vagas/${pausada.c.vaga.id}/pausar`).expect(200);
      const r1 = await pausada.aluno.post(`/vagas/${pausada.c.vaga.id}/candidaturas`).expect(409);
      expect(r1.body.detail).toBe('Esta vaga não aceita candidaturas');

      // Prazo vencido antes do JOB-01 rodar (vaga ainda ABERTA) e depois (PRAZO_EXPIRADO).
      const vencida = await logados();
      await prisma(app).vaga.update({ where: { id: vencida.c.vaga.id }, data: { prazo: new Date(Date.now() - 60_000) } });
      await vencida.aluno.post(`/vagas/${vencida.c.vaga.id}/candidaturas`).expect(409);
      await prisma(app).vaga.update({ where: { id: vencida.c.vaga.id }, data: { status: 'PRAZO_EXPIRADO' } });
      await vencida.aluno.post(`/vagas/${vencida.c.vaga.id}/candidaturas`).expect(409);

      const encerrada = await logados();
      await prisma(app).vaga.update({ where: { id: encerrada.c.vaga.id }, data: { status: 'ENCERRADA', encerradaEm: new Date(), motivoEncerramento: 'MANUAL' } });
      await encerrada.aluno.post(`/vagas/${encerrada.c.vaga.id}/candidaturas`).expect(409);
      expect(await prisma(app).candidatura.count({ where: { vagaId: { in: [pausada.c.vaga.id, vencida.c.vaga.id, encerrada.c.vaga.id] } } })).toBe(0);
    });

    it('ALU-07 RN-09 vaga fora da área ou abaixo do semestre mínimo → 404', async () => {
      const { c, aluno } = await logados({ areaCurso: 'Direito', areasVaga: ['Tecnologia'] });
      await aluno.post(`/vagas/${c.vaga.id}/candidaturas`).expect(404);
      const s = await logados({ semestreMinimo: 5 });
      await s.aluno.post(`/vagas/${s.c.vaga.id}/candidaturas`).expect(404);
      await aluno.post(`/vagas/00000000-0000-4000-8000-000000000000/candidaturas`).expect(404);
    });
  });

  describe('ALU-08 remover candidatura', () => {
    it('ALU-08 RN-10 vira CANCELADA, vai para o histórico e a empresa perde o perfil', async () => {
      const { c, emp, aluno } = await logados({ comCandidatura: true });
      await emp.get(`/empresa/candidaturas/${c.candidaturaId}`).expect(200);

      const r = await aluno.delete(`/candidaturas/${c.candidaturaId}`).expect(200);
      expect(r.body).toMatchObject({ status: 'CANCELADA', motivoCancelamento: 'ALUNO_REMOVEU', podeRemover: false });
      expect(r.body.eventos.at(-1)).toMatchObject({ tipo: 'CANCELADA', deStatus: 'EM_PROCESSO', paraStatus: 'CANCELADA' });

      await emp.get(`/empresa/candidaturas/${c.candidaturaId}`).expect(404);
      const lista = (await emp.get(`/empresa/vagas/${c.vaga.id}/candidaturas`).expect(200)).body;
      expect(lista.data).toEqual([]);
      const hist = (await aluno.get('/alunos/me/candidaturas?aba=historico').expect(200)).body;
      expect(hist.data.map((x: { id: string }) => x.id)).toEqual([c.candidaturaId]);
      expect((await aluno.get('/alunos/me/candidaturas').expect(200)).body.data).toEqual([]);
    });

    it('ALU-08 RN-10 com a vaga ABERTA, reinscrever-se reativa a mesma candidatura na primeira etapa', async () => {
      const { c, emp, aluno } = await logados({ comCandidatura: true });
      const [, entrevista] = await etapasDa(c);
      await emp.patch(`/empresa/candidaturas/${c.candidaturaId}/etapa`, { etapaId: entrevista.id }).expect(200);
      await aluno.delete(`/candidaturas/${c.candidaturaId}`).expect(200);

      const r = await aluno.post(`/vagas/${c.vaga.id}/candidaturas`).expect(201);
      expect(r.body).toMatchObject({ id: c.candidaturaId, status: 'EM_PROCESSO', etapaAtual: { nome: 'Inscrição recebida' }, motivoCancelamento: null });
      expect(r.body.eventos.map((e: { tipo: string }) => e.tipo)).toEqual(['CRIADA', 'ETAPA_ALTERADA', 'CANCELADA', 'REATIVADA']);
      expect((await notificacoesDe(c.empresa.usuarioId)).map((n) => n.tipo)).toEqual(['NOVA_CANDIDATURA']);
    });

    it('ALU-08 candidatura finalizada → 409; de outro aluno → 404', async () => {
      const { c, emp, aluno } = await logados({ comCandidatura: true });
      await emp.post(`/empresa/candidaturas/${c.candidaturaId}/nao-selecionar`).expect(200);
      await aluno.delete(`/candidaturas/${c.candidaturaId}`).expect(409);
      // Finalizada não volta por candidatura nova.
      await aluno.post(`/vagas/${c.vaga.id}/candidaturas`).expect(409);

      const { cliente } = await outroAluno();
      await cliente.delete(`/candidaturas/${c.candidaturaId}`).expect(404);
      await cliente.get(`/candidaturas/${c.candidaturaId}`).expect(404);
    });
  });

  describe('ALU-09 e ALU-10 acompanhamento', () => {
    it('ALU-09 "Em andamento" lista vaga, empresa, status, etapa e última mudança; o detalhe traz a linha do tempo', async () => {
      const { c, emp, aluno } = await logados({ comCandidatura: true });
      const [, entrevista] = await etapasDa(c);
      await emp.patch(`/empresa/candidaturas/${c.candidaturaId}/etapa`, { etapaId: entrevista.id }).expect(200);

      const lista = (await aluno.get('/alunos/me/candidaturas?aba=andamento').expect(200)).body;
      expect(lista.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
      expect(lista.data[0]).toMatchObject({ id: c.candidaturaId, status: 'EM_PROCESSO', etapa: 'Entrevista · 2 de 2', vaga: { funcao: c.vaga.funcao, empresa: expect.stringContaining('Empresa Teste') } });
      expect(new Date(lista.data[0].atualizadaEm).getTime()).toBeGreaterThan(new Date(lista.data[0].criadaEm).getTime());

      const d = (await aluno.get(`/candidaturas/${c.candidaturaId}`).expect(200)).body;
      expect(d.eventos.map((e: { tipo: string; etapaNome: string }) => [e.tipo, e.etapaNome])).toEqual([['CRIADA', 'Inscrição recebida'], ['ETAPA_ALTERADA', 'Entrevista']]);
      expect(d.vaga.etapas.map((e: { nome: string }) => e.nome)).toEqual(['Inscrição recebida', 'Entrevista']);
    });

    it('ALU-10 "Histórico" lista SELECIONADO, NAO_SELECIONADO e CANCELADA, com filtro por status', async () => {
      const { c, aluno } = await logados({ comCandidatura: true });
      // Mais duas candidaturas do mesmo aluno em vagas de outros cenários.
      const v2 = await cenario(app);
      const v3 = await cenario(app);
      const c2 = (await aluno.post(`/vagas/${v2.vaga.id}/candidaturas`).expect(201)).body.id;
      const c3 = (await aluno.post(`/vagas/${v3.vaga.id}/candidaturas`).expect(201)).body.id;
      await aluno.delete(`/candidaturas/${c.candidaturaId}`).expect(200);
      const emp2 = new Cliente(app);
      await emp2.login(v2.empresa.email, v2.empresa.senha);
      await emp2.post(`/empresa/candidaturas/${c2}/nao-selecionar`).expect(200);
      await prisma(app).candidatura.update({ where: { id: c3 }, data: { status: 'SELECIONADO' } });
      // Vaga pausada continua no histórico.
      await emp2.post(`/empresa/vagas/${v2.vaga.id}/pausar`).expect(200);

      const hist = (await aluno.get('/alunos/me/candidaturas?aba=historico').expect(200)).body;
      expect(hist.data.map((x: { status: string }) => x.status).sort()).toEqual(['CANCELADA', 'NAO_SELECIONADO', 'SELECIONADO']);
      const so = (await aluno.get('/alunos/me/candidaturas?aba=historico&status=NAO_SELECIONADO').expect(200)).body;
      expect(so.data).toEqual([expect.objectContaining({ id: c2, status: 'NAO_SELECIONADO', vaga: expect.objectContaining({ status: 'PAUSADA' }) })]);
      await aluno.get('/alunos/me/candidaturas?aba=historico&status=EM_PROCESSO').expect(400);
    });

    it('ALU-10 RN-22 aluno desligado vê o histórico, mas não se candidata', async () => {
      const { c, aluno } = await logados({ comCandidatura: true });
      const fac = new Cliente(app);
      await fac.login(c.faculdade.email, c.faculdade.senha);
      await fac.patch(`/faculdade/alunos/${c.aluno.id}/status`, { status: 'INATIVO', motivo: 'Trancou a matrícula' }).expect(200);

      const hist = (await aluno.get('/alunos/me/candidaturas?aba=historico').expect(200)).body;
      expect(hist.data).toEqual([expect.objectContaining({ id: c.candidaturaId, status: 'CANCELADA', motivoCancelamento: 'ALUNO_INATIVO' })]);
      await aluno.get(`/candidaturas/${c.candidaturaId}`).expect(200);
      await aluno.post(`/vagas/${c.vaga.id}/candidaturas`).expect(403);
    });
  });

  describe('EMP-08 lista de candidatos', () => {
    it('EMP-08 lista os não cancelados com contagem por etapa; inativo aparece sem perfil; quem removeu some', async () => {
      const { c, emp } = await logados({ comCandidatura: true });
      const [, entrevista] = await etapasDa(c);
      const b = await outroAluno();
      const cb = (await b.cliente.post(`/vagas/${c.vaga.id}/candidaturas`).expect(201)).body.id;
      const d = await outroAluno();
      const cd = (await d.cliente.post(`/vagas/${c.vaga.id}/candidaturas`).expect(201)).body.id;
      const r = await outroAluno();
      const cr = (await r.cliente.post(`/vagas/${c.vaga.id}/candidaturas`).expect(201)).body.id;
      await emp.patch(`/empresa/candidaturas/${cb}/etapa`, { etapaId: entrevista.id }).expect(200);
      await r.cliente.delete(`/candidaturas/${cr}`).expect(200);
      const fac = new Cliente(app);
      await fac.login(d.o.faculdade.email, d.o.faculdade.senha);
      await fac.patch(`/faculdade/alunos/${d.o.aluno.id}/status`, { status: 'INATIVO', motivo: 'Desligado' }).expect(200);

      const l = (await emp.get(`/empresa/vagas/${c.vaga.id}/candidaturas`).expect(200)).body;
      expect(l.meta.total).toBe(3);
      expect(l.data.map((x: { id: string }) => x.id)).toEqual([c.candidaturaId, cb, cd]); // mais antigas primeiro
      expect(l.data.map((x: { id: string }) => x.id)).not.toContain(cr);
      expect(l.etapas.map((e: { nome: string; emProcesso: number }) => [e.nome, e.emProcesso])).toEqual([['Inscrição recebida', 1], ['Entrevista', 1]]);
      expect(l.porStatus).toEqual({ EM_PROCESSO: 2, CANCELADA: 1 });

      const inativo = l.data.find((x: { id: string }) => x.id === cd);
      expect(inativo).toEqual({ id: cd, status: 'CANCELADA', alunoInativo: true, criadaEm: expect.any(String), atualizadaEm: expect.any(String), etapa: null, aluno: { nome: d.o.aluno.nome } });
      await emp.get(`/empresa/candidaturas/${cd}`).expect(404);
      expect(l.data[0]).toMatchObject({ alunoInativo: false, aluno: { nome: c.aluno.nome, semestre: 3, curso: c.curso.nome }, etapa: { nome: 'Inscrição recebida' } });

      const recentes = (await emp.get(`/empresa/vagas/${c.vaga.id}/candidaturas?ordem=recentes`).expect(200)).body;
      expect(recentes.data[0].id).toBe(cd);
    });

    it('EMP-08 filtra por curso, faixa de semestre, faculdade, etapa e status', async () => {
      const { c, emp } = await logados({ comCandidatura: true });
      const [, entrevista] = await etapasDa(c);
      const b = await outroAluno();
      const cb = (await b.cliente.post(`/vagas/${c.vaga.id}/candidaturas`).expect(201)).body.id;
      await prisma(app).aluno.update({ where: { id: b.o.aluno.id }, data: { semestreAtual: 7 } });
      await emp.patch(`/empresa/candidaturas/${cb}/etapa`, { etapaId: entrevista.id }).expect(200);

      const ids = async (q: string) => (await emp.get(`/empresa/vagas/${c.vaga.id}/candidaturas?${q}`).expect(200)).body.data.map((x: { id: string }) => x.id);
      expect(await ids(`cursoId=${b.o.curso.id}`)).toEqual([cb]);
      expect(await ids(`faculdadeId=${c.faculdade.id}`)).toEqual([c.candidaturaId]);
      expect(await ids('semestreMin=5&semestreMax=8')).toEqual([cb]);
      expect(await ids('semestreMax=4')).toEqual([c.candidaturaId]);
      expect(await ids(`etapaId=${entrevista.id}`)).toEqual([cb]);
      expect(await ids('status=NAO_SELECIONADO')).toEqual([]);

      const l = (await emp.get(`/empresa/vagas/${c.vaga.id}/candidaturas`).expect(200)).body;
      expect(l.opcoes.cursos.map((x: { id: string }) => x.id).sort()).toEqual([c.curso.id, b.o.curso.id].sort());
      expect(l.opcoes.faculdades.map((x: { id: string }) => x.id).sort()).toEqual([c.faculdade.id, b.o.faculdade.id].sort());
      await emp.get(`/empresa/vagas/${c.vaga.id}/candidaturas?semestreMin=6&semestreMax=2`).expect(400);
    });
  });

  describe('EMP-09 perfil do candidato', () => {
    it('EMP-09 D12 mostra dados, vínculo e currículo atual, sem CPF; cada acesso vai para a auditoria', async () => {
      const { c, emp, aluno } = await logados({ comCandidatura: true });
      await aluno.put('/alunos/me/curriculo', {
        objetivo: 'Desenvolvedor back-end',
        links: [],
        habilidadesTecnicas: ['TypeScript'],
        habilidadesComportamentais: [],
        disponibilidade: [],
        formacoes: [],
        experiencias: [],
        cursos: [],
        idiomas: [],
        projetos: [],
      }).expect(200);

      const r = await emp.get(`/empresa/candidaturas/${c.candidaturaId}`).expect(200);
      expect(r.body.candidato).toEqual({
        nome: c.aluno.nome,
        email: c.aluno.email,
        telefone: '11999998888',
        faculdade: expect.stringContaining('Faculdade Teste'),
        curso: c.curso.nome,
        turma: { anoIngresso: 2025, periodoIngresso: 1 },
        semestre: 3,
        ativo: true,
      });
      expect(r.body.curriculo).toMatchObject({ objetivo: 'Desenvolvedor back-end', habilidadesTecnicas: ['TypeScript'] });
      expect(r.body.etapa).toBe('Inscrição recebida · 1 de 2');
      expect(JSON.stringify(r.body)).not.toMatch(/cpf/i);
      expect(JSON.stringify(r.body)).not.toContain(c.aluno.cpf);

      // D4: currículo sempre o atual.
      await aluno.put('/alunos/me/curriculo', { objetivo: 'Engenheiro de dados', links: [], habilidadesTecnicas: [], habilidadesComportamentais: [], disponibilidade: [], formacoes: [], experiencias: [], cursos: [], idiomas: [], projetos: [] }).expect(200);
      expect((await emp.get(`/empresa/candidaturas/${c.candidaturaId}`).expect(200)).body.curriculo.objetivo).toBe('Engenheiro de dados');

      const logs = await prisma(app).auditLog.findMany({ where: { acao: 'EMPRESA_VIU_PERFIL', entidadeId: c.candidaturaId } });
      expect(logs).toHaveLength(2);
      expect(logs[0]).toMatchObject({ usuarioId: c.empresa.usuarioId, entidade: 'Candidatura', dados: { alunoId: c.aluno.id } });
    });
  });

  describe('EMP-10 mover etapa e não selecionar', () => {
    it('EMP-10 RN-18 move de etapa, grava o evento e notifica o aluno com o nome da etapa', async () => {
      const { c, emp } = await logados({ comCandidatura: true });
      const [inscricao, entrevista] = await etapasDa(c);
      const r = await emp.patch(`/empresa/candidaturas/${c.candidaturaId}/etapa`, { etapaId: entrevista.id }).expect(200);
      expect(r.body).toMatchObject({ status: 'EM_PROCESSO', etapaAtual: { id: entrevista.id, nome: 'Entrevista' } });

      const ev = await prisma(app).candidaturaEvento.findMany({ where: { candidaturaId: c.candidaturaId }, orderBy: { criadoEm: 'asc' } });
      expect(ev.at(-1)).toMatchObject({ tipo: 'ETAPA_ALTERADA', deStatus: 'EM_PROCESSO', paraStatus: 'EM_PROCESSO', etapaNome: 'Entrevista', autorId: c.empresa.usuarioId });
      const [n] = await notificacoesDe(c.aluno.usuarioId);
      expect(n).toMatchObject({ tipo: 'ETAPA_ALTERADA', link: `/aluno/candidaturas/${c.candidaturaId}` });
      const empresa = await prisma(app).empresa.findUniqueOrThrow({ where: { id: c.empresa.id } });
      expect(n.mensagem).toBe(mensagemEtapa(c.vaga.funcao, empresa.nomeFantasia, 'Entrevista'));

      // Voltar uma etapa também vale; mesma etapa ou etapa de outra vaga, não.
      await emp.patch(`/empresa/candidaturas/${c.candidaturaId}/etapa`, { etapaId: inscricao.id }).expect(200);
      await emp.patch(`/empresa/candidaturas/${c.candidaturaId}/etapa`, { etapaId: inscricao.id }).expect(422);
      const outra = await cenario(app);
      const [etapaAlheia] = await etapasDa(outra);
      const r2 = await emp.patch(`/empresa/candidaturas/${c.candidaturaId}/etapa`, { etapaId: etapaAlheia.id }).expect(422);
      expect(r2.body.errors).toEqual([{ campo: 'etapaId', mensagem: 'Etapa inválida para esta vaga' }]);
    });

    it('EMP-10 RN-15 "Não selecionado" finaliza a candidatura com a mensagem genérica; depois disso, 409', async () => {
      const { c, emp } = await logados({ comCandidatura: true });
      const [, entrevista] = await etapasDa(c);
      const r = await emp.post(`/empresa/candidaturas/${c.candidaturaId}/nao-selecionar`).expect(200);
      expect(r.body.status).toBe('NAO_SELECIONADO');

      const [n] = await notificacoesDe(c.aluno.usuarioId);
      const empresa = await prisma(app).empresa.findUniqueOrThrow({ where: { id: c.empresa.id } });
      expect(n).toMatchObject({ tipo: 'NAO_SELECIONADO', mensagem: mensagemEncerrada(c.vaga.funcao, empresa.nomeFantasia) });
      const ev = await prisma(app).candidaturaEvento.findMany({ where: { candidaturaId: c.candidaturaId }, orderBy: { criadoEm: 'asc' } });
      expect(ev.at(-1)).toMatchObject({ tipo: 'NAO_SELECIONADO', deStatus: 'EM_PROCESSO', paraStatus: 'NAO_SELECIONADO' });

      await emp.post(`/empresa/candidaturas/${c.candidaturaId}/nao-selecionar`).expect(409);
      await emp.patch(`/empresa/candidaturas/${c.candidaturaId}/etapa`, { etapaId: entrevista.id }).expect(409);
      // A empresa continua vendo o perfil de quem não foi selecionado (RN-19: não cancelada).
      await emp.get(`/empresa/candidaturas/${c.candidaturaId}`).expect(200);
    });

    it('EMP-10 com a vaga pausada a empresa ainda move e não seleciona', async () => {
      const { c, emp } = await logados({ comCandidatura: true });
      const [, entrevista] = await etapasDa(c);
      await emp.post(`/empresa/vagas/${c.vaga.id}/pausar`).expect(200);
      await emp.patch(`/empresa/candidaturas/${c.candidaturaId}/etapa`, { etapaId: entrevista.id }).expect(200);
      await emp.post(`/empresa/candidaturas/${c.candidaturaId}/nao-selecionar`).expect(200);
    });
  });

  describe('SEG-02 e SEG-09', () => {
    it('SEG-02 empresa B pede candidato, vaga ou candidatura da empresa A → 404', async () => {
      const a = await logados({ comCandidatura: true });
      const [, entrevista] = await etapasDa(a.c);
      const b = await logados();

      await b.emp.get(`/empresa/candidaturas/${a.c.candidaturaId}`).expect(404);
      await b.emp.get(`/empresa/vagas/${a.c.vaga.id}/candidaturas`).expect(404);
      await b.emp.get(`/empresa/vagas/${a.c.vaga.id}`).expect(404);
      await b.emp.patch(`/empresa/candidaturas/${a.c.candidaturaId}/etapa`, { etapaId: entrevista.id }).expect(404);
      await b.emp.post(`/empresa/candidaturas/${a.c.candidaturaId}/nao-selecionar`).expect(404);
      expect((await prisma(app).candidatura.findUniqueOrThrow({ where: { id: a.c.candidaturaId! } })).status).toBe('EM_PROCESSO');
      expect(await prisma(app).auditLog.count({ where: { acao: 'EMPRESA_VIU_PERFIL', usuarioId: b.c.empresa.usuarioId } })).toBe(0);
    });

    it('SEG-09 nenhuma resposta para a empresa contém o CPF (corpo inteiro)', async () => {
      const { c, emp } = await logados({ comCandidatura: true });
      const [, entrevista] = await etapasDa(c);
      const cpf = c.aluno.cpf;
      const formas = [cpf, `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`, `${cpf.slice(3, 6)}.${cpf.slice(6, 9)}`];
      const respostas = [
        await emp.get('/me'),
        await emp.get('/empresa/me'),
        await emp.get('/empresa/vagas'),
        await emp.get(`/empresa/vagas/${c.vaga.id}`),
        await emp.get(`/empresa/vagas/${c.vaga.id}/candidaturas`),
        await emp.get(`/empresa/candidaturas/${c.candidaturaId}`),
        await emp.patch(`/empresa/candidaturas/${c.candidaturaId}/etapa`, { etapaId: entrevista.id }),
        await emp.post(`/empresa/candidaturas/${c.candidaturaId}/nao-selecionar`),
      ];
      for (const r of respostas) {
        expect(r.status).toBeLessThan(300);
        const corpo = r.text;
        expect(corpo).not.toMatch(/cpf/i);
        for (const f of formas) expect(corpo).not.toContain(f);
      }
    });
  });
});
