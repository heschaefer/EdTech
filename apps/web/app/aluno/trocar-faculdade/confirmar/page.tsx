'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Botao, Campo, Cartao } from '@vagas/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { vinculoSchema } from '@vagas/contracts';
import { CamposVinculo } from '@/components/aluno/campos-vinculo';
import type { OpcoesFaculdade } from '@/components/aluno/tipos';
import { Aviso } from '@/components/aviso';
import { api, renovarSessao } from '@/lib/api';
import { aplicarErrosApi } from '@/lib/formulario';

type Dados = z.input<typeof vinculoSchema>;

export default function Pagina() {
  return (
    <Suspense>
      <ConfirmarTroca />
    </Suspense>
  );
}

/** ALU-12: com o link confirmado, o aluno escolhe curso, turma e semestre e a conta volta a ficar ativa. */
function ConfirmarTroca() {
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const { data, isError } = useQuery({
    queryKey: ['troca-faculdade', token],
    queryFn: () => api<OpcoesFaculdade & { email: string }>(`/alunos/me/troca-faculdade?token=${encodeURIComponent(token)}`),
  });
  const { register, handleSubmit, setError, watch, formState } = useForm<Dados>({ resolver: zodResolver(vinculoSchema) });

  const enviar = async (d: Dados) => {
    setErro('');
    try {
      await api('/alunos/me/troca-faculdade/confirmar', { method: 'POST', corpo: { ...d, token } });
      await renovarSessao(); // o access token novo já sai com o status ATIVO
      await qc.invalidateQueries();
      router.replace('/aluno');
      router.refresh();
    } catch (e) {
      setErro(aplicarErrosApi(e, setError));
    }
  };

  if (isError) return <Aviso tipo="erro">Este link é inválido, já foi usado ou expirou. Peça um novo em “Trocar de faculdade”.</Aviso>;
  if (!data) return <p>Carregando…</p>;

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Confirmar troca de faculdade</h1>
      <Cartao>
        <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4" noValidate>
          <Campo rotulo="Nova faculdade" value={data.faculdade.nome} readOnly className="bg-slate-100" />
          <Campo rotulo="Novo e-mail institucional" value={data.email} readOnly className="bg-slate-100" />
          <CamposVinculo cursos={data.cursos} register={register} watch={watch} errors={formState.errors} />
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <div>
            <Botao type="submit" disabled={formState.isSubmitting}>
              Confirmar troca
            </Botao>
          </div>
        </form>
      </Cartao>
    </div>
  );
}
