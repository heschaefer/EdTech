'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { AreaTexto, Botao, Campo, Selecao } from '@vagas/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { criarCursoSchema, DURACAO_MAX_ANOS, DURACAO_MIN_ANOS } from '@vagas/contracts';
import { Aviso } from '@/components/aviso';
import { api } from '@/lib/api';
import { aplicarErrosApi } from '@/lib/formulario';
import type { Area, Curso } from './tipos';

type Dados = z.input<typeof criarCursoSchema>;

/** FAC-03: criar e editar curso (nome, área do catálogo, duração em anos e ementa). */
export function FormCurso({ curso, aoSalvar }: { curso?: Curso; aoSalvar: (c: Curso) => void }) {
  const [erro, setErro] = useState('');
  const { data: areas = [] } = useQuery({ queryKey: ['areas'], queryFn: () => api<Area[]>('/areas') });
  const { register, handleSubmit, setError, formState } = useForm<Dados>({
    resolver: zodResolver(criarCursoSchema),
    defaultValues: curso ? { nome: curso.nome, areaId: curso.area.id, duracaoAnos: curso.duracaoAnos, ementa: curso.ementa } : { duracaoAnos: 4 },
  });

  const enviar = async (dados: Dados) => {
    setErro('');
    if (curso && Number(dados.duracaoAnos) < curso.duracaoAnos) {
      const ok = confirm(`Reduzir para ${dados.duracaoAnos} ano(s) remove os semestres excedentes e as aulas cadastradas neles. Continuar?`);
      if (!ok) return;
    }
    try {
      const salvo = curso
        ? await api<Curso>(`/faculdade/cursos/${curso.id}`, { method: 'PATCH', corpo: dados })
        : await api<Curso>('/faculdade/cursos', { method: 'POST', corpo: dados });
      aoSalvar(salvo);
    } catch (e) {
      setErro(aplicarErrosApi(e, setError));
    }
  };

  // A área atual continua na lista mesmo que tenha sido inativada depois.
  const opcoes = curso && !areas.some((a) => a.id === curso.area.id) ? [...areas, curso.area] : areas;

  return (
    <form onSubmit={handleSubmit(enviar)} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Campo rotulo="Nome do curso" {...register('nome')} erro={formState.errors.nome?.message} />
      <Selecao rotulo="Área de formação" {...register('areaId')} erro={formState.errors.areaId?.message}>
        <option value="">Selecione…</option>
        {opcoes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nome}
          </option>
        ))}
      </Selecao>
      <Campo
        rotulo="Duração (anos)"
        type="number"
        min={DURACAO_MIN_ANOS}
        max={DURACAO_MAX_ANOS}
        {...register('duracaoAnos')}
        erro={formState.errors.duracaoAnos?.message}
      />
      <div className="sm:col-span-2">
        <AreaTexto rotulo="Ementa" {...register('ementa')} erro={formState.errors.ementa?.message} />
      </div>
      {erro && (
        <div className="sm:col-span-2">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}
      <div className="sm:col-span-2">
        <Botao type="submit" disabled={formState.isSubmitting}>
          {curso ? 'Salvar curso' : 'Criar curso'}
        </Botao>
      </div>
    </form>
  );
}
