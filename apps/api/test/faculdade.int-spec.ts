import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { API, cenario, Cliente, criarApp, prisma, type Cenario } from './util';

describe('Faculdade', () => {
  let app: INestApplication;
  let c: Cenario;
  let fac: Cliente;
  let areas: { id: string; nome: string }[];

  beforeAll(async () => {
    app = await criarApp();
    await request(app.getHttpServer()).post(`${API}/__test__/reset`).expect(204);
  });
  beforeEach(async () => {
    c = await cenario(app);
    fac = new Cliente(app);
    await fac.login(c.faculdade.email, c.faculdade.senha);
    areas = (await fac.get('/areas').expect(200)).body;
  });
  afterAll(() => app.close());

  const area = (nome: string) => areas.find((a) => a.nome === nome)!.id;
  const novoCurso = (extra: object = {}) => ({ nome: `Direito ${Math.random().toString(36).slice(2, 7)}`, areaId: area('Direito'), duracaoAnos: 5, ementa: 'Formação jurídica', ...extra });

  describe('FAC-02 dados cadastrais', () => {
    it('FAC-02 edita razão social, nome fantasia, telefone e e-mail de contato', async () => {
      const antes = (await fac.get('/faculdade/me').expect(200)).body;
      expect(antes.dominios).toEqual([c.faculdade.dominio]);
      const res = await fac
        .patch('/faculdade/me', { razaoSocial: 'Nova Razão S.A.', nomeFantasia: 'Nova Uni', telefone: '(11) 98888-7777', email: 'Secretaria@Nova.edu.br' })
        .expect(200);
      expect(res.body).toMatchObject({ razaoSocial: 'Nova Razão S.A.', nomeFantasia: 'Nova Uni', telefone: '11988887777', email: 'secretaria@nova.edu.br' });
      // O e-mail de contato não muda o login.
      expect(res.body.emailLogin).toBe(c.faculdade.email);
    });

    it('FAC-02 CNPJ e domínios não são editáveis pela faculdade', async () => {
      const r1 = await fac.patch('/faculdade/me', { cnpj: '11222333000181' }).expect(400);
      expect(r1.body.errors[0].campo).toBe('cnpj');
      await fac.patch('/faculdade/me', { dominios: ['x.edu.br'] }).expect(400);
    });
  });

  describe('FAC-03 cursos', () => {
    it('FAC-03 D13 cria curso e gera os semestres (anos × 2)', async () => {
      const curso = (await fac.post('/faculdade/cursos', novoCurso({ duracaoAnos: 3 })).expect(201)).body;
      expect(curso).toMatchObject({ duracaoAnos: 3, ativo: true, area: { nome: 'Direito' } });
      const semestres = (await fac.get(`/faculdade/cursos/${curso.id}/semestres`).expect(200)).body;
      expect(semestres.map((s: { ordem: number }) => s.ordem)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(semestres[5]).toMatchObject({ ano: 3, periodo: 2 });
    });

    it('FAC-03 nome único na faculdade (sem diferenciar maiúsculas)', async () => {
      const dados = novoCurso();
      await fac.post('/faculdade/cursos', dados).expect(201);
      const res = await fac.post('/faculdade/cursos', { ...dados, nome: dados.nome.toUpperCase() }).expect(422);
      expect(res.body.errors[0].campo).toBe('nome');
      // Outra faculdade pode usar o mesmo nome.
      const outra = await cenario(app);
      const fac2 = new Cliente(app);
      await fac2.login(outra.faculdade.email, outra.faculdade.senha);
      await fac2.post('/faculdade/cursos', dados).expect(201);
    });

    it('FAC-03 RN-07 área obrigatória e ativa', async () => {
      const r = await fac.post('/faculdade/cursos', novoCurso({ areaId: undefined })).expect(400);
      expect(r.body.errors[0].campo).toBe('areaId');
      const inativa = await prisma(app).areaFormacao.create({ data: { nome: `Inativa ${Date.now()}`, ativa: false } });
      const r2 = await fac.post('/faculdade/cursos', novoCurso({ areaId: inativa.id })).expect(422);
      expect(r2.body.errors[0]).toEqual({ campo: 'areaId', mensagem: 'Escolha uma área de formação ativa' });
    });

    it('FAC-03 duração entre 1 e 6 anos', async () => {
      await fac.post('/faculdade/cursos', novoCurso({ duracaoAnos: 0 })).expect(400);
      await fac.post('/faculdade/cursos', novoCurso({ duracaoAnos: 7 })).expect(400);
    });

    it('FAC-03 aumentar a duração cria semestres; reduzir remove os excedentes', async () => {
      const curso = (await fac.post('/faculdade/cursos', novoCurso({ duracaoAnos: 2 })).expect(201)).body;
      await fac.patch(`/faculdade/cursos/${curso.id}`, { duracaoAnos: 4 }).expect(200);
      expect((await fac.get(`/faculdade/cursos/${curso.id}/semestres`)).body).toHaveLength(8);
      await fac.patch(`/faculdade/cursos/${curso.id}`, { duracaoAnos: 1 }).expect(200);
      expect((await fac.get(`/faculdade/cursos/${curso.id}/semestres`)).body).toHaveLength(2);
    });

    it('FAC-03 reduzir a duração é bloqueado se há aluno em semestre acima do novo limite', async () => {
      // O aluno do cenário está no 3º semestre de um curso de 4 anos.
      const r = await fac.patch(`/faculdade/cursos/${c.curso.id}`, { duracaoAnos: 1 }).expect(422);
      expect(r.body.errors[0].campo).toBe('duracaoAnos');
      await fac.patch(`/faculdade/cursos/${c.curso.id}`, { duracaoAnos: 2 }).expect(200);
    });

    it('FAC-03 RN-25 curso com alunos não é excluído, só inativado', async () => {
      await fac.delete(`/faculdade/cursos/${c.curso.id}`).expect(409);
      const res = await fac.patch(`/faculdade/cursos/${c.curso.id}`, { ativo: false }).expect(200);
      expect(res.body.ativo).toBe(false);
      // Continua valendo para quem já está nele.
      const aluno = await prisma(app).aluno.findUniqueOrThrow({ where: { id: c.aluno.id } });
      expect(aluno.cursoId).toBe(c.curso.id);
    });

    it('FAC-03 curso sem alunos pode ser excluído, com semestres, aulas e turmas', async () => {
      const curso = (await fac.post('/faculdade/cursos', novoCurso()).expect(201)).body;
      const [s1] = (await fac.get(`/faculdade/cursos/${curso.id}/semestres`)).body;
      await fac.post(`/faculdade/semestres/${s1.id}/aulas`, { nome: 'Introdução', ementa: 'Ementa' }).expect(201);
      await fac.post(`/faculdade/cursos/${curso.id}/turmas`, { anoIngresso: 2026 }).expect(201);
      await fac.delete(`/faculdade/cursos/${curso.id}`).expect(204);
      await fac.get(`/faculdade/cursos/${curso.id}`).expect(404);
    });

    it('FAC-03 lista os cursos da faculdade com contagens', async () => {
      const lista = (await fac.get('/faculdade/cursos').expect(200)).body;
      expect(lista).toHaveLength(1);
      expect(lista[0]).toMatchObject({ id: c.curso.id, totalAlunos: 1, totalTurmas: 1 });
    });
  });

  describe('FAC-04 grade', () => {
    it('FAC-04 cadastra, ordena, edita e remove aulas de um semestre', async () => {
      const [s1] = (await fac.get(`/faculdade/cursos/${c.curso.id}/semestres`)).body;
      const criar = (nome: string) => fac.post(`/faculdade/semestres/${s1.id}/aulas`, { nome, ementa: `Ementa de ${nome}` }).expect(201);
      const a = (await criar('Algoritmos')).body;
      const b = (await criar('Cálculo')).body;
      const d = (await criar('Lógica')).body;
      expect([a.ordem, b.ordem, d.ordem]).toEqual([1, 2, 3]);

      await fac.patch(`/faculdade/aulas/${d.id}`, { ordem: 1, nome: 'Lógica Matemática' }).expect(200);
      let aulas = (await fac.get(`/faculdade/cursos/${c.curso.id}/semestres`)).body[0].aulas;
      expect(aulas.map((x: { nome: string; ordem: number }) => `${x.ordem}:${x.nome}`)).toEqual(['1:Lógica Matemática', '2:Algoritmos', '3:Cálculo']);

      await fac.delete(`/faculdade/aulas/${a.id}`).expect(204);
      aulas = (await fac.get(`/faculdade/cursos/${c.curso.id}/semestres`)).body[0].aulas;
      expect(aulas.map((x: { nome: string; ordem: number }) => `${x.ordem}:${x.nome}`)).toEqual(['1:Lógica Matemática', '2:Cálculo']);
    });

    it('FAC-04 aula exige nome e ementa', async () => {
      const [s1] = (await fac.get(`/faculdade/cursos/${c.curso.id}/semestres`)).body;
      const r = await fac.post(`/faculdade/semestres/${s1.id}/aulas`, { nome: '' }).expect(400);
      expect(r.body.errors.map((e: { campo: string }) => e.campo)).toEqual(expect.arrayContaining(['nome', 'ementa']));
    });
  });

  describe('FAC-05 turmas', () => {
    it('FAC-05 cria turma por ano e período, única por curso', async () => {
      const t = (await fac.post(`/faculdade/cursos/${c.curso.id}/turmas`, { anoIngresso: 2026, periodoIngresso: 2 }).expect(201)).body;
      expect(t).toMatchObject({ anoIngresso: 2026, periodoIngresso: 2, ativa: true });
      const dup = await fac.post(`/faculdade/cursos/${c.curso.id}/turmas`, { anoIngresso: 2026, periodoIngresso: 2 }).expect(422);
      expect(dup.body.errors[0].campo).toBe('anoIngresso');
      const lista = (await fac.get(`/faculdade/cursos/${c.curso.id}/turmas`).expect(200)).body;
      expect(lista.map((x: { anoIngresso: number; periodoIngresso: number }) => `${x.anoIngresso}/${x.periodoIngresso}`)).toEqual(['2026/2', '2025/1']);
    });

    it('FAC-05 RN-25 turma com alunos não pode ser excluída, só inativada', async () => {
      await fac.delete(`/faculdade/turmas/${c.turma.id}`).expect(409);
      const r = await fac.patch(`/faculdade/turmas/${c.turma.id}`, { ativa: false }).expect(200);
      expect(r.body.ativa).toBe(false);
      const vazia = (await fac.post(`/faculdade/cursos/${c.curso.id}/turmas`, { anoIngresso: 2024 }).expect(201)).body;
      await fac.delete(`/faculdade/turmas/${vazia.id}`).expect(204);
    });
  });

  describe('Posse (seção 8.2)', () => {
    it('SEG-01 faculdade A recebe 404 nos cursos, aulas e turmas da faculdade B', async () => {
      const b = await cenario(app);
      const [sB] = (await prisma(app).semestre.findMany({ where: { cursoId: b.curso.id }, orderBy: { ordem: 'asc' } }));
      const aulaB = await prisma(app).aula.create({ data: { semestreId: sB.id, nome: 'X', ementa: 'Y', ordem: 1 } });

      await fac.get(`/faculdade/cursos/${b.curso.id}`).expect(404);
      await fac.patch(`/faculdade/cursos/${b.curso.id}`, { nome: 'Invadido' }).expect(404);
      await fac.delete(`/faculdade/cursos/${b.curso.id}`).expect(404);
      await fac.get(`/faculdade/cursos/${b.curso.id}/semestres`).expect(404);
      await fac.post(`/faculdade/semestres/${sB.id}/aulas`, { nome: 'X', ementa: 'Y' }).expect(404);
      await fac.patch(`/faculdade/aulas/${aulaB.id}`, { nome: 'Invadida' }).expect(404);
      await fac.delete(`/faculdade/aulas/${aulaB.id}`).expect(404);
      await fac.get(`/faculdade/cursos/${b.curso.id}/turmas`).expect(404);
      await fac.post(`/faculdade/cursos/${b.curso.id}/turmas`, { anoIngresso: 2030 }).expect(404);
      await fac.patch(`/faculdade/turmas/${b.turma.id}`, { ativa: false }).expect(404);
      await fac.delete(`/faculdade/turmas/${b.turma.id}`).expect(404);
      expect((await prisma(app).curso.findUniqueOrThrow({ where: { id: b.curso.id } })).nome).not.toBe('Invadido');
    });
  });
});
