import { HttpStatus, Injectable } from '@nestjs/common';
import {
  dominioDoEmail,
  mascararCpf,
  MENSAGENS_SENHA,
  requisitosSenhaNaoAtendidos,
  VERSAO_TERMOS,
  type CadastroAlunoInput,
  type VinculoInput,
} from '@vagas/contracts';
import { Prisma } from '@prisma/client';
import { ClockService } from '../../common/clock.service';
import { CifraService } from '../../common/cripto/cifra.service';
import { hashSenha, senhaConfere } from '../../common/cripto/senha';
import { conflito, erroDeCampo, naoEncontrado, Problema } from '../../common/problema';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { TokensEmailService } from '../auth/tokens-email.service';
import { EmailService } from '../email/email.service';
import { emailTrocaFaculdade, emailVerificacao } from '../email/templates';
import { CurriculoService } from './curriculo.service';
import { faculdadeDoDominio, opcoesDeVinculo, validarVinculo } from './vinculo';

export const MSG_FACULDADE_NAO_CLIENTE = 'Sua faculdade ainda não usa a plataforma';

@Injectable()
export class AlunosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly cifra: CifraService,
    private readonly tokens: TokensEmailService,
    private readonly email: EmailService,
    private readonly auth: AuthService,
    private readonly curriculos: CurriculoService,
  ) {}

  /** ALU-01: ao sair do campo e-mail, a faculdade aparece com seus cursos e turmas (RN-01). */
  async porDominio(email: string) {
    const faculdade = await faculdadeDoDominio(this.prisma, dominioDoEmail(email));
    if (!faculdade) throw new Problema(HttpStatus.NOT_FOUND, 'Faculdade não encontrada', MSG_FACULDADE_NAO_CLIENTE, [{ campo: 'email', mensagem: MSG_FACULDADE_NAO_CLIENTE }]);
    return { faculdade: { id: faculdade.id, nome: faculdade.nomeFantasia }, cursos: await opcoesDeVinculo(this.prisma, faculdade.id) };
  }

  /** ALU-01: a conta nasce PENDENTE_VERIFICACAO e o link vai para o e-mail institucional (RN-03). */
  async cadastrar(d: CadastroAlunoInput) {
    const faculdade = await faculdadeDoDominio(this.prisma, dominioDoEmail(d.email));
    if (!faculdade) throw erroDeCampo('email', MSG_FACULDADE_NAO_CLIENTE);
    const cpfHash = this.cifra.hmac(d.cpf);
    await this.validarUnicidade(d.email, cpfHash);
    const senhaHash = await hashSenha(d.senha);

    try {
      const token = await this.prisma.$transaction(async (tx) => {
        await validarVinculo(tx, faculdade.id, d);
        const usuario = await tx.usuario.create({ data: { email: d.email, senhaHash, papel: 'ALUNO', status: 'PENDENTE_VERIFICACAO' } });
        const aluno = await tx.aluno.create({
          data: {
            usuarioId: usuario.id,
            nome: d.nome,
            cpfHash,
            cpfCifrado: this.cifra.cifrar(d.cpf),
            telefone: d.telefone,
            faculdadeId: faculdade.id,
            cursoId: d.cursoId,
            turmaId: d.turmaId,
            semestreAtual: d.semestreAtual,
            termosVersao: VERSAO_TERMOS,
            termosAceitosEm: this.clock.agora(),
          },
        });
        if (d.curriculo) await this.curriculos.salvar(aluno.id, d.curriculo, tx);
        return this.tokens.emitir(usuario.id, 'VERIFICACAO', undefined, tx);
      });
      await this.email.enfileirar(emailVerificacao(d.email, token));
    } catch (e) {
      throw traduzirDuplicidade(e);
    }
  }

  /** RN-02 e RN-21: CPF único entre todos os alunos (inclusive inativos) e e-mail único na plataforma. */
  private async validarUnicidade(email: string, cpfHash: string) {
    const [usuario, aluno] = await Promise.all([
      this.prisma.usuario.findUnique({ where: { email } }),
      this.prisma.aluno.findUnique({ where: { cpfHash } }),
    ]);
    if (aluno) throw erroDeCampo('cpf', 'CPF já cadastrado');
    if (usuario) throw erroDeCampo('email', 'E-mail já cadastrado');
  }

  async alunoDoUsuario(usuarioId: string) {
    const aluno = await this.prisma.aluno.findUnique({ where: { usuarioId } });
    if (!aluno) throw naoEncontrado();
    return aluno;
  }

  /** ALU-02 / ALU-03: dados do aluno; CPF sempre mascarado (8.4). */
  async me(usuarioId: string) {
    const a = await this.prisma.aluno.findUnique({
      where: { usuarioId },
      include: {
        usuario: { select: { email: true, status: true } },
        faculdade: { select: { id: true, nomeFantasia: true } },
        curso: { select: { id: true, nome: true, duracaoAnos: true, ativo: true, area: { select: { nome: true } } } },
        turma: { select: { id: true, anoIngresso: true, periodoIngresso: true } },
      },
    });
    if (!a) throw naoEncontrado();
    return {
      id: a.id,
      nome: a.nome,
      email: a.usuario.email,
      telefone: a.telefone,
      cpf: mascararCpf(this.cifra.decifrar(a.cpfCifrado)),
      status: a.usuario.status,
      motivoInativacao: a.motivoInativacao,
      faculdade: { id: a.faculdade.id, nome: a.faculdade.nomeFantasia },
      curso: { id: a.curso.id, nome: a.curso.nome, duracaoAnos: a.curso.duracaoAnos, ativo: a.curso.ativo, area: a.curso.area.nome },
      turma: a.turma,
      semestreAtual: a.semestreAtual,
    };
  }

  /** ALU-02: só nome e telefone. */
  async atualizar(usuarioId: string, dados: { nome?: string; telefone?: string }) {
    await this.prisma.aluno.update({ where: { usuarioId }, data: dados });
    return this.me(usuarioId);
  }

  /** ALU-02: exige a senha atual e revoga as outras sessões; devolve uma sessão nova para este dispositivo. */
  async trocarSenha(usuarioId: string, senhaAtual: string, nova: string) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    if (!(await senhaConfere(u.senhaHash, senhaAtual))) throw erroDeCampo('senhaAtual', 'Senha atual incorreta');
    if (requisitosSenhaNaoAtendidos(nova, u.email).includes('CONTEM_EMAIL')) throw erroDeCampo('senha', MENSAGENS_SENHA.CONTEM_EMAIL, HttpStatus.BAD_REQUEST);
    await this.prisma.usuario.update({ where: { id: usuarioId }, data: { senhaHash: await hashSenha(nova) } });
    await this.auth.revogarSessoes(usuarioId);
    return this.auth.abrirSessao(u);
  }

  /** ALU-03: curso, turma e semestre; a faculdade não muda por aqui (RN-05). */
  async atualizarVinculo(usuarioId: string, v: VinculoInput) {
    const aluno = await this.alunoDoUsuario(usuarioId);
    await this.prisma.$transaction(async (tx) => {
      await validarVinculo(tx, aluno.faculdadeId, v, aluno);
      await tx.aluno.update({ where: { id: aluno.id }, data: v });
    });
    return this.me(usuarioId);
  }

  /** ALU-03: cursos ativos com turmas ativas da própria faculdade, mais o curso e a turma atuais. */
  async opcoesVinculo(usuarioId: string) {
    const aluno = await this.alunoDoUsuario(usuarioId);
    const cursos = await opcoesDeVinculo(this.prisma, aluno.faculdadeId);
    const atual = await this.prisma.curso.findUniqueOrThrow({
      where: { id: aluno.cursoId },
      select: { id: true, nome: true, duracaoAnos: true, turmas: { where: { OR: [{ ativa: true }, { id: aluno.turmaId }] }, select: { id: true, anoIngresso: true, periodoIngresso: true } } },
    });
    const semAtual = cursos.filter((c) => c.id !== atual.id);
    return [...semAtual, atual].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  /** ALU-12: o link vai para o e-mail da nova faculdade; a troca só vale depois de confirmado. */
  async pedirTrocaFaculdade(usuarioId: string, novoEmail: string) {
    const aluno = await this.alunoDoUsuario(usuarioId);
    const nova = await faculdadeDoDominio(this.prisma, dominioDoEmail(novoEmail));
    if (!nova) throw erroDeCampo('email', MSG_FACULDADE_NAO_CLIENTE);
    if (nova.id === aluno.faculdadeId) throw erroDeCampo('email', 'Informe o e-mail de outra faculdade');
    if (await this.prisma.usuario.findUnique({ where: { email: novoEmail } })) throw erroDeCampo('email', 'E-mail já cadastrado');
    const token = await this.tokens.emitir(usuarioId, 'TROCA_EMAIL', { email: novoEmail });
    await this.email.enfileirar(emailTrocaFaculdade(novoEmail, token));
  }

  /** ALU-12: dados do pedido (sem consumir o token), para a tela escolher curso, turma e semestre. */
  async opcoesTrocaFaculdade(usuarioId: string, token: string) {
    const { email } = await this.lerTokenTroca(usuarioId, token);
    return { email, ...(await this.porDominio(email)) };
  }

  /** ALU-12: troca e-mail e faculdade, define o vínculo e reativa a conta; o histórico é mantido. */
  async confirmarTrocaFaculdade(usuarioId: string, token: string, v: VinculoInput) {
    const aluno = await this.alunoDoUsuario(usuarioId);
    const { email } = await this.lerTokenTroca(usuarioId, token);
    const nova = await faculdadeDoDominio(this.prisma, dominioDoEmail(email));
    if (!nova) throw erroDeCampo('email', MSG_FACULDADE_NAO_CLIENTE);
    try {
      await this.prisma.$transaction(async (tx) => {
        await validarVinculo(tx, nova.id, v);
        const consumido = await this.tokens.consumir(token, 'TROCA_EMAIL', tx);
        if (!consumido || consumido.usuarioId !== usuarioId) throw linkInvalido();
        await tx.usuario.update({ where: { id: usuarioId }, data: { email, status: 'ATIVO', emailVerificadoEm: this.clock.agora() } });
        await tx.aluno.update({ where: { id: aluno.id }, data: { faculdadeId: nova.id, ...v, motivoInativacao: null } });
      });
    } catch (e) {
      throw traduzirDuplicidade(e);
    }
    return this.me(usuarioId);
  }

  private async lerTokenTroca(usuarioId: string, token: string) {
    const t = await this.tokens.ler(token, 'TROCA_EMAIL');
    if (!t || t.usuarioId !== usuarioId) throw linkInvalido();
    return { email: (t.dados as { email: string }).email };
  }
}

const linkInvalido = () =>
  new Problema(HttpStatus.BAD_REQUEST, 'Link inválido', 'Este link é inválido, já foi usado ou expirou.', undefined, undefined, 'link-invalido');

/** Corrida entre dois cadastros com o mesmo CPF/e-mail: o índice único do banco decide (seção 7). */
function traduzirDuplicidade(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    const alvo = String((e.meta as { target?: string[] | string })?.target ?? '');
    if (alvo.includes('cpf')) return erroDeCampo('cpf', 'CPF já cadastrado');
    if (alvo.includes('email')) return erroDeCampo('email', 'E-mail já cadastrado');
    return conflito('Registro duplicado');
  }
  return e;
}
