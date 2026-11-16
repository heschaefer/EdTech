'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Botao, Campo, Cartao } from '@vagas/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { criarFaculdadeSchema, type Pagina } from '@vagas/contracts';
import { Aviso } from '@/components/aviso';
import { formatarCnpj, type Faculdade } from '@/components/admin/tipos';
import { api } from '@/lib/api';
import { aplicarErrosApi } from '@/lib/formulario';

// No formulário os domínios vêm num único campo, separados por vírgula ou espaço.
const formSchema = criarFaculdadeSchema.omit({ dominios: true }).extend({ dominios: z.string().min(1, 'Informe ao menos um domínio') });
type Form = z.input<typeof formSchema>;

/** ADM-01 */
export default function FaculdadesAdmin() {
  const qc = useQueryClient();
  const [pagina, setPagina] = useState(1);
  const [abrirForm, setAbrirForm] = useState(false);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const lista = useQuery({ queryKey: ['admin-faculdades', pagina], queryFn: () => api<Pagina<Faculdade>>(`/admin/faculdades?page=${pagina}&pageSize=20`) });
  const { register, handleSubmit, setError, reset, formState } = useForm<Form>({ resolver: zodResolver(formSchema) });

  const criar = useMutation({
    mutationFn: (d: Form) => api<Faculdade>('/admin/faculdades', { method: 'POST', corpo: { ...d, dominios: d.dominios.split(/[\s,;]+/).filter(Boolean) } }),
    onSuccess: (f) => {
      setAviso(`Faculdade ${f.nomeFantasia} criada; o convite foi enviado para ${f.email}.`);
      setAbrirForm(false);
      reset();
      qc.invalidateQueries({ queryKey: ['admin-faculdades'] });
    },
    onError: (e) => setErro(aplicarErrosApi(e, (campo, err) => setError((String(campo).startsWith('dominios') ? 'dominios' : campo) as keyof Form, err))),
  });

  const total = lista.data?.meta.total ?? 0;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Faculdades</h1>
        <Botao onClick={() => setAbrirForm((v) => !v)} aria-expanded={abrirForm}>
          Nova faculdade
        </Botao>
      </div>
      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}

      {abrirForm && (
        <Cartao>
          <h2 className="mb-4 text-lg font-semibold">Nova faculdade</h2>
          <form onSubmit={handleSubmit((d) => (setErro(''), criar.mutate(d)))} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Campo rotulo="CNPJ" {...register('cnpj')} erro={formState.errors.cnpj?.message} />
            <Campo rotulo="Razão social" {...register('razaoSocial')} erro={formState.errors.razaoSocial?.message} />
            <Campo rotulo="Nome fantasia" {...register('nomeFantasia')} erro={formState.errors.nomeFantasia?.message} />
            <Campo rotulo="Telefone" type="tel" {...register('telefone')} erro={formState.errors.telefone?.message} />
            <Campo rotulo="E-mail" type="email" {...register('email')} erro={formState.errors.email?.message} />
            <Campo rotulo="Domínios estudantis" placeholder="aluno.unifoo.edu.br" {...register('dominios')} erro={formState.errors.dominios?.message} />
            {erro && (
              <div className="sm:col-span-2">
                <Aviso tipo="erro">{erro}</Aviso>
              </div>
            )}
            <div className="sm:col-span-2">
              <Botao type="submit" disabled={criar.isPending}>
                Criar e enviar convite
              </Botao>
            </div>
          </form>
        </Cartao>
      )}

      <Cartao className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Faculdades cadastradas</caption>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">CNPJ</th>
              <th className="px-4 py-3">Domínios</th>
              <th className="px-4 py-3">Alunos</th>
              <th className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {lista.data?.data.map((f) => (
              <tr key={f.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <Link href={`/admin/faculdades/${f.id}`} className="font-medium text-indigo-700 hover:underline">
                    {f.nomeFantasia}
                  </Link>
                </td>
                <td className="px-4 py-3 tabular-nums">{formatarCnpj(f.cnpj)}</td>
                <td className="px-4 py-3">{f.dominios.join(', ')}</td>
                <td className="px-4 py-3 tabular-nums">{f.totalAlunos}</td>
                <td className="px-4 py-3">{!f.ativa ? 'Inativa' : f.conviteAceito ? 'Ativa' : 'Convite pendente'}</td>
              </tr>
            ))}
            {lista.data?.data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma faculdade cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Cartao>
      {total > 20 && (
        <nav aria-label="Paginação" className="flex items-center gap-3 text-sm">
          <Botao variante="secundario" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </Botao>
          <span>Página {pagina} de {Math.ceil(total / 20)}</span>
          <Botao variante="secundario" disabled={pagina * 20 >= total} onClick={() => setPagina((p) => p + 1)}>
            Próxima
          </Botao>
        </nav>
      )}
    </div>
  );
}
