'use client';

import { Botao, Campo, Cartao } from '@vagas/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Aviso } from '@/components/aviso';
import { api } from '@/lib/api';

/** AUTH-04: a resposta é sempre a mesma, exista ou não o e-mail. */
export default function PaginaEsqueci() {
  const [enviado, setEnviado] = useState(false);
  const { register, handleSubmit, formState } = useForm<{ email: string }>();

  const enviar = async ({ email }: { email: string }) => {
    await api('/auth/senha/esqueci', { method: 'POST', corpo: { email } }).catch(() => undefined);
    setEnviado(true);
  };

  return (
    <Cartao>
      <h1 className="mb-4 text-xl font-semibold">Esqueci a senha</h1>
      {enviado ? (
        <Aviso tipo="sucesso">Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha. O link vale 1 hora.</Aviso>
      ) : (
        <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4">
          <Campo rotulo="E-mail" type="email" required autoComplete="email" {...register('email', { required: true })} />
          <Botao type="submit" disabled={formState.isSubmitting}>
            Enviar link
          </Botao>
        </form>
      )}
      <Link href="/login" className="mt-4 inline-block text-sm text-indigo-700 hover:underline">
        Voltar ao login
      </Link>
    </Cartao>
  );
}
