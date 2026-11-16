'use client';

import { useQuery } from '@tanstack/react-query';
import { Cartao } from '@vagas/ui';
import Link from 'next/link';
import { use, type ReactNode } from 'react';
import { ROTULOS_VAGA } from '@vagas/contracts';
import { Aviso } from '@/components/aviso';
import { api } from '@/lib/api';
import { formatarData, formatarSalario } from '@/lib/formatar';

type VagaDetalhe = {
  id: string;
  funcao: string;
  tipo: keyof typeof ROTULOS_VAGA.tipo;
  modalidade: keyof typeof ROTULOS_VAGA.modalidade;
  status: keyof typeof ROTULOS_VAGA.status;
  atividades: string;
  requisitos: string;
  beneficios: string;
  processoSeletivo: string;
  cultura: string;
  cidade: string | null;
  uf: string | null;
  semestreMinimo: number | null;
  salario: { aCombinar: boolean; min: number | null; max: number | null };
  prazo: string;
  criadaEm: string;
  areas: { id: string; nome: string }[];
  etapas: { id: string; nome: string; ordem: number }[];
  empresa: { nomeFantasia: string; ramoAtuacao: string; cidade: string; uf: string };
  somenteLeitura: boolean;
  candidatura: { id: string; status: string } | null;
  podeCandidatar: boolean;
};

/** Textos de vaga sempre como texto puro (seção 8.3), preservando as quebras de linha. */
function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 font-semibold">{titulo}</h2>
      <p className="whitespace-pre-line text-sm text-slate-700">{children}</p>
    </section>
  );
}

/** ALU-06 */
export default function VagaAluno({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: v, isError } = useQuery({ queryKey: ['aluno-vaga', id], queryFn: () => api<VagaDetalhe>(`/vagas/${id}`) });

  if (isError) return <Aviso tipo="erro">Vaga não encontrada ou não disponível para o seu curso.</Aviso>;
  if (!v) return <p>Carregando…</p>;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/aluno/vagas" className="text-sm text-indigo-700 hover:underline">← Vagas</Link>
      {v.somenteLeitura && <Aviso tipo="info">Esta vaga não está mais aberta ({ROTULOS_VAGA.status[v.status].toLowerCase()}). Você a vê porque tem uma candidatura nela.</Aviso>}
      <div>
        <h1 className="text-2xl font-semibold">{v.funcao}</h1>
        <p className="text-slate-700">{v.empresa.nomeFantasia} · {v.empresa.ramoAtuacao}</p>
      </div>
      <Cartao>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-500">Tipo</dt><dd>{ROTULOS_VAGA.tipo[v.tipo]}</dd></div>
          <div><dt className="text-slate-500">Modalidade</dt><dd>{ROTULOS_VAGA.modalidade[v.modalidade]}{v.cidade ? ` · ${v.cidade}/${v.uf}` : ''}</dd></div>
          <div><dt className="text-slate-500">Salário</dt><dd>{formatarSalario(v.salario)}</dd></div>
          <div><dt className="text-slate-500">Áreas</dt><dd>{v.areas.map((a) => a.nome).join(', ')}</dd></div>
          <div><dt className="text-slate-500">Semestre mínimo</dt><dd>{v.semestreMinimo ? `${v.semestreMinimo}º` : 'Sem exigência'}</dd></div>
          <div><dt className="text-slate-500">Candidaturas até</dt><dd>{formatarData(v.prazo)} (23:59, horário de Brasília)</dd></div>
        </dl>
      </Cartao>
      <Cartao className="flex flex-col gap-5">
        <Bloco titulo="Atividades do dia a dia">{v.atividades}</Bloco>
        <Bloco titulo="O que se espera">{v.requisitos}</Bloco>
        <Bloco titulo="Benefícios">{v.beneficios}</Bloco>
        <Bloco titulo="Cultura da empresa">{v.cultura}</Bloco>
        <Bloco titulo="Processo seletivo">{v.processoSeletivo}</Bloco>
        <section>
          <h2 className="mb-1 font-semibold">Etapas</h2>
          <ol aria-label="Etapas do processo seletivo" className="list-inside list-decimal text-sm text-slate-700">
            {v.etapas.map((e) => <li key={e.id}>{e.nome}</li>)}
          </ol>
        </section>
      </Cartao>
      {v.candidatura && v.candidatura.status !== 'CANCELADA' && <Aviso tipo="info">Você já se candidatou a esta vaga.</Aviso>}
      {v.podeCandidatar && <p className="text-sm text-slate-600">A candidatura pela plataforma chega na Fase 5.</p>}
    </div>
  );
}
