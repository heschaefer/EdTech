'use client';

import { useQuery } from '@tanstack/react-query';
import { Botao, Campo, Cartao } from '@vagas/ui';
import { useState } from 'react';
import { Aviso } from '@/components/aviso';
import type { Area } from '@/components/admin/tipos';
import { useAcao } from '@/lib/acoes';
import { api } from '@/lib/api';

/** ADM-03: criar, renomear, inativar; área em uso não pode ser excluída. */
export default function AreasAdmin() {
  const { data: areas } = useQuery({ queryKey: ['admin-areas'], queryFn: () => api<Area[]>('/admin/areas') });
  const [nome, setNome] = useState('');
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const { mensagem, executar } = useAcao(['admin-areas']);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Áreas de formação</h1>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}
      <Cartao>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await executar(() => api('/admin/areas', { method: 'POST', corpo: { nome } }), `Área ${nome} criada.`, () => setNome(''));
          }}
        >
          <div className="grow">
            <Campo rotulo="Nova área" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <Botao type="submit" disabled={!nome.trim()}>
            Criar área
          </Botao>
        </form>
      </Cartao>
      <Cartao className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Áreas de formação</caption>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Área</th>
              <th className="px-4 py-3">Cursos</th>
              <th className="px-4 py-3">Vagas</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {areas?.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  {editando?.id === a.id ? (
                    <form
                      className="flex gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await executar(() => api(`/admin/areas/${a.id}`, { method: 'PATCH', corpo: { nome: editando.nome } }), 'Área renomeada.', () => setEditando(null));
                      }}
                    >
                      <label className="sr-only" htmlFor={`nome-${a.id}`}>Novo nome</label>
                      <input id={`nome-${a.id}`} className="rounded border border-slate-300 px-2 py-1" value={editando.nome} onChange={(e) => setEditando({ id: a.id, nome: e.target.value })} />
                      <Botao type="submit" variante="secundario">Salvar</Botao>
                    </form>
                  ) : (
                    a.nome
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">{a.totalCursos}</td>
                <td className="px-4 py-3 tabular-nums">{a.totalVagas}</td>
                <td className="px-4 py-3">{a.ativa ? 'Ativa' : 'Inativa'}</td>
                <td className="flex flex-wrap gap-3 px-4 py-3">
                  <button className="text-indigo-700 hover:underline" onClick={() => setEditando({ id: a.id, nome: a.nome })}>
                    Renomear<span className="sr-only"> {a.nome}</span>
                  </button>
                  <button className="text-indigo-700 hover:underline" onClick={() => executar(() => api(`/admin/areas/${a.id}`, { method: 'PATCH', corpo: { ativa: !a.ativa } }), a.ativa ? 'Área inativada.' : 'Área reativada.')}>
                    {a.ativa ? 'Inativar' : 'Reativar'}<span className="sr-only"> {a.nome}</span>
                  </button>
                  {!a.emUso && (
                    <button className="text-red-700 hover:underline" onClick={() => confirm(`Excluir ${a.nome}?`) && executar(() => api(`/admin/areas/${a.id}`, { method: 'DELETE' }), 'Área excluída.')}>
                      Excluir<span className="sr-only"> {a.nome}</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Cartao>
    </div>
  );
}
