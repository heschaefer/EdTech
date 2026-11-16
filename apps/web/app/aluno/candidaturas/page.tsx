'use client';

import { useQuery } from '@tanstack/react-query';
import { Botao, Cartao, Selecao } from '@vagas/ui';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ROTULOS_CANDIDATURA, type Pagina, type StatusCandidatura } from '@vagas/contracts';
import { StatusCandidaturaSelo } from '@/components/candidaturas/comum';
import { useMe } from '@/components/painel';
import { api } from '@/lib/api';
import { formatarData } from '@/lib/formatar';

type Item = {
  id: string;
  status: StatusCandidatura;
  motivoCancelamento: 'ALUNO_REMOVEU' | 'ALUNO_INATIVO' | null;
  etapa: string | null;
  criadaEm: string;
  atualizadaEm: string;
  vaga: { id: string; funcao: string; status: string; empresa: string };
};

const STATUS_HISTORICO = ['SELECIONADO', 'NAO_SELECIONADO', 'CANCELADA'] as const;
const MOTIVO = { ALUNO_REMOVEU: 'você removeu', ALUNO_INATIVO: 'conta inativada' } as const;

export default function Pagina() {
  return (
    <Suspense>
      <Candidaturas />
    </Suspense>
  );
}

/** ALU-09 ("Em andamento") e ALU-10 ("Histórico"); a aba e o filtro ficam na URL. */
function Candidaturas() {
  const { data: me } = useMe();
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  // RN-22: aluno inativo só tem o histórico.
  const inativo = me?.status === 'INATIVO';
  const aba = inativo ? 'historico' : params.get('aba') === 'historico' ? 'historico' : 'andamento';
  const status = aba === 'historico' ? (params.get('status') ?? '') : '';
  const page = Number(params.get('page') ?? '1') || 1;

  const consulta = new URLSearchParams({ aba, ...(status ? { status } : {}), page: String(page) }).toString();
  const { data, isLoading } = useQuery({ queryKey: ['aluno-candidaturas', consulta], queryFn: () => api<Pagina<Item>>(`/alunos/me/candidaturas?${consulta}`), enabled: !!me });
  const ir = (novos: Record<string, string>) => {
    const q = new URLSearchParams({ aba, ...(status ? { status } : {}), ...novos });
    for (const [k, v] of [...q.entries()]) if (!v || (k === 'page' && v === '1')) q.delete(k);
    router.replace(`${caminho}?${q}`);
  };
  const paginas = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{inativo ? 'Histórico de candidaturas' : 'Candidaturas'}</h1>
      <div className="flex flex-wrap items-end justify-between gap-3">
        {!inativo && (
          <nav aria-label="Abas de candidaturas" className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
            {(['andamento', 'historico'] as const).map((a) => (
              <Link
                key={a}
                href={`${caminho}${a === 'historico' ? '?aba=historico' : ''}`}
                aria-current={aba === a ? 'page' : undefined}
                className="rounded-md px-3 py-1.5 text-slate-700 aria-[current=page]:bg-white aria-[current=page]:font-semibold aria-[current=page]:text-indigo-700 aria-[current=page]:shadow-sm"
              >
                {a === 'andamento' ? 'Em andamento' : 'Histórico'}
              </Link>
            ))}
          </nav>
        )}
        {aba === 'historico' && (
          <div className="w-56">
            <Selecao rotulo="Filtrar por status" value={status} onChange={(e) => ir({ status: e.target.value, page: '1' })}>
              <option value="">Todos</option>
              {STATUS_HISTORICO.map((s) => <option key={s} value={s}>{ROTULOS_CANDIDATURA.status[s]}</option>)}
            </Selecao>
          </div>
        )}
      </div>

      <Cartao className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{aba === 'andamento' ? 'Candidaturas em andamento' : 'Histórico de candidaturas'}</caption>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Vaga</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Última mudança</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <Link href={`/aluno/candidaturas/${c.id}`} className="font-medium text-indigo-700 hover:underline">{c.vaga.funcao}</Link>
                </td>
                <td className="px-4 py-3">{c.vaga.empresa}</td>
                <td className="px-4 py-3">
                  <StatusCandidaturaSelo status={c.status} />
                  {c.motivoCancelamento && <span className="block text-xs text-slate-500">{MOTIVO[c.motivoCancelamento]}</span>}
                </td>
                <td className="px-4 py-3">{c.status === 'EM_PROCESSO' ? c.etapa : '—'}</td>
                <td className="px-4 py-3 tabular-nums">{formatarData(c.atualizadaEm)}</td>
              </tr>
            ))}
            {!isLoading && data?.data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  {aba === 'andamento' ? (
                    <>Nenhuma candidatura em andamento. <Link href="/aluno/vagas" className="text-indigo-700 underline">Ver vagas</Link></>
                  ) : (
                    'Nada no histórico ainda.'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Cartao>

      {paginas > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-center gap-3 text-sm">
          <Botao variante="secundario" disabled={page <= 1} onClick={() => ir({ page: String(page - 1) })}>Anterior</Botao>
          <span>Página {page} de {paginas}</span>
          <Botao variante="secundario" disabled={page >= paginas} onClick={() => ir({ page: String(page + 1) })}>Próxima</Botao>
        </nav>
      )}
    </div>
  );
}
