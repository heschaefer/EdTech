import { Injectable } from '@nestjs/common';
import type { FiltroNotificacoes } from '@vagas/contracts';
import type { Prisma } from '@prisma/client';
import { ClockService } from '../../common/clock.service';
import { naoEncontrado } from '../../common/problema';
import { PrismaService, type Tx } from '../../prisma/prisma.service';

export type NovaNotificacao = { usuarioId: string; tipo: string; titulo: string; mensagem: string; link?: string };

const CAMPOS = { id: true, tipo: true, titulo: true, mensagem: true, link: true, lidaEm: true, criadaEm: true } satisfies Prisma.NotificacaoSelect;

/**
 * Outbox (seção 10): a notificação nasce na mesma transação da mudança de estado;
 * o worker manda o e-mail correspondente depois (RN-23). ALU-11: a central de cada usuário.
 */
@Injectable()
export class NotificacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  criar(n: NovaNotificacao | NovaNotificacao[], tx: Tx = this.prisma) {
    const lista = Array.isArray(n) ? n : [n];
    if (!lista.length) return Promise.resolve({ count: 0 });
    const criadaEm = this.clock.agora();
    return tx.notificacao.createMany({ data: lista.map((x) => ({ ...x, criadaEm })) });
  }

  /** ALU-11: mais recentes primeiro, com o total de não lidas para o sino. */
  async listar(usuarioId: string, f: FiltroNotificacoes) {
    const where: Prisma.NotificacaoWhereInput = { usuarioId, ...(f.naoLidas ? { lidaEm: null } : {}) };
    const [total, naoLidas, data] = await this.prisma.$transaction([
      this.prisma.notificacao.count({ where }),
      this.prisma.notificacao.count({ where: { usuarioId, lidaEm: null } }),
      this.prisma.notificacao.findMany({ where, select: CAMPOS, orderBy: [{ criadaEm: 'desc' }, { id: 'asc' }], skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
    ]);
    return { data, meta: { page: f.page, pageSize: f.pageSize, total }, naoLidas };
  }

  naoLidas(usuarioId: string) {
    return this.prisma.notificacao.count({ where: { usuarioId, lidaEm: null } }).then((total) => ({ naoLidas: total }));
  }

  /** Posse (seção 8.2): notificação de outro usuário responde 404. Marcar de novo não muda a data. */
  async marcarLida(usuarioId: string, id: string) {
    await this.prisma.notificacao.updateMany({ where: { id, usuarioId, lidaEm: null }, data: { lidaEm: this.clock.agora() } });
    const n = await this.prisma.notificacao.findFirst({ where: { id, usuarioId }, select: CAMPOS });
    if (!n) throw naoEncontrado('Notificação não encontrada');
    return n;
  }

  async marcarTodas(usuarioId: string) {
    const { count } = await this.prisma.notificacao.updateMany({ where: { usuarioId, lidaEm: null }, data: { lidaEm: this.clock.agora() } });
    return { marcadas: count };
  }
}
