import { Injectable } from '@nestjs/common';
import type { FiltroCandidaturasAluno } from '@vagas/contracts';
import { Prisma } from '@prisma/client';
import { ClockService } from '../../common/clock.service';
import { conflito, naoEncontrado } from '../../common/problema';
import { primeiraEtapa, rotuloEtapa } from '../../domain/candidaturas';
import { TransicaoInvalida } from '../../domain/erros';
import { STATUS_HISTORICO, transicaoCandidatura } from '../../domain/maquinas';
import { aceitaCandidatura, vagaVisivel } from '../../domain/visibilidade';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { VagasAlunoService } from '../vagas/vagas-aluno.service';

export const MSG_VAGA_FECHADA = 'Esta vaga não aceita candidaturas';

/** Resultado do ALU-07: `criada` diz se esta requisição criou (ou reativou) a candidatura. */
type ResultadoCandidatura = { criada: boolean; id: string };

@Injectable()
export class CandidaturasAlunoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly vagas: VagasAlunoService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  /**
   * ALU-07 / RN-09 / RN-10: cria a candidatura EM_PROCESSO na primeira etapa ou reativa a cancelada.
   * A linha da vaga fica travada (FOR SHARE) durante a transação, então pausar, encerrar ou expirar
   * esperam o fim da candidatura e nunca deixam uma inscrição nascer numa vaga já fechada.
   * Requisições paralelas: o índice único (alunoId, vagaId) e o UPDATE condicional garantem uma só.
   */
  async candidatar(usuarioId: string, vagaId: string): Promise<ResultadoCandidatura> {
    const aluno = await this.vagas.contexto(usuarioId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Vaga" WHERE id = ${vagaId}::uuid FOR SHARE`;
        const vaga = await tx.vaga.findFirst({
          where: { id: vagaId, excluidaEm: null },
          include: {
            areas: { select: { areaId: true } },
            etapas: { select: { id: true, nome: true, ordem: true } },
            empresa: { select: { ativa: true, aprovacao: true, usuarioId: true } },
          },
        });
        if (!vaga) throw naoEncontrado('Vaga não encontrada');
        const existente = await tx.candidatura.findUnique({ where: { alunoId_vagaId: { alunoId: aluno.alunoId, vagaId } } });
        const regra = { ...vaga, areaIds: vaga.areas.map((a) => a.areaId) };

        // ALU-06: vaga fora da área (ou de empresa inativa) nem existe para quem não se candidatou.
        if (!existente && !vagaVisivel({ ...regra, status: 'ABERTA' }, aluno)) throw naoEncontrado('Vaga não encontrada');
        if (existente?.status === 'EM_PROCESSO') return { criada: false, id: existente.id }; // duplo clique
        if (existente && existente.status !== 'CANCELADA') throw conflito('Sua candidatura nesta vaga já foi finalizada.');
        if (!aceitaCandidatura(regra, aluno, this.clock.agora())) throw conflito(MSG_VAGA_FECHADA);

        const etapa = primeiraEtapa(vaga.etapas);
        const agora = this.clock.agora();
        let id: string;
        if (existente) {
          const { count } = await tx.candidatura.updateMany({
            where: { id: existente.id, status: 'CANCELADA' },
            data: { status: 'EM_PROCESSO', etapaAtualId: etapa.id, motivoCancelamento: null, atualizadaEm: agora },
          });
          if (!count) return { criada: false, id: existente.id };
          await tx.candidaturaEvento.create({
            data: { candidaturaId: existente.id, tipo: 'REATIVADA', deStatus: 'CANCELADA', paraStatus: 'EM_PROCESSO', etapaNome: etapa.nome, autorId: usuarioId, criadoEm: agora },
          });
          id = existente.id;
        } else {
          const nova = await tx.candidatura.create({
            data: {
              alunoId: aluno.alunoId,
              vagaId,
              etapaAtualId: etapa.id,
              criadaEm: agora,
              atualizadaEm: agora,
              eventos: { create: { tipo: 'CRIADA', paraStatus: 'EM_PROCESSO', etapaNome: etapa.nome, autorId: usuarioId, criadoEm: agora } },
            },
          });
          id = nova.id;
        }

        const { nome } = await tx.aluno.findUniqueOrThrow({ where: { id: aluno.alunoId }, select: { nome: true } });
        await this.notificacoes.criar(
          {
            usuarioId: vaga.empresa.usuarioId,
            tipo: 'NOVA_CANDIDATURA',
            titulo: 'Nova candidatura',
            mensagem: `${nome} se candidatou à vaga ${vaga.funcao}.`,
            link: `/empresa/vagas/${vagaId}/candidatos`,
          },
          tx,
        );
        return { criada: true, id };
      });
    } catch (e) {
      // Corrida de duas criações: a perdedora bate no índice único (RN-09) e devolve a que venceu.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const c = await this.prisma.candidatura.findUniqueOrThrow({ where: { alunoId_vagaId: { alunoId: aluno.alunoId, vagaId } } });
        return { criada: false, id: c.id };
      }
      throw e;
    }
  }

  /** ALU-08 / RN-10: só EM_PROCESSO vira CANCELADA; a empresa deixa de ver o perfil. */
  async remover(usuarioId: string, id: string) {
    const c = await this.daSessao(usuarioId, id);
    try {
      transicaoCandidatura('cancelar', c.status);
    } catch (e) {
      if (e instanceof TransicaoInvalida) throw conflito('Só candidaturas em processo podem ser removidas.');
      throw e;
    }
    const agora = this.clock.agora();
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.candidatura.updateMany({
        where: { id, status: 'EM_PROCESSO' },
        data: { status: 'CANCELADA', motivoCancelamento: 'ALUNO_REMOVEU', atualizadaEm: agora },
      });
      if (!count) throw conflito('Só candidaturas em processo podem ser removidas.');
      await tx.candidaturaEvento.create({
        data: { candidaturaId: id, tipo: 'CANCELADA', deStatus: 'EM_PROCESSO', paraStatus: 'CANCELADA', etapaNome: c.etapaAtual?.nome ?? null, autorId: usuarioId, criadoEm: agora },
      });
    });
    return this.obter(usuarioId, id);
  }

  /** ALU-09 ("Em andamento": EM_PROCESSO) e ALU-10 ("Histórico": status finais, com filtro). */
  async listar(usuarioId: string, f: FiltroCandidaturasAluno) {
    const where: Prisma.CandidaturaWhereInput = {
      aluno: { usuarioId },
      status: f.aba === 'andamento' ? 'EM_PROCESSO' : (f.status ?? { in: STATUS_HISTORICO }),
    };
    const [total, itens] = await this.prisma.$transaction([
      this.prisma.candidatura.count({ where }),
      this.prisma.candidatura.findMany({
        where,
        orderBy: [{ atualizadaEm: 'desc' }, { id: 'asc' }],
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
        include: {
          etapaAtual: { select: { nome: true, ordem: true } },
          vaga: { select: { id: true, funcao: true, status: true, empresa: { select: { nomeFantasia: true } }, etapas: { select: { ordem: true } } } },
        },
      }),
    ]);
    return {
      data: itens.map((c) => ({
        id: c.id,
        status: c.status,
        motivoCancelamento: c.motivoCancelamento,
        etapa: rotuloEtapa(c.etapaAtual, c.vaga.etapas),
        criadaEm: c.criadaEm,
        atualizadaEm: c.atualizadaEm,
        vaga: { id: c.vaga.id, funcao: c.vaga.funcao, status: c.vaga.status, empresa: c.vaga.empresa.nomeFantasia },
      })),
      meta: { page: f.page, pageSize: f.pageSize, total },
    };
  }

  /** ALU-09: detalhe com a linha do tempo de eventos (RN-18). */
  async obter(usuarioId: string, id: string) {
    const c = await this.prisma.candidatura.findFirst({
      where: { id, aluno: { usuarioId } },
      include: {
        etapaAtual: { select: { id: true, nome: true, ordem: true } },
        vaga: {
          select: {
            id: true,
            funcao: true,
            status: true,
            prazo: true,
            empresa: { select: { nomeFantasia: true } },
            etapas: { orderBy: { ordem: 'asc' }, select: { id: true, nome: true, ordem: true } },
          },
        },
        eventos: { orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }], select: { id: true, tipo: true, deStatus: true, paraStatus: true, etapaNome: true, criadoEm: true } },
      },
    });
    if (!c) throw naoEncontrado('Candidatura não encontrada');
    const { vaga, etapaAtual, eventos } = c;
    return {
      id: c.id,
      status: c.status,
      motivoCancelamento: c.motivoCancelamento,
      criadaEm: c.criadaEm,
      atualizadaEm: c.atualizadaEm,
      etapaAtual,
      etapa: rotuloEtapa(etapaAtual, vaga.etapas),
      vaga: { id: vaga.id, funcao: vaga.funcao, status: vaga.status, prazo: vaga.prazo, empresa: vaga.empresa.nomeFantasia, etapas: vaga.etapas },
      eventos,
      podeRemover: c.status === 'EM_PROCESSO',
    };
  }

  /** Posse (seção 8.2): candidatura de outro aluno responde 404. */
  private async daSessao(usuarioId: string, id: string) {
    const c = await this.prisma.candidatura.findFirst({ where: { id, aluno: { usuarioId } }, include: { etapaAtual: { select: { nome: true } } } });
    if (!c) throw naoEncontrado('Candidatura não encontrada');
    return c;
  }
}
