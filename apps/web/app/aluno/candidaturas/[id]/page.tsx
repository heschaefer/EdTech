'use client';

import { useQuery } from '@tanstack/react-query';
import { Botao, Cartao } from '@vagas/ui';
import Link from 'next/link';
import { use, useState } from 'react';
import { ROTULOS_VAGA, type StatusCandidatura } from '@vagas/contracts';
import { Aviso } from '@/components/aviso';
import { LinhaDoTempo, StatusCandidaturaSelo, type Evento } from '@/components/candidaturas/comum';
import { Dialogo } from '@/components/dialogo';
import { useMe } from '@/components/painel';
import { useAcao } from '@/lib/acoes';
import { api } from '@/lib/api';
import { formatarData, formatarDataHora } from '@/lib/formatar';

type Detalhe = {
  id: string;
  status: StatusCandidatura;
  motivoCancelamento: 'ALUNO_REMOVEU' | 'ALUNO_INATIVO' | null;
  criadaEm: string;
  atualizadaEm: string;
  etapaAtual: { id: string; nome: string; ordem: number } | null;
  etapa: string | null;
  vaga: { id: string; funcao: string; status: keyof typeof ROTULOS_VAGA.status; prazo: string; empresa: string; etapas: { id: string; nome: string; ordem: number }[] };
  eventos: Evento[];
  podeRemover: boolean;
};

/** ALU-09 (detalhe com linha do tempo) e ALU-08 (remover). */
export default function CandidaturaAluno({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: me } = useMe();
  const chave = ['aluno-candidatura', id];
  const { data: c, isError } = useQuery({ queryKey: chave, queryFn: () => api<Detalhe>(`/candidaturas/${id}`) });
  const { mensagem, executar } = useAcao(chave, ['aluno-candidaturas'], ['aluno-vagas'], ['aluno-vaga']);
  const [removendo, setRemovendo] = useState(false);

  if (isError) return <Aviso tipo="erro">Candidatura não encontrada.</Aviso>;
  if (!c) return <p>Carregando…</p>;
  const inativo = me?.status === 'INATIVO';
  const emProcesso = c.status === 'EM_PROCESSO';

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/aluno/candidaturas${emProcesso ? '' : '?aba=historico'}`} className="text-sm text-indigo-700 hover:underline">← Candidaturas</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{c.vaga.funcao}</h1>
          <p className="text-slate-700">{c.vaga.empresa} · vaga {ROTULOS_VAGA.status[c.vaga.status].toLowerCase()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!inativo && <Link href={`/aluno/vagas/${c.vaga.id}`} className="rounded-md px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-slate-300 hover:bg-slate-50">Ver vaga</Link>}
          {c.podeRemover && !inativo && <Botao variante="perigo" onClick={() => setRemovendo(true)}>Remover candidatura</Botao>}
        </div>
      </div>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      <Cartao>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-500">Status</dt><dd className="mt-1"><StatusCandidaturaSelo status={c.status} /></dd></div>
          <div><dt className="text-slate-500">Etapa atual</dt><dd>{emProcesso ? c.etapa : '—'}</dd></div>
          <div><dt className="text-slate-500">Última mudança</dt><dd>{formatarDataHora(c.atualizadaEm)}</dd></div>
          <div><dt className="text-slate-500">Candidatura em</dt><dd>{formatarData(c.criadaEm)}</dd></div>
          <div><dt className="text-slate-500">Prazo da vaga</dt><dd>{formatarData(c.vaga.prazo)}</dd></div>
        </dl>
        {c.status === 'CANCELADA' && c.vaga.status === 'ABERTA' && !inativo && (
          <p className="mt-4 text-sm text-slate-600">A vaga continua aberta: você pode se candidatar de novo pela página da vaga.</p>
        )}
      </Cartao>

      <div className="grid gap-6 md:grid-cols-2">
        <Cartao>
          <h2 className="mb-3 text-lg font-semibold">Etapas do processo seletivo</h2>
          <ol className="flex flex-col gap-1 text-sm">
            {c.vaga.etapas.map((e, i) => {
              const atual = emProcesso && e.id === c.etapaAtual?.id;
              return (
                <li key={e.id} aria-current={atual ? 'step' : undefined} className={atual ? 'font-semibold text-indigo-700' : 'text-slate-700'}>
                  {i + 1}. {e.nome}{atual ? ' (etapa atual)' : ''}
                </li>
              );
            })}
          </ol>
        </Cartao>
        <Cartao>
          <h2 className="mb-3 text-lg font-semibold">Linha do tempo</h2>
          <LinhaDoTempo eventos={c.eventos} />
        </Cartao>
      </div>

      {removendo && (
        <Dialogo
          titulo="Remover candidatura"
          rotuloConfirmar="Remover"
          variante="perigo"
          aoFechar={() => setRemovendo(false)}
          aoConfirmar={() => executar(() => api(`/candidaturas/${id}`, { method: 'DELETE' }), 'Candidatura removida', () => setRemovendo(false)).finally(() => setRemovendo(false))}
        >
          <p>A empresa deixa de ver o seu perfil e a candidatura vai para o histórico. Enquanto a vaga estiver aberta, você pode se candidatar de novo.</p>
        </Dialogo>
      )}
    </div>
  );
}
