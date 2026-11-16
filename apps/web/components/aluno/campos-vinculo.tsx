'use client';

import { Selecao } from '@vagas/ui';
import type { FieldErrors, UseFormRegister, UseFormWatch } from 'react-hook-form';
import { nomeTurma } from '@/lib/formatar';
import type { CursoOpcao } from './tipos';

type Vinculo = { cursoId: string; turmaId: string; semestreAtual: number | string };

/** Curso → turmas do curso → semestre de 1 a duração × 2 (RN-05). Usado no cadastro, no perfil e na troca de faculdade. */
export function CamposVinculo<T extends Vinculo>({
  cursos,
  register,
  watch,
  errors,
}: {
  cursos: CursoOpcao[];
  register: UseFormRegister<T>;
  watch: UseFormWatch<T>;
  errors: FieldErrors<T>;
}) {
  const reg = register as unknown as UseFormRegister<Vinculo>;
  const err = errors as FieldErrors<Vinculo>;
  const curso = cursos.find((c) => c.id === (watch as unknown as UseFormWatch<Vinculo>)('cursoId'));
  return (
    <>
      <Selecao rotulo="Curso" {...reg('cursoId')} erro={err.cursoId?.message}>
        <option value="">Selecione…</option>
        {cursos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </Selecao>
      <Selecao rotulo="Turma (ano/período de ingresso)" {...reg('turmaId')} erro={err.turmaId?.message} disabled={!curso}>
        <option value="">Selecione…</option>
        {curso?.turmas.map((t) => (
          <option key={t.id} value={t.id}>
            {nomeTurma(t)}
          </option>
        ))}
      </Selecao>
      <Selecao rotulo="Semestre atual" {...reg('semestreAtual')} erro={err.semestreAtual?.message} disabled={!curso}>
        <option value="">Selecione…</option>
        {Array.from({ length: (curso?.duracaoAnos ?? 0) * 2 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {i + 1}º semestre
          </option>
        ))}
      </Selecao>
    </>
  );
}
