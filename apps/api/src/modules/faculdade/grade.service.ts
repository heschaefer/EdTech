import { Injectable } from '@nestjs/common';
import { naoEncontrado } from '../../common/problema';
import { reordenar } from '../../domain/cursos';
import { PrismaService, type Tx } from '../../prisma/prisma.service';

type DadosAula = { nome?: string; ementa?: string; ordem?: number };

/** FAC-04: em cada semestre, cadastrar, ordenar, editar e remover aulas. */
@Injectable()
export class GradeService {
  constructor(private readonly prisma: PrismaService) {}

  async semestres(faculdadeId: string, cursoId: string) {
    const curso = await this.prisma.curso.findFirst({ where: { id: cursoId, faculdadeId }, select: { id: true } });
    if (!curso) throw naoEncontrado('Curso não encontrado');
    return this.prisma.semestre.findMany({
      where: { cursoId },
      orderBy: { ordem: 'asc' },
      select: { id: true, ano: true, periodo: true, ordem: true, aulas: { orderBy: { ordem: 'asc' }, select: { id: true, nome: true, ementa: true, ordem: true } } },
    });
  }

  async criarAula(faculdadeId: string, semestreId: string, dados: { nome: string; ementa: string }) {
    const semestre = await this.prisma.semestre.findFirst({ where: { id: semestreId, curso: { faculdadeId } } });
    if (!semestre) throw naoEncontrado('Semestre não encontrado');
    return this.prisma.$transaction(async (tx) => {
      const { _max } = await tx.aula.aggregate({ where: { semestreId }, _max: { ordem: true } });
      return tx.aula.create({ data: { ...dados, semestreId, ordem: (_max.ordem ?? 0) + 1 } });
    });
  }

  async atualizarAula(faculdadeId: string, id: string, { ordem, ...dados }: DadosAula) {
    const aula = await this.aulaDaFaculdade(faculdadeId, id);
    return this.prisma.$transaction(async (tx) => {
      if (Object.keys(dados).length) await tx.aula.update({ where: { id }, data: dados });
      if (ordem !== undefined && ordem !== aula.ordem) {
        const aulas = await tx.aula.findMany({ where: { semestreId: aula.semestreId }, orderBy: { ordem: 'asc' }, select: { id: true } });
        await this.gravarOrdem(tx, reordenar(aulas, id, ordem));
      }
      return tx.aula.findUniqueOrThrow({ where: { id } });
    });
  }

  async excluirAula(faculdadeId: string, id: string) {
    const aula = await this.aulaDaFaculdade(faculdadeId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.aula.delete({ where: { id } });
      const restantes = await tx.aula.findMany({ where: { semestreId: aula.semestreId }, orderBy: { ordem: 'asc' }, select: { id: true } });
      await this.gravarOrdem(tx, restantes.map((a, i) => ({ ...a, ordem: i + 1 })));
    });
  }

  private async aulaDaFaculdade(faculdadeId: string, id: string) {
    const aula = await this.prisma.aula.findFirst({ where: { id, semestre: { curso: { faculdadeId } } } });
    if (!aula) throw naoEncontrado('Aula não encontrada');
    return aula;
  }

  private async gravarOrdem(tx: Tx, itens: { id: string; ordem: number }[]) {
    for (const { id, ordem } of itens) await tx.aula.update({ where: { id }, data: { ordem } });
  }
}
