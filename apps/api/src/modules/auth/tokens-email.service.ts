import { Injectable } from '@nestjs/common';
import type { Prisma, TipoTokenEmail } from '@prisma/client';
import { ClockService } from '../../common/clock.service';
import { gerarTokenOpaco, sha256 } from '../../common/cripto/tokens';
import { PrismaService, type Tx } from '../../prisma/prisma.service';

/** Seção 8.1: verificação 24 h, senha 1 h, convite 72 h; troca de e-mail 24 h. */
export const VALIDADE_TOKEN_MS: Record<TipoTokenEmail, number> = {
  VERIFICACAO: 24 * 3600_000,
  RESET_SENHA: 3600_000,
  CONVITE: 72 * 3600_000,
  TROCA_EMAIL: 24 * 3600_000,
};

@Injectable()
export class TokensEmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  /** Cria um token novo e invalida os anteriores do mesmo tipo. Devolve o token em claro. */
  async emitir(usuarioId: string, tipo: TipoTokenEmail, dados?: Prisma.InputJsonValue, tx: Tx = this.prisma): Promise<string> {
    const agora = this.clock.agora();
    await tx.tokenEmail.updateMany({ where: { usuarioId, tipo, usadoEm: null }, data: { usadoEm: agora } });
    const token = gerarTokenOpaco();
    await tx.tokenEmail.create({
      data: { usuarioId, tipo, tokenHash: sha256(token), dados, expiraEm: new Date(agora.getTime() + VALIDADE_TOKEN_MS[tipo]) },
    });
    return token;
  }

  /**
   * Consome o token uma única vez (UPDATE condicional): duas requisições simultâneas
   * com o mesmo link nunca passam ambas. Devolve null se inválido, usado ou expirado.
   */
  async consumir(token: string, tipo: TipoTokenEmail, tx: Tx = this.prisma) {
    const agora = this.clock.agora();
    const registro = await tx.tokenEmail.findUnique({ where: { tokenHash: sha256(token) } });
    if (!registro || registro.tipo !== tipo || registro.usadoEm || registro.expiraEm <= agora) return null;
    const { count } = await tx.tokenEmail.updateMany({ where: { id: registro.id, usadoEm: null }, data: { usadoEm: agora } });
    return count === 1 ? registro : null;
  }
}
