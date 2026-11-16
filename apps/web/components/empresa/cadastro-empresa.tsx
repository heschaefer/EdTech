'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Botao, Campo, Cartao } from '@vagas/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { cadastroEmpresaSchema } from '@vagas/contracts';
import { Aviso } from '@/components/aviso';
import { api, ErroApi } from '@/lib/api';
import { formatarCnpj, formatarTelefone } from '@/lib/formatar';
import { aplicarErrosApi } from '@/lib/formulario';
import { CamposEndereco } from './campos-endereco';

type Dados = z.input<typeof cadastroEmpresaSchema>;

/** EMP-01 */
export function CadastroEmpresa() {
  const [erro, setErro] = useState('');
  const [concluido, setConcluido] = useState<string | null>(null);
  const { register, handleSubmit, setError, setValue, formState } = useForm<Dados>({ resolver: zodResolver(cadastroEmpresaSchema), criteriaMode: 'all' });
  const errosSenha = Object.values(formState.errors.senha?.types ?? {}).flat().map(String);

  const enviar = async (d: Dados) => {
    setErro('');
    try {
      const r = await api<{ email: string }>('/auth/empresas', { method: 'POST', corpo: d });
      setConcluido(r.email);
    } catch (e) {
      setErro(e instanceof ErroApi && e.status === 429 ? 'Muitos cadastros a partir desta rede. Tente mais tarde.' : aplicarErrosApi(e, setError));
    }
  };

  if (concluido) {
    return (
      <Cartao>
        <h1 className="mb-4 text-xl font-semibold">Cadastro recebido</h1>
        <Aviso tipo="sucesso">
          Enviamos um link de verificação para {concluido}. Depois de confirmar o e-mail você já pode entrar e completar o perfil; a publicação de vagas
          é liberada quando o administrador aprovar o cadastro.
        </Aviso>
        <Link href="/login" className="mt-4 inline-block text-sm text-indigo-700 hover:underline">Ir para o login</Link>
      </Cartao>
    );
  }

  return (
    <Cartao>
      <h1 className="mb-4 text-xl font-semibold">Cadastro de empresa</h1>
      <form onSubmit={handleSubmit(enviar)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Campo rotulo="Razão social" {...register('razaoSocial')} erro={formState.errors.razaoSocial?.message} />
        <Campo rotulo="Nome fantasia" {...register('nomeFantasia')} erro={formState.errors.nomeFantasia?.message} />
        <Campo rotulo="CNPJ" inputMode="numeric" {...register('cnpj', { onChange: (e) => setValue('cnpj', formatarCnpj(e.target.value)) })} erro={formState.errors.cnpj?.message} />
        <Campo rotulo="Ramo de atuação" {...register('ramoAtuacao')} erro={formState.errors.ramoAtuacao?.message} />
        <Campo rotulo="Telefone" type="tel" {...register('telefone', { onChange: (e) => setValue('telefone', formatarTelefone(e.target.value)) })} erro={formState.errors.telefone?.message} />
        <Campo rotulo="E-mail" type="email" autoComplete="email" {...register('email')} erro={formState.errors.email?.message} />
        <Campo rotulo="Senha" type="password" autoComplete="new-password" {...register('senha')} erro={errosSenha.length ? errosSenha : formState.errors.senha?.message} />
        <Campo rotulo="Confirmação da senha" type="password" autoComplete="new-password" {...register('confirmacao')} erro={formState.errors.confirmacao?.message} />
        <h2 className="mt-2 font-medium sm:col-span-2">Endereço</h2>
        <CamposEndereco register={register} setValue={setValue} errors={formState.errors} />
        {erro && <div className="sm:col-span-2"><Aviso tipo="erro">{erro}</Aviso></div>}
        <div className="sm:col-span-2">
          <Botao type="submit" disabled={formState.isSubmitting}>Criar conta da empresa</Botao>
        </div>
      </form>
      <p className="mt-4 text-sm">
        Já tem conta? <Link href="/login" className="text-indigo-700 underline">Entrar</Link>
      </p>
    </Cartao>
  );
}
