import { Injectable } from '@nestjs/common';
import { mensagemEncerrada, mensagemEtapa, NOME_TITULAR_REMOVIDO, type FiltroCandidatos } from '@vagas/contracts';
import type { Prisma } from '@prisma/client';
import { ClockService } from '../../common/clock.service';
import { conflito, erroDeCampo, naoEncontrado, regraDeNegocio } from '../../common/problema';
import { FILTRO_LISTA_EMPRESA, FILTRO_PERFIL_EMPRESA, rotuloEtapa } from '../../domain/candidaturas';
import { TransicaoInvalida } from '../../domain/erros';
import { transicaoCandidatura, type AcaoCandidatura } from '../../domain/maquinas';
import { PrismaService } from '../../prisma/prisma.service';
import { CurriculoService } from '../alunos/curriculo.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EmpresasService } from '../empresas/empresas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

type Ator = { id: string; ip?: string };

const MSG_FINALIZADA = 'Esta candidatura não está mais em processo.';

function exigirTransicao(acao: AcaoCandidatura, status: Parameters<typeof transicaoCandidatura>[1]) {
  try {
    transicaoCandidatura(acao, status);
  } catch (e) {
    if (e instanceof TransicaoInvalida) throw conflito(MSG_FINALIZADA, { statusCandidatura: e.de });
    throw e;
  }
}

/**
 * EMP-08 a EMP-10. Toda consulta filtra pela empresa da sessão (seção 8.2): candidatura ou vaga
 * de outra empresa responde 404 (SEG-02). O CPF nunca é selecionado (D12, SEG-09).
 */
@Injectable()
export class CandidaturasEmpresaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly empresas: EmpresasService,
    private readonly curriculos: CurriculoService,
    private readonly notificacoes: NotificacoesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** EMP-08: candidatos não cancelados (e os inativos, sem perfil), contagem por etapa e filtros. */
  async listar(usuarioId: string, vagaId: string, f: FiltroCandidatos) {
    const empresa = await this.empresas.daSessao(usuarioId);
    const vaga = await this.prisma.vaga.findFirst({
      where: { id: vagaId, empresaId: empresa.id, excluidaEm: null },
      select: { id: true, funcao: true, status: true, etapas: { orderBy: { ordem: 'asc' }, select: { id: true, nome: true, ordem: true } } },
    });
    if (!vaga) throw naoEncontrado('Vaga não encontrada');

    const base: Prisma.CandidaturaWhereInput = { vagaId, ...FILTRO_LISTA_EMPRESA };
    const filtros: Prisma.CandidaturaWhereInput[] = [base];
    const doAluno: Prisma.AlunoWhereInput = {};
    if (f.cursoId) doAluno.cursoId = f.cursoId;
    if (f.faculdadeId) doAluno.faculdadeId = f.faculdadeId;
    if (f.semestreMin != null || f.semestreMax != null) doAluno.semestreAtual = { gte: f.semestreMin, lte: f.semestreMax };
    if (Object.keys(doAluno).length) filtros.push({ aluno: doAluno });
    if (f.etapaId) filtros.push({ etapaAtualId: f.etapaId });
    if (f.status) filtros.push({ status: f.status });
    const where: Prisma.CandidaturaWhereInput = { AND: filtros };
    const ativos: Prisma.CandidaturaWhereInput = { vagaId, ...FILTRO_PERFIL_EMPRESA };

    // Consultas independentes em paralelo, sem transação (Fase 7, carga).
    const [total, itens, porEtapa, porStatus, cursos, faculdades] = await Promise.all([
      this.prisma.candidatura.count({ where }),
      this.prisma.candidatura.findMany({
        where,
        orderBy: [{ criadaEm: f.ordem === 'recentes' ? 'desc' : 'asc' }, { id: 'asc' }],
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
        select: {
          id: true,
          status: true,
          criadaEm: true,
          atualizadaEm: true,
          etapaAtual: { select: { id: true, nome: true, ordem: true } },
          aluno: {
            select: {
              nome: true,
              anonimizadoEm: true,
              semestreAtual: true,
              curso: { select: { id: true, nome: true } },
              faculdade: { select: { id: true, nomeFantasia: true } },
            },
          },
        },
      }),
      this.prisma.candidatura.groupBy({ by: ['etapaAtualId'], where: { vagaId, status: 'EM_PROCESSO' }, _count: { _all: true }, orderBy: { etapaAtualId: 'asc' } }),
      this.prisma.candidatura.groupBy({ by: ['status'], where: base, _count: { _all: true }, orderBy: { status: 'asc' } }),
      this.prisma.curso.findMany({ where: { alunos: { some: { candidaturas: { some: ativos } } } }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
      this.prisma.faculdade.findMany({ where: { alunos: { some: { candidaturas: { some: ativos } } } }, select: { id: true, nomeFantasia: true }, orderBy: { nomeFantasia: 'asc' } }),
    ]);

    const contagemEtapa = new Map(porEtapa.map((g) => [g.etapaAtualId, (g._count as { _all: number })._all]));
    return {
      vaga: { id: vaga.id, funcao: vaga.funcao, status: vaga.status },
      etapas: vaga.etapas.map((e) => ({ ...e, emProcesso: contagemEtapa.get(e.id) ?? 0 })),
      porStatus: Object.fromEntries(porStatus.map((g) => [g.status, (g._count as { _all: number })._all])),
      opcoes: { cursos, faculdades: faculdades.map((x) => ({ id: x.id, nome: x.nomeFantasia })) },
      data: itens.map((c) => {
        // D17: cancelada por desligamento aparece como "Aluno inativo", sem perfil nem dados acadêmicos.
        // Seção 8.4: titular que pediu exclusão só conta nos agregados.
        if (c.aluno.anonimizadoEm) return { id: c.id, status: c.status, alunoInativo: false, alunoRemovido: true, criadaEm: c.criadaEm, atualizadaEm: c.atualizadaEm, etapa: null, aluno: { nome: NOME_TITULAR_REMOVIDO } };
        if (c.status === 'CANCELADA') return { id: c.id, status: c.status, alunoInativo: true, criadaEm: c.criadaEm, atualizadaEm: c.atualizadaEm, etapa: null, aluno: { nome: c.aluno.nome } };
        return {
          id: c.id,
          status: c.status,
          alunoInativo: false,
          criadaEm: c.criadaEm,
          atualizadaEm: c.atualizadaEm,
          etapa: c.etapaAtual,
          aluno: { nome: c.aluno.nome, semestre: c.aluno.semestreAtual, curso: c.aluno.curso.nome, faculdade: c.aluno.faculdade.nomeFantasia },
        };
      }),
      meta: { page: f.page, pageSize: f.pageSize, total },
    };
  }

  /** EMP-09 / RN-19 / D12: dados e currículo atual, nunca o CPF; cada acesso vai para a auditoria. */
  async obter(ator: Ator, id: string) {
    const c = await this.daEmpresa(ator.id, id);
    const aluno = await this.prisma.aluno.findUniqueOrThrow({
      where: { id: c.alunoId },
      select: {
        nome: true,
        telefone: true,
        semestreAtual: true,
        usuario: { select: { email: true, status: true } },
        faculdade: { select: { nomeFantasia: true } },
        curso: { select: { nome: true } },
        turma: { select: { anoIngresso: true, periodoIngresso: true } },
      },
    });
    const { graduacaoAtual, curriculo } = await this.curriculos.obter(c.alunoId);
    await this.auditoria.registrar({ usuarioId: ator.id, acao: 'EMPRESA_VIU_PERFIL', entidade: 'Candidatura', entidadeId: id, ip: ator.ip, dados: { alunoId: c.alunoId } });

    const eventos = await this.prisma.candidaturaEvento.findMany({
      where: { candidaturaId: id },
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
      select: { id: true, tipo: true, deStatus: true, paraStatus: true, etapaNome: true, criadoEm: true },
    });
    return {
      id: c.id,
      status: c.status,
      criadaEm: c.criadaEm,
      atualizadaEm: c.atualizadaEm,
      etapaAtual: c.etapaAtual,
      etapa: rotuloEtapa(c.etapaAtual, c.vaga.etapas),
      vaga: { id: c.vaga.id, funcao: c.vaga.funcao, status: c.vaga.status, etapas: c.vaga.etapas },
      candidato: {
        nome: aluno.nome,
        email: aluno.usuario.email,
        telefone: aluno.telefone,
        faculdade: aluno.faculdade.nomeFantasia,
        curso: aluno.curso.nome,
        turma: aluno.turma,
        semestre: aluno.semestreAtual,
        ativo: aluno.usuario.status === 'ATIVO',
      },
      graduacaoAtual,
      curriculo,
      eventos,
    };
  }

  /** EMP-10: move o candidato EM_PROCESSO para outra etapa da mesma vaga; o aluno é notificado. */
  async moverEtapa(usuarioId: string, id: string, etapaId: string) {
    const c = await this.daEmpresa(usuarioId, id);
    exigirTransicao('moverEtapa', c.status);
    const etapa = c.vaga.etapas.find((e) => e.id === etapaId);
    if (!etapa) throw erroDeCampo('etapaId', 'Etapa inválida para esta vaga');
    if (etapa.id === c.etapaAtualId) throw regraDeNegocio('O candidato já está nesta etapa.');

    const agora = this.clock.agora();
    await this.prisma.$transaction(async (tx) => {
      // UPDATE condicional (seção 6): se outra ação mudou a candidatura antes, nada é aplicado.
      const { count } = await tx.candidatura.updateMany({
        where: { id, status: 'EM_PROCESSO', etapaAtualId: c.etapaAtualId },
        data: { etapaAtualId: etapa.id, atualizadaEm: agora },
      });
      if (!count) throw conflito('A candidatura mudou enquanto você agia. Recarregue a página.');
      await tx.candidaturaEvento.create({
        data: { candidaturaId: id, tipo: 'ETAPA_ALTERADA', deStatus: 'EM_PROCESSO', paraStatus: 'EM_PROCESSO', etapaNome: etapa.nome, autorId: usuarioId, criadoEm: agora },
      });
      await this.notificacoes.criar(
        {
          usuarioId: c.aluno.usuarioId,
          tipo: 'ETAPA_ALTERADA',
          titulo: `Sua candidatura avançou: ${etapa.nome}`,
          mensagem: mensagemEtapa(c.vaga.funcao, c.vaga.empresa.nomeFantasia, etapa.nome),
          link: `/aluno/candidaturas/${id}`,
        },
        tx,
      );
    });
    return this.resumo(id);
  }

  /** EMP-10 / RN-15: "Não selecionado" antes do encerramento, com a mensagem genérica. */
  async naoSelecionar(usuarioId: string, id: string) {
    const c = await this.daEmpresa(usuarioId, id);
    exigirTransicao('naoSelecionar', c.status);

    const agora = this.clock.agora();
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.candidatura.updateMany({
        where: { id, status: 'EM_PROCESSO', vaga: { status: { not: 'ENCERRADA' } } },
        data: { status: 'NAO_SELECIONADO', atualizadaEm: agora },
      });
      if (!count) throw conflito(MSG_FINALIZADA);
      await tx.candidaturaEvento.create({
        data: { candidaturaId: id, tipo: 'NAO_SELECIONADO', deStatus: 'EM_PROCESSO', paraStatus: 'NAO_SELECIONADO', etapaNome: c.etapaAtual?.nome ?? null, autorId: usuarioId, criadoEm: agora },
      });
      await this.notificacoes.criar(
        {
          usuarioId: c.aluno.usuarioId,
          tipo: 'NAO_SELECIONADO',
          titulo: `Candidatura encerrada: ${c.vaga.funcao}`,
          mensagem: mensagemEncerrada(c.vaga.funcao, c.vaga.empresa.nomeFantasia),
          link: `/aluno/candidaturas/${id}`,
        },
        tx,
      );
    });
    return this.resumo(id);
  }

  private async resumo(id: string) {
    const c = await this.prisma.candidatura.findUniqueOrThrow({
      where: { id },
      select: { id: true, status: true, atualizadaEm: true, etapaAtual: { select: { id: true, nome: true, ordem: true } } },
    });
    return c;
  }

  /** Posse + RN-19: candidatura de vaga de outra empresa, ou cancelada, responde 404. */
  private async daEmpresa(usuarioId: string, id: string) {
    const empresa = await this.empresas.daSessao(usuarioId);
    const c = await this.prisma.candidatura.findFirst({
      where: { id, vaga: { empresaId: empresa.id, excluidaEm: null }, ...FILTRO_PERFIL_EMPRESA },
      include: {
        etapaAtual: { select: { id: true, nome: true, ordem: true } },
        aluno: { select: { usuarioId: true } },
        vaga: {
          select: {
            id: true,
            funcao: true,
            status: true,
            empresa: { select: { nomeFantasia: true } },
            etapas: { orderBy: { ordem: 'asc' }, select: { id: true, nome: true, ordem: true } },
          },
        },
      },
    });
    if (!c) throw naoEncontrado('Candidatura não encontrada');
    return c;
  }
}
