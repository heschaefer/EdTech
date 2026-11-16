import { Injectable } from '@nestjs/common';
import { PrismaService, type Tx } from '../../prisma/prisma.service';

export type NovaNotificacao = { usuarioId: string; tipo: string; titulo: string; mensagem: string; link?: string };

/**
 * Outbox (seção 10): a notificação nasce na mesma transação da mudança de estado;
 * o worker manda o e-mail correspondente depois (RN-23).
 */
@Injectable()
export class NotificacoesService {
  constructor(private readonly prisma: PrismaService) {}

  criar(n: NovaNotificacao | NovaNotificacao[], tx: Tx = this.prisma) {
    const lista = Array.isArray(n) ? n : [n];
    if (!lista.length) return Promise.resolve({ count: 0 });
    return tx.notificacao.createMany({ data: lista });
  }
}
