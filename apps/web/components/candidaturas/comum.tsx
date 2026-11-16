import { ROTULOS_CANDIDATURA, type StatusCandidatura } from '@vagas/contracts';
import { formatarDataHora } from '@/lib/formatar';

export type Evento = {
  id: string;
  tipo: keyof typeof ROTULOS_CANDIDATURA.evento;
  deStatus: StatusCandidatura | null;
  paraStatus: StatusCandidatura | null;
  etapaNome: string | null;
  criadoEm: string;
};

const CORES: Record<StatusCandidatura, string> = {
  EM_PROCESSO: 'bg-sky-100 text-sky-800',
  SELECIONADO: 'bg-green-100 text-green-800',
  NAO_SELECIONADO: 'bg-slate-200 text-slate-700',
  CANCELADA: 'bg-amber-100 text-amber-800',
};

export function StatusCandidaturaSelo({ status, inativo }: { status: StatusCandidatura; inativo?: boolean }) {
  if (inativo) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Aluno inativo</span>;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CORES[status]}`}>{ROTULOS_CANDIDATURA.status[status]}</span>;
}

/** ALU-09 / RN-18: eventos imutáveis da candidatura, do mais antigo ao mais recente. */
export function LinhaDoTempo({ eventos }: { eventos: Evento[] }) {
  return (
    <ol aria-label="Linha do tempo" className="relative flex flex-col gap-4 border-l border-slate-200 pl-5">
      {eventos.map((e) => (
        <li key={e.id} className="relative">
          <span aria-hidden className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500" />
          <p className="font-medium">
            {ROTULOS_CANDIDATURA.evento[e.tipo]}
            {e.etapaNome && e.tipo !== 'CANCELADA' && e.tipo !== 'NAO_SELECIONADO' ? `: ${e.etapaNome}` : ''}
          </p>
          <p className="text-xs text-slate-500"><time dateTime={e.criadoEm}>{formatarDataHora(e.criadoEm)}</time></p>
        </li>
      ))}
    </ol>
  );
}
