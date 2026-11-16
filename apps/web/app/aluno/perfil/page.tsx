'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Botao, Campo, Cartao } from '@vagas/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { atualizarAlunoSchema, trocarSenhaSchema, vinculoSchema } from '@vagas/contracts';
import { CamposVinculo } from '@/components/aluno/campos-vinculo';
import type { CursoOpcao, MeAluno } from '@/components/aluno/tipos';
import { Aviso } from '@/components/aviso';
import type { Mensagem } from '@/lib/acoes';
import { api } from '@/lib/api';
import { formatarTelefone, nomeTurma } from '@/lib/formatar';
import { aplicarErrosApi } from '@/lib/formulario';

/** ALU-02 e ALU-03 */
export default function PerfilAluno() {
  const { data: me } = useQuery({ queryKey: ['aluno-me'], queryFn: () => api<MeAluno>('/alunos/me') });
  if (!me) return <p>Carregando…</p>;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Meu perfil</h1>
      <DadosPessoais me={me} />
      <Vinculo me={me} />
      <TrocarSenha />
    </div>
  );
}

function useSalvo() {
  const qc = useQueryClient();
  return (me: MeAluno) => {
    qc.setQueryData(['aluno-me'], me);
    qc.invalidateQueries({ queryKey: ['me'] });
  };
}

function DadosPessoais({ me }: { me: MeAluno }) {
  const salvo = useSalvo();
  const [msg, setMsg] = useState<Mensagem>(null);
  type Dados = z.input<typeof atualizarAlunoSchema>;
  const { register, handleSubmit, setError, setValue, formState } = useForm<Dados>({
    resolver: zodResolver(atualizarAlunoSchema),
    defaultValues: { nome: me.nome, telefone: formatarTelefone(me.telefone) },
  });
  const enviar = async (d: Dados) => {
    try {
      salvo(await api<MeAluno>('/alunos/me', { method: 'PATCH', corpo: d }));
      setMsg({ tipo: 'sucesso', texto: 'Dados pessoais salvos.' });
    } catch (e) {
      const texto = aplicarErrosApi(e, setError);
      setMsg(texto ? { tipo: 'erro', texto } : null);
    }
  };
  return (
    <Cartao>
      <h2 className="mb-4 text-lg font-semibold">Dados pessoais</h2>
      <form onSubmit={handleSubmit(enviar)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Campo rotulo="Nome completo" {...register('nome')} erro={formState.errors.nome?.message} />
        <Campo rotulo="Telefone" type="tel" {...register('telefone', { onChange: (e) => setValue('telefone', formatarTelefone(e.target.value)) })} erro={formState.errors.telefone?.message} />
        <Campo rotulo="E-mail institucional" value={me.email} readOnly className="bg-slate-100" />
        <Campo rotulo="CPF" value={me.cpf} readOnly className="bg-slate-100" />
        <p className="text-sm text-slate-600 sm:col-span-2">
          O CPF não pode ser alterado. O e-mail muda só ao{' '}
          <Link href="/aluno/trocar-faculdade" className="text-indigo-700 underline">
            trocar de faculdade
          </Link>
          .
        </p>
        {msg && <div className="sm:col-span-2"><Aviso tipo={msg.tipo}>{msg.texto}</Aviso></div>}
        <div className="sm:col-span-2">
          <Botao type="submit" disabled={formState.isSubmitting}>Salvar dados pessoais</Botao>
        </div>
      </form>
    </Cartao>
  );
}

function Vinculo({ me }: { me: MeAluno }) {
  const salvo = useSalvo();
  const [msg, setMsg] = useState<Mensagem>(null);
  const { data: cursos = [] } = useQuery({ queryKey: ['aluno-opcoes-vinculo'], queryFn: () => api<CursoOpcao[]>('/alunos/me/vinculo/opcoes') });
  type Dados = z.input<typeof vinculoSchema>;
  const { register, handleSubmit, setError, watch, formState } = useForm<Dados>({
    resolver: zodResolver(vinculoSchema),
    values: { cursoId: me.curso.id, turmaId: me.turma.id, semestreAtual: me.semestreAtual },
  });
  const enviar = async (d: Dados) => {
    try {
      salvo(await api<MeAluno>('/alunos/me/vinculo', { method: 'PATCH', corpo: d }));
      setMsg({ tipo: 'sucesso', texto: 'Vínculo acadêmico atualizado.' });
    } catch (e) {
      const texto = aplicarErrosApi(e, setError);
      setMsg(texto ? { tipo: 'erro', texto } : null);
    }
  };
  return (
    <Cartao>
      <h2 className="mb-1 text-lg font-semibold">Vínculo acadêmico</h2>
      <p className="mb-4 text-sm text-slate-600">
        {me.faculdade.nome} · {me.curso.nome} ({me.curso.area}) · turma {nomeTurma(me.turma)} · {me.semestreAtual}º semestre
      </p>
      {cursos.length > 0 && (
        <form onSubmit={handleSubmit(enviar)} className="grid gap-4 sm:grid-cols-3" noValidate>
          <CamposVinculo cursos={cursos} register={register} watch={watch} errors={formState.errors} />
          {msg && <div className="sm:col-span-3"><Aviso tipo={msg.tipo}>{msg.texto}</Aviso></div>}
          <div className="sm:col-span-3">
            <Botao type="submit" disabled={formState.isSubmitting}>Salvar vínculo</Botao>
          </div>
        </form>
      )}
    </Cartao>
  );
}

function TrocarSenha() {
  const [msg, setMsg] = useState<Mensagem>(null);
  type Dados = z.input<typeof trocarSenhaSchema>;
  const { register, handleSubmit, setError, reset, formState } = useForm<Dados>({ resolver: zodResolver(trocarSenhaSchema), criteriaMode: 'all' });
  const errosSenha = Object.values(formState.errors.senha?.types ?? {}).flat().map(String);
  const enviar = async (d: Dados) => {
    try {
      await api('/alunos/me/senha', { method: 'PATCH', corpo: d });
      reset();
      setMsg({ tipo: 'sucesso', texto: 'Senha alterada. As outras sessões foram encerradas.' });
    } catch (e) {
      const texto = aplicarErrosApi(e, setError);
      setMsg(texto ? { tipo: 'erro', texto } : null);
    }
  };
  return (
    <Cartao>
      <h2 className="mb-4 text-lg font-semibold">Trocar senha</h2>
      <form onSubmit={handleSubmit(enviar)} className="grid gap-4 sm:grid-cols-3" noValidate>
        <Campo rotulo="Senha atual" type="password" autoComplete="current-password" {...register('senhaAtual')} erro={formState.errors.senhaAtual?.message} />
        <Campo rotulo="Nova senha" type="password" autoComplete="new-password" {...register('senha')} erro={errosSenha.length ? errosSenha : formState.errors.senha?.message} />
        <Campo rotulo="Confirmação da nova senha" type="password" autoComplete="new-password" {...register('confirmacao')} erro={formState.errors.confirmacao?.message} />
        {msg && <div className="sm:col-span-3"><Aviso tipo={msg.tipo}>{msg.texto}</Aviso></div>}
        <div className="sm:col-span-3">
          <Botao type="submit" disabled={formState.isSubmitting}>Trocar senha</Botao>
        </div>
      </form>
    </Cartao>
  );
}
