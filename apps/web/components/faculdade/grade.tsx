'use client';

import { useQuery } from '@tanstack/react-query';
import { AreaTexto, Botao, Campo, Cartao, Selecao } from '@vagas/ui';
import { useState } from 'react';
import { Aviso } from '@/components/aviso';
import { useAcao } from '@/lib/acoes';
import { api } from '@/lib/api';
import type { Aula, Semestre } from './tipos';

const rotuloSemestre = (s: Semestre) => `${s.ordem}º semestre (ano ${s.ano})`;

/** FAC-04: em cada semestre, cadastrar, ordenar, editar e remover aulas. */
export function Grade({ cursoId }: { cursoId: string }) {
  const chave = ['fac-semestres', cursoId];
  const { data: semestres = [] } = useQuery({ queryKey: chave, queryFn: () => api<Semestre[]>(`/faculdade/cursos/${cursoId}/semestres`) });
  const { mensagem, executar } = useAcao(chave);
  const [ordemSelecionada, setOrdemSelecionada] = useState(1);
  const [nova, setNova] = useState({ nome: '', ementa: '' });
  const [editando, setEditando] = useState<Aula | null>(null);
  const semestre = semestres.find((s) => s.ordem === ordemSelecionada) ?? semestres[0];

  if (!semestre) return null;

  const mover = (a: Aula, ordem: number) => executar(() => api(`/faculdade/aulas/${a.id}`, { method: 'PATCH', corpo: { ordem } }), `${a.nome} movida para a posição ${ordem}.`);

  return (
    <Cartao>
      <h2 className="mb-4 text-lg font-semibold">Grade curricular</h2>
      <div className="mb-4 max-w-xs">
        <Selecao rotulo="Semestre" value={semestre.ordem} onChange={(e) => (setOrdemSelecionada(Number(e.target.value)), setEditando(null))}>
          {semestres.map((s) => (
            <option key={s.id} value={s.ordem}>
              {rotuloSemestre(s)} · {s.aulas.length} {s.aulas.length === 1 ? 'aula' : 'aulas'}
            </option>
          ))}
        </Selecao>
      </div>
      {mensagem && (
        <div className="mb-4">
          <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>
        </div>
      )}

      <ol aria-label={`Aulas do ${rotuloSemestre(semestre)}`} className="mb-6 flex flex-col gap-2">
        {semestre.aulas.map((a, i) => (
          <li key={a.id} className="rounded-md bg-slate-50 p-3 text-sm">
            {editando?.id === a.id ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await executar(() => api(`/faculdade/aulas/${a.id}`, { method: 'PATCH', corpo: { nome: editando.nome, ementa: editando.ementa } }), 'Aula atualizada.', () => setEditando(null));
                }}
              >
                <Campo rotulo="Nome da aula" value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
                <AreaTexto rotulo="Ementa da aula" rows={3} value={editando.ementa} onChange={(e) => setEditando({ ...editando, ementa: e.target.value })} />
                <div className="flex gap-2">
                  <Botao type="submit">Salvar aula</Botao>
                  <Botao type="button" variante="secundario" onClick={() => setEditando(null)}>
                    Cancelar
                  </Botao>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {a.ordem}. {a.nome}
                  </p>
                  <p className="whitespace-pre-line text-slate-600">{a.ementa}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button className="text-indigo-700 hover:underline disabled:opacity-40" disabled={i === 0} onClick={() => mover(a, a.ordem - 1)}>
                    Subir<span className="sr-only"> {a.nome}</span>
                  </button>
                  <button className="text-indigo-700 hover:underline disabled:opacity-40" disabled={i === semestre.aulas.length - 1} onClick={() => mover(a, a.ordem + 1)}>
                    Descer<span className="sr-only"> {a.nome}</span>
                  </button>
                  <button className="text-indigo-700 hover:underline" onClick={() => setEditando(a)}>
                    Editar<span className="sr-only"> {a.nome}</span>
                  </button>
                  <button
                    className="text-red-700 hover:underline"
                    onClick={() => confirm(`Remover a aula ${a.nome}?`) && executar(() => api(`/faculdade/aulas/${a.id}`, { method: 'DELETE' }), 'Aula removida.')}
                  >
                    Remover<span className="sr-only"> {a.nome}</span>
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {semestre.aulas.length === 0 && <li className="text-sm text-slate-500">Nenhuma aula neste semestre.</li>}
      </ol>

      <form
        className="flex flex-col gap-3 border-t border-slate-100 pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await executar(() => api(`/faculdade/semestres/${semestre.id}/aulas`, { method: 'POST', corpo: nova }), `Aula ${nova.nome} adicionada.`, () => setNova({ nome: '', ementa: '' }));
        }}
      >
        <h3 className="font-medium">Nova aula no {rotuloSemestre(semestre)}</h3>
        <Campo rotulo="Nome da nova aula" value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} />
        <AreaTexto rotulo="Ementa da nova aula" rows={3} value={nova.ementa} onChange={(e) => setNova({ ...nova, ementa: e.target.value })} />
        <div>
          <Botao type="submit" disabled={!nova.nome.trim() || !nova.ementa.trim()}>
            Adicionar aula
          </Botao>
        </div>
      </form>
    </Cartao>
  );
}
