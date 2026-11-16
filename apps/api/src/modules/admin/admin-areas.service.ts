import { Injectable } from '@nestjs/common';
import { conflito, erroDeCampo, naoEncontrado } from '../../common/problema';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

type Ator = { id: string; ip?: string };

/** ADM-03: catálogo global de áreas de formação (D1). */
@Injectable()
export class AdminAreasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar() {
    const areas = await this.prisma.areaFormacao.findMany({
      orderBy: { nome: 'asc' },
      include: { _count: { select: { cursos: true, vagas: true } } },
    });
    return areas.map(({ _count, ...a }) => ({ ...a, totalCursos: _count.cursos, totalVagas: _count.vagas, emUso: _count.cursos + _count.vagas > 0 }));
  }

  async criar(nome: string, ator: Ator) {
    await this.nomeLivre(nome);
    return this.prisma.$transaction(async (tx) => {
      const area = await tx.areaFormacao.create({ data: { nome } });
      await this.auditoria.registrar({ usuarioId: ator.id, acao: 'ADMIN_CRIOU_AREA', entidade: 'AreaFormacao', entidadeId: area.id, ip: ator.ip, dados: { nome } }, tx);
      return area;
    });
  }

  async atualizar(id: string, dados: { nome?: string; ativa?: boolean }, ator: Ator) {
    const area = await this.prisma.areaFormacao.findUnique({ where: { id } });
    if (!area) throw naoEncontrado();
    if (dados.nome && dados.nome.toLowerCase() !== area.nome.toLowerCase()) await this.nomeLivre(dados.nome, id);
    return this.prisma.$transaction(async (tx) => {
      const atualizada = await tx.areaFormacao.update({ where: { id }, data: dados });
      await this.auditoria.registrar({ usuarioId: ator.id, acao: 'ADMIN_EDITOU_AREA', entidade: 'AreaFormacao', entidadeId: id, ip: ator.ip, dados }, tx);
      return atualizada;
    });
  }

  /** ADM-03: área em uso por curso ou vaga não pode ser excluída (só inativada). */
  async excluir(id: string, ator: Ator) {
    const area = await this.prisma.areaFormacao.findUnique({ where: { id }, include: { _count: { select: { cursos: true, vagas: true } } } });
    if (!area) throw naoEncontrado();
    if (area._count.cursos + area._count.vagas > 0) throw conflito('Área em uso por curso ou vaga; inative-a em vez de excluir.');
    await this.prisma.$transaction(async (tx) => {
      await tx.areaFormacao.delete({ where: { id } });
      await this.auditoria.registrar({ usuarioId: ator.id, acao: 'ADMIN_EXCLUIU_AREA', entidade: 'AreaFormacao', entidadeId: id, ip: ator.ip, dados: { nome: area.nome } }, tx);
    });
  }

  private async nomeLivre(nome: string, excetoId?: string) {
    const existente = await this.prisma.areaFormacao.findFirst({ where: { nome: { equals: nome, mode: 'insensitive' }, ...(excetoId ? { id: { not: excetoId } } : {}) } });
    if (existente) throw erroDeCampo('nome', 'Já existe uma área com esse nome');
  }
}
