'use client';

import { Cartao } from '@vagas/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Aviso } from '@/components/aviso';
import { api } from '@/lib/api';

/** AUTH-05: confirma o e-mail ao abrir o link (uso único). */
export function ConsumirLink() {
  const token = useSearchParams().get('token') ?? '';
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando');
  const enviado = useRef(false);

  useEffect(() => {
    if (enviado.current) return;
    enviado.current = true;
    api('/auth/verificar-email', { method: 'POST', corpo: { token } })
      .then(() => setEstado('ok'))
      .catch(() => setEstado('erro'));
  }, [token]);

  return (
    <Cartao>
      <h1 className="mb-4 text-xl font-semibold">Verificação de e-mail</h1>
      {estado === 'carregando' && <p>Confirmando…</p>}
      {estado === 'ok' && <Aviso tipo="sucesso">E-mail confirmado! Você já pode entrar.</Aviso>}
      {estado === 'erro' && <Aviso tipo="erro">Este link é inválido, já foi usado ou expirou. Entre para pedir um novo.</Aviso>}
      <Link href="/login" className="mt-4 inline-block text-sm text-indigo-700 hover:underline">
        Ir para o login
      </Link>
    </Cartao>
  );
}
