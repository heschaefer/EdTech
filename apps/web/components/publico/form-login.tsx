'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Botao, Campo, Cartao } from '@vagas/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PAINEL_POR_PAPEL, type Me } from '@vagas/contracts';
import { Aviso } from '@/components/aviso';
import { api, ErroApi, renovarSessao } from '@/lib/api';

const schema = z.object({
  email: z.string().trim().email('E-mail inválido'),
  senha: z.string().min(1, 'Informe a senha'),
  totp: z.string().optional(),
});
type Dados = z.infer<typeof schema>;

/** Só aceita destinos internos (evita open redirect). */
const destinoSeguro = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : null);

export function FormLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const next = destinoSeguro(params.get('next'));
  const [erro, setErro] = useState('');
  const [precisa2fa, setPrecisa2fa] = useState(false);
  const [podeReenviar, setPodeReenviar] = useState(false);
  const [reenviado, setReenviado] = useState(false);
  const { register, handleSubmit, getValues, formState } = useForm<Dados>({ resolver: zodResolver(schema) });

  // Access token expirado mas refresh válido: renova e segue sem pedir a senha de novo (AUTH-02).
  useEffect(() => {
    if (!document.cookie.includes('csrf=')) return;
    renovarSessao().then(async (ok) => {
      if (!ok) return;
      const me = await api<Me>('/me', { semRenovar: true }).catch(() => null);
      if (me) router.replace(next ?? PAINEL_POR_PAPEL[me.papel]);
    });
  }, [next, router]);

  const enviar = async ({ email, senha, totp }: Dados) => {
    setErro('');
    setPodeReenviar(false);
    try {
      const r = await api<{ painel: string }>('/auth/login', { method: 'POST', corpo: { email, senha, ...(totp ? { totp } : {}) } });
      router.replace(next ?? r.painel);
      router.refresh();
    } catch (e) {
      if (!(e instanceof ErroApi)) return setErro('Não foi possível entrar. Tente novamente.');
      if (e.problema.requer2fa) setPrecisa2fa(true);
      if (e.problema.podeReenviar) setPodeReenviar(true);
      setErro(e.status === 429 ? 'Muitas tentativas. Aguarde um minuto e tente de novo.' : e.message);
    }
  };

  const reenviar = async () => {
    await api('/auth/reenviar-verificacao', { method: 'POST', corpo: { email: getValues('email') } }).catch(() => undefined);
    setReenviado(true);
  };

  return (
    <Cartao>
      <h1 className="mb-4 text-xl font-semibold">Entrar</h1>
      <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4" noValidate>
        <Campo rotulo="E-mail" type="email" autoComplete="username" {...register('email')} erro={formState.errors.email?.message} />
        <Campo rotulo="Senha" type="password" autoComplete="current-password" {...register('senha')} erro={formState.errors.senha?.message} />
        {precisa2fa && (
          <Campo rotulo="Código do autenticador" inputMode="numeric" autoComplete="one-time-code" maxLength={6} {...register('totp')} />
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {podeReenviar &&
          (reenviado ? (
            <Aviso tipo="sucesso">Se houver um cadastro pendente, enviamos um novo link.</Aviso>
          ) : (
            <Botao type="button" variante="secundario" onClick={reenviar}>
              Reenviar link de verificação
            </Botao>
          ))}
        <Botao type="submit" disabled={formState.isSubmitting}>
          Entrar
        </Botao>
      </form>
      <div className="mt-4 flex flex-col gap-1 text-sm">
        <Link href="/senha/esqueci" className="text-indigo-700 hover:underline">
          Esqueci a senha
        </Link>
        <Link href="/cadastro/aluno" className="text-indigo-700 hover:underline">
          Sou aluno e quero criar minha conta
        </Link>
        <Link href="/cadastro/empresa" className="text-indigo-700 hover:underline">
          Sou empresa e quero publicar vagas
        </Link>
      </div>
    </Cartao>
  );
}
