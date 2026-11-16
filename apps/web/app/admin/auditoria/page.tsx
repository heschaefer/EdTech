'use client';

import { useQuery } from '@tanstack/react-query';
import { Botao, Campo, Cartao, Selecao } from '@vagas/ui';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatarDataHora } from '@/lib/formatar';

type Registro = {
  id: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  ip: string | null;
  dados: unknown;
  criadoEm: string;
  ator: { email: string; papel: string } | null;
};
type Resposta = { data: Registro[]; meta: { page: number; pageSize: number; total: number }; acoes: string[] };

/** Seção 8.4: trilha de auditoria (acesso a perfil, mudanças de status, ações de admin), só leitura. */
export default function Auditoria() {
  const [filtro, setFiltro] = useState({ acao: '', entidadeId: '', page: 1 });
  const consulta = new URLSearchParams(Object.entries(filtro).filter(([k, v]) => v !== '' && !(k === 'page' && v === 1)).map(([k, v]) => [k, String(v)])).toString();
  const { data, isLoading } = useQuery({ queryKey: ['admin-auditoria', consulta], queryFn: () => api<Resposta>(`/admin/auditoria?${consulta}`) });
  const paginas = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Auditoria</h1>
      <Cartao>
        <form role="search" aria-label="Filtrar auditoria" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
          <Selecao rotulo="Ação" value={filtro.acao} onChange={(e) => setFiltro({ ...filtro, acao: e.target.value, page: 1 })}>
            <option value="">Todas</option>
            {data?.acoes.map((a) => <option key={a} value={a}>{a}</option>)}
          </Selecao>
          <Campo rotulo="Id do registro afetado" value={filtro.entidadeId} onChange={(e) => setFiltro({ ...filtro, entidadeId: e.target.value.trim(), page: 1 })} />
        </form>
      </Cartao>

      <Cartao className="overflow-x-auto p-0" role="region" aria-label="Registros de auditoria" tabIndex={0}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Registros de auditoria</caption>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Quem</th>
              <th className="px-4 py-3">Registro</th>
              <th className="px-4 py-3">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatarDataHora(r.criadoEm)}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.acao}</td>
                <td className="px-4 py-3">
                  {r.ator ? `${r.ator.email} (${r.ator.papel.toLowerCase()})` : 'Sistema'}
                  {r.ip && <span className="block text-xs text-slate-500">IP {r.ip}</span>}
                </td>
                <td className="px-4 py-3 text-xs">{r.entidade}<span className="block font-mono text-slate-500">{r.entidadeId}</span></td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.dados ? JSON.stringify(r.dados) : '—'}</td>
              </tr>
            ))}
            {!isLoading && data?.data.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Nenhum registro.</td></tr>}
          </tbody>
        </table>
      </Cartao>

      {paginas > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-center gap-3 text-sm">
          <Botao variante="secundario" disabled={filtro.page <= 1} onClick={() => setFiltro({ ...filtro, page: filtro.page - 1 })}>Anterior</Botao>
          <span>Página {filtro.page} de {paginas}</span>
          <Botao variante="secundario" disabled={filtro.page >= paginas} onClick={() => setFiltro({ ...filtro, page: filtro.page + 1 })}>Próxima</Botao>
        </nav>
      )}
    </div>
  );
}
