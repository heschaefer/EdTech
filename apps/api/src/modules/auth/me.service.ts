import { Injectable } from '@nestjs/common';
import type { Me } from '@vagas/contracts';
import { naoAutenticado } from '../../common/problema';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async de(usuarioId: string): Promise<Me & Record<string, unknown>> {
    const u = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: {
        aluno: { select: { nome: true } },
        empresa: { select: { nomeFantasia: true, aprovacao: true, aprovacaoMotivo: true } },
        faculdade: { select: { nomeFantasia: true } },
      },
    });
    if (!u) throw naoAutenticado();
    const nome = u.aluno?.nome ?? u.empresa?.nomeFantasia ?? u.faculdade?.nomeFantasia ?? 'Administrador';
    return {
      id: u.id,
      email: u.email,
      papel: u.papel,
      status: u.status,
      nome,
      ...(u.empresa ? { aprovacao: u.empresa.aprovacao, aprovacaoMotivo: u.empresa.aprovacaoMotivo } : {}),
    };
  }
}
