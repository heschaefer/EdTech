'use client';

import { useQuery } from '@tanstack/react-query';
import { Botao, Cartao, Selecao } from '@vagas/ui';
import Link from 'next/link';
import { use, useState } from 'react';
import { ROTULOS_CANDIDATURA, StatusCandidatura as StatusEnum, type StatusCandidatura } from '@vagas/contracts';
import { Aviso } from '@/components/aviso';
import { StatusCandidaturaSelo } from '@/components/candidaturas/comum';
import { StatusVaga } from '@/components/empresa/status-vaga';
import type { Vaga } from '@/components/empresa/tipos';
import { api } from '@/lib/api';
import { formatarData } from '@/lib/formatar';

type Candidato = {
  id: string;
  status: StatusCandidatura;
  alunoInativo: boolean;
  criadaEm: string;
  atualizadaEm: string;
  etapa: { id: string; nome: string; ordem: number } | null;
  aluno: { nome: string; semestre?: number; curso?: string; faculdade?: string };
};

type Resposta = {
  vaga: { id: string; funcao: string; status: Vaga['status'] };
  etapas: { id: string; nome: string; ordem: number; emProcesso: number }[];
  porStatus: Partial<Record<StatusCandidatura, number>>;
  opcoes: { cursos: { id: string; nome: string }[]; faculdades: { id: string; nome: string }[] };
  data: Candidato[];
  meta: { page: number; pageSize: number; total: number };
};

const FILTRO_INICIAL = { cursoId: '', faculdadeId: '', etapaId: '', semestreMin: '', semestreMax: '', status: '', ordem: 'antigas', page: 1 };
const SEMESTRES = Array.from({ length: 12 }, (_, i) => i + 1);

/** EMP-08: candidatos não cancelados com contagem por etapa; desligados aparecem como "Aluno inativo" (D17). */
export default function CandidatosVaga({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [filtro, setFiltro] = useState(FILTRO_INICIAL);
  const consulta = new URLSearchParams(Object.entries(filtro).filter(([k, v]) => v !== '' && !(k === 'page' && v === 1)).map(([k, v]) => [k, String(v)])).toString();
  const { data, isError, isLoading } = useQuery({ queryKey: ['empresa-candidatos', id, consulta], queryFn: () => api<Resposta>(`/empresa/vagas/${id}/candidaturas?${consulta}`) });
  const mudar = (campo: keyof typeof filtro, valor: string) => setFiltro((f) => ({ ...f, [campo]: valor, page: 1 }));

  if (isError) return <Aviso tipo="erro">Vaga não encontrada.</Aviso>;
  const paginas = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/empresa/vagas/${id}`} className="text-sm text-indigo-700 hover:underline">← Vaga</Link>
      <div>
        <h1 className="text-2xl font-semibold">Candidatos{data ? ` · ${data.vaga.funcao}` : ''}</h1>
        {data && (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <StatusVaga status={data.vaga.status} />
            {(['EM_PROCESSO', 'SELECIONADO', 'NAO_SELECIONADO'] as const).map((s) => `${data.porStatus[s] ?? 0} ${ROTULOS_CANDIDATURA.status[s].toLowerCase()}`).join(' · ')}
            {data.porStatus.CANCELADA ? ` · ${data.porStatus.CANCELADA} inativo(s)` : ''}
          </p>
        )}
      </div>

      {data && (
        <ul aria-label="Candidatos em processo por etapa" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.etapas.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => mudar('etapaId', filtro.etapaId === e.id ? '' : e.id)}
                aria-pressed={filtro.etapaId === e.id}
                className="w-full rounded-lg bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-indigo-300 aria-pressed:ring-2 aria-pressed:ring-indigo-500"
              >
                <span className="block text-xs text-slate-500">Etapa {e.ordem}</span>
                <span className="block font-medium">{e.nome}</span>
                <span className="block text-2xl font-semibold tabular-nums">{e.emProcesso}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Cartao>
        <form role="search" aria-label="Filtrar candidatos" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7" onSubmit={(e) => e.preventDefault()}>
          <Selecao rotulo="Curso" value={filtro.cursoId} onChange={(e) => mudar('cursoId', e.target.value)}>
            <option value="">Todos</option>
            {data?.opcoes.cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Selecao>
          <Selecao rotulo="Faculdade" value={filtro.faculdadeId} onChange={(e) => mudar('faculdadeId', e.target.value)}>
            <option value="">Todas</option>
            {data?.opcoes.faculdades.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </Selecao>
          <Selecao rotulo="Semestre de" value={filtro.semestreMin} onChange={(e) => mudar('semestreMin', e.target.value)}>
            <option value="">—</option>
            {SEMESTRES.map((s) => <option key={s} value={s}>{s}º</option>)}
          </Selecao>
          <Selecao rotulo="Semestre até" value={filtro.semestreMax} onChange={(e) => mudar('semestreMax', e.target.value)}>
            <option value="">—</option>
            {SEMESTRES.map((s) => <option key={s} value={s}>{s}º</option>)}
          </Selecao>
          <Selecao rotulo="Etapa" value={filtro.etapaId} onChange={(e) => mudar('etapaId', e.target.value)}>
            <option value="">Todas</option>
            {data?.etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </Selecao>
          <Selecao rotulo="Status" value={filtro.status} onChange={(e) => mudar('status', e.target.value)}>
            <option value="">Todos</option>
            {StatusEnum.options.map((s) => <option key={s} value={s}>{s === 'CANCELADA' ? 'Aluno inativo' : ROTULOS_CANDIDATURA.status[s]}</option>)}
          </Selecao>
          <Selecao rotulo="Ordenar" value={filtro.ordem} onChange={(e) => mudar('ordem', e.target.value)}>
            <option value="antigas">Candidatura mais antiga</option>
            <option value="recentes">Candidatura mais recente</option>
          </Selecao>
        </form>
      </Cartao>

      <Cartao className="overflow-x-auto p-0" role="region" aria-label="Candidatos da vaga" tabIndex={0}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Candidatos da vaga</caption>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Candidato</th>
              <th className="px-4 py-3">Faculdade · curso</th>
              <th className="px-4 py-3">Semestre</th>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Candidatura em</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  {/* D17: inativo não abre o perfil. */}
                  {c.alunoInativo ? (
                    <span className="font-medium text-slate-700">{c.aluno.nome}</span>
                  ) : (
                    <Link href={`/empresa/candidaturas/${c.id}`} className="font-medium text-indigo-700 hover:underline">{c.aluno.nome}</Link>
                  )}
                </td>
                <td className="px-4 py-3">{c.alunoInativo ? '—' : `${c.aluno.faculdade} · ${c.aluno.curso}`}</td>
                <td className="px-4 py-3 tabular-nums">{c.aluno.semestre ? `${c.aluno.semestre}º` : '—'}</td>
                <td className="px-4 py-3">{c.status === 'EM_PROCESSO' ? c.etapa?.nome : '—'}</td>
                <td className="px-4 py-3"><StatusCandidaturaSelo status={c.status} inativo={c.alunoInativo} /></td>
                <td className="px-4 py-3 tabular-nums">{formatarData(c.criadaEm)}</td>
              </tr>
            ))}
            {!isLoading && data?.data.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Nenhum candidato encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </Cartao>

      {paginas > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-center gap-3 text-sm">
          <Botao variante="secundario" disabled={filtro.page <= 1} onClick={() => setFiltro((f) => ({ ...f, page: f.page - 1 }))}>Anterior</Botao>
          <span>Página {filtro.page} de {paginas}</span>
          <Botao variante="secundario" disabled={filtro.page >= paginas} onClick={() => setFiltro((f) => ({ ...f, page: f.page + 1 }))}>Próxima</Botao>
        </nav>
      )}
    </div>
  );
}
