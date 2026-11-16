'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Botao, Cartao } from '@vagas/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { Aviso } from '@/components/aviso';
import { FormCurso } from '@/components/faculdade/form-curso';
import { Grade } from '@/components/faculdade/grade';
import { Turmas } from '@/components/faculdade/turmas';
import type { Curso } from '@/components/faculdade/tipos';
import { useAcao } from '@/lib/acoes';
import { api } from '@/lib/api';

/** FAC-03 a FAC-05 */
export default function CursoFaculdade({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const chave = ['fac-curso', id];
  const { data: curso, isLoading, isError } = useQuery({ queryKey: chave, queryFn: () => api<Curso>(`/faculdade/cursos/${id}`) });
  const { mensagem, setMensagem, executar } = useAcao(chave, ['fac-cursos'], ['fac-semestres', id]);
  const [versaoForm, setVersaoForm] = useState(0);

  if (isLoading) return <p>Carregando…</p>;
  if (isError || !curso) return <Aviso tipo="erro">Curso não encontrado.</Aviso>;

  const excluir = async () => {
    if (!confirm(`Excluir o curso ${curso.nome}, com toda a grade e as turmas?`)) return;
    if (await executar(() => api(`/faculdade/cursos/${id}`, { method: 'DELETE' }), 'Curso excluído.')) router.replace('/faculdade/cursos');
  };

  return (
    <div className="flex flex-col gap-6">
      <Link href="/faculdade/cursos" className="text-sm text-indigo-700 hover:underline">
        ← Cursos
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {curso.nome} {!curso.ativo && <span className="text-base font-normal text-slate-500">(inativo)</span>}
        </h1>
        <div className="flex gap-2">
          <Botao
            variante="secundario"
            onClick={() => executar(() => api(`/faculdade/cursos/${id}`, { method: 'PATCH', corpo: { ativo: !curso.ativo } }), curso.ativo ? 'Curso inativado: some dos novos cadastros e continua para quem já está nele.' : 'Curso reativado.')}
          >
            {curso.ativo ? 'Inativar curso' : 'Reativar curso'}
          </Botao>
          {/* RN-25: com alunos, só inativa. */}
          {curso.totalAlunos === 0 && (
            <Botao variante="perigo" onClick={excluir}>
              Excluir curso
            </Botao>
          )}
        </div>
      </div>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      <Cartao>
        <h2 className="mb-4 text-lg font-semibold">Dados do curso</h2>
        <FormCurso
          key={versaoForm}
          curso={curso}
          aoSalvar={(c) => {
            setMensagem({ tipo: 'sucesso', texto: `Curso salvo: ${c.duracaoAnos * 2} semestres.` });
            qc.setQueryData(chave, c);
            qc.invalidateQueries({ queryKey: ['fac-semestres', id] });
            qc.invalidateQueries({ queryKey: ['fac-cursos'] });
            setVersaoForm((v) => v + 1);
          }}
        />
      </Cartao>

      <Grade cursoId={id} />
      <Turmas cursoId={id} nomeCurso={curso.nome} />
    </div>
  );
}
