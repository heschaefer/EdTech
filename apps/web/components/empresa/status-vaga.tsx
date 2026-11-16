import { ROTULOS_VAGA } from '@vagas/contracts';

const CORES = {
  ABERTA: 'bg-green-100 text-green-800',
  PAUSADA: 'bg-amber-100 text-amber-800',
  PRAZO_EXPIRADO: 'bg-red-100 text-red-800',
  ENCERRADA: 'bg-slate-200 text-slate-700',
} as const;

export function StatusVaga({ status }: { status: keyof typeof CORES }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CORES[status]}`}>{ROTULOS_VAGA.status[status]}</span>;
}
