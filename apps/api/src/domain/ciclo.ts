import type { StatusVaga } from '@vagas/contracts';
import { RegraViolada } from './erros';
import { HORAS_ENCERRAMENTO_AUTOMATICO, HORAS_LEMBRETE, somarHoras } from './prazo';

/**
 * Seção 10 · Notificações e jobs. As mesmas condições existem como predicado (testável) e como
 * filtro Prisma (usado no UPDATE condicional, para que job e empresa nunca apliquem as duas ações).
 */
type VagaNoCiclo = { status: StatusVaga; prazo: Date; lembreteEnviadoEm: Date | null; excluidaEm?: Date | null };

const ativa = (v: VagaNoCiclo) => !v.excluidaEm;

/** JOB-01 / RN-12: `status IN (ABERTA, PAUSADA) AND prazo <= agora`. */
export const deveExpirar = (v: VagaNoCiclo, agora: Date) =>
  ativa(v) && (v.status === 'ABERTA' || v.status === 'PAUSADA') && v.prazo.getTime() <= agora.getTime();

/**
 * JOB-03: `status = PRAZO_EXPIRADO AND prazo + 48 h <= agora AND lembreteEnviadoEm IS NULL`.
 * Se o job atrasou e a vaga já passou das 72 h, o lembrete perde o sentido: ela encerra na mesma rodada.
 */
export const deveLembrar = (v: VagaNoCiclo, agora: Date) =>
  ativa(v) &&
  v.status === 'PRAZO_EXPIRADO' &&
  v.lembreteEnviadoEm === null &&
  somarHoras(v.prazo, HORAS_LEMBRETE).getTime() <= agora.getTime() &&
  somarHoras(v.prazo, HORAS_ENCERRAMENTO_AUTOMATICO).getTime() > agora.getTime();

/** JOB-02 / RN-13: `status = PRAZO_EXPIRADO AND prazo + 72 h <= agora`. */
export const deveEncerrarAutomatico = (v: VagaNoCiclo, agora: Date) =>
  ativa(v) && v.status === 'PRAZO_EXPIRADO' && somarHoras(v.prazo, HORAS_ENCERRAMENTO_AUTOMATICO).getTime() <= agora.getTime();

export const filtroExpirar = (agora: Date) => ({ status: { in: ['ABERTA', 'PAUSADA'] as StatusVaga[] }, prazo: { lte: agora }, excluidaEm: null });

export const filtroLembrete = (agora: Date) => ({
  status: 'PRAZO_EXPIRADO' as const,
  lembreteEnviadoEm: null,
  excluidaEm: null,
  prazo: { lte: somarHoras(agora, -HORAS_LEMBRETE), gt: somarHoras(agora, -HORAS_ENCERRAMENTO_AUTOMATICO) },
});

export const filtroEncerrarAutomatico = (agora: Date) => ({
  status: 'PRAZO_EXPIRADO' as const,
  excluidaEm: null,
  prazo: { lte: somarHoras(agora, -HORAS_ENCERRAMENTO_AUTOMATICO) },
});

/** Instante do encerramento automático (para avisos à empresa). */
export const encerramentoAutomaticoEm = (prazo: Date) => somarHoras(prazo, HORAS_ENCERRAMENTO_AUTOMATICO);

/**
 * EMP-11 / RN-14: de 0 a n selecionados entre os candidatos EM_PROCESSO; os demais em processo
 * viram NAO_SELECIONADO. Selecionar quem não está em processo é erro de regra.
 */
export function planoEncerramento(emProcesso: string[], selecionados: string[]) {
  const escolhidos = new Set(selecionados);
  const invalidos = [...escolhidos].filter((id) => !emProcesso.includes(id));
  if (invalidos.length) throw new RegraViolada(`Só candidatos em processo podem ser selecionados (${invalidos.length} inválido(s)).`);
  return {
    selecionados: emProcesso.filter((id) => escolhidos.has(id)),
    naoSelecionados: emProcesso.filter((id) => !escolhidos.has(id)),
  };
}
