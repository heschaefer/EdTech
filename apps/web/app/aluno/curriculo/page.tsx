'use client';

import { useQuery } from '@tanstack/react-query';
import { EditorCurriculo, type CurriculoApi } from '@/components/aluno/editor-curriculo';
import { api } from '@/lib/api';

/** ALU-04 */
export default function CurriculoAluno() {
  const { data } = useQuery({ queryKey: ['aluno-curriculo'], queryFn: () => api<CurriculoApi>('/alunos/me/curriculo') });
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Meu currículo</h1>
        <p className="text-sm text-slate-600">Sem foto, idade, estado civil, gênero ou documentos: esses dados não ajudam na seleção.</p>
      </div>
      {data ? <EditorCurriculo dados={data} /> : <p>Carregando…</p>}
    </div>
  );
}
