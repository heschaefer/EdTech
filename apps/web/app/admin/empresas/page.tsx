'use client';

import { useQuery } from '@tanstack/react-query';
import { Botao, Campo, Cartao, Selecao } from '@vagas/ui';
import { useState } from 'react';
import type { Pagina } from '@vagas/contracts';
import { formatarCnpj } from '@/components/admin/tipos';
import { Aviso } from '@/components/aviso';
import { useAcao } from '@/lib/acoes';
import { api } from '@/lib/api';
import { formatarCep } from '@/lib/formatar';

type Empresa = {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  emailLogin: string;
  emailVerificado: boolean;
  telefone: string;
  ramoAtuacao: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  ativa: boolean;
  aprovacao: 'PENDENTE' | 'APROVADA' | 'REPROVADA';
  aprovacaoMotivo: string | null;
  totalVagas: number;
};

const APROVACAO = { PENDENTE: 'Aguardando análise', APROVADA: 'Aprovada', REPROVADA: 'Reprovada' } as const;

/** ADM-04 (aprovar/reprovar) e ADM-05 (listar, ver, inativar). */
export default function EmpresasAdmin() {
  const [filtro, setFiltro] = useState({ aprovacao: 'PENDENTE', ativa: '', q: '' });
  const [aberta, setAberta] = useState<string | null>(null);
  const [reprovando, setReprovando] = useState<{ id: string; motivo: string } | null>(null);
  const params = new URLSearchParams(Object.entries({ ...filtro, pageSize: '50' }).filter(([, v]) => v));
  const { data } = useQuery({ queryKey: ['admin-empresas', params.toString()], queryFn: () => api<Pagina<Empresa>>(`/admin/empresas?${params}`) });
  const { mensagem, executar } = useAcao(['admin-empresas']);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Empresas</h1>
      <Cartao>
        <form role="search" className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => e.preventDefault()}>
          <Selecao rotulo="Aprovação" value={filtro.aprovacao} onChange={(e) => setFiltro({ ...filtro, aprovacao: e.target.value })}>
            <option value="">Todas</option>
            {Object.entries(APROVACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </Selecao>
          <Selecao rotulo="Situação" value={filtro.ativa} onChange={(e) => setFiltro({ ...filtro, ativa: e.target.value })}>
            <option value="">Todas</option>
            <option value="true">Ativas</option>
            <option value="false">Inativas</option>
          </Selecao>
          <Campo rotulo="Buscar por nome, CNPJ ou e-mail" value={filtro.q} onChange={(e) => setFiltro({ ...filtro, q: e.target.value })} />
        </form>
      </Cartao>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      <ul aria-label="Empresas" className="flex flex-col gap-3">
        {data?.data.map((e) => (
          <li key={e.id}>
            <Cartao>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{e.nomeFantasia}</h2>
                  <p className="text-sm text-slate-600">{e.razaoSocial} · CNPJ {formatarCnpj(e.cnpj)}</p>
                  <p className="text-sm text-slate-600">
                    {APROVACAO[e.aprovacao]}
                    {e.aprovacaoMotivo ? ` (${e.aprovacaoMotivo})` : ''} · {e.ativa ? 'Ativa' : 'Inativa'} · {e.totalVagas} vaga(s)
                    {!e.emailVerificado && ' · e-mail não verificado'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Botao variante="secundario" onClick={() => setAberta(aberta === e.id ? null : e.id)} aria-expanded={aberta === e.id}>
                    {aberta === e.id ? 'Ocultar dados' : 'Ver dados'}<span className="sr-only"> de {e.nomeFantasia}</span>
                  </Botao>
                  {e.aprovacao === 'PENDENTE' && e.emailVerificado && (
                    <>
                      <Botao onClick={() => executar(() => api(`/admin/empresas/${e.id}/aprovar`, { method: 'POST' }), `${e.nomeFantasia} aprovada.`)}>
                        Aprovar<span className="sr-only"> {e.nomeFantasia}</span>
                      </Botao>
                      <Botao variante="perigo" onClick={() => setReprovando({ id: e.id, motivo: '' })}>
                        Reprovar<span className="sr-only"> {e.nomeFantasia}</span>
                      </Botao>
                    </>
                  )}
                  <Botao
                    variante="secundario"
                    onClick={() =>
                      (e.ativa ? confirm(`Inativar ${e.nomeFantasia}? O login fica bloqueado e todas as vagas abertas serão pausadas.`) : true) &&
                      executar(() => api(`/admin/empresas/${e.id}`, { method: 'PATCH', corpo: { ativa: !e.ativa } }), e.ativa ? `${e.nomeFantasia} inativada; vagas abertas pausadas.` : `${e.nomeFantasia} reativada.`)
                    }
                  >
                    {e.ativa ? 'Inativar' : 'Reativar'}<span className="sr-only"> {e.nomeFantasia}</span>
                  </Botao>
                </div>
              </div>
              {reprovando?.id === e.id && (
                <form
                  className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    executar(() => api(`/admin/empresas/${e.id}/reprovar`, { method: 'POST', corpo: { motivo: reprovando.motivo } }), `${e.nomeFantasia} reprovada.`, () => setReprovando(null));
                  }}
                >
                  <Campo rotulo="Motivo da reprovação" value={reprovando.motivo} onChange={(ev) => setReprovando({ id: e.id, motivo: ev.target.value })} />
                  <div className="flex gap-2">
                    <Botao type="submit" variante="perigo" disabled={reprovando.motivo.trim().length < 3}>Confirmar reprovação</Botao>
                    <Botao type="button" variante="secundario" onClick={() => setReprovando(null)}>Cancelar</Botao>
                  </div>
                </form>
              )}
              {aberta === e.id && (
                <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
                  <div><dt className="text-slate-500">Ramo</dt><dd>{e.ramoAtuacao}</dd></div>
                  <div><dt className="text-slate-500">Contato</dt><dd>{e.email} · {e.telefone}</dd></div>
                  <div><dt className="text-slate-500">Login</dt><dd>{e.emailLogin}</dd></div>
                  <div className="sm:col-span-3">
                    <dt className="text-slate-500">Endereço</dt>
                    <dd>{e.logradouro}, {e.numero}{e.complemento ? ` – ${e.complemento}` : ''} · {e.bairro} · {e.cidade}/{e.uf} · CEP {formatarCep(e.cep)}</dd>
                  </div>
                </dl>
              )}
            </Cartao>
          </li>
        ))}
        {data?.data.length === 0 && <li className="text-slate-500">Nenhuma empresa encontrada.</li>}
      </ul>
    </div>
  );
}
