import { Injectable } from '@nestjs/common';
import { mensagemEncerrada, mensagemSelecionado } from '@vagas/contracts';
import type { MotivoEncerramento } from '@prisma/client';
import { planoEncerramento } from '../../domain/ciclo';
import type { Tx } from '../../prisma/prisma.service';
import { NotificacoesService, type NovaNotificacao } from '../notificacoes/notificacoes.service';

type Encerramento = {
  vagaId: string;
  motivo: MotivoEncerramento;
  selecionados: string[];
  autorId: string | null;
  agora: Date;
};

/**
 * EMP-11 / JOB-02 (RN-13, RN-14): devolutiva de todos os candidatos em processo. Roda dentro da
 * transação que já mudou a vaga para ENCERRADA com UPDATE condicional — só quem venceu essa
 * corrida chega aqui, então nenhum aluno é notificado duas vezes.
 */
@Injectable()
export class EncerramentoService {
  constructor(private readonly notificacoes: NotificacoesService) {}

  async devolutiva(tx: Tx, { vagaId, motivo, selecionados, autorId, agora }: Encerramento) {
    // Trava as candidaturas em processo: "não selecionar" ou "mover etapa" simultâneos esperam e depois falham com 409.
    const travadas = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Candidatura" WHERE "vagaId" = ${vagaId}::uuid AND status = 'EM_PROCESSO' ORDER BY id FOR UPDATE`;
    const plano = planoEncerramento(
      travadas.map((c) => c.id),
      selecionados,
    );
    const candidaturas = await tx.candidatura.findMany({
      where: { id: { in: travadas.map((c) => c.id) } },
      select: { id: true, etapaAtual: { select: { nome: true } }, aluno: { select: { usuarioId: true } } },
    });
    const vaga = await tx.vaga.findUniqueOrThrow({ where: { id: vagaId }, select: { funcao: true, empresa: { select: { nomeFantasia: true } } } });
    const porId = new Map(candidaturas.map((c) => [c.id, c]));

    const aplicar = async (ids: string[], para: 'SELECIONADO' | 'NAO_SELECIONADO') => {
      if (!ids.length) return;
      await tx.candidatura.updateMany({ where: { id: { in: ids }, status: 'EM_PROCESSO' }, data: { status: para, atualizadaEm: agora } });
      await tx.candidaturaEvento.createMany({
        data: ids.map((candidaturaId) => ({
          candidaturaId,
          tipo: para,
          deStatus: 'EM_PROCESSO' as const,
          paraStatus: para,
          etapaNome: porId.get(candidaturaId)?.etapaAtual?.nome ?? null,
          autorId,
          criadoEm: agora,
        })),
      });
    };
    await aplicar(plano.selecionados, 'SELECIONADO');
    await aplicar(plano.naoSelecionados, 'NAO_SELECIONADO');

    const { funcao } = vaga;
    const empresa = vaga.empresa.nomeFantasia;
    const avisos: NovaNotificacao[] = [
      ...plano.selecionados.map((id) => ({
        usuarioId: porId.get(id)!.aluno.usuarioId,
        tipo: 'SELECIONADO',
        titulo: `Você foi selecionado(a): ${funcao}`,
        mensagem: mensagemSelecionado(funcao, empresa),
        link: `/aluno/candidaturas/${id}`,
      })),
      ...plano.naoSelecionados.map((id) => ({
        usuarioId: porId.get(id)!.aluno.usuarioId,
        tipo: motivo === 'AUTOMATICO' ? 'VAGA_ENCERRADA_AUTOMATICAMENTE' : 'NAO_SELECIONADO',
        titulo: `Vaga encerrada: ${funcao}`,
        mensagem: mensagemEncerrada(funcao, empresa),
        link: `/aluno/candidaturas/${id}`,
      })),
    ];
    await this.notificacoes.criar(avisos, tx);
    return { selecionados: plano.selecionados.length, naoSelecionados: plano.naoSelecionados.length };
  }
}
