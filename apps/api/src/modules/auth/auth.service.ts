import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { MENSAGENS_SENHA, PAINEL_POR_PAPEL, requisitosSenhaNaoAtendidos, type LoginInput } from '@vagas/contracts';
import type { Usuario } from '@prisma/client';
import { authenticator } from 'otplib';
import { randomUUID } from 'node:crypto';
import { ClockService } from '../../common/clock.service';
import { CifraService } from '../../common/cripto/cifra.service';
import { hashParaComparacaoCega, hashSenha, senhaConfere } from '../../common/cripto/senha';
import { gerarTokenOpaco, sha256 } from '../../common/cripto/tokens';
import { naoAutenticado, Problema } from '../../common/problema';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { emailBloqueio, emailRedefinicao, emailSenhaAlterada, emailVerificacao } from '../email/templates';
import { ChavesJwtService } from './chaves-jwt.service';
import { VIDA_REFRESH_MS } from './cookies';
import { TokensEmailService } from './tokens-email.service';

export const MAX_FALHAS_LOGIN = 5;
export const BLOQUEIO_MS = 15 * 60_000;
export const MSG_CREDENCIAIS = 'E-mail ou senha inválidos';

export type Sessao = { access: string; refresh: string; csrf: string };

/** Aceita o código do passo anterior/seguinte (±30 s) para tolerar relógio e digitação na virada. */
const verificadorTotp = authenticator.clone({ window: 1 });

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly chaves: ChavesJwtService,
    private readonly tokens: TokensEmailService,
    private readonly email: EmailService,
    private readonly cifra: CifraService,
  ) {}

  /** AUTH-01 */
  async login({ email, senha, totp }: LoginInput): Promise<{ sessao: Sessao; usuario: Usuario; painel: string }> {
    const agora = this.clock.agora();
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });

    if (!usuario) {
      await senhaConfere(await hashParaComparacaoCega(), senha);
      throw naoAutenticado(MSG_CREDENCIAIS);
    }

    // SEG-06: bloqueada, nega mesmo com a senha certa.
    if (usuario.bloqueadoAte && usuario.bloqueadoAte > agora) {
      throw naoAutenticado('Conta bloqueada temporariamente. Tente novamente em alguns minutos.', undefined, 'conta-bloqueada');
    }

    if (!(await senhaConfere(usuario.senhaHash, senha))) {
      await this.registrarFalha(usuario);
      throw naoAutenticado(MSG_CREDENCIAIS);
    }

    if (usuario.status === 'PENDENTE_VERIFICACAO') {
      throw naoAutenticado('Confirme seu e-mail antes de entrar.', { podeReenviar: true }, 'email-nao-verificado');
    }
    // RN-22: aluno INATIVO entra com acesso restrito; demais papéis inativos não entram.
    if (usuario.status !== 'ATIVO' && !(usuario.papel === 'ALUNO' && usuario.status === 'INATIVO')) {
      throw naoAutenticado('Conta inativa. Procure o administrador da plataforma.', undefined, 'conta-inativa');
    }

    if (usuario.papel === 'ADMIN') this.verificarTotp(usuario, totp);

    if (usuario.falhasLogin > 0 || usuario.bloqueadoAte) {
      await this.prisma.usuario.update({ where: { id: usuario.id }, data: { falhasLogin: 0, bloqueadoAte: null } });
    }

    const sessao = await this.abrirSessao(usuario, randomUUID());
    const painel = usuario.papel === 'ALUNO' && usuario.status === 'INATIVO' ? '/aluno/trocar-faculdade' : PAINEL_POR_PAPEL[usuario.papel];
    return { sessao, usuario, painel };
  }

  private verificarTotp(usuario: Usuario, codigo?: string) {
    if (!usuario.totpSecretCifrado) throw naoAutenticado('2FA não configurado para este administrador.');
    if (!codigo) throw naoAutenticado('Informe o código do autenticador.', { requer2fa: true }, 'totp-obrigatorio');
    const segredo = this.cifra.decifrar(usuario.totpSecretCifrado);
    const valido = verificadorTotp.verify({ token: codigo, secret: segredo });
    if (!valido) throw naoAutenticado('Código do autenticador inválido.', { requer2fa: true }, 'totp-invalido');
  }

  /** AUTH-01: 5 falhas seguidas bloqueiam 15 min e avisam o dono por e-mail. */
  private async registrarFalha(usuario: Usuario) {
    const agora = this.clock.agora();
    // Incremento atômico: tentativas paralelas não se perdem.
    const atualizado = await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { falhasLogin: { increment: 1 } },
      select: { falhasLogin: true },
    });
    if (atualizado.falhasLogin >= MAX_FALHAS_LOGIN) {
      const { count } = await this.prisma.usuario.updateMany({
        where: { id: usuario.id, falhasLogin: { gte: MAX_FALHAS_LOGIN } },
        data: { falhasLogin: 0, bloqueadoAte: new Date(agora.getTime() + BLOQUEIO_MS) },
      });
      if (count) await this.email.enfileirar(emailBloqueio(usuario.email));
    }
  }

  /** Abre uma sessão nova (nova família de refresh tokens). */
  async abrirSessao(usuario: Pick<Usuario, 'id' | 'papel' | 'status'>, familia: string = randomUUID()): Promise<Sessao> {
    const refresh = gerarTokenOpaco();
    await this.prisma.refreshToken.create({
      data: {
        usuarioId: usuario.id,
        familia,
        tokenHash: sha256(refresh),
        expiraEm: new Date(this.clock.agora().getTime() + VIDA_REFRESH_MS),
      },
    });
    return { access: this.chaves.assinar(usuario), refresh, csrf: gerarTokenOpaco() };
  }

  /**
   * AUTH-02: troca o refresh a cada uso. Token já trocado ou revogado que reaparece
   * revoga a família inteira (SEG-03).
   */
  async renovar(refresh: string | undefined): Promise<Sessao> {
    if (!refresh) throw naoAutenticado();
    const agora = this.clock.agora();
    const atual = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refresh) }, include: { usuario: true } });
    if (!atual) throw naoAutenticado();

    if (atual.revogadoEm || atual.substituidoPorId) {
      await this.revogarFamilia(atual.familia);
      this.logger.warn(`Reuso de refresh token detectado; família ${atual.familia} revogada`);
      throw naoAutenticado();
    }
    if (atual.expiraEm <= agora) throw naoAutenticado();

    const u = atual.usuario;
    const podeEntrar = u.status === 'ATIVO' || (u.papel === 'ALUNO' && u.status === 'INATIVO');
    if (!podeEntrar) {
      await this.revogarFamilia(atual.familia);
      throw naoAutenticado('Conta inativa');
    }

    const novoRefresh = gerarTokenOpaco();
    const novoId = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      // UPDATE condicional: dois refresh paralelos com o mesmo token → só um vence.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: atual.id, revogadoEm: null, substituidoPorId: null },
        data: { revogadoEm: agora, substituidoPorId: novoId },
      });
      if (count !== 1) throw naoAutenticado();
      await tx.refreshToken.create({
        data: {
          id: novoId,
          usuarioId: u.id,
          familia: atual.familia,
          tokenHash: sha256(novoRefresh),
          expiraEm: new Date(agora.getTime() + VIDA_REFRESH_MS),
        },
      });
    });
    return { access: this.chaves.assinar(u), refresh: novoRefresh, csrf: gerarTokenOpaco() };
  }

  private revogarFamilia(familia: string) {
    return this.prisma.refreshToken.updateMany({ where: { familia, revogadoEm: null }, data: { revogadoEm: this.clock.agora() } });
  }

  /** Revoga todas as sessões do usuário (troca/redefinição de senha), exceto, opcionalmente, uma família. */
  revogarSessoes(usuarioId: string, excetoFamilia?: string) {
    return this.prisma.refreshToken.updateMany({
      where: { usuarioId, revogadoEm: null, ...(excetoFamilia ? { familia: { not: excetoFamilia } } : {}) },
      data: { revogadoEm: this.clock.agora() },
    });
  }

  /** AUTH-03 */
  async logout(refresh: string | undefined) {
    if (!refresh) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refresh), revogadoEm: null },
      data: { revogadoEm: this.clock.agora() },
    });
  }

  /** Família do refresh atual (para manter a sessão corrente ao trocar a senha). */
  async familiaDe(refresh: string | undefined) {
    if (!refresh) return undefined;
    return (await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refresh) } }))?.familia;
  }

  /** AUTH-05 */
  async verificarEmail(token: string) {
    await this.prisma.$transaction(async (tx) => {
      const t = await this.tokens.consumir(token, 'VERIFICACAO', tx);
      if (!t) throw linkInvalido();
      await tx.usuario.updateMany({
        where: { id: t.usuarioId, status: 'PENDENTE_VERIFICACAO' },
        data: { status: 'ATIVO', emailVerificadoEm: this.clock.agora() },
      });
    });
  }

  /** AUTH-05: resposta sempre igual; o limite de 3/h fica no controller. */
  async reenviarVerificacao(email: string) {
    const u = await this.prisma.usuario.findUnique({ where: { email } });
    if (!u || u.status !== 'PENDENTE_VERIFICACAO' || u.papel === 'FACULDADE') return;
    const token = await this.tokens.emitir(u.id, 'VERIFICACAO');
    await this.email.enfileirar(emailVerificacao(u.email, token));
  }

  /** AUTH-04: sempre 202, exista ou não o e-mail. */
  async esqueciSenha(email: string) {
    const u = await this.prisma.usuario.findUnique({ where: { email } });
    if (!u || !u.senhaHash) return;
    const token = await this.tokens.emitir(u.id, 'RESET_SENHA');
    await this.email.enfileirar(emailRedefinicao(u.email, token));
  }

  /** AUTH-04: link de uso único; ao redefinir, todas as sessões são revogadas. */
  async redefinirSenha(token: string, senha: string) {
    await this.definirSenhaPorToken(token, senha, 'RESET_SENHA');
  }

  /** FAC-01: o convite define a senha e ativa a conta da faculdade. */
  async aceitarConvite(token: string, senha: string) {
    await this.definirSenhaPorToken(token, senha, 'CONVITE');
  }

  private async definirSenhaPorToken(token: string, senha: string, tipo: 'RESET_SENHA' | 'CONVITE') {
    const hash = await hashSenha(senha);
    const usuario = await this.prisma.$transaction(async (tx) => {
      const t = await this.tokens.consumir(token, tipo, tx);
      if (!t) throw linkInvalido();
      const u = await tx.usuario.findUniqueOrThrow({ where: { id: t.usuarioId } });
      if (requisitosSenhaNaoAtendidos(senha, u.email).includes('CONTEM_EMAIL')) {
        throw new Problema(HttpStatus.BAD_REQUEST, 'Dados inválidos', 'Senha fora da política', [
          { campo: 'senha', mensagem: MENSAGENS_SENHA.CONTEM_EMAIL },
        ]);
      }
      const agora = this.clock.agora();
      await tx.usuario.update({
        where: { id: u.id },
        data: {
          senhaHash: hash,
          falhasLogin: 0,
          bloqueadoAte: null,
          ...(tipo === 'CONVITE' ? { status: 'ATIVO', emailVerificadoEm: u.emailVerificadoEm ?? agora } : {}),
        },
      });
      return u;
    });
    await this.revogarSessoes(usuario.id);
    if (tipo === 'RESET_SENHA') await this.email.enfileirar(emailSenhaAlterada(usuario.email));
  }

  /** ASVS 2.2.3: avisa por e-mail que a senha mudou (troca pelo perfil, ALU-02). */
  avisarSenhaAlterada(email: string) {
    return this.email.enfileirar(emailSenhaAlterada(email));
  }
}

const linkInvalido = () =>
  new Problema(HttpStatus.BAD_REQUEST, 'Link inválido', 'Este link é inválido, já foi usado ou expirou.', undefined, undefined, 'link-invalido');
