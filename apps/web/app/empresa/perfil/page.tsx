'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Botao, Campo, Cartao } from '@vagas/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { atualizarEmpresaSchema } from '@vagas/contracts';
import { formatarCnpj } from '@/components/admin/tipos';
import { Aviso } from '@/components/aviso';
import { CamposEndereco } from '@/components/empresa/campos-endereco';
import { mensagemDeErro, type Mensagem } from '@/lib/acoes';
import { api } from '@/lib/api';
import { formatarCep, formatarTelefone } from '@/lib/formatar';
import { aplicarErrosApi } from '@/lib/formulario';

export type PerfilEmpresa = {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  telefone: string;
  email: string;
  emailLogin: string;
  ramoAtuacao: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  aprovacao: 'PENDENTE' | 'APROVADA' | 'REPROVADA';
  aprovacaoMotivo: string | null;
};
type Dados = z.input<typeof atualizarEmpresaSchema>;

/** EMP-02: tudo, menos o CNPJ. */
export default function PerfilEmpresaPagina() {
  const { data } = useQuery({ queryKey: ['empresa-perfil'], queryFn: () => api<PerfilEmpresa>('/empresa/me') });
  return data ? <FormPerfil perfil={data} /> : <p>Carregando…</p>;
}

function FormPerfil({ perfil }: { perfil: PerfilEmpresa }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<Mensagem>(null);
  const { register, handleSubmit, setError, setValue, formState } = useForm<Dados>({
    resolver: zodResolver(atualizarEmpresaSchema),
    // Só os campos editáveis: o schema é estrito e recusaria id, cnpj, aprovacao…
    defaultValues: {
      razaoSocial: perfil.razaoSocial,
      nomeFantasia: perfil.nomeFantasia,
      ramoAtuacao: perfil.ramoAtuacao,
      telefone: formatarTelefone(perfil.telefone),
      email: perfil.email,
      cep: formatarCep(perfil.cep),
      logradouro: perfil.logradouro,
      numero: perfil.numero,
      complemento: perfil.complemento ?? '',
      bairro: perfil.bairro,
      cidade: perfil.cidade,
      uf: perfil.uf as Dados['uf'],
    },
  });

  const enviar = async (d: Dados) => {
    setMsg(null);
    try {
      qc.setQueryData(['empresa-perfil'], await api<PerfilEmpresa>('/empresa/me', { method: 'PATCH', corpo: d }));
      await qc.invalidateQueries({ queryKey: ['me'] });
      setMsg({ tipo: 'sucesso', texto: 'Perfil salvo.' });
    } catch (e) {
      const texto = aplicarErrosApi(e, setError);
      if (texto) setMsg({ tipo: 'erro', texto });
    }
  };

  const pedirAnalise = async () => {
    try {
      qc.setQueryData(['empresa-perfil'], await api<PerfilEmpresa>('/empresa/me/solicitar-analise', { method: 'POST' }));
      await qc.invalidateQueries({ queryKey: ['me'] });
      setMsg({ tipo: 'sucesso', texto: 'Nova análise solicitada. Avisaremos o resultado por aqui e por e-mail.' });
    } catch (e) {
      setMsg({ tipo: 'erro', texto: mensagemDeErro(e) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Perfil da empresa</h1>
      {perfil.aprovacao === 'REPROVADA' && (
        <Cartao>
          <p className="mb-3 text-sm">Depois de corrigir o que foi apontado, peça uma nova análise.</p>
          <Botao onClick={pedirAnalise}>Solicitar nova análise</Botao>
        </Cartao>
      )}
      <Cartao>
        <form onSubmit={handleSubmit(enviar)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Campo rotulo="CNPJ" value={formatarCnpj(perfil.cnpj)} readOnly className="bg-slate-100" />
          <Campo rotulo="E-mail de acesso" value={perfil.emailLogin} readOnly className="bg-slate-100" />
          <Campo rotulo="Razão social" {...register('razaoSocial')} erro={formState.errors.razaoSocial?.message} />
          <Campo rotulo="Nome fantasia" {...register('nomeFantasia')} erro={formState.errors.nomeFantasia?.message} />
          <Campo rotulo="Ramo de atuação" {...register('ramoAtuacao')} erro={formState.errors.ramoAtuacao?.message} />
          <Campo rotulo="Telefone" type="tel" {...register('telefone', { onChange: (e) => setValue('telefone', formatarTelefone(e.target.value)) })} erro={formState.errors.telefone?.message} />
          <Campo rotulo="E-mail de contato" type="email" {...register('email')} erro={formState.errors.email?.message} />
          <h2 className="mt-2 font-medium sm:col-span-2">Endereço</h2>
          <CamposEndereco register={register} setValue={setValue} errors={formState.errors} />
          {msg && <div className="sm:col-span-2"><Aviso tipo={msg.tipo}>{msg.texto}</Aviso></div>}
          <div className="sm:col-span-2">
            <Botao type="submit" disabled={formState.isSubmitting}>Salvar perfil</Botao>
          </div>
        </form>
      </Cartao>
    </div>
  );
}
