'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Botao, Cartao } from '@vagas/ui';
import Link from 'next/link';
import { useState } from 'react';
import { PAINEL_POR_PAPEL, type Notificacao, type Pagina, type Papel } from '@vagas/contracts';
import { Aviso } from '@/components/aviso';
import { useAcao } from '@/lib/acoes';
import { api } from '@/lib/api';
import { formatarDataHora } from '@/lib/formatar';

const CHAVE = ['notificacoes'];

/** ALU-11: o sino mostra quantas não lidas há e leva à central. */
export function Sino({ papel }: { papel: Papel }) {
  const { data } = useQuery({
    queryKey: [...CHAVE, 'nao-lidas'],
    queryFn: () => api<{ naoLidas: number }>('/notificacoes/nao-lidas'),
    refetchInterval: 30_000,
  });
  const n = data?.naoLidas ?? 0;
  return (
    <Link
      href={`${PAINEL_POR_PAPEL[papel]}/notificacoes`}
      aria-label={n ? `Notificações: ${n} não lida${n > 1 ? 's' : ''}` : 'Notificações'}
      className="relative rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {n > 0 && (
        <span aria-hidden className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-semibold leading-5 text-white">
          {n > 99 ? '99+' : n}
        </span>
      )}
    </Link>
  );
}

/** EMP-12: avisos de prazo trazem os atalhos para prorrogar ou encerrar a vaga. */
const COM_ATALHOS_DE_PRAZO = new Set(['PRAZO_VENCIDO', 'LEMBRETE_ENCERRAMENTO']);

/** ALU-11: central de notificações de qualquer papel. */
export function CentralNotificacoes() {
  const qc = useQueryClient();
  const [soNaoLidas, setSoNaoLidas] = useState(false);
  const [page, setPage] = useState(1);
  const consulta = new URLSearchParams({ page: String(page), ...(soNaoLidas ? { naoLidas: 'true' } : {}) }).toString();
  const { data, isLoading } = useQuery({
    queryKey: [...CHAVE, 'lista', consulta],
    queryFn: () => api<Pagina<Notificacao> & { naoLidas: number }>(`/notificacoes?${consulta}`),
  });
  const { mensagem, executar } = useAcao(CHAVE);
  const marcar = (id: string) => api(`/notificacoes/${id}/lida`, { method: 'PATCH' }).then(() => qc.invalidateQueries({ queryKey: CHAVE }));
  const paginas = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notificações</h1>
          {data && <p className="text-sm text-slate-600">{data.naoLidas ? `${data.naoLidas} não lida(s)` : 'Tudo lido'}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={soNaoLidas} onChange={(e) => (setSoNaoLidas(e.target.checked), setPage(1))} className="h-4 w-4" />
            Só não lidas
          </label>
          <Botao variante="secundario" disabled={!data?.naoLidas} onClick={() => executar(() => api('/notificacoes/lidas', { method: 'PATCH' }), 'Todas as notificações foram marcadas como lidas.')}>
            Marcar todas como lidas
          </Botao>
        </div>
      </div>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      <ul aria-label="Notificações" className="flex flex-col gap-3">
        {data?.data.map((n) => {
          const lida = !!n.lidaEm;
          return (
            <li key={n.id}>
              <Cartao className={`flex flex-col gap-2 p-4 ${lida ? '' : 'border-l-4 border-indigo-500'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">
                    {!lida && <span className="mr-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">Não lida</span>}
                    {n.titulo}
                  </p>
                  <time dateTime={n.criadaEm} className="text-xs text-slate-500">{formatarDataHora(n.criadaEm)}</time>
                </div>
                <p className="text-sm text-slate-700">{n.mensagem}</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  {n.link && (
                    <Link href={n.link} onClick={() => !lida && marcar(n.id)} className="font-medium text-indigo-700 hover:underline">
                      Abrir<span className="sr-only">: {n.titulo}</span>
                    </Link>
                  )}
                  {n.link && COM_ATALHOS_DE_PRAZO.has(n.tipo) && (
                    <>
                      <Link href={`${n.link}#prorrogar`} onClick={() => !lida && marcar(n.id)} className="font-medium text-indigo-700 hover:underline">
                        Prorrogar<span className="sr-only">: {n.titulo}</span>
                      </Link>
                      <Link href={`${n.link}/encerrar`} onClick={() => !lida && marcar(n.id)} className="font-medium text-indigo-700 hover:underline">
                        Encerrar<span className="sr-only">: {n.titulo}</span>
                      </Link>
                    </>
                  )}
                  {!lida && (
                    <button type="button" onClick={() => marcar(n.id)} className="text-slate-600 hover:underline">
                      Marcar como lida<span className="sr-only">: {n.titulo}</span>
                    </button>
                  )}
                </div>
              </Cartao>
            </li>
          );
        })}
        {!isLoading && data?.data.length === 0 && <li className="text-slate-500">{soNaoLidas ? 'Nenhuma notificação não lida.' : 'Nenhuma notificação ainda.'}</li>}
      </ul>

      {paginas > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-center gap-3 text-sm">
          <Botao variante="secundario" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Botao>
          <span>Página {page} de {paginas}</span>
          <Botao variante="secundario" disabled={page >= paginas} onClick={() => setPage(page + 1)}>Próxima</Botao>
        </nav>
      )}
    </div>
  );
}
