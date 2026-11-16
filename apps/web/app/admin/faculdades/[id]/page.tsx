'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Botao, Campo, Cartao } from '@vagas/ui';
import Link from 'next/link';
import { use, useState } from 'react';
import { Aviso } from '@/components/aviso';
import { formatarCnpj, type Faculdade } from '@/components/admin/tipos';
import { useAcao } from '@/lib/acoes';
import { api } from '@/lib/api';

/** ADM-02: domínios, convite e inativação (D19, RN-27). */
export default function FaculdadeAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [novoDominio, setNovoDominio] = useState('');
  const chave = ['admin-faculdade', id];
  const { data: f, isLoading } = useQuery({ queryKey: chave, queryFn: () => api<Faculdade>(`/admin/faculdades/${id}`) });
  const { mensagem, executar: acao } = useAcao(chave, ['admin-faculdades']);

  const alternar = useMutation({
    mutationFn: async () => {
      const inativar = f!.ativa;
      if (inativar && !confirm(`Inativar ${f!.nomeFantasia}? Todos os ${f!.totalAlunos} alunos dela ficarão inativos e as candidaturas em andamento serão canceladas.`)) return;
      await acao(() => api(`/admin/faculdades/${id}`, { method: 'PATCH', corpo: { ativa: !inativar } }), inativar ? 'Faculdade inativada.' : 'Faculdade reativada.');
    },
  });

  if (isLoading || !f) return <p>Carregando…</p>;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/faculdades" className="text-sm text-indigo-700 hover:underline">
        ← Faculdades
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{f.nomeFantasia}</h1>
        <Botao variante={f.ativa ? 'perigo' : 'primario'} onClick={() => alternar.mutate()} disabled={alternar.isPending}>
          {f.ativa ? 'Inativar faculdade' : 'Reativar faculdade'}
        </Botao>
      </div>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      <Cartao>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Razão social</dt><dd>{f.razaoSocial}</dd></div>
          <div><dt className="text-slate-500">CNPJ</dt><dd className="tabular-nums">{formatarCnpj(f.cnpj)}</dd></div>
          <div><dt className="text-slate-500">E-mail</dt><dd>{f.email}</dd></div>
          <div><dt className="text-slate-500">Telefone</dt><dd>{f.telefone}</dd></div>
          <div><dt className="text-slate-500">Situação</dt><dd>{f.ativa ? 'Ativa' : 'Inativa'}</dd></div>
          <div><dt className="text-slate-500">Alunos · cursos</dt><dd>{f.totalAlunos} · {f.totalCursos}</dd></div>
        </dl>
      </Cartao>

      <Cartao>
        <h2 className="mb-3 text-lg font-semibold">Domínios estudantis</h2>
        <ul className="mb-4 flex flex-col gap-2">
          {f.dominios.map((d) => (
            <li key={d} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
              <span>{d}</span>
              <button
                className="text-red-700 hover:underline disabled:opacity-40"
                disabled={f.dominios.length === 1}
                onClick={() => acao(() => api(`/admin/faculdades/${id}/dominios`, { method: 'DELETE', corpo: { dominio: d } }), `Domínio ${d} removido.`)}
              >
                Remover<span className="sr-only"> {d}</span>
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            acao(() => api(`/admin/faculdades/${id}/dominios`, { method: 'POST', corpo: { dominio: novoDominio } }), `Domínio ${novoDominio} adicionado.`, () => setNovoDominio(''));
          }}
        >
          <div className="grow">
            <Campo rotulo="Novo domínio" value={novoDominio} onChange={(e) => setNovoDominio(e.target.value)} placeholder="pos.unifoo.edu.br" />
          </div>
          <Botao type="submit" variante="secundario" disabled={!novoDominio}>
            Adicionar
          </Botao>
        </form>
      </Cartao>

      {!f.conviteAceito && f.ativa && (
        <Cartao>
          <h2 className="mb-2 text-lg font-semibold">Convite</h2>
          <p className="mb-3 text-sm text-slate-600">A faculdade ainda não definiu a senha. O convite vale 72 horas.</p>
          <Botao variante="secundario" onClick={() => acao(() => api(`/admin/faculdades/${id}/convite`, { method: 'POST' }), `Convite reenviado para ${f.email}.`)}>
            Reenviar convite
          </Botao>
        </Cartao>
      )}
    </div>
  );
}
