'use client';

import { Botao, Campo, Cartao } from '@vagas/ui';
import Link from 'next/link';
import { useState } from 'react';
import type { MeAluno } from '@/components/aluno/tipos';
import { Aviso } from '@/components/aviso';
import { useQuery } from '@tanstack/react-query';
import { mensagemDeErro, type Mensagem } from '@/lib/acoes';
import { api } from '@/lib/api';

const MOTIVOS: Record<string, string> = {
  DESLIGADO_PELA_FACULDADE: 'Sua faculdade desligou sua conta.',
  FACULDADE_INATIVA: 'Sua faculdade deixou de usar a plataforma.',
};

/** ALU-12: o link de confirmação vai para o e-mail institucional da nova faculdade. */
export default function TrocarFaculdade() {
  const { data: me } = useQuery({ queryKey: ['aluno-me'], queryFn: () => api<MeAluno>('/alunos/me') });
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<Mensagem>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api('/alunos/me/troca-faculdade', { method: 'POST', corpo: { email } });
      setMsg({ tipo: 'sucesso', texto: `Enviamos um link de confirmação para ${email}. Abra-o para escolher curso, turma e semestre.` });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: mensagemDeErro(err) });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Trocar de faculdade</h1>
      {me?.status === 'INATIVO' && (
        <Aviso tipo="info">
          Sua conta está inativa. {MOTIVOS[me.motivoInativacao ?? ''] ?? ''} Se você entrou em outra faculdade que usa a plataforma, confirme o novo
          e-mail institucional para reativar a conta. Seu{' '}
          <Link href="/aluno/candidaturas" className="underline">
            histórico de candidaturas
          </Link>{' '}
          continua disponível.
        </Aviso>
      )}
      <Cartao>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <Campo rotulo="E-mail institucional da nova faculdade" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
          <div>
            <Botao type="submit" disabled={enviando || !email}>
              Enviar link de confirmação
            </Botao>
          </div>
        </form>
      </Cartao>
    </div>
  );
}
