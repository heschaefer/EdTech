import type { INestApplication } from '@nestjs/common';
import { gerarCpf } from '@vagas/contracts';
import { randomInt } from 'node:crypto';
import request from 'supertest';
import { ManutencaoService } from '../src/modules/manutencao/manutencao.service';
import { API, cenario, Cliente, criarApp, emailsPara, prisma, tokenDoEmail, type Cenario } from './util';

const cpfNovo = () => gerarCpf(String(randomInt(100_000_000, 999_999_999)));
const SENHA = 'Xq9#mVt2!pL';

describe('Aluno', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await criarApp();
    await http().post(`${API}/__test__/reset`).expect(204);
  });
  afterAll(() => app.close());

  const dadosCadastro = (c: Cenario, extra: object = {}) => ({
    nome: 'Bruna Lima',
    cpf: cpfNovo(),
    email: `bruna.${randomInt(1e6)}@${c.faculdade.dominio}`,
    telefone: '(11) 97777-6666',
    senha: SENHA,
    confirmacao: SENHA,
    cursoId: c.curso.id,
    turmaId: c.turma.id,
    semestreAtual: 2,
    aceiteTermos: true,
    ...extra,
  });

  async function alunoLogado(opcoes: object = {}) {
    const c = await cenario(app, opcoes);
    const cli = new Cliente(app);
    await cli.login(c.aluno.email, c.aluno.senha);
    return { c, cli };
  }

  describe('ALU-01 cadastro', () => {
    it('ALU-01 RN-01 o domínio do e-mail traz a faculdade com cursos e turmas ativos', async () => {
      const c = await cenario(app);
      await prisma(app).curso.create({ data: { faculdadeId: c.faculdade.id, areaId: (await prisma(app).areaFormacao.findFirstOrThrow()).id, nome: 'Inativo', duracaoAnos: 1, ementa: 'x', ativo: false } });
      const res = await http().get(`${API}/faculdades/por-dominio`).query({ email: `X@${c.faculdade.dominio.toUpperCase()}` }).expect(200);
      expect(res.body.faculdade.id).toBe(c.faculdade.id);
      expect(res.body.cursos).toHaveLength(1);
      expect(res.body.cursos[0]).toMatchObject({ id: c.curso.id, duracaoAnos: 4, turmas: [{ id: c.turma.id, anoIngresso: 2025, periodoIngresso: 1 }] });
    });

    it('ALU-01 domínio não cadastrado ou de faculdade inativa: "Sua faculdade ainda não usa a plataforma"', async () => {
      const r = await http().get(`${API}/faculdades/por-dominio`).query({ email: 'a@desconhecida.edu.br' }).expect(404);
      expect(r.body.detail).toBe('Sua faculdade ainda não usa a plataforma');
      const c = await cenario(app);
      await prisma(app).faculdade.update({ where: { id: c.faculdade.id }, data: { ativa: false } });
      await http().get(`${API}/faculdades/por-dominio`).query({ email: `a@${c.faculdade.dominio}` }).expect(404);
      const cad = await http().post(`${API}/auth/alunos`).send(dadosCadastro(c)).expect(422);
      expect(cad.body.errors).toEqual([{ campo: 'email', mensagem: 'Sua faculdade ainda não usa a plataforma' }]);
    });

    it('ALU-01 RN-03 AUTH-05 conclui o cadastro pendente; o link do e-mail ativa a conta', async () => {
      const c = await cenario(app);
      const dados = dadosCadastro(c, { curriculo: { objetivo: 'Estágio em desenvolvimento', habilidadesTecnicas: ['TypeScript'] } });
      await http().post(`${API}/auth/alunos`).send(dados).expect(201);

      const usuario = await prisma(app).usuario.findUniqueOrThrow({ where: { email: dados.email }, include: { aluno: { include: { curriculo: true } } } });
      expect(usuario.status).toBe('PENDENTE_VERIFICACAO');
      expect(usuario.aluno).toMatchObject({ faculdadeId: c.faculdade.id, semestreAtual: 2, termosVersao: expect.any(String) });
      expect(usuario.aluno!.curriculo!.objetivo).toBe('Estágio em desenvolvimento');
      // 8.4: CPF cifrado e com índice cego, nunca em claro.
      expect(usuario.aluno!.cpfCifrado).not.toContain(dados.cpf);
      expect(usuario.aluno!.cpfHash).toMatch(/^[0-9a-f]{64}$/);

      const login = await http().post(`${API}/auth/login`).send({ email: dados.email, senha: SENHA }).expect(401);
      expect(login.body.type).toBe('email-nao-verificado');

      const token = tokenDoEmail((await emailsPara(dados.email))[0]);
      await http().post(`${API}/auth/verificar-email`).send({ token }).expect(200);
      const ok = await http().post(`${API}/auth/login`).send({ email: dados.email, senha: SENHA }).expect(200);
      expect(ok.body.painel).toBe('/aluno');
    });

    it('ALU-01 RN-02 CPF inválido ou já usado (inclusive por aluno inativo) dá erro no campo CPF', async () => {
      const c = await cenario(app);
      const r1 = await http().post(`${API}/auth/alunos`).send(dadosCadastro(c, { cpf: '123.456.789-00' })).expect(400);
      expect(r1.body.errors[0].campo).toBe('cpf');
      await prisma(app).usuario.update({ where: { id: c.aluno.usuarioId }, data: { status: 'INATIVO' } });
      const r2 = await http().post(`${API}/auth/alunos`).send(dadosCadastro(c, { cpf: c.aluno.cpf })).expect(422);
      expect(r2.body.errors).toEqual([{ campo: 'cpf', mensagem: 'CPF já cadastrado' }]);
    });

    it('ALU-01 RN-21 e-mail já usado dá erro no campo e-mail', async () => {
      const c = await cenario(app);
      const r = await http().post(`${API}/auth/alunos`).send(dadosCadastro(c, { email: c.aluno.email.toUpperCase() })).expect(422);
      expect(r.body.errors).toEqual([{ campo: 'email', mensagem: 'E-mail já cadastrado' }]);
    });

    it('ALU-01 RN-04 senha fora da política lista cada requisito não atendido', async () => {
      const c = await cenario(app);
      const r = await http().post(`${API}/auth/alunos`).send(dadosCadastro(c, { senha: 'abcdefgh', confirmacao: 'abcdefgh' })).expect(400);
      const msgs = r.body.errors.filter((e: { campo: string }) => e.campo === 'senha').map((e: { mensagem: string }) => e.mensagem);
      expect(msgs).toEqual(expect.arrayContaining(['Ao menos 1 letra maiúscula', 'Ao menos 1 número', 'Ao menos 1 caractere especial', 'Senha muito comum']));
    });

    it('ALU-01 campos obrigatórios e aceite dos termos', async () => {
      const r = await http().post(`${API}/auth/alunos`).send({}).expect(400);
      const campos = r.body.errors.map((e: { campo: string }) => e.campo);
      expect(campos).toEqual(expect.arrayContaining(['nome', 'cpf', 'email', 'telefone', 'senha', 'confirmacao', 'cursoId', 'turmaId', 'semestreAtual', 'aceiteTermos']));
    });

    it('ALU-01 RN-05 curso inativo, turma de outro curso ou semestre acima de duração × 2 são recusados', async () => {
      const c = await cenario(app);
      const outro = await cenario(app);
      const r1 = await http().post(`${API}/auth/alunos`).send(dadosCadastro(c, { turmaId: outro.turma.id })).expect(422);
      expect(r1.body.errors[0].campo).toBe('turmaId');
      const r2 = await http().post(`${API}/auth/alunos`).send(dadosCadastro(c, { semestreAtual: 9 })).expect(422);
      expect(r2.body.errors[0]).toEqual({ campo: 'semestreAtual', mensagem: 'O semestre vai de 1 a 8 neste curso' });
      await prisma(app).curso.update({ where: { id: c.curso.id }, data: { ativo: false } });
      const r3 = await http().post(`${API}/auth/alunos`).send(dadosCadastro(c)).expect(422);
      expect(r3.body.errors[0].campo).toBe('cursoId');
    });

    it('RN-03 cadastro não verificado em 7 dias é apagado, liberando CPF e e-mail', async () => {
      const c = await cenario(app);
      const dados = dadosCadastro(c);
      await http().post(`${API}/auth/alunos`).send(dados).expect(201);
      const u = await prisma(app).usuario.findUniqueOrThrow({ where: { email: dados.email } });
      await prisma(app).usuario.update({ where: { id: u.id }, data: { criadoEm: new Date(Date.now() - 8 * 24 * 3600_000) } });

      expect(await app.get(ManutencaoService).apagarCadastrosNaoVerificados()).toBeGreaterThanOrEqual(1);
      expect(await prisma(app).usuario.findUnique({ where: { email: dados.email } })).toBeNull();
      await http().post(`${API}/auth/alunos`).send(dados).expect(201);
      // O aluno ativo do cenário não é afetado.
      expect(await prisma(app).usuario.findUnique({ where: { id: c.aluno.usuarioId } })).not.toBeNull();
    });
  });

  describe('ALU-02 dados pessoais', () => {
    it('ALU-02 edita nome e telefone; CPF vem mascarado e não é editável, nem o e-mail', async () => {
      const { c, cli } = await alunoLogado();
      const me = (await cli.get('/alunos/me').expect(200)).body;
      expect(me.cpf).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
      expect(JSON.stringify(me)).not.toContain(c.aluno.cpf);
      const r = await cli.patch('/alunos/me', { nome: 'Ana Paula Souza', telefone: '11912345678' }).expect(200);
      expect(r.body).toMatchObject({ nome: 'Ana Paula Souza', telefone: '11912345678' });
      await cli.patch('/alunos/me', { cpf: gerarCpf('111222333') }).expect(400);
      await cli.patch('/alunos/me', { email: 'outro@x.com' }).expect(400);
    });

    it('ALU-02 trocar a senha exige a senha atual e revoga as outras sessões', async () => {
      const { c, cli } = await alunoLogado();
      const outra = new Cliente(app);
      await outra.login(c.aluno.email, c.aluno.senha);

      const errada = await cli.patch('/alunos/me/senha', { senhaAtual: 'Errada#123', senha: 'Nova#Senha2026', confirmacao: 'Nova#Senha2026' }).expect(422);
      expect(errada.body.errors[0].campo).toBe('senhaAtual');
      await cli.patch('/alunos/me/senha', { senhaAtual: c.aluno.senha, senha: 'Nova#Senha2026', confirmacao: 'Nova#Senha2026' }).expect(200);

      await outra.post('/auth/refresh').expect(401);
      await cli.post('/auth/refresh').expect(200); // este dispositivo recebeu sessão nova
      await new Cliente(app).login(c.aluno.email, 'Nova#Senha2026');
      // ASVS 2.2.3: o titular é avisado da mudança de senha.
      expect((await emailsPara(c.aluno.email)).map((e) => e.assunto)).toContain('Sua senha foi alterada');
    });
  });

  describe('ALU-03 vínculo acadêmico', () => {
    it('ALU-03 RN-05 troca curso, turma e semestre dentro da própria faculdade', async () => {
      const { c, cli } = await alunoLogado();
      const fac = new Cliente(app);
      await fac.login(c.faculdade.email, c.faculdade.senha);
      const areas = (await fac.get('/areas')).body as { id: string; nome: string }[];
      const novo = (await fac.post('/faculdade/cursos', { nome: 'Direito', areaId: areas.find((a) => a.nome === 'Direito')!.id, duracaoAnos: 5, ementa: 'x' }).expect(201)).body;
      const turma = (await fac.post(`/faculdade/cursos/${novo.id}/turmas`, { anoIngresso: 2026 }).expect(201)).body;

      const r = await cli.patch('/alunos/me/vinculo', { cursoId: novo.id, turmaId: turma.id, semestreAtual: 10 }).expect(200);
      expect(r.body).toMatchObject({ curso: { id: novo.id, area: 'Direito' }, semestreAtual: 10 });
      expect(r.body.faculdade.id).toBe(c.faculdade.id);
    });

    it('ALU-03 recusa curso de outra faculdade, turma de outro curso e semestre fora do limite', async () => {
      const { c, cli } = await alunoLogado();
      const outra = await cenario(app);
      (await cli.patch('/alunos/me/vinculo', { cursoId: outra.curso.id, turmaId: outra.turma.id, semestreAtual: 1 }).expect(422)).body;
      const r = await cli.patch('/alunos/me/vinculo', { cursoId: c.curso.id, turmaId: c.turma.id, semestreAtual: 9 }).expect(422);
      expect(r.body.errors[0].campo).toBe('semestreAtual');
      await cli.patch('/alunos/me/vinculo', { cursoId: c.curso.id, turmaId: c.turma.id, semestreAtual: 8 }).expect(200);
    });

    it('ALU-03 RN-25 aluno continua no curso inativado; pode atualizar o semestre nele', async () => {
      const { c, cli } = await alunoLogado();
      await prisma(app).curso.update({ where: { id: c.curso.id }, data: { ativo: false } });
      const opcoes = (await cli.get('/alunos/me/vinculo/opcoes').expect(200)).body;
      expect(opcoes.map((x: { id: string }) => x.id)).toEqual([c.curso.id]);
      await cli.patch('/alunos/me/vinculo', { cursoId: c.curso.id, turmaId: c.turma.id, semestreAtual: 4 }).expect(200);
    });
  });

  describe('ALU-04 currículo', () => {
    const curriculo = {
      objetivo: 'Estágio em desenvolvimento back-end',
      resumo: 'Estudante de computação com interesse em APIs.',
      cidade: 'São Paulo',
      uf: 'SP',
      links: [{ tipo: 'GITHUB', url: 'https://github.com/ana' }],
      habilidadesTecnicas: ['TypeScript', 'SQL', 'TypeScript'],
      habilidadesComportamentais: ['Comunicação'],
      disponibilidade: ['TARDE', 'NOITE'],
      informacoesAdicionais: 'CNH B',
      formacoes: [{ nivel: 'TECNICO', curso: 'Informática', instituicao: 'ETEC', inicio: '2020-02-01', conclusao: '2022-12-01', situacao: 'CONCLUIDO' }],
      experiencias: [{ tipo: 'MONITORIA', organizacao: 'Universidade', cargo: 'Monitora de Cálculo', inicio: '2025-03-01', fim: '', descricao: 'Plantões semanais' }],
      cursos: [{ nome: 'Docker', instituicao: 'Alura', cargaHoraria: 20, conclusao: '2025-06-01', certificadoUrl: 'https://alura.com.br/cert/1' }],
      idiomas: [{ idioma: 'Inglês', nivel: 'AVANCADO' }],
      projetos: [{ titulo: 'TCC', descricao: 'Plataforma de vagas', link: 'https://github.com/ana/tcc' }],
    };

    it('ALU-04 salva o currículo; nome, e-mail, telefone e graduação vêm do cadastro', async () => {
      const { c, cli } = await alunoLogado();
      const r = (await cli.put('/alunos/me/curriculo', curriculo).expect(200)).body;
      expect(r.dadosPessoais).toEqual({ nome: c.aluno.nome, email: c.aluno.email, telefone: '11999998888' });
      expect(r.graduacaoAtual).toMatchObject({ curso: c.curso.nome, semestre: 3, previsaoConclusao: { ano: 2028, periodo: 2 } });
      expect(r.curriculo).toMatchObject({
        objetivo: curriculo.objetivo,
        habilidadesTecnicas: ['TypeScript', 'SQL'],
        disponibilidade: ['TARDE', 'NOITE'],
        experiencias: [{ cargo: 'Monitora de Cálculo', inicio: '2025-03-01', fim: null }],
        idiomas: [{ idioma: 'Inglês', nivel: 'AVANCADO' }],
      });
    });

    it('ALU-04 D4 salvar substitui a versão anterior inteira', async () => {
      const { cli } = await alunoLogado();
      await cli.put('/alunos/me/curriculo', curriculo).expect(200);
      const r = (await cli.put('/alunos/me/curriculo', { objetivo: 'Trainee', idiomas: [{ idioma: 'Espanhol', nivel: 'BASICO' }] }).expect(200)).body;
      expect(r.curriculo).toMatchObject({ objetivo: 'Trainee', resumo: null, experiencias: [], projetos: [], idiomas: [{ idioma: 'Espanhol' }] });
      expect((await cli.get('/alunos/me/curriculo').expect(200)).body.curriculo.objetivo).toBe('Trainee');
    });

    it('ALU-04 recusa link que não é http(s) e campos fora do currículo padrão', async () => {
      const { cli } = await alunoLogado();
      const r = await cli.put('/alunos/me/curriculo', { links: [{ tipo: 'OUTRO', url: 'javascript:alert(1)' }] }).expect(400);
      expect(r.body.errors[0].campo).toBe('links.0.url');
      await cli.put('/alunos/me/curriculo', { foto: 'data:image/png;base64,xx' }).expect(400);
    });
  });

  describe('ALU-12 trocar de faculdade', () => {
    it('ALU-12 RN-22 aluno inativo confirma o e-mail da nova faculdade, escolhe o vínculo e volta a ficar ativo com o histórico', async () => {
      const a = await cenario(app, { comCandidatura: true });
      const b = await cenario(app);
      await prisma(app).usuario.update({ where: { id: a.aluno.usuarioId }, data: { status: 'INATIVO' } });
      await prisma(app).aluno.update({ where: { id: a.aluno.id }, data: { motivoInativacao: 'DESLIGADO_PELA_FACULDADE' } });
      const cli = new Cliente(app);
      await cli.login(a.aluno.email, a.aluno.senha);

      const novoEmail = `ana.nova@${b.faculdade.dominio}`;
      await cli.post('/alunos/me/troca-faculdade', { email: novoEmail }).expect(202);
      const token = tokenDoEmail((await emailsPara(novoEmail))[0]);

      const opcoes = (await cli.get(`/alunos/me/troca-faculdade?token=${token}`).expect(200)).body;
      expect(opcoes).toMatchObject({ email: novoEmail, faculdade: { id: b.faculdade.id }, cursos: [{ id: b.curso.id }] });

      const r = await cli.post('/alunos/me/troca-faculdade/confirmar', { token, cursoId: b.curso.id, turmaId: b.turma.id, semestreAtual: 5 }).expect(200);
      expect(r.body).toMatchObject({ email: novoEmail, status: 'ATIVO', faculdade: { id: b.faculdade.id }, semestreAtual: 5, motivoInativacao: null });
      expect(await prisma(app).candidatura.count({ where: { alunoId: a.aluno.id } })).toBe(1);
      // O link é de uso único.
      await cli.post('/alunos/me/troca-faculdade/confirmar', { token, cursoId: b.curso.id, turmaId: b.turma.id, semestreAtual: 5 }).expect(400);
      await new Cliente(app).login(novoEmail, a.aluno.senha);
    });

    it('ALU-12 domínio não cliente, mesma faculdade ou e-mail já usado bloqueiam a troca', async () => {
      const { c, cli } = await alunoLogado();
      const outra = await cenario(app);
      const r1 = await cli.post('/alunos/me/troca-faculdade', { email: 'x@naocliente.edu.br' }).expect(422);
      expect(r1.body.errors[0].mensagem).toBe('Sua faculdade ainda não usa a plataforma');
      await cli.post('/alunos/me/troca-faculdade', { email: `outro@${c.faculdade.dominio}` }).expect(422);
      await cli.post('/alunos/me/troca-faculdade', { email: outra.aluno.email }).expect(422);
    });

    it('ALU-12 o token de troca só serve para quem pediu', async () => {
      const a = await cenario(app);
      const b = await cenario(app);
      const cliA = new Cliente(app);
      await cliA.login(a.aluno.email, a.aluno.senha);
      const novoEmail = `troca.${randomInt(1e6)}@${b.faculdade.dominio}`;
      await cliA.post('/alunos/me/troca-faculdade', { email: novoEmail }).expect(202);
      const token = tokenDoEmail((await emailsPara(novoEmail))[0]);
      const intruso = new Cliente(app);
      await intruso.login(b.aluno.email, b.aluno.senha);
      await intruso.get(`/alunos/me/troca-faculdade?token=${token}`).expect(400);
    });
  });
});
