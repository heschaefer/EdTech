'use client';

import { useQuery } from '@tanstack/react-query';
import { AreaTexto, Botao, Caixa, Campo, Cartao, Selecao } from '@vagas/ui';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Modalidade, ROTULOS_VAGA, TipoVaga, UFS } from '@vagas/contracts';
import { Aviso } from '@/components/aviso';
import { api, ErroApi } from '@/lib/api';
import { dataCivilSP } from '@/lib/formatar';
import type { Vaga } from './tipos';

type Form = {
  funcao: string;
  tipo: string;
  modalidade: string;
  areaIds: string[];
  atividades: string;
  requisitos: string;
  aCombinar: boolean;
  salarioMin: string;
  salarioMax: string;
  beneficios: string;
  processoSeletivo: string;
  cultura: string;
  cidade: string;
  uf: string;
  semestreMinimo: string;
  etapas: { id?: string; nome: string }[];
  prazo: string;
};

const vazio = (endereco?: { cidade: string; uf: string }): Form => ({
  funcao: '',
  tipo: 'ESTAGIO',
  modalidade: 'PRESENCIAL',
  areaIds: [],
  atividades: '',
  requisitos: '',
  aCombinar: false,
  salarioMin: '',
  salarioMax: '',
  beneficios: '',
  processoSeletivo: '',
  cultura: '',
  // EMP-03: cidade e UF vêm preenchidas com o endereço da empresa.
  cidade: endereco?.cidade ?? '',
  uf: endereco?.uf ?? '',
  semestreMinimo: '',
  etapas: [{ nome: 'Triagem de currículos' }, { nome: 'Entrevista' }],
  prazo: '',
});

const daVaga = (v: Vaga): Form => ({
  funcao: v.funcao,
  tipo: v.tipo,
  modalidade: v.modalidade,
  areaIds: v.areas.map((a) => a.id),
  atividades: v.atividades,
  requisitos: v.requisitos,
  aCombinar: v.salario.aCombinar,
  salarioMin: v.salario.min?.toString() ?? '',
  salarioMax: v.salario.max?.toString() ?? '',
  beneficios: v.beneficios,
  processoSeletivo: v.processoSeletivo,
  cultura: v.cultura,
  cidade: v.cidade ?? '',
  uf: v.uf ?? '',
  semestreMinimo: v.semestreMinimo?.toString() ?? '',
  etapas: v.etapas.map((e) => ({ id: e.id, nome: e.nome })),
  prazo: dataCivilSP(v.prazo),
});

/** Campos do formulário com nomes diferentes dos da API. */
const CAMPO_DA_API: Record<string, string> = { 'salario.min': 'salarioMin', 'salario.max': 'salarioMax' };

/** EMP-03 (criar) e EMP-04 (editar, com controle otimista pela versão). */
export function FormVaga({ vaga, aoSalvar }: { vaga?: Vaga; aoSalvar: (v: Vaga) => void }) {
  const { data: areas = [] } = useQuery({ queryKey: ['areas'], queryFn: () => api<{ id: string; nome: string }[]>('/areas') });
  const { data: empresa } = useQuery({ queryKey: ['empresa-perfil'], queryFn: () => api<{ cidade: string; uf: string }>('/empresa/me'), enabled: !vaga });
  const [erro, setErro] = useState('');
  const [conflitoVersao, setConflitoVersao] = useState(false);
  const { register, control, handleSubmit, watch, setError, formState } = useForm<Form>({
    values: vaga ? daVaga(vaga) : empresa ? vazio(empresa) : undefined,
    defaultValues: vazio(),
  });
  const etapas = useFieldArray({ control, name: 'etapas' });
  const modalidade = watch('modalidade');
  const aCombinar = watch('aCombinar');
  const err = formState.errors;

  const enviar = async (f: Form) => {
    setErro('');
    setConflitoVersao(false);
    const corpo = {
      funcao: f.funcao,
      tipo: f.tipo,
      modalidade: f.modalidade,
      areaIds: Array.isArray(f.areaIds) ? f.areaIds : [],
      atividades: f.atividades,
      requisitos: f.requisitos,
      salario: f.aCombinar ? { aCombinar: true } : { aCombinar: false, min: f.salarioMin || null, max: f.salarioMax || null },
      beneficios: f.beneficios,
      processoSeletivo: f.processoSeletivo,
      cultura: f.cultura,
      cidade: f.cidade,
      uf: f.uf,
      semestreMinimo: f.semestreMinimo,
      etapas: f.etapas.map((e) => (e.id ? { id: e.id, nome: e.nome } : { nome: e.nome })),
      ...(vaga ? { versao: vaga.versao } : { prazo: f.prazo }),
    };
    try {
      aoSalvar(await api<Vaga>(vaga ? `/empresa/vagas/${vaga.id}` : '/empresa/vagas', { method: vaga ? 'PATCH' : 'POST', corpo }));
    } catch (e) {
      if (!(e instanceof ErroApi)) return setErro('Não foi possível salvar. Tente novamente.');
      if (e.status === 409 && e.problema.versaoAtual !== undefined) return setConflitoVersao(true);
      for (const { campo, mensagem } of e.problema.errors ?? []) setError((CAMPO_DA_API[campo] ?? campo) as keyof Form, { type: 'server', message: mensagem });
      setErro(e.problema.errors?.length ? 'Revise os campos destacados.' : e.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-6" noValidate>
      <Cartao>
        <h2 className="mb-4 text-lg font-semibold">A vaga</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Campo rotulo="Função" {...register('funcao')} erro={err.funcao?.message} /></div>
          <Selecao rotulo="Tipo de vaga" {...register('tipo')}>
            {TipoVaga.options.map((t) => <option key={t} value={t}>{ROTULOS_VAGA.tipo[t]}</option>)}
          </Selecao>
          <Selecao rotulo="Modalidade" {...register('modalidade')}>
            {Modalidade.options.map((m) => <option key={m} value={m}>{ROTULOS_VAGA.modalidade[m]}</option>)}
          </Selecao>
          {modalidade !== 'REMOTO' && (
            <>
              <Campo rotulo="Cidade da vaga" {...register('cidade')} erro={err.cidade?.message} />
              <Selecao rotulo="UF da vaga" {...register('uf')} erro={err.uf?.message}>
                <option value="">—</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </Selecao>
            </>
          )}
          <fieldset className="sm:col-span-2" aria-describedby={err.areaIds ? 'areas-erro' : undefined}>
            <legend className="mb-2 text-sm font-medium text-slate-800">Áreas de formação (os alunos dessas áreas verão a vaga)</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {areas.map((a) => <Caixa key={a.id} rotulo={a.nome} value={a.id} {...register('areaIds')} />)}
            </div>
            {err.areaIds && <p id="areas-erro" className="mt-1 text-sm text-red-700">{err.areaIds.message}</p>}
          </fieldset>
          <Selecao rotulo="Semestre mínimo (opcional)" {...register('semestreMinimo')} erro={err.semestreMinimo?.message}>
            <option value="">Sem exigência</option>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}º semestre</option>)}
          </Selecao>
          {!vaga && <Campo rotulo="Prazo para candidaturas" type="date" {...register('prazo')} erro={err.prazo?.message} />}
        </div>
      </Cartao>

      <Cartao>
        <h2 className="mb-4 text-lg font-semibold">Descrição</h2>
        <div className="grid gap-4">
          <AreaTexto rotulo="Atividades do dia a dia" maxLength={5000} {...register('atividades')} erro={err.atividades?.message} />
          <AreaTexto rotulo="O que se espera (formação, experiência)" maxLength={5000} {...register('requisitos')} erro={err.requisitos?.message} />
          <AreaTexto rotulo="Benefícios" rows={3} maxLength={5000} {...register('beneficios')} erro={err.beneficios?.message} />
          <AreaTexto rotulo="Cultura da empresa" rows={3} maxLength={5000} {...register('cultura')} erro={err.cultura?.message} />
        </div>
      </Cartao>

      <Cartao>
        <h2 className="mb-4 text-lg font-semibold">Salário</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3"><Caixa rotulo="Salário a combinar" {...register('aCombinar')} /></div>
          {!aCombinar && (
            <>
              <Campo rotulo="Salário mínimo (R$)" type="number" min={0} step="0.01" {...register('salarioMin')} erro={err.salarioMin?.message} />
              <Campo rotulo="Salário máximo (R$)" type="number" min={0} step="0.01" {...register('salarioMax')} erro={err.salarioMax?.message} />
            </>
          )}
        </div>
      </Cartao>

      <Cartao>
        <h2 className="mb-4 text-lg font-semibold">Processo seletivo</h2>
        <AreaTexto rotulo="Como funciona o processo seletivo" rows={3} maxLength={5000} {...register('processoSeletivo')} erro={err.processoSeletivo?.message} />
        <h3 className="mb-2 mt-4 font-medium">Etapas (na ordem)</h3>
        <ol aria-label="Etapas do processo seletivo" className="flex flex-col gap-2">
          {etapas.fields.map((f, i) => (
            <li key={f.id} className="flex flex-wrap items-end gap-2">
              <div className="grow">
                <Campo rotulo={`Etapa ${i + 1}`} {...register(`etapas.${i}.nome`)} erro={err.etapas?.[i]?.nome?.message} />
              </div>
              <Botao type="button" variante="secundario" disabled={i === 0} onClick={() => etapas.move(i, i - 1)} aria-label={`Subir etapa ${i + 1}`}>↑</Botao>
              <Botao type="button" variante="secundario" disabled={i === etapas.fields.length - 1} onClick={() => etapas.move(i, i + 1)} aria-label={`Descer etapa ${i + 1}`}>↓</Botao>
              <Botao type="button" variante="secundario" disabled={etapas.fields.length === 1} onClick={() => etapas.remove(i)} aria-label={`Remover etapa ${i + 1}`}>Remover</Botao>
            </li>
          ))}
        </ol>
        {err.etapas?.message && <p className="mt-1 text-sm text-red-700">{err.etapas.message}</p>}
        <div className="mt-3">
          <Botao type="button" variante="secundario" onClick={() => etapas.append({ nome: '' })}>Adicionar etapa</Botao>
        </div>
      </Cartao>

      {conflitoVersao && (
        <Aviso tipo="erro">
          Esta vaga foi alterada por outra pessoa enquanto você editava.{' '}
          <button type="button" className="underline" onClick={() => window.location.reload()}>Recarregar a versão atual</button>
        </Aviso>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div>
        <Botao type="submit" disabled={formState.isSubmitting}>{vaga ? 'Salvar alterações' : 'Publicar vaga'}</Botao>
      </div>
    </form>
  );
}
