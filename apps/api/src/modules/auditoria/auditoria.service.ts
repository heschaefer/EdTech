import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { contextoRequisicao } from '../../common/contexto';
import { PrismaService, type Tx } from '../../prisma/prisma.service';

export type Auditoria = {
  usuarioId: string | null;
  acao: string;
  entidade: string;
  entidadeId: string;
  ip?: string;
  dados?: Prisma.InputJsonValue;
};

/** Seção 8.4: acesso da empresa a perfil, mudanças de status e toda ação de admin. */
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sem `ip` explícito, usa o da requisição em curso; jobs do worker gravam sem IP e com usuarioId nulo (sistema). */
  registrar(a: Auditoria, tx: Tx = this.prisma) {
    return tx.auditLog.create({ data: { ...a, ip: a.ip ?? contextoRequisicao.getStore()?.ip } });
  }
}
