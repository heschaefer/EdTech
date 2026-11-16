import { Injectable } from '@nestjs/common';
import type { AtualizarCursoInput, CriarCursoInput } from '@vagas/contracts';
import { conflito, erroDeCampo, naoEncontrado } from '../../common/problema';
import { gerarSemestres, reducaoPermitida, totalSemestres } from '../../domain/cursos';
import { PrismaService, type Tx } from '../../prisma/prisma.service';

/** FAC-03 */
@Injectable()
export class CursosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(faculdadeId: string) {
    const cursos = await this.prisma.curso.findMany({
      where: { faculdadeId },
      orderBy: { nome: 'asc' },
      include: { area: { select: { id: true, nome: true } }, _count: { select: { alunos: true, turmas: true } } },
    });
    return cursos.map(apresentar);
  }

  async obter(faculdadeId: string, id: string) {
    const curso = await this.prisma.curso.findFirst({
      where: { id, faculdadeId },
      include: { area: { select: { id: true, nome: true } }, _count: { select: { alunos: true, turmas: true } } },
    });
    if (!curso) throw naoEncontrado('Curso não encontrado');
    return apresentar(curso);
  }

  async criar(faculdadeId: string, dados: CriarCursoInput) {
    await this.validarArea(dados.areaId);
    await this.validarNome(faculdadeId, dados.nome);
    const curso = await this.prisma.curso.create({
      data: { ...dados, faculdadeId, semestres: { create: gerarSemestres(dados.duracaoAnos) } },
    });
    return this.obter(faculdadeId, curso.id);
  }

  async atualizar(faculdadeId: string, id: string, dados: AtualizarCursoInput) {
    const atual = await this.prisma.curso.findFirst({ where: { id, faculdadeId } });
    if (!atual) throw naoEncontrado('Curso não encontrado');
    if (dados.areaId && dados.areaId !== atual.areaId) await this.validarArea(dados.areaId);
    if (dados.nome && dados.nome.toLowerCase() !== atual.nome.toLowerCase()) await this.validarNome(faculdadeId, dados.nome, id);

    await this.prisma.$transaction(async (tx) => {
      if (dados.duracaoAnos && dados.duracaoAnos !== atual.duracaoAnos) await this.ajustarDuracao(tx, id, dados.duracaoAnos);
      await tx.curso.update({ where: { id }, data: dados });
    });
    return this.obter(faculdadeId, id);
  }

  /**
   * FAC-03: a duração define os semestres (anos × 2). Aumentar cria os que faltam; reduzir
   * remove os excedentes (com suas aulas) e é bloqueado se houver aluno acima do novo limite.
   */
  private async ajustarDuracao(tx: Tx, cursoId: string, novaDuracao: number) {
    const { _max } = await tx.aluno.aggregate({ where: { cursoId }, _max: { semestreAtual: true } });
    if (!reducaoPermitida(novaDuracao, _max.semestreAtual)) {
      throw erroDeCampo('duracaoAnos', `Há aluno no ${_max.semestreAtual}º semestre; a duração não pode ficar abaixo disso`);
    }
    const limite = totalSemestres(novaDuracao);
    await tx.semestre.deleteMany({ where: { cursoId, ordem: { gt: limite } } });
    await tx.semestre.createMany({ data: gerarSemestres(novaDuracao).map((s) => ({ ...s, cursoId })), skipDuplicates: true });
  }

  /** RN-25: curso com alunos não é excluído, só inativado. */
  async excluir(faculdadeId: string, id: string) {
    const curso = await this.prisma.curso.findFirst({ where: { id, faculdadeId }, include: { _count: { select: { alunos: true } } } });
    if (!curso) throw naoEncontrado('Curso não encontrado');
    if (curso._count.alunos > 0) throw conflito('Curso com alunos não pode ser excluído; inative-o.');
    await this.prisma.$transaction([
      this.prisma.turma.deleteMany({ where: { cursoId: id } }),
      this.prisma.curso.delete({ where: { id } }),
    ]);
  }

  /** RN-07: exatamente uma área ativa do catálogo. */
  private async validarArea(areaId: string) {
    const area = await this.prisma.areaFormacao.findUnique({ where: { id: areaId } });
    if (!area || !area.ativa) throw erroDeCampo('areaId', 'Escolha uma área de formação ativa');
  }

  /** Nome único na faculdade (sem diferenciar maiúsculas). */
  private async validarNome(faculdadeId: string, nome: string, excetoId?: string) {
    const existe = await this.prisma.curso.findFirst({
      where: { faculdadeId, nome: { equals: nome, mode: 'insensitive' }, ...(excetoId ? { id: { not: excetoId } } : {}) },
    });
    if (existe) throw erroDeCampo('nome', 'Já existe um curso com esse nome');
  }
}

type CursoComContagem = {
  id: string;
  nome: string;
  duracaoAnos: number;
  ementa: string;
  ativo: boolean;
  area: { id: string; nome: string };
  _count: { alunos: number; turmas: number };
};

const apresentar = ({ _count, faculdadeId: _f, areaId: _a, ...c }: CursoComContagem & { faculdadeId?: string; areaId?: string }) => ({
  ...c,
  totalAlunos: _count.alunos,
  totalTurmas: _count.turmas,
});
