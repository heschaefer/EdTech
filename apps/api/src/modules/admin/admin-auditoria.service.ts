import { Injectable } from '@nestjs/common';
import type { FiltroAuditoria } from '@vagas/contracts';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Seção 8.4: trilha de auditoria (acesso da empresa a perfil, mudanças de status e ações de admin), só leitura. */
@Injectable()
export class AdminAuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(f: FiltroAuditoria) {
    const where: Prisma.AuditLogWhereInput = {
      ...(f.acao ? { acao: f.acao } : {}),
      ...(f.entidade ? { entidade: f.entidade } : {}),
      ...(f.entidadeId ? { entidadeId: f.entidadeId } : {}),
    };
    const [total, itens, acoes] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, orderBy: [{ criadoEm: 'desc' }, { id: 'asc' }], skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
      this.prisma.auditLog.groupBy({ by: ['acao'], orderBy: { acao: 'asc' } }),
    ]);
    const atores = await this.prisma.usuario.findMany({
      where: { id: { in: [...new Set(itens.map((i) => i.usuarioId).filter((x): x is string => !!x))] } },
      select: { id: true, email: true, papel: true },
    });
    const porId = new Map(atores.map((a) => [a.id, a]));
    return {
      data: itens.map(({ usuarioId, ...i }) => ({ ...i, ator: usuarioId ? (porId.get(usuarioId) ?? null) : null })),
      meta: { page: f.page, pageSize: f.pageSize, total },
      acoes: acoes.map((a) => a.acao),
    };
  }
}
