import { Injectable } from '@nestjs/common';
import { conflito, erroDeCampo, naoEncontrado } from '../../common/problema';
import { PrismaService } from '../../prisma/prisma.service';

type DadosTurma = { anoIngresso?: number; periodoIngresso?: number; ativa?: boolean };

/** FAC-05: turma por ano e período de ingresso, única por curso. */
@Injectable()
export class TurmasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(faculdadeId: string, cursoId: string) {
    await this.cursoDaFaculdade(faculdadeId, cursoId);
    const turmas = await this.prisma.turma.findMany({
      where: { cursoId },
      orderBy: [{ anoIngresso: 'desc' }, { periodoIngresso: 'desc' }],
      include: { _count: { select: { alunos: true } } },
    });
    return turmas.map(({ _count, ...t }) => ({ ...t, totalAlunos: _count.alunos }));
  }

  async criar(faculdadeId: string, cursoId: string, dados: { anoIngresso: number; periodoIngresso: number }) {
    await this.cursoDaFaculdade(faculdadeId, cursoId);
    await this.validarUnica(cursoId, dados.anoIngresso, dados.periodoIngresso);
    return this.prisma.turma.create({ data: { ...dados, cursoId } });
  }

  async atualizar(faculdadeId: string, id: string, dados: DadosTurma) {
    const turma = await this.turmaDaFaculdade(faculdadeId, id);
    const ano = dados.anoIngresso ?? turma.anoIngresso;
    const periodo = dados.periodoIngresso ?? turma.periodoIngresso;
    if (ano !== turma.anoIngresso || periodo !== turma.periodoIngresso) await this.validarUnica(turma.cursoId, ano, periodo, id);
    return this.prisma.turma.update({ where: { id }, data: dados });
  }

  /** FAC-05 / RN-25: turma com alunos não é excluída, só inativada. */
  async excluir(faculdadeId: string, id: string) {
    const turma = await this.turmaDaFaculdade(faculdadeId, id);
    if ((await this.prisma.aluno.count({ where: { turmaId: turma.id } })) > 0) {
      throw conflito('Turma com alunos não pode ser excluída; inative-a.');
    }
    await this.prisma.turma.delete({ where: { id } });
  }

  private async cursoDaFaculdade(faculdadeId: string, cursoId: string) {
    const curso = await this.prisma.curso.findFirst({ where: { id: cursoId, faculdadeId }, select: { id: true } });
    if (!curso) throw naoEncontrado('Curso não encontrado');
  }

  private async turmaDaFaculdade(faculdadeId: string, id: string) {
    const turma = await this.prisma.turma.findFirst({ where: { id, curso: { faculdadeId } } });
    if (!turma) throw naoEncontrado('Turma não encontrada');
    return turma;
  }

  private async validarUnica(cursoId: string, anoIngresso: number, periodoIngresso: number, excetoId?: string) {
    const existe = await this.prisma.turma.findFirst({ where: { cursoId, anoIngresso, periodoIngresso, ...(excetoId ? { id: { not: excetoId } } : {}) } });
    if (existe) throw erroDeCampo('anoIngresso', `A turma ${anoIngresso}/${periodoIngresso} já existe neste curso`);
  }
}
