import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { API, cenario, Cliente, criarApp, prisma, vagaMinima, type Cenario } from './util';

const diasAFrente = (dias: number) => new Date(Date.now() + dias * 24 * 3600_000).toISOString().slice(0, 10);

describe('Vagas', () => {
  let app: INestApplication;
  let areas: Record<string, string>;

  beforeAll(async () => {
    app = await criarApp();
    await request(app.getHttpServer()).post(`${API}/__test__/reset`).expect(204);
    areas = Object.fromEntries((await prisma(app).areaFormacao.findMany()).map((a) => [a.nome, a.id]));
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

  describe('EMP-03 criar vaga', () => {
    it('EMP-03 publica a vaga ABERTA, com etapas ordenadas, e ela já aparece para os alunos da área', async () => {
      const { emp, aluno } = await logados();
      const v = (await emp.post('/empresa/vagas', vagaMinima(areas.Tecnologia, { funcao: 'Dev Júnior', etapas: [{ nome: 'Triagem' }, { nome: 'Entrevista' }], salario: { aCombinar: false, min: 1800, max: 2500 } })).expect(201)).body;
      expect(v).toMatchObject({ status: 'ABERTA', versao: 0, salario: { aCombinar: false, min: 1800, max: 2500 }, etapas: [{ nome: 'Triagem', ordem: 1 }, { nome: 'Entrevista', ordem: 2 }] });
      // RN-11: prazo vale até 23:59:59 de Brasília.
      expect(new Date(v.prazo).toISOString()).toMatch(/T02:59:59\.000Z$/);
      const lista = (await aluno.get('/vagas?q=Dev%20J%C3%BAnior').expect(200)).body;
      expect(lista.data.map((x: { id: string }) => x.id)).toContain(v.id);
    });

    it('EMP-03 RN-11 prazo no passado ou a mais de 1 ano da publicação dá erro no campo prazo', async () => {
      const { emp } = await logados();
      const passado = await emp.post('/empresa/vagas', vagaMinima(areas.Tecnologia, { prazo: diasAFrente(-1) })).expect(422);
      expect(passado.body.errors).toEqual([{ campo: 'prazo', mensagem: 'O prazo precisa ser uma data futura' }]);
      const longe = await emp.post('/empresa/vagas', vagaMinima(areas.Tecnologia, { prazo: diasAFrente(370) })).expect(422);
      expect(longe.body.errors).toEqual([{ campo: 'prazo', mensagem: 'O prazo não pode passar de 1 ano após a publicação' }]);
    });

    it('EMP-03 presencial exige cidade e UF; área precisa estar ativa', async () => {
      const { emp } = await logados();
      const r = await emp.post('/empresa/vagas', vagaMinima(areas.Tecnologia, { modalidade: 'PRESENCIAL' })).expect(400);
      expect(r.body.errors.map((e: { campo: string }) => e.campo)).toEqual(['cidade', 'uf']);
      const inativa = await prisma(app).areaFormacao.create({ data: { nome: `Inativa ${Date.now()}`, ativa: false } });
      await emp.post('/empresa/vagas', vagaMinima(inativa.id)).expect(422);
    });
  });

  describe('EMP-04 editar vaga', () => {
    it('EMP-04 edita com a versão atual; a segunda edição simultânea recebe 409 com a versão atual', async () => {
      const { c, emp } = await logados();
      const v = (await emp.get(`/empresa/vagas/${c.vaga.id}`).expect(200)).body;
      await emp.patch(`/empresa/vagas/${c.vaga.id}`, { versao: v.versao, funcao: 'Primeira edição' }).expect(200);
      const r = await emp.patch(`/empresa/vagas/${c.vaga.id}`, { versao: v.versao, funcao: 'Segunda edição' }).expect(409);
      expect(r.body.versaoAtual).toBe(v.versao + 1);
      expect((await emp.get(`/empresa/vagas/${c.vaga.id}`)).body.funcao).toBe('Primeira edição');
    });

    it('EMP-04 trocar áreas não remove candidaturas; etapa com candidatos não pode ser removida', async () => {
      const { c, emp } = await logados({ comCandidatura: true });
      const v = (await emp.get(`/empresa/vagas/${c.vaga.id}`)).body;
      const [inscricao, entrevista] = v.etapas;
      const r1 = await emp.patch(`/empresa/vagas/${c.vaga.id}`, { versao: v.versao, areaIds: [areas.Direito], etapas: [{ id: entrevista.id, nome: 'Entrevista' }] }).expect(422);
      expect(r1.body.detail).toContain('Inscrição recebida');

      const r2 = await emp
        .patch(`/empresa/vagas/${c.vaga.id}`, { versao: v.versao, areaIds: [areas.Direito], etapas: [{ id: inscricao.id, nome: 'Inscrição' }, { nome: 'Teste técnico' }, { id: entrevista.id, nome: 'Entrevista final' }] })
        .expect(200);
      expect(r2.body.areas.map((a: { nome: string }) => a.nome)).toEqual(['Direito']);
      expect(r2.body.etapas.map((e: { nome: string }) => e.nome)).toEqual(['Inscrição', 'Teste técnico', 'Entrevista final']);
      expect(await prisma(app).candidatura.count({ where: { vagaId: c.vaga.id } })).toBe(1);
    });

    it('EMP-04 vaga ENCERRADA não pode ser editada', async () => {
      const { c, emp } = await logados();
      await prisma(app).vaga.update({ where: { id: c.vaga.id }, data: { status: 'ENCERRADA' } });
      await emp.patch(`/empresa/vagas/${c.vaga.id}`, { versao: 0, funcao: 'x' }).expect(409);
    });
  });

  describe('EMP-05 pausar e reativar', () => {
    it('EMP-05 RN-16 pausar tira da listagem e bloqueia o detalhe; reativar devolve', async () => {
      const { c, emp, aluno } = await logados();
      await emp.post(`/empresa/vagas/${c.vaga.id}/pausar`).expect(200);
      expect((await aluno.get('/vagas').expect(200)).body.data.map((x: { id: string }) => x.id)).not.toContain(c.vaga.id);
      await aluno.get(`/vagas/${c.vaga.id}`).expect(404);
      await emp.post(`/empresa/vagas/${c.vaga.id}/pausar`).expect(409);
      await emp.post(`/empresa/vagas/${c.vaga.id}/reativar`).expect(200);
      expect((await aluno.get('/vagas').expect(200)).body.data.map((x: { id: string }) => x.id)).toContain(c.vaga.id);
    });

    it('EMP-05 RN-16 reativar só se o prazo não venceu', async () => {
      const { c, emp } = await logados();
      await emp.post(`/empresa/vagas/${c.vaga.id}/pausar`).expect(200);
      await prisma(app).vaga.update({ where: { id: c.vaga.id }, data: { prazo: new Date(Date.now() - 3600_000) } });
      const r = await emp.post(`/empresa/vagas/${c.vaga.id}/reativar`).expect(422);
      expect(r.body.detail).toContain('prorrogue');
    });
  });

  it('EMP-06 D10 RN-17 exclui (lógico) só vaga sem candidatura; com candidatura, só encerra', async () => {
    const { c, emp } = await logados({ comCandidatura: true });
    const r = await emp.delete(`/empresa/vagas/${c.vaga.id}`).expect(409);
    expect(r.body.detail).toContain('Encerrar');
    const nova = (await emp.post('/empresa/vagas', vagaMinima(areas.Tecnologia)).expect(201)).body;
    await emp.delete(`/empresa/vagas/${nova.id}`).expect(204);
    await emp.get(`/empresa/vagas/${nova.id}`).expect(404);
    expect((await prisma(app).vaga.findUniqueOrThrow({ where: { id: nova.id } })).excluidaEm).not.toBeNull();
  });

  describe('EMP-07 prorrogar', () => {
    it('EMP-07 vaga com prazo expirado volta para ABERTA com o novo prazo', async () => {
      const { c, emp, aluno } = await logados();
      await prisma(app).vaga.update({ where: { id: c.vaga.id }, data: { status: 'PRAZO_EXPIRADO', prazo: new Date(Date.now() - 3600_000), lembreteEnviadoEm: new Date() } });
      const r = await emp.post(`/empresa/vagas/${c.vaga.id}/prorrogar`, { prazo: diasAFrente(10) }).expect(200);
      expect(r.body.status).toBe('ABERTA');
      expect((await prisma(app).vaga.findUniqueOrThrow({ where: { id: c.vaga.id } })).lembreteEnviadoEm).toBeNull();
      await aluno.get(`/vagas/${c.vaga.id}`).expect(200);
    });

    it('EMP-07 RN-11 D21 novo prazo futuro e no máximo 1 ano após a publicação; encerrada não prorroga', async () => {
      const { c, emp } = await logados();
      await emp.post(`/empresa/vagas/${c.vaga.id}/prorrogar`, { prazo: diasAFrente(-2) }).expect(422);
      await emp.post(`/empresa/vagas/${c.vaga.id}/prorrogar`, { prazo: diasAFrente(400) }).expect(422);
      const pausada = await emp.post(`/empresa/vagas/${c.vaga.id}/pausar`).expect(200);
      const r = await emp.post(`/empresa/vagas/${c.vaga.id}/prorrogar`, { prazo: diasAFrente(60) }).expect(200);
      expect(r.body.status).toBe('PAUSADA');
      expect(r.body.versao).toBe(pausada.body.versao + 1);
      await prisma(app).vaga.update({ where: { id: c.vaga.id }, data: { status: 'ENCERRADA' } });
      await emp.post(`/empresa/vagas/${c.vaga.id}/prorrogar`, { prazo: diasAFrente(30) }).expect(409);
    });
  });

  describe('ALU-05 lista de vagas', () => {
    async function publicar(emp: Cliente, extra: object, diasPrazo = 20) {
      return (await emp.post('/empresa/vagas', vagaMinima(areas.Tecnologia, extra, diasPrazo)).expect(201)).body.id as string;
    }

    it('ALU-05 RN-08 só vagas ABERTAS da área do curso e com semestre mínimo atingido', async () => {
      const { c, emp, aluno } = await logados();
      const outraArea = (await emp.post('/empresa/vagas', vagaMinima(areas.Direito)).expect(201)).body.id;
      const semestreAlto = await publicar(emp, { semestreMinimo: 5 });
      const semestreOk = await publicar(emp, { semestreMinimo: 3 });
      const ids = (await aluno.get('/vagas?pageSize=100').expect(200)).body.data.map((x: { id: string }) => x.id);
      expect(ids).toEqual(expect.arrayContaining([c.vaga.id, semestreOk]));
      expect(ids).not.toContain(outraArea);
      expect(ids).not.toContain(semestreAlto);
    });

    it('ALU-05 filtros por texto, tipo, modalidade, UF, cidade, salário e publicação recente; ordenação por prazo', async () => {
      const { c, emp, aluno } = await logados();
      const nome = `Analista ${Date.now()}`;
      const clt = await publicar(emp, { funcao: nome, tipo: 'CLT', modalidade: 'HIBRIDO', cidade: 'Campinas', uf: 'SP', salario: { aCombinar: false, min: 4000, max: 5000 } }, 5);
      const ids = async (qs: string) => (await aluno.get(`/vagas?${qs}`).expect(200)).body.data.map((x: { id: string }) => x.id);

      expect(await ids(`q=${encodeURIComponent(nome)}`)).toEqual([clt]);
      expect(await ids('tipo=CLT&modalidade=HIBRIDO&uf=SP&cidade=campinas')).toContain(clt);
      expect(await ids('tipo=CLT')).not.toContain(c.vaga.id);
      expect(await ids('salarioMin=4500')).toContain(clt);
      expect(await ids('salarioMin=6000')).not.toContain(clt);
      expect(await ids('salarioMin=1000')).not.toContain(c.vaga.id); // "a combinar" sai do filtro de salário
      await prisma(app).vaga.update({ where: { id: c.vaga.id }, data: { criadaEm: new Date(Date.now() - 20 * 24 * 3600_000) } });
      expect(await ids('dias=15')).not.toContain(c.vaga.id);
      expect(await ids('dias=30')).toContain(c.vaga.id);
      const porPrazo = await ids('ordem=prazo&pageSize=100');
      expect(porPrazo.indexOf(clt)).toBeLessThan(porPrazo.indexOf(c.vaga.id));
      await aluno.get('/vagas?dias=10').expect(400);
    });

    it('ALU-05 pagina de 20 em 20 e marca "Candidatado"', async () => {
      const { c, aluno } = await logados({ comCandidatura: true });
      const r = (await aluno.get('/vagas').expect(200)).body;
      expect(r.meta).toMatchObject({ page: 1, pageSize: 20 });
      expect(r.data.find((x: { id: string }) => x.id === c.vaga.id)).toMatchObject({ candidatado: true, empresa: { nomeFantasia: expect.any(String) } });
    });

    it('ALU-05 RN-08 RN-26 empresa inativa ou não aprovada some da lista', async () => {
      const { c, aluno } = await logados();
      await prisma(app).empresa.update({ where: { id: c.empresa.id }, data: { aprovacao: 'PENDENTE' } });
      expect((await aluno.get('/vagas').expect(200)).body.data.map((x: { id: string }) => x.id)).not.toContain(c.vaga.id);
    });

    it('ALU-05 RN-22 aluno inativo não vê vagas', async () => {
      const { c, aluno } = await logados();
      await prisma(app).usuario.update({ where: { id: c.aluno.usuarioId }, data: { status: 'INATIVO' } });
      await aluno.get('/vagas').expect(403);
    });
  });

  describe('ALU-06 detalhe da vaga', () => {
    it('ALU-06 mostra todos os campos e as etapas; o aluno pode se candidatar', async () => {
      const { c, aluno } = await logados();
      const v = (await aluno.get(`/vagas/${c.vaga.id}`).expect(200)).body;
      expect(v).toMatchObject({ funcao: c.vaga.funcao, somenteLeitura: false, podeCandidatar: true, candidatura: null, etapas: [{ nome: 'Inscrição recebida' }, { nome: 'Entrevista' }] });
      for (const campo of ['atividades', 'requisitos', 'beneficios', 'processoSeletivo', 'cultura', 'salario', 'areas', 'prazo']) expect(v).toHaveProperty(campo);
      expect(v.empresa).toEqual({ nomeFantasia: expect.any(String), ramoAtuacao: 'Tecnologia', cidade: 'São Paulo', uf: 'SP' });
    });

    it('ALU-06 vaga fora da área → 404; vaga não ABERTA com candidatura → somente leitura', async () => {
      const a: Cenario = await cenario(app, { areaCurso: 'Direito', areasVaga: ['Tecnologia'] });
      const aluno = new Cliente(app);
      await aluno.login(a.aluno.email, a.aluno.senha);
      await aluno.get(`/vagas/${a.vaga.id}`).expect(404);

      const { c, emp, aluno: comCandidatura } = await logados({ comCandidatura: true });
      await emp.post(`/empresa/vagas/${c.vaga.id}/pausar`).expect(200);
      const v = (await comCandidatura.get(`/vagas/${c.vaga.id}`).expect(200)).body;
      expect(v).toMatchObject({ somenteLeitura: true, podeCandidatar: false, candidatura: { status: 'EM_PROCESSO' } });
    });
  });

  describe('Posse (seção 8.2)', () => {
    it('SEG-02 empresa A recebe 404 em qualquer ação sobre a vaga da empresa B', async () => {
      const { emp } = await logados();
      const b = await cenario(app);
      await emp.get(`/empresa/vagas/${b.vaga.id}`).expect(404);
      await emp.patch(`/empresa/vagas/${b.vaga.id}`, { versao: 0, funcao: 'Invadida' }).expect(404);
      for (const acao of ['pausar', 'reativar']) await emp.post(`/empresa/vagas/${b.vaga.id}/${acao}`).expect(404);
      await emp.post(`/empresa/vagas/${b.vaga.id}/prorrogar`, { prazo: diasAFrente(10) }).expect(404);
      await emp.delete(`/empresa/vagas/${b.vaga.id}`).expect(404);
      expect((await emp.get('/empresa/vagas').expect(200)).body.map((v: { id: string }) => v.id)).not.toContain(b.vaga.id);
    });
  });
});
