import { Controller, Get, Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Catálogo de áreas ativas, para qualquer usuário logado (ALU-05, FAC-03, EMP-03). */
@Controller('areas')
export class AreasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  listar() {
    return this.prisma.areaFormacao.findMany({ where: { ativa: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } });
  }
}

@Module({ controllers: [AreasController] })
export class AreasModule {}
