'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Botao, Campo, Cartao } from '@vagas/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { senhaNovaSchema } from '@vagas/contracts';
import { Aviso } from '@/components/aviso';
import { api } from '@/lib/api';
import { aplicarErrosApi } from '@/lib/formulario';

const schema = z
  .object({ senha: senhaNovaSchema, confirmacao: z.string() })
  .refine((d) => d.senha === d.confirmacao, { path: ['confirmacao'], message: 'As senhas não conferem' });
type Dados = z.infer<typeof schema>;

/** Usado pela redefinição (AUTH-04) e pelo convite da faculdade (FAC-01). */
export function FormDefinirSenha({ titulo, rota, sucesso }: { titulo: string; rota: string; sucesso: string }) {
  const token = useSearchParams().get('token') ?? '';
  const [estado, setEstado] = useState<'form' | 'ok'>('form');
  const [erro, setErro] = useState('');
  // criteriaMode "all": a tela lista cada requisito não atendido (ALU-01 / RN-04).
  const { register, handleSubmit, setError, formState } = useForm<Dados>({ resolver: zodResolver(schema), criteriaMode: 'all' });
  const errosSenha = Object.values(formState.errors.senha?.types ?? {}).flat().map(String);

  const enviar = async (dados: Dados) => {
    setErro('');
    try {
      await api(rota, { method: 'POST', corpo: { token, ...dados } });
      setEstado('ok');
    } catch (e) {
      setErro(aplicarErrosApi(e, setError));
    }
  };

  return (
    <Cartao>
      <h1 className="mb-4 text-xl font-semibold">{titulo}</h1>
      {estado === 'ok' ? (
        <Aviso tipo="sucesso">{sucesso}</Aviso>
      ) : (
        <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4" noValidate>
          <Campo rotulo="Nova senha" type="password" autoComplete="new-password" {...register('senha')} erro={errosSenha.length ? errosSenha : formState.errors.senha?.message} />
          <Campo rotulo="Confirmação da senha" type="password" autoComplete="new-password" {...register('confirmacao')} erro={formState.errors.confirmacao?.message} />
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <Botao type="submit" disabled={formState.isSubmitting}>
            Salvar senha
          </Botao>
        </form>
      )}
      <Link href="/login" className="mt-4 inline-block text-sm text-indigo-700 hover:underline">
        Ir para o login
      </Link>
    </Cartao>
  );
}
