'use client';

import { useQuery } from '@tanstack/react-query';
import { Botao, Campo, Cartao, Selecao } from '@vagas/ui';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Modalidade, ROTULOS_VAGA, TipoVaga, UFS, type Pagina } from '@vagas/contracts';
import { api } from '@/lib/api';
import { formatarData, formatarSalario } from '@/lib/formatar';

type VagaResumo = {
  id: string;
  funcao: string;
  tipo: keyof typeof ROTULOS_VAGA.tipo;
  modalidade: keyof typeof ROTULOS_VAGA.modalidade;
  cidade: string | null;
  uf: string | null;
  salario: { aCombinar: boolean; min: number | null; max: number | null };
  prazo: string;
  criadaEm: string;
  areas: { id: string; nome: string }[];
  empresa: { nomeFantasia: string };
  candidatado: boolean;
};

const FILTROS = ['q', 'tipo', 'modalidade', 'uf', 'cidade', 'salarioMin', 'dias', 'ordem'] as const;

export default function Pagina() {
  return (
    <Suspense>
      <VagasAluno />
    </Suspense>
  );
}

/** ALU-05: os filtros ficam na URL; voltar ou compartilhar o link mantém o resultado. */
function VagasAluno() {
  const caminho = usePathname();
  const params = useSearchParams();
  const pagina = Number(params.get('page') ?? 1);
  const consulta = params.toString();
  const { data, isLoading, isError } = useQuery({ queryKey: ['aluno-vagas', consulta], queryFn: () => api<Pagina<VagaResumo>>(`/vagas${consulta ? `?${consulta}` : ''}`) });

  // Texto e cidade só vão para a URL ao parar de digitar.
  const [texto, setTexto] = useState({ q: params.get('q') ?? '', cidade: params.get('cidade') ?? '', salarioMin: params.get('salarioMin') ?? '' });
  const definir = (mudancas: Record<string, string>) => {
    // Lê a URL atual (não o hook): duas mudanças seguidas não podem apagar uma à outra.
    const novo = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(mudancas)) (v ? novo.set(k, v) : novo.delete(k));
    if (!('page' in mudancas)) novo.delete('page');
    // History API nativa: atualiza a URL na hora (o Next sincroniza o useSearchParams).
    window.history.replaceState(null, '', novo.size ? `${caminho}?${novo}` : caminho);
  };
  useEffect(() => {
    const t = setTimeout(() => {
      const atual = new URLSearchParams(window.location.search);
      if (texto.q !== (atual.get('q') ?? '') || texto.cidade !== (atual.get('cidade') ?? '') || texto.salarioMin !== (atual.get('salarioMin') ?? '')) definir(texto);
    }, 400);
    return () => clearTimeout(t);
  }, [texto]);

  const total = data?.meta.total ?? 0;
  const temFiltro = FILTROS.some((f) => params.get(f));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Vagas para você</h1>
      <Cartao>
        <form role="search" aria-label="Filtrar vagas" className="grid gap-3 sm:grid-cols-4" onSubmit={(e) => e.preventDefault()}>
          <div className="sm:col-span-2">
            <Campo rotulo="Função ou empresa" type="search" value={texto.q} onChange={(e) => setTexto({ ...texto, q: e.target.value })} />
          </div>
          <Selecao rotulo="Tipo" value={params.get('tipo') ?? ''} onChange={(e) => definir({ tipo: e.target.value })}>
            <option value="">Todos</option>
            {TipoVaga.options.map((t) => <option key={t} value={t}>{ROTULOS_VAGA.tipo[t]}</option>)}
          </Selecao>
          <Selecao rotulo="Modalidade" value={params.get('modalidade') ?? ''} onChange={(e) => definir({ modalidade: e.target.value })}>
            <option value="">Todas</option>
            {Modalidade.options.map((m) => <option key={m} value={m}>{ROTULOS_VAGA.modalidade[m]}</option>)}
          </Selecao>
          <Selecao rotulo="UF" value={params.get('uf') ?? ''} onChange={(e) => definir({ uf: e.target.value })}>
            <option value="">Todas</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </Selecao>
          <Campo rotulo="Cidade" value={texto.cidade} onChange={(e) => setTexto({ ...texto, cidade: e.target.value })} />
          <Campo rotulo="Salário a partir de (R$)" type="number" min={0} value={texto.salarioMin} onChange={(e) => setTexto({ ...texto, salarioMin: e.target.value })} />
          <Selecao rotulo="Publicadas nos últimos" value={params.get('dias') ?? ''} onChange={(e) => definir({ dias: e.target.value })}>
            <option value="">Qualquer data</option>
            <option value="7">7 dias</option>
            <option value="15">15 dias</option>
            <option value="30">30 dias</option>
          </Selecao>
          <Selecao rotulo="Ordenar por" value={params.get('ordem') ?? 'recentes'} onChange={(e) => definir({ ordem: e.target.value === 'recentes' ? '' : e.target.value })}>
            <option value="recentes">Mais recentes</option>
            <option value="prazo">Prazo mais próximo</option>
          </Selecao>
          {temFiltro && (
            <div className="flex items-end">
              <Botao type="button" variante="secundario" onClick={() => (setTexto({ q: '', cidade: '', salarioMin: '' }), window.history.replaceState(null, '', caminho))}>Limpar filtros</Botao>
            </div>
          )}
        </form>
      </Cartao>

      <p role="status" className="text-sm text-slate-600">{isLoading ? 'Carregando vagas…' : `${total} vaga(s) encontrada(s)`}</p>
      {isError && <p className="text-sm text-red-700">Não foi possível carregar as vagas.</p>}

      <ul aria-label="Vagas" className="flex flex-col gap-3">
        {data?.data.map((v) => (
          <li key={v.id}>
            <Cartao className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">
                  <Link href={`/aluno/vagas/${v.id}`} className="text-indigo-700 hover:underline">{v.funcao}</Link>
                </h2>
                <p className="text-sm text-slate-700">{v.empresa.nomeFantasia}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {ROTULOS_VAGA.tipo[v.tipo]} · {ROTULOS_VAGA.modalidade[v.modalidade]}
                  {v.cidade ? ` · ${v.cidade}/${v.uf}` : ''} · {formatarSalario(v.salario)}
                </p>
                <p className="text-xs text-slate-500">Publicada em {formatarData(v.criadaEm)} · candidaturas até {formatarData(v.prazo)}</p>
              </div>
              {v.candidatado && <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">Candidatado</span>}
            </Cartao>
          </li>
        ))}
      </ul>
      {!isLoading && total === 0 && <p className="text-slate-600">Nenhuma vaga da sua área com esses filtros. Tente ampliar a busca.</p>}

      {total > 20 && (
        <nav aria-label="Paginação" className="flex items-center gap-3 text-sm">
          <Botao variante="secundario" disabled={pagina <= 1} onClick={() => definir({ page: String(pagina - 1) })}>Anterior</Botao>
          <span>Página {pagina} de {Math.ceil(total / 20)}</span>
          <Botao variante="secundario" disabled={pagina * 20 >= total} onClick={() => definir({ page: String(pagina + 1) })}>Próxima</Botao>
        </nav>
      )}
    </div>
  );
}
