import { Injectable } from '@nestjs/common';
import { naoAutenticado } from '../../common/problema';
import { PrismaService } from '../../prisma/prisma.service';

/** Resolve a faculdade do usuário logado; toda consulta do painel filtra por ela (seção 8.2). */
@Injectable()
export class FaculdadeAtualService {
  constructor(private readonly prisma: PrismaService) {}

  async id(usuarioId: string): Promise<string> {
    const f = await this.prisma.faculdade.findUnique({ where: { usuarioId }, select: { id: true, ativa: true } });
    if (!f || !f.ativa) throw naoAutenticado('Faculdade inativa');
    return f.id;
  }
}
