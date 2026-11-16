import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ClockService } from '../../common/clock.service';
import { encerramentoAutomaticoEm, filtroEncerrarAutomatico, filtroExpirar, filtroLembrete } from '../../domain/ciclo';
import { dataHoraBrasilia } from '../../domain/prazo';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { EncerramentoService } from './encerramento.service';

export const JOBS_PRAZO = ['expirar-prazos', 'lembrete', 'encerrar-automatico'] as const;
export type JobPrazo = (typeof JOBS_PRAZO)[number];

type VagaJob = { id: string; funcao: string; prazo: Date; empresa: { usuarioId: string } };
const SELECAO = { id: true, funcao: true, prazo: true, empresa: { select: { usuarioId: true } } } satisfies Prisma.VagaSelect;

/**
 * Jobs de prazo (seção 10): o worker roda os três a cada 5 min; nos testes, `/__test__/jobs/:nome`
 * roda um deles na hora, só para a vaga indicada. Cada vaga anda na própria transação, com o filtro
 * repetido no UPDATE condicional: se a empresa prorrogou ou encerrou no mesmo instante, só uma
 * das ações vence (JOB-02).
 */
@Injectable()
export class PrazosService {
  private readonly logger = new Logger(PrazosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly notificacoes: NotificacoesService,
    private readonly encerramento: EncerramentoService,
  ) {}

  rodar(job: JobPrazo, vagaId?: string): Promise<number> {
    if (job === 'expirar-prazos') return this.expirar(vagaId);
    if (job === 'lembrete') return this.lembrar(vagaId);
    return this.encerrarAutomatico(vagaId);
  }

  /** Uma rodada completa, na ordem do ciclo. */
  async rodarTodos() {
    const expiradas = await this.expirar();
    const lembretes = await this.lembrar();
    const encerradas = await this.encerrarAutomatico();
    if (expiradas || lembretes || encerradas) this.logger.log(`Prazos: ${expiradas} expirada(s), ${lembretes} lembrete(s), ${encerradas} encerrada(s)`);
    return { expiradas, lembretes, encerradas };
  }

  /** JOB-01 / RN-12 / EMP-12: vira PRAZO_EXPIRADO, sai da listagem e a empresa recebe os atalhos. */
  expirar(vagaId?: string) {
    return this.porVaga(filtroExpirar, vagaId, async (tx, v, agora) => {
      const { count } = await tx.vaga.updateMany({ where: { id: v.id, ...filtroExpirar(agora) }, data: { status: 'PRAZO_EXPIRADO', versao: { increment: 1 } } });
      if (!count) return false;
      await this.notificacoes.criar(
        {
          usuarioId: v.empresa.usuarioId,
          tipo: 'PRAZO_VENCIDO',
          titulo: `Prazo vencido: ${v.funcao}`,
          mensagem: `O prazo da vaga ${v.funcao} venceu e ela saiu da listagem. Prorrogue o prazo ou encerre a vaga com a devolutiva aos candidatos. Sem nenhuma ação, ela será encerrada automaticamente em ${dataHoraBrasilia(encerramentoAutomaticoEm(v.prazo))}.`,
          link: `/empresa/vagas/${v.id}`,
        },
        tx,
      );
      return true;
    });
  }

  /** JOB-03 / EMP-12: lembrete único 24 h antes do encerramento automático. */
  lembrar(vagaId?: string) {
    return this.porVaga(filtroLembrete, vagaId, async (tx, v, agora) => {
      const { count } = await tx.vaga.updateMany({ where: { id: v.id, ...filtroLembrete(agora) }, data: { lembreteEnviadoEm: agora } });
      if (!count) return false;
      await this.notificacoes.criar(
        {
          usuarioId: v.empresa.usuarioId,
          tipo: 'LEMBRETE_ENCERRAMENTO',
          titulo: `Lembrete: ${v.funcao} será encerrada em 24 h`,
          mensagem: `A vaga ${v.funcao} está com o prazo vencido e será encerrada automaticamente em ${dataHoraBrasilia(encerramentoAutomaticoEm(v.prazo))}, com a mensagem genérica de não seleção para todos em processo. Prorrogue o prazo ou encerre escolhendo os selecionados antes disso.`,
          link: `/empresa/vagas/${v.id}`,
        },
        tx,
      );
      return true;
    });
  }

  /** JOB-02 / RN-13: ENCERRADA (AUTOMATICO); quem estava em processo vira NAO_SELECIONADO e todos são avisados. */
  encerrarAutomatico(vagaId?: string) {
    return this.porVaga(filtroEncerrarAutomatico, vagaId, async (tx, v, agora) => {
      const { count } = await tx.vaga.updateMany({
        where: { id: v.id, ...filtroEncerrarAutomatico(agora) },
        data: { status: 'ENCERRADA', motivoEncerramento: 'AUTOMATICO', encerradaEm: agora, versao: { increment: 1 } },
      });
      if (!count) return false;
      const r = await this.encerramento.devolutiva(tx, { vagaId: v.id, motivo: 'AUTOMATICO', selecionados: [], autorId: null, agora });
      await this.notificacoes.criar(
        {
          usuarioId: v.empresa.usuarioId,
          tipo: 'VAGA_ENCERRADA_AUTOMATICAMENTE',
          titulo: `Vaga encerrada automaticamente: ${v.funcao}`,
          mensagem: `A vaga ${v.funcao} foi encerrada 72 h após o prazo, sem prorrogação. ${r.naoSelecionados} candidato(s) em processo receberam a mensagem de encerramento.`,
          link: `/empresa/vagas/${v.id}`,
        },
        tx,
      );
      return true;
    });
  }

  private async porVaga(
    filtro: (agora: Date) => Prisma.VagaWhereInput,
    vagaId: string | undefined,
    acao: (tx: Tx, v: VagaJob, agora: Date) => Promise<boolean>,
  ): Promise<number> {
    const vagas = await this.prisma.vaga.findMany({
      where: { ...filtro(this.clock.agora()), ...(vagaId ? { id: vagaId } : {}) },
      select: SELECAO,
      orderBy: { prazo: 'asc' },
      take: 500,
    });
    let feitas = 0;
    for (const v of vagas) {
      try {
        if (await this.prisma.$transaction((tx) => acao(tx, v, this.clock.agora()))) feitas++;
      } catch (e) {
        this.logger.error(`Vaga ${v.id}: ${(e as Error).message}`);
      }
    }
    return feitas;
  }
}
