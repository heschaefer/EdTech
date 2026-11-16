import type { StatusCandidatura } from '@vagas/contracts';

export type MotivoCancelamento = 'ALUNO_REMOVEU' | 'ALUNO_INATIVO';
type CandidaturaParaEmpresa = { status: StatusCandidatura; motivoCancelamento: MotivoCancelamento | null };

/**
 * EMP-08 / D17: a empresa lista as candidaturas não canceladas e as canceladas por desligamento
 * (que aparecem como "Aluno inativo"); a que o próprio aluno removeu some da lista (RN-10).
 */
export const empresaVeNaLista = (c: CandidaturaParaEmpresa) => c.status !== 'CANCELADA' || c.motivoCancelamento === 'ALUNO_INATIVO';

/** RN-19: perfil do aluno só com candidatura não cancelada. */
export const empresaVePerfil = (c: CandidaturaParaEmpresa) => c.status !== 'CANCELADA';

/** Mesmas regras como filtro Prisma. */
export const FILTRO_LISTA_EMPRESA = { OR: [{ status: { not: 'CANCELADA' as const } }, { motivoCancelamento: 'ALUNO_INATIVO' as const }] };
export const FILTRO_PERFIL_EMPRESA = { status: { not: 'CANCELADA' as const } };

/** ALU-07 / RN-10: a candidatura nasce (ou renasce) na primeira etapa, a de menor ordem. */
export function primeiraEtapa<E extends { ordem: number }>(etapas: E[]): E {
  if (!etapas.length) throw new Error('Vaga sem etapas');
  return etapas.reduce((a, b) => (b.ordem < a.ordem ? b : a));
}

/** ALU-09: "Entrevista técnica · 2 de 4". */
export function rotuloEtapa(etapa: { nome: string; ordem: number } | null, etapas: { ordem: number }[]): string | null {
  if (!etapa) return null;
  const posicao = [...etapas].sort((a, b) => a.ordem - b.ordem).findIndex((e) => e.ordem === etapa.ordem) + 1;
  return posicao > 0 ? `${etapa.nome} · ${posicao} de ${etapas.length}` : etapa.nome;
}
