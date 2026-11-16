'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Botao, Campo, Cartao } from '@vagas/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { atualizarFaculdadeSchema } from '@vagas/contracts';
import { Aviso } from '@/components/aviso';
import { formatarCnpj } from '@/components/admin/tipos';
import { api } from '@/lib/api';
import { aplicarErrosApi } from '@/lib/formulario';

type Perfil = { cnpj: string; razaoSocial: string; nomeFantasia: string; telefone: string; email: string; dominios: string[]; emailLogin: string };
type Dados = z.input<typeof atualizarFaculdadeSchema>;

/** FAC-02: CNPJ e domínios só o admin altera. */
export default function PerfilFaculdade() {
  const qc = useQueryClient();
  const { data: perfil } = useQuery({ queryKey: ['fac-perfil'], queryFn: () => api<Perfil>('/faculdade/me') });
  if (!perfil) return <p>Carregando…</p>;
  return <FormPerfil perfil={perfil} aoSalvar={(p) => qc.setQueryData(['fac-perfil'], p)} />;
}

function FormPerfil({ perfil, aoSalvar }: { perfil: Perfil; aoSalvar: (p: Perfil) => void }) {
  const [msg, setMsg] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<Dados>({
    resolver: zodResolver(atualizarFaculdadeSchema),
    defaultValues: { razaoSocial: perfil.razaoSocial, nomeFantasia: perfil.nomeFantasia, telefone: perfil.telefone, email: perfil.email },
  });

  const enviar = async (dados: Dados) => {
    setMsg(null);
    try {
      aoSalvar(await api<Perfil>('/faculdade/me', { method: 'PATCH', corpo: dados }));
      setMsg({ tipo: 'sucesso', texto: 'Dados salvos.' });
    } catch (e) {
      const texto = aplicarErrosApi(e, setError);
      if (texto) setMsg({ tipo: 'erro', texto });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dados da faculdade</h1>
      <Cartao>
        <form onSubmit={handleSubmit(enviar)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Campo rotulo="Razão social" {...register('razaoSocial')} erro={formState.errors.razaoSocial?.message} />
          <Campo rotulo="Nome fantasia" {...register('nomeFantasia')} erro={formState.errors.nomeFantasia?.message} />
          <Campo rotulo="Telefone" type="tel" {...register('telefone')} erro={formState.errors.telefone?.message} />
          <Campo rotulo="E-mail de contato" type="email" {...register('email')} erro={formState.errors.email?.message} />
          {msg && (
            <div className="sm:col-span-2">
              <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>
            </div>
          )}
          <div className="sm:col-span-2">
            <Botao type="submit" disabled={formState.isSubmitting}>
              Salvar dados
            </Botao>
          </div>
        </form>
      </Cartao>
      <Cartao>
        <h2 className="mb-3 text-lg font-semibold">Só o administrador da plataforma altera</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-500">CNPJ</dt><dd className="tabular-nums">{formatarCnpj(perfil.cnpj)}</dd></div>
          <div><dt className="text-slate-500">Domínios estudantis</dt><dd>{perfil.dominios.join(', ')}</dd></div>
          <div><dt className="text-slate-500">E-mail de acesso</dt><dd>{perfil.emailLogin}</dd></div>
        </dl>
      </Cartao>
    </div>
  );
}
