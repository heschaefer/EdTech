import type { StatusCandidatura, StatusVaga } from '@vagas/contracts';
import { TransicaoInvalida } from './erros';

type Transicao<S extends string> = { de: readonly S[]; para: S | 'MANTEM' };

/** Seção 6 · Vaga. "MANTEM" = a ação não muda o status (ex.: prorrogar vaga ABERTA). */
export const TRANSICOES_VAGA = {
  pausar: { de: ['ABERTA'], para: 'PAUSADA' },
  reativar: { de: ['PAUSADA'], para: 'ABERTA' },
  expirar: { de: ['ABERTA', 'PAUSADA'], para: 'PRAZO_EXPIRADO' },
  prorrogarExpirada: { de: ['PRAZO_EXPIRADO'], para: 'ABERTA' },
  prorrogar: { de: ['ABERTA', 'PAUSADA'], para: 'MANTEM' },
  editar: { de: ['ABERTA', 'PAUSADA', 'PRAZO_EXPIRADO'], para: 'MANTEM' },
  encerrar: { de: ['ABERTA', 'PAUSADA', 'PRAZO_EXPIRADO'], para: 'ENCERRADA' },
  encerrarAutomatico: { de: ['PRAZO_EXPIRADO'], para: 'ENCERRADA' },
} as const satisfies Record<string, Transicao<StatusVaga>>;

/** Seção 6 · Candidatura. */
export const TRANSICOES_CANDIDATURA = {
  moverEtapa: { de: ['EM_PROCESSO'], para: 'EM_PROCESSO' },
  cancelar: { de: ['EM_PROCESSO'], para: 'CANCELADA' },
  reativar: { de: ['CANCELADA'], para: 'EM_PROCESSO' },
  naoSelecionar: { de: ['EM_PROCESSO'], para: 'NAO_SELECIONADO' },
  selecionar: { de: ['EM_PROCESSO'], para: 'SELECIONADO' },
} as const satisfies Record<string, Transicao<StatusCandidatura>>;

export type AcaoVaga = keyof typeof TRANSICOES_VAGA;
export type AcaoCandidatura = keyof typeof TRANSICOES_CANDIDATURA;

/** Devolve o status de destino ou lança TransicaoInvalida (→ 409). */
export function transicaoVaga(acao: AcaoVaga, atual: StatusVaga): StatusVaga {
  const t: Transicao<StatusVaga> = TRANSICOES_VAGA[acao];
  if (!t.de.includes(atual)) throw new TransicaoInvalida('vaga', acao, atual);
  return t.para === 'MANTEM' ? atual : t.para;
}

export function transicaoCandidatura(acao: AcaoCandidatura, atual: StatusCandidatura): StatusCandidatura {
  const t: Transicao<StatusCandidatura> = TRANSICOES_CANDIDATURA[acao];
  if (!t.de.includes(atual)) throw new TransicaoInvalida('candidatura', acao, atual);
  return t.para === 'MANTEM' ? atual : t.para;
}

/** Estados de onde a ação parte, para o UPDATE condicional (`WHERE id = ? AND status IN (...)`). */
export const origensVaga = (acao: AcaoVaga): StatusVaga[] => [...TRANSICOES_VAGA[acao].de];
export const origensCandidatura = (acao: AcaoCandidatura): StatusCandidatura[] => [...TRANSICOES_CANDIDATURA[acao].de];

/** ALU-10: status que vão para o histórico. */
export const STATUS_HISTORICO: StatusCandidatura[] = ['SELECIONADO', 'NAO_SELECIONADO', 'CANCELADA'];
