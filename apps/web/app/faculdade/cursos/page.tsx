'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Botao, Cartao } from '@vagas/ui';
import Link from 'next/link';
import { useState } from 'react';
import { Aviso } from '@/components/aviso';
import { FormCurso } from '@/components/faculdade/form-curso';
import type { Curso } from '@/components/faculdade/tipos';
import { api } from '@/lib/api';

/** FAC-03 */
export default function CursosFaculdade() {
  const qc = useQueryClient();
  const [abrir, setAbrir] = useState(false);
  const [aviso, setAviso] = useState('');
  const { data: cursos, isLoading } = useQuery({ queryKey: ['fac-cursos'], queryFn: () => api<Curso[]>('/faculdade/cursos') });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Cursos</h1>
        <Botao onClick={() => setAbrir((v) => !v)} aria-expanded={abrir}>
          Novo curso
        </Botao>
      </div>
      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {abrir && (
        <Cartao>
          <h2 className="mb-4 text-lg font-semibold">Novo curso</h2>
          <FormCurso
            aoSalvar={(c) => {
              setAviso(`Curso ${c.nome} criado com ${c.duracaoAnos * 2} semestres.`);
              setAbrir(false);
              qc.invalidateQueries({ queryKey: ['fac-cursos'] });
            }}
          />
        </Cartao>
      )}
      <Cartao className="overflow-x-auto p-0" role="region" aria-label="Cursos da faculdade" tabIndex={0}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Cursos da faculdade</caption>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Curso</th>
              <th className="px-4 py-3">Área</th>
              <th className="px-4 py-3">Duração</th>
              <th className="px-4 py-3">Turmas</th>
              <th className="px-4 py-3">Alunos</th>
              <th className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {cursos?.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <Link href={`/faculdade/cursos/${c.id}`} className="font-medium text-indigo-700 hover:underline">
                    {c.nome}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.area.nome}</td>
                <td className="px-4 py-3">{c.duracaoAnos} {c.duracaoAnos === 1 ? 'ano' : 'anos'}</td>
                <td className="px-4 py-3 tabular-nums">{c.totalTurmas}</td>
                <td className="px-4 py-3 tabular-nums">{c.totalAlunos}</td>
                <td className="px-4 py-3">{c.ativo ? 'Ativo' : 'Inativo'}</td>
              </tr>
            ))}
            {!isLoading && cursos?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Nenhum curso cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Cartao>
    </div>
  );
}
