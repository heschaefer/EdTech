'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Botao, Campo, Cartao } from '@vagas/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, use, useEffect, useRef, useState } from 'react';
import { Aviso } from '@/components/aviso';
import { FormVaga } from '@/components/empresa/form-vaga';
import { StatusVaga } from '@/components/empresa/status-vaga';
import type { Vaga } from '@/components/empresa/tipos';
import { useAcao } from '@/lib/acoes';
import { api } from '@/lib/api';
import { dataCivilSP, formatarData, formatarDataHora } from '@/lib/formatar';

const HORAS_ENCERRAMENTO_AUTOMATICO = 72;

export default function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <VagaEmpresa id={id} />
    </Suspense>
  );
}

/** EMP-04 a EMP-07, EMP-11 (atalho para encerrar) e EMP-12 (prazo vencido). */
function VagaEmpresa({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const busca = useSearchParams();
  const publicada = busca.get('publicada');
  const encerradaAgora = busca.get('encerrada');
  const chave = ['empresa-vaga', id];
  const { data: vaga, isError } = useQuery({ queryKey: chave, queryFn: () => api<Vaga>(`/empresa/vagas/${id}`) });
  const { mensagem, setMensagem, executar } = useAcao(chave, ['empresa-vagas']);
  const [editando, setEditando] = useState(false);
  const [novoPrazo, setNovoPrazo] = useState('');
  const campoPrazo = useRef<HTMLDivElement>(null);

  // EMP-12: o atalho "Prorrogar" da notificação abre a vaga em #prorrogar.
  useEffect(() => {
    if (vaga && window.location.hash === '#prorrogar') {
      campoPrazo.current?.scrollIntoView({ block: 'center' });
      campoPrazo.current?.querySelector('input')?.focus();
    }
  }, [vaga]);

  if (isError) return <Aviso tipo="erro">Vaga não encontrada.</Aviso>;
  if (!vaga) return <p>Carregando…</p>;
  const encerrada = vaga.status === 'ENCERRADA';
  const acao = (rota: string, texto: string, corpo?: object) => executar(() => api(`/empresa/vagas/${id}/${rota}`, { method: 'POST', corpo }), texto);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/empresa/vagas" className="text-sm text-indigo-700 hover:underline">← Vagas</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{vaga.funcao}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            <StatusVaga status={vaga.status} /> Prazo: {formatarData(vaga.prazo)} · {vaga.areas.map((a) => a.nome).join(', ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {vaga.status === 'ABERTA' && <Botao variante="secundario" onClick={() => acao('pausar', 'Vaga pausada: saiu da listagem e não recebe novas candidaturas.')}>Pausar</Botao>}
          {vaga.status === 'PAUSADA' && <Botao variante="secundario" onClick={() => acao('reativar', 'Vaga reativada.')}>Reativar</Botao>}
          {!encerrada && !editando && <Botao variante="secundario" onClick={() => (setEditando(true), setMensagem(null))}>Editar</Botao>}
          {/* D10: sem candidaturas, exclui; encerrar (EMP-11) vale sempre que a vaga não está encerrada. */}
          {!encerrada && (
            <Link href={`/empresa/vagas/${id}/encerrar`} className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700">
              Encerrar vaga
            </Link>
          )}
          {!vaga.jaTeveCandidatura && (
            <Botao
              variante="perigo"
              onClick={async () => {
                if (confirm(`Excluir a vaga ${vaga.funcao}?`) && (await executar(() => api(`/empresa/vagas/${id}`, { method: 'DELETE' }), 'Vaga excluída.'))) router.replace('/empresa/vagas');
              }}
            >
              Excluir
            </Botao>
          )}
        </div>
      </div>
      {publicada && !mensagem && <Aviso tipo="sucesso">Vaga publicada: já aparece para os alunos das áreas escolhidas.</Aviso>}
      {encerradaAgora && !mensagem && <Aviso tipo="sucesso">Vaga encerrada. Os candidatos receberam a devolutiva.</Aviso>}
      {vaga.status === 'PRAZO_EXPIRADO' && (
        <Aviso tipo="erro">
          O prazo venceu e a vaga saiu da listagem. Prorrogue o prazo ou encerre com a devolutiva; sem ação, ela será encerrada automaticamente em{' '}
          {formatarDataHora(new Date(new Date(vaga.prazo).getTime() + HORAS_ENCERRAMENTO_AUTOMATICO * 3600_000))}.
        </Aviso>
      )}
      {encerrada && vaga.encerradaEm && (
        <p className="text-sm text-slate-600">
          Encerrada em {formatarDataHora(vaga.encerradaEm)}
          {vaga.motivoEncerramento === 'AUTOMATICO' ? ' automaticamente, 72 h após o prazo.' : '.'}
        </p>
      )}
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      {!encerrada && (
        <Cartao id="prorrogar">
          <h2 className="mb-1 text-lg font-semibold">Prorrogar prazo</h2>
          <p className="mb-3 text-sm text-slate-600">Até 1 ano após a publicação ({formatarData(vaga.criadaEm)}). O prazo vale até 23:59 (horário de Brasília).</p>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              executar(() => api(`/empresa/vagas/${id}/prorrogar`, { method: 'POST', corpo: { prazo: novoPrazo } }), `Prazo prorrogado para ${novoPrazo.split('-').reverse().join('/')}.`, () => setNovoPrazo(''));
            }}
          >
            <div className="w-48" ref={campoPrazo}>
              <Campo rotulo="Novo prazo" type="date" min={dataCivilSP(new Date())} value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)} />
            </div>
            <Botao type="submit" variante="secundario" disabled={!novoPrazo}>Prorrogar</Botao>
          </form>
        </Cartao>
      )}

      {editando ? (
        <FormVaga
          vaga={vaga}
          aoSalvar={(v) => {
            qc.setQueryData(chave, v);
            qc.invalidateQueries({ queryKey: ['empresa-vagas'] });
            setEditando(false);
            setMensagem({ tipo: 'sucesso', texto: 'Alterações salvas.' });
          }}
        />
      ) : (
        <Cartao>
          <h2 className="mb-3 text-lg font-semibold">Etapas do processo seletivo</h2>
          <ol className="list-inside list-decimal text-sm">
            {vaga.etapas.map((e) => <li key={e.id}>{e.nome}</li>)}
          </ol>
          <Link href={`/empresa/vagas/${id}/candidatos`} className="mt-4 inline-block font-medium text-indigo-700 hover:underline">
            Ver candidatos ({vaga.totalCandidatos ?? 0})
          </Link>
        </Cartao>
      )}
    </div>
  );
}
