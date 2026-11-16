import type { INestApplication } from '@nestjs/common';
import { mensagemEncerrada, mensagemSelecionado } from '@vagas/contracts';
import request from 'supertest';
import { API, cenario, Cliente, criarApp, emailsPara, prisma, type Cenario } from './util';

const H = 3600_000;
const horasAtras = (h: number) => new Date(Date.now() - h * H);

describe('Ciclo de vida da vaga e notificações', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarApp();
    await request(app.getHttpServer()).post(`${API}/__test__/reset`).expect(204);
  });
  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());
  const job = async (nome: string, vagaId?: string) => (await http().post(`${API}/__test__/jobs/${nome}`).send({ vagaId }).expect(200)).body.processados as number;
  const moverPrazo = (vagaId: string, prazo: Date) => http().post(`${API}/__test__/vagas/${vagaId}/prazo`).send({ prazo: prazo.toISOString() }).expect(204);
  const vaga = (id: string) => prisma(app).vaga.findUniqueOrThrow({ where: { id } });
  const candidatura = (id: string) => prisma(app).candidatura.findUniqueOrThrow({ where: { id } });
  const notificacoes = (usuarioId: string, tipo?: string) => prisma(app).notificacao.findMany({ where: { usuarioId, ...(tipo ? { tipo } : {}) }, orderBy: { criadaEm: 'asc' } });

  async function logados(opcoes: object = {}) {
    const c = await cenario(app, opcoes);
    const emp = new Cliente(app);
    await emp.login(c.empresa.email, c.empresa.senha);
    const aluno = new Cliente(app);
    await aluno.login(c.aluno.email, c.aluno.senha);
    return { c, emp, aluno };
  }

  /** Mais um aluno (de outro cenário, mesma área) candidatado à vaga de `c`. */
  async function maisUmCandidato(c: Cenario) {
    const o = await cenario(app);
    const cliente = new Cliente(app);
    await cliente.login(o.aluno.email, o.aluno.senha);
    const id = (await cliente.post(`/vagas/${c.vaga.id}/candidaturas`).expect(201)).body.id as string;
    return { o, cliente, id };
  }

  describe('EMP-11 encerrar vaga com devolutiva', () => {
    it('EMP-11 RN-14 selecionados viram SELECIONADO, os demais em processo NAO_SELECIONADO, e todos são avisados', async () => {
      const { c, emp } = await logados({ comCandidatura: true });
      const b = await maisUmCandidato(c);
      const d = await maisUmCandidato(c);
      const empresa = await prisma(app).empresa.findUniqueOrThrow({ where: { id: c.empresa.id } });

      const r = await emp.post(`/empresa/vagas/${c.vaga.id}/encerrar`, { selecionados: [b.id] }).expect(200);
      expect(r.body).toMatchObject({ status: 'ENCERRADA', motivoEncerramento: 'MANUAL', resultado: { selecionados: 1, naoSelecionados: 2 } });
      expect(r.body.encerradaEm).toBeTruthy();

      expect((await candidatura(b.id)).status).toBe('SELECIONADO');
      expect((await candidatura(c.candidaturaId!)).status).toBe('NAO_SELECIONADO');
      expect((await candidatura(d.id)).status).toBe('NAO_SELECIONADO');

      const [sel] = await notificacoes(b.o.aluno.usuarioId);
      expect(sel).toMatchObject({ tipo: 'SELECIONADO', mensagem: mensagemSelecionado(c.vaga.funcao, empresa.nomeFantasia), link: `/aluno/candidaturas/${b.id}` });
      const [nao] = await notificacoes(c.aluno.usuarioId);
      expect(nao).toMatchObject({ tipo: 'NAO_SELECIONADO', mensagem: mensagemEncerrada(c.vaga.funcao, empresa.nomeFantasia) });

      // RN-18: evento imutável com autor; RN-23: cada notificação vira e-mail.
      const ev = await prisma(app).candidaturaEvento.findFirstOrThrow({ where: { candidaturaId: b.id, tipo: 'SELECIONADO' } });
      expect(ev).toMatchObject({ deStatus: 'EM_PROCESSO', paraStatus: 'SELECIONADO', autorId: c.empresa.usuarioId });
      expect(await job('enviar-emails')).toBeGreaterThanOrEqual(3);
      expect((await emailsPara(b.o.aluno.email)).map((e) => e.assunto)).toContain(`Você foi selecionado(a): ${c.vaga.funcao}`);
      expect((await emailsPara(c.aluno.email)).map((e) => e.assunto)).toContain(`Vaga encerrada: ${c.vaga.funcao}`);
    });

    it('EMP-11 a ação é irreversível: encerrar de novo, editar, prorrogar ou se candidatar → 409', async () => {
      const { c, emp, aluno } = await logados();
      await emp.post(`/empresa/vagas/${c.vaga.id}/encerrar`, {}).expect(200);
      await emp.post(`/empresa/vagas/${c.vaga.id}/encerrar`, {}).expect(409);
      await emp.patch(`/empresa/vagas/${c.vaga.id}`, { versao: (await vaga(c.vaga.id)).versao, funcao: 'X' }).expect(409);
      await emp.post(`/empresa/vagas/${c.vaga.id}/pausar`).expect(409);
      await aluno.post(`/vagas/${c.vaga.id}/candidaturas`).expect(409);
    });

    it('EMP-11 só candidatos em processo podem ser selecionados; nada muda se a escolha é inválida', async () => {
      const { c, emp } = await logados({ comCandidatura: true });
      const b = await maisUmCandidato(c);
      await emp.post(`/empresa/candidaturas/${b.id}/nao-selecionar`).expect(200);
      const outra = await cenario(app, { comCandidatura: true });

      for (const invalido of [b.id, outra.candidaturaId!]) {
        const r = await emp.post(`/empresa/vagas/${c.vaga.id}/encerrar`, { selecionados: [c.candidaturaId, invalido] }).expect(422);
        expect(r.body.errors).toEqual([{ campo: 'selecionados', mensagem: 'Selecione apenas candidatos em processo' }]);
      }
      expect((await vaga(c.vaga.id)).status).toBe('ABERTA');
      expect((await candidatura(c.candidaturaId!)).status).toBe('EM_PROCESSO');
      expect(await notificacoes(c.aluno.usuarioId)).toEqual([]);
    });

    it('EMP-11 D17 candidatura cancelada (inclusive por desligamento) não recebe devolutiva; vaga expirada também encerra', async () => {
      const { c, emp } = await logados({ comCandidatura: true });
      const d = await maisUmCandidato(c);
      const fac = new Cliente(app);
      await fac.login(d.o.faculdade.email, d.o.faculdade.senha);
      await fac.patch(`/faculdade/alunos/${d.o.aluno.id}/status`, { status: 'INATIVO', motivo: 'Desligado' }).expect(200);
      await moverPrazo(c.vaga.id, horasAtras(1));
      await job('expirar-prazos', c.vaga.id);

      const r = await emp.post(`/empresa/vagas/${c.vaga.id}/encerrar`, { selecionados: [c.candidaturaId] }).expect(200);
      expect(r.body.resultado).toEqual({ selecionados: 1, naoSelecionados: 0 });
      expect((await candidatura(d.id)).status).toBe('CANCELADA');
      expect(await notificacoes(d.o.aluno.usuarioId)).toEqual([]);
    });

    it('EMP-11 SEG-02 vaga de outra empresa → 404', async () => {
      const a = await logados();
      const b = await logados();
      await b.emp.post(`/empresa/vagas/${a.c.vaga.id}/encerrar`, {}).expect(404);
      expect((await vaga(a.c.vaga.id)).status).toBe('ABERTA');
    });

    it('EMP-11 candidatura simultânea ao encerramento: nunca sobra candidatura em processo numa vaga encerrada', async () => {
      for (let i = 0; i < 4; i++) {
        const { c, emp, aluno } = await logados();
        const [enc, cand] = await Promise.all([emp.post(`/empresa/vagas/${c.vaga.id}/encerrar`, {}), aluno.post(`/vagas/${c.vaga.id}/candidaturas`)]);
        expect(enc.status).toBe(200);
        expect([201, 409]).toContain(cand.status);
        expect(await prisma(app).candidatura.count({ where: { vagaId: c.vaga.id, status: 'EM_PROCESSO' } })).toBe(0);
        if (cand.status === 201) expect((await candidatura(cand.body.id)).status).toBe('NAO_SELECIONADO');
      }
    });
  });

  describe('JOB-01 vencimento do prazo', () => {
    it('JOB-01 RN-12 EMP-12 vaga ABERTA ou PAUSADA vencida vira PRAZO_EXPIRADO, sai da listagem e a empresa é notificada', async () => {
      const { c, emp, aluno } = await logados();
      const pausada = await logados();
      await pausada.emp.post(`/empresa/vagas/${pausada.c.vaga.id}/pausar`).expect(200);
      for (const v of [c.vaga.id, pausada.c.vaga.id]) await moverPrazo(v, horasAtras(1));

      expect(await job('expirar-prazos', c.vaga.id)).toBe(1);
      expect(await job('expirar-prazos', pausada.c.vaga.id)).toBe(1);
      expect((await vaga(c.vaga.id)).status).toBe('PRAZO_EXPIRADO');
      expect((await vaga(pausada.c.vaga.id)).status).toBe('PRAZO_EXPIRADO');

      const [n] = await notificacoes(c.empresa.usuarioId, 'PRAZO_VENCIDO');
      expect(n).toMatchObject({ titulo: `Prazo vencido: ${c.vaga.funcao}`, link: `/empresa/vagas/${c.vaga.id}` });
      expect(n.mensagem).toMatch(/Prorrogue o prazo ou encerre a vaga/);
      expect(n.mensagem).toMatch(/encerrada automaticamente em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/);

      const lista = (await aluno.get(`/vagas?q=${encodeURIComponent(c.vaga.funcao)}`).expect(200)).body;
      expect(lista.data).toEqual([]);
      await aluno.post(`/vagas/${c.vaga.id}/candidaturas`).expect(409);
      // Rodar de novo não notifica outra vez; prorrogar reabre (EMP-07).
      expect(await job('expirar-prazos', c.vaga.id)).toBe(0);
      expect(await notificacoes(c.empresa.usuarioId, 'PRAZO_VENCIDO')).toHaveLength(1);
      const novo = new Date(Date.now() + 10 * 24 * H).toISOString().slice(0, 10);
      expect((await emp.post(`/empresa/vagas/${c.vaga.id}/prorrogar`, { prazo: novo }).expect(200)).body.status).toBe('ABERTA');
    });

    it('JOB-01 vaga com prazo no futuro, ou de outro teste, não é tocada', async () => {
      const a = await cenario(app);
      const b = await cenario(app);
      await moverPrazo(b.vaga.id, horasAtras(1));
      expect(await job('expirar-prazos', a.vaga.id)).toBe(0);
      expect((await vaga(a.vaga.id)).status).toBe('ABERTA');
      expect((await vaga(b.vaga.id)).status).toBe('ABERTA'); // só roda para a vaga indicada
    });
  });

  describe('JOB-03 lembrete', () => {
    it('JOB-03 EMP-12 48 h após o vencimento, a empresa recebe o lembrete uma única vez', async () => {
      const c = await cenario(app);
      await moverPrazo(c.vaga.id, horasAtras(1));
      await job('expirar-prazos', c.vaga.id);
      expect(await job('lembrete', c.vaga.id)).toBe(0);

      await moverPrazo(c.vaga.id, horasAtras(49));
      expect(await job('lembrete', c.vaga.id)).toBe(1);
      expect(await job('lembrete', c.vaga.id)).toBe(0);
      const lembretes = await notificacoes(c.empresa.usuarioId, 'LEMBRETE_ENCERRAMENTO');
      expect(lembretes).toHaveLength(1);
      expect(lembretes[0]).toMatchObject({ titulo: `Lembrete: ${c.vaga.funcao} será encerrada em 24 h`, link: `/empresa/vagas/${c.vaga.id}` });
      expect((await vaga(c.vaga.id)).lembreteEnviadoEm).not.toBeNull();
    });
  });

  describe('JOB-02 encerramento automático', () => {
    it('JOB-02 RN-13 72 h após o prazo a vaga encerra (AUTOMATICO), em processo vira NAO_SELECIONADO e todos são avisados', async () => {
      const { c } = await logados({ comCandidatura: true });
      const b = await maisUmCandidato(c);
      const empresa = await prisma(app).empresa.findUniqueOrThrow({ where: { id: c.empresa.id } });
      await moverPrazo(c.vaga.id, horasAtras(1));
      await job('expirar-prazos', c.vaga.id);
      await moverPrazo(c.vaga.id, horasAtras(71));
      expect(await job('encerrar-automatico', c.vaga.id)).toBe(0);

      await moverPrazo(c.vaga.id, horasAtras(73));
      expect(await job('encerrar-automatico', c.vaga.id)).toBe(1);
      expect(await vaga(c.vaga.id)).toMatchObject({ status: 'ENCERRADA', motivoEncerramento: 'AUTOMATICO' });
      for (const id of [c.candidaturaId!, b.id]) expect((await candidatura(id)).status).toBe('NAO_SELECIONADO');
      const ev = await prisma(app).candidaturaEvento.findFirstOrThrow({ where: { candidaturaId: b.id, tipo: 'NAO_SELECIONADO' } });
      expect(ev.autorId).toBeNull(); // sistema

      const [aviso] = await notificacoes(c.aluno.usuarioId);
      expect(aviso).toMatchObject({ tipo: 'VAGA_ENCERRADA_AUTOMATICAMENTE', mensagem: mensagemEncerrada(c.vaga.funcao, empresa.nomeFantasia) });
      const [paraEmpresa] = await notificacoes(c.empresa.usuarioId, 'VAGA_ENCERRADA_AUTOMATICAMENTE');
      expect(paraEmpresa.mensagem).toContain('2 candidato(s)');

      expect(await job('encerrar-automatico', c.vaga.id)).toBe(0);
      expect(await notificacoes(c.aluno.usuarioId)).toHaveLength(1);
      await job('enviar-emails');
      expect((await emailsPara(c.aluno.email)).map((e) => e.assunto)).toContain(`Vaga encerrada: ${c.vaga.funcao}`);
    });

    it('JOB-02 empresa prorroga ou encerra no mesmo instante do job: só uma ação vence e ninguém é avisado duas vezes', async () => {
      const novo = new Date(Date.now() + 10 * 24 * H).toISOString().slice(0, 10);
      for (const acao of ['prorrogar', 'encerrar', 'prorrogar', 'encerrar'] as const) {
        const { c, emp } = await logados({ comCandidatura: true });
        await moverPrazo(c.vaga.id, horasAtras(1));
        await job('expirar-prazos', c.vaga.id);
        await moverPrazo(c.vaga.id, horasAtras(73));

        const [doJob, daEmpresa] = await Promise.all([
          job('encerrar-automatico', c.vaga.id),
          acao === 'prorrogar' ? emp.post(`/empresa/vagas/${c.vaga.id}/prorrogar`, { prazo: novo }) : emp.post(`/empresa/vagas/${c.vaga.id}/encerrar`, { selecionados: [c.candidaturaId] }),
        ]);
        const empresaVenceu = daEmpresa.status === 200;
        expect(doJob + (empresaVenceu ? 1 : 0)).toBe(1);
        const v = await vaga(c.vaga.id);
        const cand = await candidatura(c.candidaturaId!);
        if (!empresaVenceu) {
          expect(v).toMatchObject({ status: 'ENCERRADA', motivoEncerramento: 'AUTOMATICO' });
          expect(cand.status).toBe('NAO_SELECIONADO');
        } else if (acao === 'prorrogar') {
          expect(v.status).toBe('ABERTA');
          expect(cand.status).toBe('EM_PROCESSO');
        } else {
          expect(v.motivoEncerramento).toBe('MANUAL');
          expect(cand.status).toBe('SELECIONADO');
        }
        expect((await notificacoes(c.aluno.usuarioId)).length).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('ALU-11 central de notificações', () => {
    it('ALU-11 lista as notificações com o total de não lidas, marca uma e depois todas como lidas', async () => {
      const { c, emp, aluno } = await logados({ comCandidatura: true });
      const [, entrevista] = await prisma(app).etapaSelecao.findMany({ where: { vagaId: c.vaga.id }, orderBy: { ordem: 'asc' } });
      await emp.patch(`/empresa/candidaturas/${c.candidaturaId}/etapa`, { etapaId: entrevista.id }).expect(200);
      await emp.post(`/empresa/candidaturas/${c.candidaturaId}/nao-selecionar`).expect(200);

      const l = (await aluno.get('/notificacoes').expect(200)).body;
      expect(l).toMatchObject({ naoLidas: 2, meta: { total: 2 } });
      expect(l.data.map((n: { tipo: string }) => n.tipo)).toEqual(['NAO_SELECIONADO', 'ETAPA_ALTERADA']); // mais recente primeiro
      expect(l.data[0]).toMatchObject({ link: `/aluno/candidaturas/${c.candidaturaId}`, lidaEm: null });
      expect((await aluno.get('/notificacoes/nao-lidas').expect(200)).body).toEqual({ naoLidas: 2 });

      const lida = (await aluno.patch(`/notificacoes/${l.data[1].id}/lida`).expect(200)).body;
      expect(lida.lidaEm).toBeTruthy();
      // Marcar de novo mantém a data da primeira leitura.
      expect((await aluno.patch(`/notificacoes/${l.data[1].id}/lida`).expect(200)).body.lidaEm).toBe(lida.lidaEm);
      const naoLidas = (await aluno.get('/notificacoes?naoLidas=true').expect(200)).body;
      expect(naoLidas).toMatchObject({ naoLidas: 1, meta: { total: 1 } });
      expect(naoLidas.data[0].id).toBe(l.data[0].id);

      expect((await aluno.patch('/notificacoes/lidas').expect(200)).body).toEqual({ marcadas: 1 });
      expect((await aluno.get('/notificacoes/nao-lidas')).body).toEqual({ naoLidas: 0 });
    });

    it('ALU-11 notificação de outro usuário → 404; aluno inativo ainda vê as suas', async () => {
      const { c, emp, aluno } = await logados({ comCandidatura: true });
      await emp.post(`/empresa/candidaturas/${c.candidaturaId}/nao-selecionar`).expect(200);
      const [n] = await notificacoes(c.aluno.usuarioId);
      await emp.patch(`/notificacoes/${n.id}/lida`).expect(404);
      expect((await prisma(app).notificacao.findUniqueOrThrow({ where: { id: n.id } })).lidaEm).toBeNull();

      const fac = new Cliente(app);
      await fac.login(c.faculdade.email, c.faculdade.senha);
      await fac.patch(`/faculdade/alunos/${c.aluno.id}/status`, { status: 'INATIVO', motivo: 'Formado' }).expect(200);
      expect((await aluno.get('/notificacoes').expect(200)).body.data).toHaveLength(1);
      await aluno.patch(`/notificacoes/${n.id}/lida`).expect(200);
    });

    it('ALU-11 RN-23 todo evento in-app também sai por e-mail', async () => {
      const { c, emp } = await logados({ comCandidatura: true });
      await emp.post(`/empresa/candidaturas/${c.candidaturaId}/nao-selecionar`).expect(200);
      await job('enviar-emails');
      const n = (await notificacoes(c.aluno.usuarioId))[0];
      expect(n.emailEnviadoEm).not.toBeNull();
      const [email] = await emailsPara(c.aluno.email);
      expect(email.assunto).toBe(n.titulo);
      expect(email.texto).toContain(n.mensagem);
      expect(email.texto).toContain(`/aluno/candidaturas/${c.candidaturaId}`);
    });
  });
});
