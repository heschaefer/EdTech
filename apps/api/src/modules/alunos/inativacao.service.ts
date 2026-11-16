import { Injectable } from '@nestjs/common';
import type { MotivoInativacao } from '@prisma/client';
import { ClockService } from '../../common/clock.service';
import type { Tx } from '../../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

/**
 * RN-22: aluno inativado deixa de ver vagas; candidaturas EM_PROCESSO viram CANCELADA (ALUNO_INATIVO),
 * com evento imutável (RN-18) e aviso à empresa. Usado pelo desligamento (FAC-06) e pela
 * inativação da faculdade (ADM-02, RN-27).
 */
@Injectable()
export class InativacaoAlunosService {
  constructor(
    private readonly clock: ClockService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async inativar(tx: Tx, alunoIds: string[], motivo: MotivoInativacao, autorId: string | null) {
    if (!alunoIds.length) return;
    const alunos = await tx.aluno.findMany({ where: { id: { in: alunoIds } }, select: { id: true, usuarioId: true, nome: true } });
    await tx.usuario.updateMany({ where: { id: { in: alunos.map((a) => a.usuarioId) }, status: 'ATIVO' }, data: { status: 'INATIVO' } });
    await tx.aluno.updateMany({ where: { id: { in: alunoIds } }, data: { motivoInativacao: motivo } });

    const candidaturas = await tx.candidatura.findMany({
      where: { alunoId: { in: alunoIds }, status: 'EM_PROCESSO' },
      select: { id: true, alunoId: true, vaga: { select: { id: true, funcao: true, empresa: { select: { usuarioId: true } } } } },
    });
    if (!candidaturas.length) return;

    const ids = candidaturas.map((c) => c.id);
    await tx.candidatura.updateMany({
      where: { id: { in: ids }, status: 'EM_PROCESSO' },
      data: { status: 'CANCELADA', motivoCancelamento: 'ALUNO_INATIVO' },
    });
    await tx.candidaturaEvento.createMany({
      data: ids.map((candidaturaId) => ({
        candidaturaId,
        tipo: 'CANCELADA',
        deStatus: 'EM_PROCESSO' as const,
        paraStatus: 'CANCELADA' as const,
        autorId,
        criadoEm: this.clock.agora(),
      })),
    });
    const nomes = new Map(alunos.map((a) => [a.id, a.nome]));
    await this.notificacoes.criar(
      candidaturas.map((c) => ({
        usuarioId: c.vaga.empresa.usuarioId,
        tipo: 'CANDIDATO_INATIVO',
        titulo: 'Candidatura cancelada',
        mensagem: `${nomes.get(c.alunoId)} não está mais ativo(a) na faculdade; a candidatura para ${c.vaga.funcao} foi cancelada.`,
        link: `/empresa/vagas/${c.vaga.id}/candidatos`,
      })),
      tx,
    );
  }

  /** RN-27: reativar a faculdade reativa só quem foi inativado por esse motivo. */
  async reativarPorFaculdade(tx: Tx, faculdadeId: string) {
    const alunos = await tx.aluno.findMany({ where: { faculdadeId, motivoInativacao: 'FACULDADE_INATIVA' }, select: { id: true, usuarioId: true } });
    if (!alunos.length) return;
    await tx.usuario.updateMany({ where: { id: { in: alunos.map((a) => a.usuarioId) }, status: 'INATIVO' }, data: { status: 'ATIVO' } });
    await tx.aluno.updateMany({ where: { id: { in: alunos.map((a) => a.id) } }, data: { motivoInativacao: null } });
  }
}
