import type { Prisma } from '@prisma/client';

export const INCLUIR_VAGA = {
  areas: { select: { area: { select: { id: true, nome: true } } } },
  etapas: { orderBy: { ordem: 'asc' as const }, select: { id: true, nome: true, ordem: true } },
} satisfies Prisma.VagaInclude;

type VagaComRelacoes = Prisma.VagaGetPayload<{ include: typeof INCLUIR_VAGA }>;

/** Salário como faixa ou "a combinar" (ambos nulos). */
export function apresentarSalario(salarioMin: Prisma.Decimal | null, salarioMax: Prisma.Decimal | null) {
  const min = salarioMin == null ? null : Number(salarioMin);
  const max = salarioMax == null ? null : Number(salarioMax);
  return { aCombinar: min == null && max == null, min, max };
}

/** Formato público da vaga: salário como faixa ou "a combinar"; áreas e etapas achatadas. */
export function apresentarVaga({ areas, salarioMin, salarioMax, empresaId: _e, excluidaEm: _x, lembreteEnviadoEm: _l, ...v }: VagaComRelacoes) {
  return { ...v, salario: apresentarSalario(salarioMin, salarioMax), areas: areas.map((a) => a.area) };
}

/**
 * Campos do resumo usado nas listagens (ALU-05): sem os textos longos (até 5 000 caracteres cada),
 * que só o detalhe mostra. Buscar e descartar esses textos custava caro sob carga (Fase 7).
 */
export const SELECAO_RESUMO_VAGA = {
  id: true,
  funcao: true,
  tipo: true,
  modalidade: true,
  cidade: true,
  uf: true,
  semestreMinimo: true,
  status: true,
  prazo: true,
  encerradaEm: true,
  motivoEncerramento: true,
  criadaEm: true,
  atualizadaEm: true,
  salarioMin: true,
  salarioMax: true,
  ...INCLUIR_VAGA,
} satisfies Prisma.VagaSelect;
