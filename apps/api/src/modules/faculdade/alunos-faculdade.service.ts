import { Injectable } from '@nestjs/common';
import { mascararCpf, type StatusAlunoInput } from '@vagas/contracts';
import type { Prisma } from '@prisma/client';
import { CifraService } from '../../common/cripto/cifra.service';
import { conflito, naoEncontrado } from '../../common/problema';
import { PrismaService } from '../../prisma/prisma.service';
import { InativacaoAlunosService } from '../alunos/inativacao.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

type Filtro = {
  cursoId?: string;
  turmaId?: string;
  semestre?: number;
  status?: 'ATIVO' | 'INATIVO' | 'PENDENTE_VERIFICACAO';
  q?: string;
  page: number;
  pageSize: number;
};

/** FAC-06: a faculdade vê os dados cadastrais dos seus alunos (CPF mascarado, sem currículo) e desliga/reativa. */
@Injectable()
export class AlunosFaculdadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cifra: CifraService,
    private readonly inativacao: InativacaoAlunosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(faculdadeId: string, f: Filtro) {
    const where: Prisma.AlunoWhereInput = {
      faculdadeId,
      ...(f.cursoId ? { cursoId: f.cursoId } : {}),
      ...(f.turmaId ? { turmaId: f.turmaId } : {}),
      ...(f.semestre ? { semestreAtual: f.semestre } : {}),
      ...(f.status ? { usuario: { status: f.status } } : {}),
      ...(f.q ? { OR: [{ nome: { contains: f.q, mode: 'insensitive' } }, { usuario: { email: { contains: f.q.toLowerCase() } } }] } : {}),
    };
    const [total, alunos] = await this.prisma.$transaction([
      this.prisma.aluno.count({ where }),
      this.prisma.aluno.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
        include: {
          usuario: { select: { email: true, status: true } },
          curso: { select: { id: true, nome: true } },
          turma: { select: { id: true, anoIngresso: true, periodoIngresso: true } },
        },
      }),
    ]);
    return {
      data: alunos.map((a) => ({
        id: a.id,
        nome: a.nome,
        email: a.usuario.email,
        telefone: a.telefone,
        cpf: mascararCpf(this.cifra.decifrar(a.cpfCifrado)),
        curso: a.curso,
        turma: a.turma,
        semestreAtual: a.semestreAtual,
        status: a.usuario.status,
        motivoInativacao: a.motivoInativacao,
      })),
      meta: { page: f.page, pageSize: f.pageSize, total },
    };
  }

  /**
   * FAC-06 / RN-22 / D17 / D18: desligar inativa a conta e cancela na hora as candidaturas em andamento;
   * reativar vale só para quem a própria faculdade desligou.
   */
  async alterarStatus(faculdadeId: string, alunoId: string, mudanca: StatusAlunoInput, ator: { id: string; ip?: string }) {
    const aluno = await this.prisma.aluno.findFirst({ where: { id: alunoId, faculdadeId }, include: { usuario: true } });
    if (!aluno) throw naoEncontrado('Aluno não encontrado');

    await this.prisma.$transaction(async (tx) => {
      if (mudanca.status === 'INATIVO') {
        if (aluno.usuario.status !== 'ATIVO') throw conflito('Só um aluno ativo pode ser desligado.');
        await this.inativacao.inativar(tx, [aluno.id], 'DESLIGADO_PELA_FACULDADE', ator.id);
        await this.auditoria.registrar({ usuarioId: ator.id, acao: 'FACULDADE_DESLIGOU_ALUNO', entidade: 'Aluno', entidadeId: aluno.id, ip: ator.ip, dados: { motivo: mudanca.motivo ?? '' } }, tx);
      } else {
        if (aluno.usuario.status !== 'INATIVO' || aluno.motivoInativacao !== 'DESLIGADO_PELA_FACULDADE') {
          throw conflito('Só um aluno desligado pela faculdade pode ser reativado.');
        }
        const { count } = await tx.usuario.updateMany({ where: { id: aluno.usuarioId, status: 'INATIVO' }, data: { status: 'ATIVO' } });
        if (!count) throw conflito('O aluno já foi reativado.');
        await tx.aluno.update({ where: { id: aluno.id }, data: { motivoInativacao: null } });
        await this.auditoria.registrar({ usuarioId: ator.id, acao: 'FACULDADE_REATIVOU_ALUNO', entidade: 'Aluno', entidadeId: aluno.id, ip: ator.ip }, tx);
      }
    });
    const atualizado = await this.prisma.aluno.findUniqueOrThrow({ where: { id: alunoId }, include: { usuario: { select: { status: true } } } });
    return { id: atualizado.id, status: atualizado.usuario.status, motivoInativacao: atualizado.motivoInativacao };
  }
}
