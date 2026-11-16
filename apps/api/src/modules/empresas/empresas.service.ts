import { HttpStatus, Injectable } from '@nestjs/common';
import type { AtualizarEmpresaInput, CadastroEmpresaInput } from '@vagas/contracts';
import { Prisma, type Empresa } from '@prisma/client';
import { hashSenha } from '../../common/cripto/senha';
import { conflito, erroDeCampo, naoEncontrado, Problema } from '../../common/problema';
import { PrismaService } from '../../prisma/prisma.service';
import { TokensEmailService } from '../auth/tokens-email.service';
import { EmailService } from '../email/email.service';
import { emailVerificacao } from '../email/templates';

export const MSG_EM_ANALISE = 'Cadastro em análise: a empresa só publica vagas depois da aprovação do administrador.';

@Injectable()
export class EmpresasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensEmailService,
    private readonly email: EmailService,
  ) {}

  /** EMP-01: conta pendente de verificação e cadastro pendente de aprovação (D20). */
  async cadastrar({ senha, confirmacao: _, cnpj, email, ...dados }: CadastroEmpresaInput) {
    // RN-20: CNPJ único entre empresas e faculdades. RN-21: e-mail único na plataforma.
    const [emp, fac, usuario] = await Promise.all([
      this.prisma.empresa.findUnique({ where: { cnpj } }),
      this.prisma.faculdade.findUnique({ where: { cnpj } }),
      this.prisma.usuario.findUnique({ where: { email } }),
    ]);
    if (emp || fac) throw erroDeCampo('cnpj', 'CNPJ já cadastrado');
    if (usuario) throw erroDeCampo('email', 'E-mail já cadastrado');

    const senhaHash = await hashSenha(senha);
    try {
      const token = await this.prisma.$transaction(async (tx) => {
        const u = await tx.usuario.create({ data: { email, senhaHash, papel: 'EMPRESA', status: 'PENDENTE_VERIFICACAO' } });
        await tx.empresa.create({ data: { ...dados, complemento: dados.complemento ?? null, cnpj, email, usuarioId: u.id } });
        return this.tokens.emitir(u.id, 'VERIFICACAO', undefined, tx);
      });
      await this.email.enfileirar(emailVerificacao(email, token));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const alvo = String((e.meta as { target?: unknown })?.target ?? '');
        throw alvo.includes('cnpj') ? erroDeCampo('cnpj', 'CNPJ já cadastrado') : erroDeCampo('email', 'E-mail já cadastrado');
      }
      throw e;
    }
  }

  async daSessao(usuarioId: string): Promise<Empresa> {
    const empresa = await this.prisma.empresa.findUnique({ where: { usuarioId } });
    if (!empresa) throw naoEncontrado();
    return empresa;
  }

  /** RN-26: só empresa ativa e aprovada publica vagas. */
  async exigirAprovada(usuarioId: string): Promise<Empresa> {
    const empresa = await this.daSessao(usuarioId);
    if (empresa.aprovacao !== 'APROVADA' || !empresa.ativa) {
      throw new Problema(HttpStatus.FORBIDDEN, 'Empresa não aprovada', MSG_EM_ANALISE, undefined, { aprovacao: empresa.aprovacao }, 'empresa-nao-aprovada');
    }
    return empresa;
  }

  async perfil(usuarioId: string) {
    const { usuarioId: _, ...e } = await this.daSessao(usuarioId);
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { email: true } });
    return { ...e, emailLogin: u.email };
  }

  /** EMP-02: tudo, menos o CNPJ. */
  async atualizar(usuarioId: string, dados: AtualizarEmpresaInput) {
    await this.prisma.empresa.update({ where: { usuarioId }, data: { ...dados, ...(dados.complemento === undefined ? {} : { complemento: dados.complemento ?? null }) } });
    return this.perfil(usuarioId);
  }

  /** RN-26 / D20: reprovada, corrige o perfil e pede nova análise. */
  async solicitarAnalise(usuarioId: string) {
    const { count } = await this.prisma.empresa.updateMany({ where: { usuarioId, aprovacao: 'REPROVADA' }, data: { aprovacao: 'PENDENTE', aprovacaoMotivo: null } });
    if (!count) throw conflito('Só um cadastro reprovado pode pedir nova análise.');
    return this.perfil(usuarioId);
  }
}
