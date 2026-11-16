'use client';

import { useQuery } from '@tanstack/react-query';
import { Botao, Campo, Cartao, Selecao } from '@vagas/ui';
import { useState } from 'react';
import type { Pagina } from '@vagas/contracts';
import { Aviso } from '@/components/aviso';
import type { Curso, Turma } from '@/components/faculdade/tipos';
import { useAcao } from '@/lib/acoes';
import { api } from '@/lib/api';
import { nomeTurma } from '@/lib/formatar';

type Aluno = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  curso: { id: string; nome: string };
  turma: { id: string; anoIngresso: number; periodoIngresso: number };
  semestreAtual: number;
  status: 'ATIVO' | 'INATIVO' | 'PENDENTE_VERIFICACAO';
  motivoInativacao: string | null;
};

const STATUS: Record<Aluno['status'], string> = { ATIVO: 'Ativo', INATIVO: 'Inativo', PENDENTE_VERIFICACAO: 'E-mail não verificado' };

/** FAC-06: lista com filtros; desligar (com motivo) e reativar. */
export default function AlunosFaculdade() {
  const [filtro, setFiltro] = useState({ cursoId: '', turmaId: '', semestre: '', status: '', q: '', page: 1 });
  const [desligando, setDesligando] = useState<{ aluno: Aluno; motivo: string } | null>(null);
  const params = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v !== '').map(([k, v]) => [k, String(v)]));
  const chave = ['fac-alunos', params.toString()];
  const { data } = useQuery({ queryKey: chave, queryFn: () => api<Pagina<Aluno>>(`/faculdade/alunos?${params}`) });
  const { data: cursos = [] } = useQuery({ queryKey: ['fac-cursos'], queryFn: () => api<Curso[]>('/faculdade/cursos') });
  const { data: turmas = [] } = useQuery({
    queryKey: ['fac-turmas', filtro.cursoId],
    queryFn: () => api<Turma[]>(`/faculdade/cursos/${filtro.cursoId}/turmas`),
    enabled: !!filtro.cursoId,
  });
  const { mensagem, executar } = useAcao(['fac-alunos']);
  const mudar = (campo: keyof typeof filtro, valor: string) => setFiltro((f) => ({ ...f, [campo]: valor, ...(campo === 'cursoId' ? { turmaId: '' } : {}), page: 1 }));
  const total = data?.meta.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Alunos</h1>
      <Cartao>
        <form role="search" className="grid gap-3 sm:grid-cols-5" onSubmit={(e) => e.preventDefault()}>
          <Campo rotulo="Buscar por nome ou e-mail" value={filtro.q} onChange={(e) => mudar('q', e.target.value)} />
          <Selecao rotulo="Curso" value={filtro.cursoId} onChange={(e) => mudar('cursoId', e.target.value)}>
            <option value="">Todos</option>
            {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Selecao>
          <Selecao rotulo="Turma" value={filtro.turmaId} onChange={(e) => mudar('turmaId', e.target.value)} disabled={!filtro.cursoId}>
            <option value="">Todas</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{nomeTurma(t)}</option>)}
          </Selecao>
          <Selecao rotulo="Semestre" value={filtro.semestre} onChange={(e) => mudar('semestre', e.target.value)}>
            <option value="">Todos</option>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}º</option>)}
          </Selecao>
          <Selecao rotulo="Situação" value={filtro.status} onChange={(e) => mudar('status', e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(STATUS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </Selecao>
        </form>
      </Cartao>

      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      {desligando && (
        <Cartao role="dialog" aria-modal="true" aria-labelledby="titulo-desligar">
          <h2 id="titulo-desligar" className="mb-2 text-lg font-semibold">Desligar {desligando.aluno.nome}</h2>
          <p className="mb-4 text-sm text-slate-600">
            A conta fica inativa: o aluno deixa de ver vagas e as candidaturas em andamento são canceladas na hora. Você pode reativá-lo depois.
          </p>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              executar(
                () => api(`/faculdade/alunos/${desligando.aluno.id}/status`, { method: 'PATCH', corpo: { status: 'INATIVO', motivo: desligando.motivo } }),
                `${desligando.aluno.nome} foi desligado(a).`,
                () => setDesligando(null),
              );
            }}
          >
            <Campo rotulo="Motivo do desligamento" value={desligando.motivo} onChange={(e) => setDesligando({ ...desligando, motivo: e.target.value })} />
            <div className="flex gap-2">
              <Botao type="submit" variante="perigo" disabled={desligando.motivo.trim().length < 3}>Confirmar desligamento</Botao>
              <Botao type="button" variante="secundario" onClick={() => setDesligando(null)}>Cancelar</Botao>
            </div>
          </form>
        </Cartao>
      )}

      <Cartao className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Alunos da faculdade</caption>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Aluno</th>
              <th className="px-4 py-3">CPF</th>
              <th className="px-4 py-3">Curso · turma</th>
              <th className="px-4 py-3">Semestre</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{a.nome}</p>
                  <p className="text-slate-600">{a.email} · {a.telefone}</p>
                </td>
                <td className="px-4 py-3 tabular-nums">{a.cpf}</td>
                <td className="px-4 py-3">{a.curso.nome} · {nomeTurma(a.turma)}</td>
                <td className="px-4 py-3 tabular-nums">{a.semestreAtual}º</td>
                <td className="px-4 py-3">
                  {STATUS[a.status]}
                  {a.motivoInativacao === 'FACULDADE_INATIVA' && <span className="block text-xs text-slate-500">faculdade inativada</span>}
                </td>
                <td className="px-4 py-3">
                  {a.status === 'ATIVO' && (
                    <button className="text-red-700 hover:underline" onClick={() => setDesligando({ aluno: a, motivo: '' })}>
                      Desligar<span className="sr-only"> {a.nome}</span>
                    </button>
                  )}
                  {a.status === 'INATIVO' && a.motivoInativacao === 'DESLIGADO_PELA_FACULDADE' && (
                    <button className="text-indigo-700 hover:underline" onClick={() => executar(() => api(`/faculdade/alunos/${a.id}/status`, { method: 'PATCH', corpo: { status: 'ATIVO' } }), `${a.nome} foi reativado(a).`)}>
                      Reativar<span className="sr-only"> {a.nome}</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {data?.data.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Nenhum aluno encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </Cartao>
      {total > 20 && (
        <nav aria-label="Paginação" className="flex items-center gap-3 text-sm">
          <Botao variante="secundario" disabled={filtro.page === 1} onClick={() => setFiltro((f) => ({ ...f, page: f.page - 1 }))}>Anterior</Botao>
          <span>Página {filtro.page} de {Math.ceil(total / 20)}</span>
          <Botao variante="secundario" disabled={filtro.page * 20 >= total} onClick={() => setFiltro((f) => ({ ...f, page: f.page + 1 }))}>Próxima</Botao>
        </nav>
      )}
    </div>
  );
}
