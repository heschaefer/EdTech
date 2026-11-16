/** RN-11 e RN-24: prazos valem até 23:59:59 de America/Sao_Paulo; tudo é guardado em UTC. */
export const FUSO = 'America/Sao_Paulo';
const HORA = 60 * 60 * 1000;

/** Deslocamento (ms) do fuso em relação ao UTC num instante. Ex.: -3 h → -10_800_000. */
function deslocamento(instante: Date, fuso = FUSO): number {
  const nome = new Intl.DateTimeFormat('en-US', { timeZone: fuso, timeZoneName: 'longOffset' })
    .formatToParts(instante)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(nome ?? '');
  if (!m) return 0;
  const sinal = m[1] === '-' ? -1 : 1;
  return sinal * (Number(m[2]) * HORA + Number(m[3] ?? 0) * 60_000);
}

/** Data civil (YYYY-MM-DD) de um instante no fuso de Brasília. */
export function dataCivil(instante: Date, fuso = FUSO): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instante);
}

/** 23:59:59 da data escolhida em Brasília, como instante UTC (D15). */
export function fimDoDia(data: string, fuso = FUSO): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) throw new Error(`Data inválida: ${data}`);
  const local = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59);
  const palpite = new Date(local);
  return new Date(local - deslocamento(new Date(local - deslocamento(palpite, fuso)), fuso));
}

/** Soma anos a uma data civil, ajustando 29/02 para 28/02. */
export function somarAnos(data: string, anos: number): string {
  const [a, m, d] = data.split('-').map(Number);
  const alvo = new Date(Date.UTC(a + anos, m - 1, d));
  if (alvo.getUTCMonth() !== m - 1) alvo.setUTCDate(0);
  return alvo.toISOString().slice(0, 10);
}

export type ErroPrazo = 'PRAZO_PASSADO' | 'PRAZO_ALEM_DE_1_ANO';

export const MENSAGENS_PRAZO: Record<ErroPrazo, string> = {
  PRAZO_PASSADO: 'O prazo precisa ser uma data futura',
  PRAZO_ALEM_DE_1_ANO: 'O prazo não pode passar de 1 ano após a publicação',
};

/**
 * RN-11 / D21: o prazo (data civil) precisa ser futuro e no máximo 1 ano após a publicação,
 * contando prorrogações. Devolve o instante UTC do prazo ou o erro.
 */
export function validarPrazo(
  data: string,
  publicadaEm: Date,
  agora: Date,
): { ok: true; prazo: Date } | { ok: false; erro: ErroPrazo } {
  const prazo = fimDoDia(data);
  if (prazo.getTime() <= agora.getTime()) return { ok: false, erro: 'PRAZO_PASSADO' };
  const limite = fimDoDia(somarAnos(dataCivil(publicadaEm), 1));
  if (prazo.getTime() > limite.getTime()) return { ok: false, erro: 'PRAZO_ALEM_DE_1_ANO' };
  return { ok: true, prazo };
}

export const prazoVencido = (prazo: Date, agora: Date) => prazo.getTime() <= agora.getTime();

/** JOB-03: lembrete 48 h após o vencimento. JOB-02: encerramento 72 h após. */
export const HORAS_LEMBRETE = 48;
export const HORAS_ENCERRAMENTO_AUTOMATICO = 72;
export const somarHoras = (d: Date, horas: number) => new Date(d.getTime() + horas * HORA);

/** RN-24: instante exibido em Brasília, ex.: "13/11/2026 às 23:59". */
export const dataHoraBrasilia = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    .format(d)
    .replace(', ', ' às ');
