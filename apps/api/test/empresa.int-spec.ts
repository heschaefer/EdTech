import type { INestApplication } from '@nestjs/common';
import { gerarCnpj } from '@vagas/contracts';
import { randomInt } from 'node:crypto';
import request from 'supertest';
import { OutboxService } from '../src/modules/notificacoes/outbox.service';
import { API, cenario, Cliente, criarApp, emailsPara, prisma, tokenDoEmail, vagaMinima } from './util';

const SENHA = 'Xq9#mVt2!pL';
const dadosEmpresa = (extra: object = {}) => {
  const s = randomInt(1e8).toString(36);
  return {
    razaoSocial: `Faísca ${s} LTDA`,
    nomeFantasia: `Faísca ${s}`,
    cnpj: gerarCnpj(String(randomInt(10_000_000, 99_999_999)) + '0001'),
    telefone: '(11) 3333-4444',
    email: `contato@faisca${s}.com.br`,
    senha: SENHA,
    confirmacao: SENHA,
    ramoAtuacao: 'Energia',
    cep: '01310-100',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
    ...extra,
  };
};

describe('Empresa', () => {
  let app: INestApplication;
  let admin: Cliente;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await criarApp();
    await http().post(`${API}/__test__/reset`).expect(204);
    admin = new Cliente(app);
    await admin.loginAdmin();
  });
  afterAll(() => app.close());

  /** Cadastra, verifica o e-mail e loga. */
  async function empresaVerificada() {
    const dados = dadosEmpresa();
    await http().post(`${API}/auth/empresas`).send(dados).expect(201);
    const token = tokenDoEmail((await emailsPara(dados.email))[0]);
    await http().post(`${API}/auth/verificar-email`).send({ token }).expect(200);
    const cli = new Cliente(app);
    await cli.login(dados.email, SENHA);
    const { id } = (await cli.get('/empresa/me').expect(200)).body;
    return { dados, cli, id };
  }

  describe('EMP-01 cadastro', () => {
    it('EMP-01 D20 cadastro pendente: verifica o e-mail, entra, mas não publica vaga até a aprovação', async () => {
      const { dados, cli } = await empresaVerificada();
      const me = (await cli.get('/me').expect(200)).body;
      expect(me).toMatchObject({ papel: 'EMPRESA', aprovacao: 'PENDENTE' });
      const perfil = (await cli.get('/empresa/me').expect(200)).body;
      expect(perfil).toMatchObject({ cnpj: dados.cnpj.replace(/\D/g, ''), cep: '01310100', uf: 'SP', complemento: null });
      const r = await cli.post('/empresa/vagas', {}).expect(400); // validação antes da regra
      expect(r.status).toBe(400);
      const areas = (await cli.get('/areas')).body as { id: string }[];
      const vaga = await cli.post('/empresa/vagas', vagaMinima(areas[0].id)).expect(403);
      expect(vaga.body).toMatchObject({ type: 'empresa-nao-aprovada', detail: expect.stringContaining('Cadastro em análise') });
    });

    it('EMP-01 RN-20 CNPJ inválido ou já usado (por empresa ou faculdade) dá erro no campo', async () => {
      const r1 = await http().post(`${API}/auth/empresas`).send(dadosEmpresa({ cnpj: '11.222.333/0001-82' })).expect(400);
      expect(r1.body.errors[0].campo).toBe('cnpj');
      const c = await cenario(app);
      const cnpjFac = (await prisma(app).faculdade.findUniqueOrThrow({ where: { id: c.faculdade.id } })).cnpj;
      const r2 = await http().post(`${API}/auth/empresas`).send(dadosEmpresa({ cnpj: cnpjFac })).expect(422);
      expect(r2.body.errors).toEqual([{ campo: 'cnpj', mensagem: 'CNPJ já cadastrado' }]);
    });

    it('EMP-01 D6 endereço completo obrigatório', async () => {
      const r = await http().post(`${API}/auth/empresas`).send(dadosEmpresa({ cep: '123', logradouro: '', numero: '' })).expect(400);
      expect(r.body.errors.map((e: { campo: string }) => e.campo)).toEqual(expect.arrayContaining(['cep', 'logradouro', 'numero']));
    });
  });

  it('EMP-02 edita o perfil, menos o CNPJ', async () => {
    const { cli } = await empresaVerificada();
    const r = await cli.patch('/empresa/me', { nomeFantasia: 'Faísca Energia', complemento: 'Conj. 12', cidade: 'Campinas' }).expect(200);
    expect(r.body).toMatchObject({ nomeFantasia: 'Faísca Energia', complemento: 'Conj. 12', cidade: 'Campinas' });
    await cli.patch('/empresa/me', { cnpj: '11222333000181' }).expect(400);
  });

  describe('ADM-04 aprovação', () => {
    it('ADM-04 admin vê as pendentes com e-mail verificado e aprova; a empresa recebe in-app e por e-mail', async () => {
      const naoVerificada = dadosEmpresa();
      await http().post(`${API}/auth/empresas`).send(naoVerificada).expect(201);
      const { dados, cli, id } = await empresaVerificada();

      const pendentes = (await admin.get('/admin/empresas?aprovacao=PENDENTE&pageSize=100').expect(200)).body.data.map((e: { email: string }) => e.email);
      expect(pendentes).toContain(dados.email);
      expect(pendentes).not.toContain(naoVerificada.email);

      await admin.post(`/admin/empresas/${id}/aprovar`).expect(200);
      expect((await cli.get('/me')).body.aprovacao).toBe('APROVADA');
      const n = await prisma(app).notificacao.findFirstOrThrow({ where: { usuario: { email: dados.email }, tipo: 'EMPRESA_APROVADA' } });
      expect(n.emailEnviadoEm).toBeNull();
      // RN-23: o outbox entrega o e-mail da notificação.
      await app.get(OutboxService).processar();
      expect((await emailsPara(dados.email)).map((e) => e.assunto)).toContain('Cadastro aprovado');
      expect((await prisma(app).notificacao.findUniqueOrThrow({ where: { id: n.id } })).emailEnviadoEm).not.toBeNull();
      expect(await prisma(app).auditLog.count({ where: { acao: 'ADMIN_APROVOU_EMPRESA', entidadeId: id } })).toBe(1);
      await admin.post(`/admin/empresas/${id}/aprovar`).expect(409);
    });

    it('ADM-04 RN-26 reprova com motivo; a empresa vê o motivo, corrige e pede nova análise', async () => {
      const { cli, id } = await empresaVerificada();
      await admin.post(`/admin/empresas/${id}/reprovar`, {}).expect(400);
      await admin.post(`/admin/empresas/${id}/reprovar`, { motivo: 'Ramo de atuação incompleto' }).expect(200);
      expect((await cli.get('/me')).body).toMatchObject({ aprovacao: 'REPROVADA', aprovacaoMotivo: 'Ramo de atuação incompleto' });
      await cli.patch('/empresa/me', { ramoAtuacao: 'Energia solar residencial' }).expect(200);
      await cli.post('/empresa/me/solicitar-analise').expect(200);
      expect((await cli.get('/me')).body.aprovacao).toBe('PENDENTE');
      await cli.post('/empresa/me/solicitar-analise').expect(409);
      await admin.post(`/admin/empresas/${id}/aprovar`).expect(200);
    });
  });

  it('ADM-05 inativar empresa bloqueia o login e pausa as vagas abertas; reativar libera o login', async () => {
    const c = await cenario(app);
    await admin.patch(`/admin/empresas/${c.empresa.id}`, { ativa: false }).expect(200);
    expect((await prisma(app).vaga.findUniqueOrThrow({ where: { id: c.vaga.id } })).status).toBe('PAUSADA');
    await http().post(`${API}/auth/login`).send({ email: c.empresa.email, senha: c.empresa.senha }).expect(401);
    const lista = (await admin.get(`/admin/empresas?ativa=false&q=${encodeURIComponent(c.empresa.email)}`).expect(200)).body;
    expect(lista.data[0]).toMatchObject({ id: c.empresa.id, ativa: false });

    await admin.patch(`/admin/empresas/${c.empresa.id}`, { ativa: true }).expect(200);
    await new Cliente(app).login(c.empresa.email, c.empresa.senha);
    expect((await prisma(app).vaga.findUniqueOrThrow({ where: { id: c.vaga.id } })).status).toBe('PAUSADA');
  });
});
