'use client';

import { useQuery } from '@tanstack/react-query';
import { Botao, Campo, Cartao, Selecao } from '@vagas/ui';
import { useState } from 'react';
import { Aviso } from '@/components/aviso';
import { useAcao } from '@/lib/acoes';
import { api } from '@/lib/api';
import type { Turma } from './tipos';

/** FAC-05: turma por ano e período de ingresso; com alunos, só inativa. */
export function Turmas({ cursoId, nomeCurso }: { cursoId: string; nomeCurso: string }) {
  const chave = ['fac-turmas', cursoId];
  const { data: turmas = [] } = useQuery({ queryKey: chave, queryFn: () => api<Turma[]>(`/faculdade/cursos/${cursoId}/turmas`) });
  const { mensagem, executar } = useAcao(chave, ['fac-curso', cursoId]);
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [periodo, setPeriodo] = useState('1');
  const nome = (t: Turma) => `${nomeCurso} ${t.anoIngresso}/${t.periodoIngresso}`;

  return (
    <Cartao>
      <h2 className="mb-4 text-lg font-semibold">Turmas</h2>
      {mensagem && (
        <div className="mb-4">
          <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>
        </div>
      )}
      <form
        className="mb-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          executar(() => api(`/faculdade/cursos/${cursoId}/turmas`, { method: 'POST', corpo: { anoIngresso: Number(ano), periodoIngresso: Number(periodo) } }), `Turma ${ano}/${periodo} criada.`);
        }}
      >
        <div className="w-32">
          <Campo rotulo="Ano de ingresso" type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
        </div>
        <div className="w-40">
          <Selecao rotulo="Período de ingresso" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="1">1º semestre</option>
            <option value="2">2º semestre</option>
          </Selecao>
        </div>
        <Botao type="submit" variante="secundario">
          Criar turma
        </Botao>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Turmas do curso</caption>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-2">Turma</th>
              <th className="px-4 py-2">Alunos</th>
              <th className="px-4 py-2">Situação</th>
              <th className="px-4 py-2"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {turmas.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{nome(t)}</td>
                <td className="px-4 py-2 tabular-nums">{t.totalAlunos}</td>
                <td className="px-4 py-2">{t.ativa ? 'Ativa' : 'Inativa'}</td>
                <td className="flex gap-3 px-4 py-2">
                  <button
                    className="text-indigo-700 hover:underline"
                    onClick={() => executar(() => api(`/faculdade/turmas/${t.id}`, { method: 'PATCH', corpo: { ativa: !t.ativa } }), t.ativa ? 'Turma inativada.' : 'Turma reativada.')}
                  >
                    {t.ativa ? 'Inativar' : 'Reativar'}<span className="sr-only"> turma {t.anoIngresso}/{t.periodoIngresso}</span>
                  </button>
                  {t.totalAlunos === 0 && (
                    <button
                      className="text-red-700 hover:underline"
                      onClick={() => confirm(`Excluir a turma ${nome(t)}?`) && executar(() => api(`/faculdade/turmas/${t.id}`, { method: 'DELETE' }), 'Turma excluída.')}
                    >
                      Excluir<span className="sr-only"> turma {t.anoIngresso}/{t.periodoIngresso}</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {turmas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-slate-500">
                  Nenhuma turma cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Cartao>
  );
}
