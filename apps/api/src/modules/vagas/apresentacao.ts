import type { Prisma } from '@prisma/client';

export const INCLUIR_VAGA = {
  areas: { select: { area: { select: { id: true, nome: true } } } },
  etapas: { orderBy: { ordem: 'asc' as const }, select: { id: true, nome: true, ordem: true } },
} satisfies Prisma.VagaInclude;

type VagaComRelacoes = Prisma.VagaGetPayload<{ include: typeof INCLUIR_VAGA }>;

/** Formato público da vaga: salário como faixa ou "a combinar"; áreas e etapas achatadas. */
export function apresentarVaga({ areas, salarioMin, salarioMax, empresaId: _e, excluidaEm: _x, lembreteEnviadoEm: _l, ...v }: VagaComRelacoes) {
  const min = salarioMin == null ? null : Number(salarioMin);
  const max = salarioMax == null ? null : Number(salarioMax);
  return {
    ...v,
    salario: { aCombinar: min == null && max == null, min, max },
    areas: areas.map((a) => a.area),
  };
}
