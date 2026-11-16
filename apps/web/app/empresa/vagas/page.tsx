'use client';

import { useQuery } from '@tanstack/react-query';
import { Cartao, Selecao } from '@vagas/ui';
import Link from 'next/link';
import { useState } from 'react';
import { ROTULOS_VAGA } from '@vagas/contracts';
import { StatusVaga } from '@/components/empresa/status-vaga';
import type { Vaga } from '@/components/empresa/tipos';
import { useMe } from '@/components/painel';
import { api } from '@/lib/api';
import { formatarData } from '@/lib/formatar';

export default function VagasEmpresa() {
  const { data: me } = useMe();
  const [status, setStatus] = useState('');
  const { data: vagas, isLoading } = useQuery({ queryKey: ['empresa-vagas', status], queryFn: () => api<Vaga[]>(`/empresa/vagas${status ? `?status=${status}` : ''}`) });
  const aprovada = me?.aprovacao === 'APROVADA';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">Vagas</h1>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Selecao rotulo="Filtrar por situação" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(ROTULOS_VAGA.status).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </Selecao>
          </div>
          {/* RN-26: sem aprovação, não publica. */}
          {aprovada ? (
            <Link href="/empresa/vagas/nova" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Nova vaga</Link>
          ) : (
            <span className="rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-600" aria-disabled="true">Nova vaga (aguardando aprovação)</span>
          )}
        </div>
      </div>
      <Cartao className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Vagas da empresa</caption>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Função</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3">Prazo</th>
              <th className="px-4 py-3">Candidatos</th>
              <th className="px-4 py-3">Publicada em</th>
            </tr>
          </thead>
          <tbody>
            {vagas?.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <Link href={`/empresa/vagas/${v.id}`} className="font-medium text-indigo-700 hover:underline">{v.funcao}</Link>
                  <span className="block text-xs text-slate-500">{ROTULOS_VAGA.tipo[v.tipo as keyof typeof ROTULOS_VAGA.tipo]} · {ROTULOS_VAGA.modalidade[v.modalidade as keyof typeof ROTULOS_VAGA.modalidade]}</span>
                </td>
                <td className="px-4 py-3"><StatusVaga status={v.status} /></td>
                <td className="px-4 py-3 tabular-nums">{formatarData(v.prazo)}</td>
                <td className="px-4 py-3 tabular-nums">{v.totalCandidatos ?? 0}</td>
                <td className="px-4 py-3 tabular-nums">{formatarData(v.criadaEm)}</td>
              </tr>
            ))}
            {!isLoading && vagas?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Nenhuma vaga por aqui.</td></tr>
            )}
          </tbody>
        </table>
      </Cartao>
    </div>
  );
}
