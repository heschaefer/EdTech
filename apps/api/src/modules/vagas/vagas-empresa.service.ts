import { HttpStatus, Injectable } from '@nestjs/common';
import type { AtualizarVagaInput, CriarVagaInput } from '@vagas/contracts';
import type { Prisma, StatusVaga } from '@prisma/client';
import { ClockService } from '../../common/clock.service';
import { conflito, erroDeCampo, naoEncontrado, Problema, regraDeNegocio } from '../../common/problema';
import { RegraViolada, TransicaoInvalida } from '../../domain/erros';
import { origensVaga, transicaoVaga, TRANSICOES_VAGA, type AcaoVaga } from '../../domain/maquinas';
import { MENSAGENS_PRAZO, prazoVencido, validarPrazo } from '../../domain/prazo';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EncerramentoService } from '../ciclo/encerramento.service';
import { EmpresasService } from '../empresas/empresas.service';
import { apresentarVaga, INCLUIR_VAGA } from './apresentacao';

const salarioDb = (s: { aCombinar: boolean; min?: number | null; max?: number | null }) =>
  s.aCombinar ? { salarioMin: null, salarioMax: null } : { salarioMin: s.min ?? null, salarioMax: s.max ?? null };

/** Traduz erro de máquina de estado em 409 (seção 6). */
function emConflito<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof TransicaoInvalida) throw conflito(`Não é possível fazer isso com a vaga no estado atual (${e.de}).`, { statusVaga: e.de });
    throw e;
  }
}

@Injectable()
export class VagasEmpresaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly empresas: EmpresasService,
    private readonly encerramento: EncerramentoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Seção 8.4: toda mudança de status da vaga feita pela empresa vai para a auditoria. */
  private auditar(usuarioId: string, acao: string, vagaId: string, dados: Record<string, string | number | null>, tx?: Tx) {
    return this.auditoria.registrar({ usuarioId, acao, entidade: 'Vaga', entidadeId: vagaId, dados }, tx);
  }

  async listar(usuarioId: string, status?: StatusVaga) {
    const empresa = await this.empresas.daSessao(usuarioId);
    const vagas = await this.prisma.vaga.findMany({
      where: { empresaId: empresa.id, excluidaEm: null, ...(status ? { status } : {}) },
      orderBy: { criadaEm: 'desc' },
      include: { ...INCLUIR_VAGA, _count: { select: { candidaturas: { where: { status: { not: 'CANCELADA' } } } } } },
    });
    return vagas.map(({ _count, ...v }) => ({ ...apresentarVaga(v), totalCandidatos: _count.candidaturas }));
  }

  async obter(usuarioId: string, id: string) {
    const empresa = await this.empresas.daSessao(usuarioId);
    return this.obterDaEmpresa(empresa.id, id);
  }

  private async obterDaEmpresa(empresaId: string, id: string) {
    const v = await this.prisma.vaga.findFirst({
      where: { id, empresaId, excluidaEm: null },
      include: { ...INCLUIR_VAGA, _count: { select: { candidaturas: true } } },
    });
    if (!v) throw naoEncontrado('Vaga não encontrada');
    const { _count, ...vaga } = v;
    const totalCandidatos = _count.candidaturas ? await this.prisma.candidatura.count({ where: { vagaId: id, status: { not: 'CANCELADA' } } }) : 0;
    return { ...apresentarVaga(vaga), jaTeveCandidatura: _count.candidaturas > 0, totalCandidatos };
  }

  /** Posse (seção 8.2): vaga de outra empresa responde 404. */
  private async vagaDaEmpresa(usuarioId: string, id: string) {
    const empresa = await this.empresas.daSessao(usuarioId);
    const vaga = await this.prisma.vaga.findFirst({ where: { id, empresaId: empresa.id, excluidaEm: null } });
    if (!vaga) throw naoEncontrado('Vaga não encontrada');
    return { empresa, vaga };
  }

  /** EMP-03 */
  async criar(usuarioId: string, d: CriarVagaInput) {
    const empresa = await this.empresas.exigirAprovada(usuarioId); // RN-26
    const agora = this.clock.agora();
    const prazo = validarPrazo(d.prazo, agora, agora); // RN-11
    if (!prazo.ok) throw erroDeCampo('prazo', MENSAGENS_PRAZO[prazo.erro]);
    await this.validarAreas(d.areaIds);

    const vaga = await this.prisma.vaga.create({
      data: {
        empresaId: empresa.id,
        funcao: d.funcao,
        tipo: d.tipo,
        modalidade: d.modalidade,
        atividades: d.atividades,
        requisitos: d.requisitos,
        ...salarioDb(d.salario),
        beneficios: d.beneficios,
        processoSeletivo: d.processoSeletivo,
        cultura: d.cultura,
        cidade: d.modalidade === 'REMOTO' ? (d.cidade ?? null) : d.cidade!,
        uf: d.modalidade === 'REMOTO' ? (d.uf ?? null) : d.uf!,
        semestreMinimo: d.semestreMinimo ?? null,
        prazo: prazo.prazo,
        criadaEm: agora,
        areas: { create: d.areaIds.map((areaId) => ({ areaId })) },
        etapas: { create: d.etapas.map((e, i) => ({ nome: e.nome, ordem: i + 1 })) },
      },
    });
    return this.obterDaEmpresa(empresa.id, vaga.id);
  }

  /** EMP-04: permitido enquanto não ENCERRADA; versão desatualizada → 409. */
  async atualizar(usuarioId: string, id: string, { versao, etapas, areaIds, salario, ...campos }: AtualizarVagaInput) {
    const { empresa, vaga } = await this.vagaDaEmpresa(usuarioId, id);
    emConflito(() => transicaoVaga('editar', vaga.status));

    const modalidade = campos.modalidade ?? vaga.modalidade;
    const cidade = campos.cidade !== undefined ? campos.cidade : vaga.cidade;
    const uf = campos.uf !== undefined ? campos.uf : vaga.uf;
    if (modalidade !== 'REMOTO') {
      if (!cidade) throw erroDeCampo('cidade', 'Obrigatória para vaga presencial ou híbrida');
      if (!uf) throw erroDeCampo('uf', 'Obrigatória para vaga presencial ou híbrida');
    }
    if (areaIds) await this.validarAreas(areaIds, id);

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.vaga.updateMany({
        where: { id, versao, status: { not: 'ENCERRADA' } },
        data: { ...campos, ...(salario ? salarioDb(salario) : {}), versao: { increment: 1 } },
      });
      if (!count) {
        const atual = await tx.vaga.findUniqueOrThrow({ where: { id }, select: { versao: true, status: true } });
        if (atual.status === 'ENCERRADA') throw conflito('A vaga foi encerrada e não pode mais ser editada.');
        throw conflito('A vaga foi alterada por outra pessoa. Recarregue para ver a versão atual.', { versaoAtual: atual.versao });
      }
      // EMP-04: trocar áreas não remove candidaturas existentes.
      if (areaIds) {
        await tx.vagaArea.deleteMany({ where: { vagaId: id } });
        await tx.vagaArea.createMany({ data: [...new Set(areaIds)].map((areaId) => ({ vagaId: id, areaId })) });
      }
      if (etapas) await this.sincronizarEtapas(tx, id, etapas);
    });
    return this.obterDaEmpresa(empresa.id, id);
  }

  /** EMP-04: renomeia, reordena e cria etapas; etapa com candidatos não pode ser removida. */
  private async sincronizarEtapas(tx: Tx, vagaId: string, etapas: { id?: string; nome: string }[]) {
    const existentes = await tx.etapaSelecao.findMany({ where: { vagaId }, select: { id: true, nome: true } });
    const idsExistentes = new Set(existentes.map((e) => e.id));
    for (const e of etapas) if (e.id && !idsExistentes.has(e.id)) throw erroDeCampo('etapas', 'Etapa inválida');

    const mantidas = new Set(etapas.map((e) => e.id).filter(Boolean));
    const removidas = existentes.filter((e) => !mantidas.has(e.id));
    if (removidas.length) {
      const comCandidatos = await tx.candidatura.findFirst({ where: { etapaAtualId: { in: removidas.map((e) => e.id) } }, select: { etapaAtual: { select: { nome: true } } } });
      if (comCandidatos) throw regraDeNegocio(`A etapa "${comCandidatos.etapaAtual!.nome}" tem candidatos e não pode ser removida.`, [{ campo: 'etapas', mensagem: 'Etapa com candidatos não pode ser removida' }]);
      await tx.etapaSelecao.deleteMany({ where: { id: { in: removidas.map((e) => e.id) } } });
    }
    // Ordens provisórias negativas evitam choque com o índice único (vagaId, ordem) durante a troca.
    const restantes = existentes.filter((e) => mantidas.has(e.id));
    for (const [i, e] of restantes.entries()) await tx.etapaSelecao.update({ where: { id: e.id }, data: { ordem: -(i + 1) } });
    for (const [i, e] of etapas.entries()) {
      if (e.id) await tx.etapaSelecao.update({ where: { id: e.id }, data: { nome: e.nome, ordem: i + 1 } });
      else await tx.etapaSelecao.create({ data: { vagaId, nome: e.nome, ordem: i + 1 } });
    }
  }

  /** Aplica uma transição com UPDATE condicional (seção 6): ações simultâneas nunca aplicam duas mudanças. */
  private async transicionar(id: string, acao: AcaoVaga, para: StatusVaga, extra: Prisma.VagaUpdateManyMutationInput = {}) {
    // Ação que mantém o status (ex.: prorrogar vaga aberta) não reescreve o status lido antes.
    const mudaStatus = TRANSICOES_VAGA[acao].para !== 'MANTEM';
    const { count } = await this.prisma.vaga.updateMany({
      where: { id, status: { in: origensVaga(acao) } },
      data: { ...(mudaStatus ? { status: para } : {}), versao: { increment: 1 }, ...extra },
    });
    if (!count) throw conflito('A vaga mudou de estado enquanto você agia. Recarregue a página.');
  }

  /** EMP-05 / RN-16: pausar tira da listagem e bloqueia novas candidaturas; o prazo continua correndo. */
  async pausar(usuarioId: string, id: string) {
    const { empresa, vaga } = await this.vagaDaEmpresa(usuarioId, id);
    await this.transicionar(id, 'pausar', emConflito(() => transicaoVaga('pausar', vaga.status)));
    await this.auditar(usuarioId, 'EMPRESA_PAUSOU_VAGA', id, { de: vaga.status, para: 'PAUSADA' });
    return this.obterDaEmpresa(empresa.id, id);
  }

  /** EMP-05: reativar só se o prazo não venceu. */
  async reativar(usuarioId: string, id: string) {
    const { empresa, vaga } = await this.vagaDaEmpresa(usuarioId, id);
    const para = emConflito(() => transicaoVaga('reativar', vaga.status));
    if (prazoVencido(vaga.prazo, this.clock.agora())) throw regraDeNegocio('O prazo desta vaga já venceu; prorrogue o prazo para reabri-la.');
    await this.transicionar(id, 'reativar', para);
    await this.auditar(usuarioId, 'EMPRESA_REATIVOU_VAGA', id, { de: vaga.status, para });
    return this.obterDaEmpresa(empresa.id, id);
  }

  /** EMP-06 / D10 / RN-17: exclusão lógica só se a vaga nunca teve candidatura. */
  async excluir(usuarioId: string, id: string) {
    const { vaga } = await this.vagaDaEmpresa(usuarioId, id);
    if ((await this.prisma.candidatura.count({ where: { vagaId: vaga.id } })) > 0) {
      throw conflito('Esta vaga já recebeu candidaturas e não pode ser excluída; use "Encerrar".');
    }
    const { count } = await this.prisma.vaga.updateMany({ where: { id, excluidaEm: null }, data: { excluidaEm: this.clock.agora() } });
    if (!count) throw naoEncontrado('Vaga não encontrada');
    await this.auditar(usuarioId, 'EMPRESA_EXCLUIU_VAGA', id, { de: vaga.status });
  }

  /** EMP-07 / RN-11 / D21: novo prazo futuro e no máximo 1 ano após a publicação; vaga expirada volta para ABERTA. */
  async prorrogar(usuarioId: string, id: string, data: string) {
    const { empresa, vaga } = await this.vagaDaEmpresa(usuarioId, id);
    const acao: AcaoVaga = vaga.status === 'PRAZO_EXPIRADO' ? 'prorrogarExpirada' : 'prorrogar';
    const para = emConflito(() => transicaoVaga(acao, vaga.status));
    const prazo = validarPrazo(data, vaga.criadaEm, this.clock.agora());
    if (!prazo.ok) throw erroDeCampo('prazo', MENSAGENS_PRAZO[prazo.erro]);
    await this.transicionar(id, acao, para, { prazo: prazo.prazo, lembreteEnviadoEm: null });
    await this.auditar(usuarioId, 'EMPRESA_PRORROGOU_VAGA', id, { de: vaga.status, para, prazoAnterior: vaga.prazo.toISOString(), prazo: prazo.prazo.toISOString() });
    return this.obterDaEmpresa(empresa.id, id);
  }

  /**
   * EMP-11 / RN-14: encerra de vez e manda a devolutiva. O UPDATE condicional da vaga vem primeiro
   * (trava a linha e espera candidaturas em curso); depois as candidaturas em processo viram
   * SELECIONADO ou NAO_SELECIONADO e cada aluno é notificado in-app e por e-mail.
   */
  async encerrar(usuarioId: string, id: string, selecionados: string[]) {
    const { empresa, vaga } = await this.vagaDaEmpresa(usuarioId, id);
    emConflito(() => transicaoVaga('encerrar', vaga.status));
    const agora = this.clock.agora();
    try {
      const resultado = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.vaga.updateMany({
          where: { id, status: { in: origensVaga('encerrar') } },
          data: { status: 'ENCERRADA', motivoEncerramento: 'MANUAL', encerradaEm: agora, versao: { increment: 1 } },
        });
        if (!count) throw conflito('A vaga mudou de estado enquanto você agia. Recarregue a página.');
        const r = await this.encerramento.devolutiva(tx, { vagaId: id, motivo: 'MANUAL', selecionados, autorId: usuarioId, agora });
        await this.auditar(usuarioId, 'EMPRESA_ENCERROU_VAGA', id, { de: vaga.status, para: 'ENCERRADA', ...r }, tx);
        return r;
      });
      return { ...(await this.obterDaEmpresa(empresa.id, id)), resultado };
    } catch (e) {
      if (e instanceof RegraViolada) throw regraDeNegocio(e.message, [{ campo: 'selecionados', mensagem: 'Selecione apenas candidatos em processo' }]);
      throw e;
    }
  }

  /** Áreas do catálogo e ativas; numa edição, as áreas que a vaga já tinha continuam aceitas. */
  private async validarAreas(areaIds: string[], vagaId?: string) {
    const unicas = [...new Set(areaIds)];
    const atuais = vagaId ? (await this.prisma.vagaArea.findMany({ where: { vagaId } })).map((a) => a.areaId) : [];
    const areas = await this.prisma.areaFormacao.findMany({ where: { id: { in: unicas } } });
    const validas = areas.filter((a) => a.ativa || atuais.includes(a.id));
    if (validas.length !== unicas.length) throw new Problema(HttpStatus.UNPROCESSABLE_ENTITY, 'Dados inválidos', 'Área de formação inválida ou inativa', [{ campo: 'areaIds', mensagem: 'Escolha áreas de formação ativas' }]);
  }
}
