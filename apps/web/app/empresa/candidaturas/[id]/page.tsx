'use client';

import { useQuery } from '@tanstack/react-query';
import { Botao, Cartao, Selecao } from '@vagas/ui';
import Link from 'next/link';
import { use, useState } from 'react';
import type { StatusCandidatura } from '@vagas/contracts';
import type { CurriculoApi } from '@/components/aluno/editor-curriculo';
import { Aviso } from '@/components/aviso';
import { LinhaDoTempo, StatusCandidaturaSelo, type Evento } from '@/components/candidaturas/comum';
import { Dialogo } from '@/components/dialogo';
import { CurriculoLeitura } from '@/components/empresa/curriculo-leitura';
import { useAcao } from '@/lib/acoes';
import { api } from '@/lib/api';
import { formatarData, formatarTelefone, nomeTurma } from '@/lib/formatar';

type Etapa = { id: string; nome: string; ordem: number };
type Perfil = {
  id: string;
  status: StatusCandidatura;
  criadaEm: string;
  atualizadaEm: string;
  etapaAtual: Etapa | null;
  etapa: string | null;
  vaga: { id: string; funcao: string; status: string; etapas: Etapa[] };
  candidato: {
    nome: string;
    email: string;
    telefone: string;
    faculdade: string;
    curso: string;
    turma: { anoIngresso: number; periodoIngresso: number };
    semestre: number;
    ativo: boolean;
  };
  graduacaoAtual: CurriculoApi['graduacaoAtual'];
  curriculo: CurriculoApi['curriculo'];
  eventos: Evento[];
};

/** EMP-09 (perfil, sem CPF) e EMP-10 (mover etapa ou não selecionar). */
export default function CandidaturaEmpresa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const chave = ['empresa-candidatura', id];
  const { data: p, isError } = useQuery({ queryKey: chave, queryFn: () => api<Perfil>(`/empresa/candidaturas/${id}`) });
  const { mensagem, executar } = useAcao(chave, ['empresa-candidatos'], ['empresa-vagas']);
  const [etapaId, setEtapaId] = useState('');
  const [naoSelecionando, setNaoSelecionando] = useState(false);

  if (isError) return <Aviso tipo="erro">Candidatura não encontrada ou cancelada.</Aviso>;
  if (!p) return <p>Carregando…</p>;
  const emProcesso = p.status === 'EM_PROCESSO';
  const c = p.candidato;

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/empresa/vagas/${p.vaga.id}/candidatos`} className="text-sm text-indigo-700 hover:underline">← Candidatos de {p.vaga.funcao}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{c.nome}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <StatusCandidaturaSelo status={p.status} />
            {emProcesso && <span>Etapa: {p.etapa}</span>}
            <span>· candidatura em {formatarData(p.criadaEm)}</span>
          </p>
        </div>
        {emProcesso && <Botao variante="perigo" onClick={() => setNaoSelecionando(true)}>Não selecionar</Botao>}
      </div>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      {emProcesso && (
        <Cartao>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const nome = p.vaga.etapas.find((x) => x.id === etapaId)?.nome;
              executar(() => api(`/empresa/candidaturas/${id}/etapa`, { method: 'PATCH', corpo: { etapaId } }), `Candidato movido para ${nome}. O aluno foi avisado.`, () => setEtapaId(''));
            }}
          >
            <div className="w-64">
              <Selecao rotulo="Mover para a etapa" value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
                <option value="">Escolha a etapa</option>
                {p.vaga.etapas.filter((e) => e.id !== p.etapaAtual?.id).map((e) => <option key={e.id} value={e.id}>{e.ordem}. {e.nome}</option>)}
              </Selecao>
            </div>
            <Botao type="submit" disabled={!etapaId}>Mover</Botao>
          </form>
        </Cartao>
      )}

      <Cartao>
        <h2 className="mb-3 text-lg font-semibold">Dados do candidato</h2>
        {!c.ativo && <p className="mb-3 text-sm text-amber-800">Este aluno não está mais ativo na faculdade.</p>}
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-500">E-mail</dt><dd><a className="text-indigo-700 underline" href={`mailto:${c.email}`}>{c.email}</a></dd></div>
          <div><dt className="text-slate-500">Telefone</dt><dd>{formatarTelefone(c.telefone)}</dd></div>
          <div><dt className="text-slate-500">Faculdade</dt><dd>{c.faculdade}</dd></div>
          <div><dt className="text-slate-500">Curso</dt><dd>{c.curso}</dd></div>
          <div><dt className="text-slate-500">Turma</dt><dd>{nomeTurma(c.turma)}</dd></div>
          <div><dt className="text-slate-500">Semestre</dt><dd>{c.semestre}º</dd></div>
        </dl>
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CurriculoLeitura curriculo={p.curriculo} graduacao={p.graduacaoAtual} />
        </div>
        <Cartao>
          <h2 className="mb-3 text-lg font-semibold">Linha do tempo</h2>
          <LinhaDoTempo eventos={p.eventos} />
        </Cartao>
      </div>

      {naoSelecionando && (
        <Dialogo
          titulo={`Não selecionar ${c.nome}`}
          rotuloConfirmar="Confirmar"
          variante="perigo"
          aoFechar={() => setNaoSelecionando(false)}
          aoConfirmar={() =>
            executar(() => api(`/empresa/candidaturas/${id}/nao-selecionar`, { method: 'POST' }), 'Candidatura finalizada como não selecionada. O aluno foi avisado.', () => setNaoSelecionando(false)).finally(() =>
              setNaoSelecionando(false),
            )
          }
        >
          <p>A candidatura é finalizada agora e o aluno recebe a mensagem padrão de encerramento. Essa ação não pode ser desfeita.</p>
        </Dialogo>
      )}
    </div>
  );
}
