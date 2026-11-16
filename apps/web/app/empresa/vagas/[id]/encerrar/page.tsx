'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Botao, Cartao } from '@vagas/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { Aviso } from '@/components/aviso';
import type { Vaga } from '@/components/empresa/tipos';
import { mensagemDeErro } from '@/lib/acoes';
import { api } from '@/lib/api';
import { formatarData } from '@/lib/formatar';

type Candidato = {
  id: string;
  criadaEm: string;
  etapa: { nome: string } | null;
  aluno: { nome: string; curso?: string; faculdade?: string; semestre?: number };
};
type Pagina = { data: Candidato[]; meta: { total: number; pageSize: number } };

/** Todos os candidatos em processo (a lista da API vem em páginas de até 100). */
async function emProcesso(vagaId: string) {
  const todos: Candidato[] = [];
  for (let page = 1; ; page++) {
    const p = await api<Pagina>(`/empresa/vagas/${vagaId}/candidaturas?status=EM_PROCESSO&pageSize=100&page=${page}`);
    todos.push(...p.data);
    if (todos.length >= p.meta.total || !p.data.length) return todos;
  }
}

/** EMP-11: escolher os selecionados (zero ou mais), revisar o resumo e confirmar. Irreversível. */
export default function EncerrarVaga({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { data: vaga, isError } = useQuery({ queryKey: ['empresa-vaga', id], queryFn: () => api<Vaga>(`/empresa/vagas/${id}`) });
  const { data: candidatos } = useQuery({ queryKey: ['empresa-candidatos', id, 'em-processo'], queryFn: () => emProcesso(id) });
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [revisando, setRevisando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (isError) return <Aviso tipo="erro">Vaga não encontrada.</Aviso>;
  if (!vaga || !candidatos) return <p>Carregando…</p>;
  if (vaga.status === 'ENCERRADA') {
    return (
      <div className="flex flex-col gap-4">
        <Aviso tipo="info">Esta vaga já está encerrada.</Aviso>
        <Link href={`/empresa/vagas/${id}`} className="text-sm text-indigo-700 hover:underline">← Voltar para a vaga</Link>
      </div>
    );
  }

  const alternar = (cid: string) =>
    setSelecionados((s) => {
      const novo = new Set(s);
      if (novo.has(cid)) novo.delete(cid);
      else novo.add(cid);
      return novo;
    });
  const escolhidos = candidatos.filter((c) => selecionados.has(c.id));
  const demais = candidatos.filter((c) => !selecionados.has(c.id));

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      await api(`/empresa/vagas/${id}/encerrar`, { method: 'POST', corpo: { selecionados: [...selecionados] } });
      await Promise.all([qc.invalidateQueries({ queryKey: ['empresa-vaga', id] }), qc.invalidateQueries({ queryKey: ['empresa-vagas'] }), qc.invalidateQueries({ queryKey: ['empresa-candidatos'] })]);
      router.replace(`/empresa/vagas/${id}?encerrada=1`);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/empresa/vagas/${id}`} className="text-sm text-indigo-700 hover:underline">← {vaga.funcao}</Link>
      <div>
        <h1 className="text-2xl font-semibold">{revisando ? 'Resumo do encerramento' : 'Encerrar vaga'}</h1>
        <p className="mt-1 text-sm text-slate-600">{vaga.funcao} · {candidatos.length} candidato(s) em processo</p>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {!revisando ? (
        <>
          <p className="text-sm text-slate-700">
            Marque quem foi selecionado (pode ser ninguém). Os demais candidatos em processo recebem a mensagem padrão de encerramento.
          </p>
          <Cartao className="p-0">
            {candidatos.length ? (
              <fieldset>
                <legend className="sr-only">Candidatos selecionados</legend>
                <ul className="divide-y divide-slate-100">
                  {candidatos.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-slate-50">
                        <input type="checkbox" className="mt-1 h-4 w-4" checked={selecionados.has(c.id)} onChange={() => alternar(c.id)} aria-label={`Selecionar ${c.aluno.nome}`} />
                        <span className="text-sm">
                          <span className="block font-medium">{c.aluno.nome}</span>
                          <span className="block text-slate-600">
                            {c.aluno.faculdade} · {c.aluno.curso} · {c.aluno.semestre}º semestre · etapa {c.etapa?.nome} · desde {formatarData(c.criadaEm)}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ) : (
              <p className="px-4 py-6 text-sm text-slate-500">Nenhum candidato em processo. A vaga será só encerrada.</p>
            )}
          </Cartao>
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => setRevisando(true)}>Revisar encerramento</Botao>
            <Link href={`/empresa/vagas/${id}`} className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-slate-300 hover:bg-slate-50">Cancelar</Link>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Cartao>
              <h2 className="mb-2 font-semibold">Selecionados ({escolhidos.length})</h2>
              {escolhidos.length ? (
                <ul aria-label="Selecionados" className="list-inside list-disc text-sm">{escolhidos.map((c) => <li key={c.id}>{c.aluno.nome}</li>)}</ul>
              ) : (
                <p className="text-sm text-slate-500">Ninguém selecionado.</p>
              )}
              <p className="mt-3 text-xs text-slate-500">Recebem: “Parabéns! Você foi selecionado(a) para a vaga {vaga.funcao}…”</p>
            </Cartao>
            <Cartao>
              <h2 className="mb-2 font-semibold">Não selecionados ({demais.length})</h2>
              {demais.length ? (
                <ul aria-label="Não selecionados" className="list-inside list-disc text-sm">{demais.map((c) => <li key={c.id}>{c.aluno.nome}</li>)}</ul>
              ) : (
                <p className="text-sm text-slate-500">Nenhum.</p>
              )}
              <p className="mt-3 text-xs text-slate-500">Recebem: “A vaga {vaga.funcao} foi encerrada. Obrigado pela sua candidatura…”</p>
            </Cartao>
          </div>
          <Aviso tipo="erro">Esta ação é irreversível: a vaga não poderá ser reaberta e todos os candidatos acima serão avisados na plataforma e por e-mail.</Aviso>
          <div className="flex flex-wrap gap-2">
            <Botao variante="perigo" disabled={enviando} onClick={confirmar}>Confirmar encerramento</Botao>
            <Botao variante="secundario" disabled={enviando} onClick={() => setRevisando(false)}>Voltar e alterar</Botao>
          </div>
        </>
      )}
    </div>
  );
}
