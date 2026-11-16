'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AreaTexto, Botao, Caixa, Campo, Cartao, Selecao } from '@vagas/ui';
import { useState, type ReactNode } from 'react';
import { useFieldArray, useForm, type ArrayPath, type Control, type FieldArray } from 'react-hook-form';
import {
  DISPONIBILIDADES,
  NIVEIS_FORMACAO,
  NIVEIS_IDIOMA,
  ROTULOS,
  SITUACOES_FORMACAO,
  TIPOS_EXPERIENCIA,
  TIPOS_LINK,
  UFS,
} from '@vagas/contracts';
import { Aviso } from '@/components/aviso';
import type { Mensagem } from '@/lib/acoes';
import { api, ErroApi } from '@/lib/api';
import { etiquetas } from '@/lib/formatar';

export type CurriculoApi = {
  dadosPessoais: { nome: string; email: string; telefone: string };
  graduacaoAtual: { faculdade: string; curso: string; semestre: number; previsaoConclusao: { ano: number; periodo: number } };
  curriculo: {
    objetivo: string | null;
    resumo: string | null;
    cidade: string | null;
    uf: string | null;
    links: { tipo: string; url: string }[];
    habilidadesTecnicas: string[];
    habilidadesComportamentais: string[];
    disponibilidade: string[];
    informacoesAdicionais: string | null;
    formacoes: { nivel: string; curso: string; instituicao: string; inicio: string | null; conclusao: string | null; situacao: string }[];
    experiencias: { tipo: string; organizacao: string; cargo: string; inicio: string; fim: string | null; descricao: string | null }[];
    cursos: { nome: string; instituicao: string; cargaHoraria: number | null; conclusao: string | null; certificadoUrl: string | null }[];
    idiomas: { idioma: string; nivel: string }[];
    projetos: { titulo: string; descricao: string; link: string | null }[];
  };
};

/** Tudo como texto no formulário; vira o formato da API no envio. */
type Form = {
  objetivo: string;
  resumo: string;
  cidade: string;
  uf: string;
  links: { tipo: string; url: string }[];
  habilidadesTecnicas: string;
  habilidadesComportamentais: string;
  disponibilidade: string[];
  informacoesAdicionais: string;
  formacoes: { nivel: string; curso: string; instituicao: string; inicio: string; conclusao: string; situacao: string }[];
  experiencias: { tipo: string; organizacao: string; cargo: string; inicio: string; fim: string; descricao: string }[];
  cursos: { nome: string; instituicao: string; cargaHoraria: string; conclusao: string; certificadoUrl: string }[];
  idiomas: { idioma: string; nivel: string }[];
  projetos: { titulo: string; descricao: string; link: string }[];
};

const texto = (v: string | number | null | undefined) => (v == null ? '' : String(v));
const semVazios = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '')) as Partial<T>;

function paraForm(c: CurriculoApi['curriculo']): Form {
  return {
    objetivo: texto(c.objetivo),
    resumo: texto(c.resumo),
    cidade: texto(c.cidade),
    uf: texto(c.uf),
    links: c.links,
    habilidadesTecnicas: c.habilidadesTecnicas.join(', '),
    habilidadesComportamentais: c.habilidadesComportamentais.join(', '),
    disponibilidade: c.disponibilidade,
    informacoesAdicionais: texto(c.informacoesAdicionais),
    formacoes: c.formacoes.map((f) => ({ ...f, inicio: texto(f.inicio), conclusao: texto(f.conclusao) })),
    experiencias: c.experiencias.map((e) => ({ ...e, fim: texto(e.fim), descricao: texto(e.descricao) })),
    cursos: c.cursos.map((x) => ({ ...x, cargaHoraria: texto(x.cargaHoraria), conclusao: texto(x.conclusao), certificadoUrl: texto(x.certificadoUrl) })),
    idiomas: c.idiomas,
    projetos: c.projetos.map((p) => ({ ...p, link: texto(p.link) })),
  };
}

function paraApi(f: Form) {
  return {
    ...semVazios({ objetivo: f.objetivo, resumo: f.resumo, cidade: f.cidade, uf: f.uf, informacoesAdicionais: f.informacoesAdicionais }),
    links: f.links.filter((l) => l.url.trim()),
    habilidadesTecnicas: etiquetas(f.habilidadesTecnicas),
    habilidadesComportamentais: etiquetas(f.habilidadesComportamentais),
    disponibilidade: Array.isArray(f.disponibilidade) ? f.disponibilidade : [],
    formacoes: f.formacoes.map((x) => semVazios(x)),
    experiencias: f.experiencias.map((x) => semVazios(x)),
    cursos: f.cursos.map((x) => semVazios(x)),
    idiomas: f.idiomas,
    projetos: f.projetos.map((x) => semVazios(x)),
  };
}

const opcoes = (lista: readonly string[], rotulos: Record<string, string>) =>
  lista.map((v) => (
    <option key={v} value={v}>
      {rotulos[v]}
    </option>
  ));

/** ALU-04: seções do currículo padrão (D16). */
export function EditorCurriculo({ dados }: { dados: CurriculoApi }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<Mensagem>(null);
  const { register, control, handleSubmit, setError, formState } = useForm<Form>({ defaultValues: paraForm(dados.curriculo) });
  const erro = (caminho: string) => {
    const partes = caminho.split('.');
    let atual: unknown = formState.errors;
    for (const p of partes) atual = (atual as Record<string, unknown> | undefined)?.[p];
    return (atual as { message?: string } | undefined)?.message;
  };

  const enviar = async (f: Form) => {
    setMsg(null);
    try {
      const salvo = await api<CurriculoApi>('/alunos/me/curriculo', { method: 'PUT', corpo: paraApi(f) });
      qc.setQueryData(['aluno-curriculo'], salvo);
      setMsg({ tipo: 'sucesso', texto: 'Currículo salvo. As empresas das suas candidaturas já veem esta versão.' });
    } catch (e) {
      if (e instanceof ErroApi && e.problema.errors?.length) {
        for (const { campo, mensagem } of e.problema.errors) {
          // Etiquetas (habilidadesTecnicas.3) aparecem no campo de texto da lista.
          const alvo = /^habilidades\w+\.\d+$/.test(campo) ? campo.split('.')[0] : campo;
          setError(alvo as keyof Form, { type: 'server', message: mensagem });
        }
        setMsg({ tipo: 'erro', texto: 'Revise os campos destacados.' });
      } else setMsg({ tipo: 'erro', texto: 'Não foi possível salvar. Tente novamente.' });
    }
  };

  const { dadosPessoais: dp, graduacaoAtual: g } = dados;
  return (
    <form onSubmit={handleSubmit(enviar)} className="flex flex-col gap-6" noValidate>
      <Secao titulo="Dados pessoais e contato">
        <p className="text-sm text-slate-600 sm:col-span-2">
          {dp.nome} · {dp.email} · {dp.telefone} <span className="text-slate-500">(vêm do cadastro)</span>
        </p>
        <Campo rotulo="Cidade" {...register('cidade')} erro={erro('cidade')} />
        <Selecao rotulo="UF" {...register('uf')} erro={erro('uf')}>
          <option value="">—</option>
          {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
        </Selecao>
        <Lista
          control={control}
          nome="links"
          titulo="Links"
          novo={{ tipo: 'LINKEDIN', url: '' }}
          rotuloAdicionar="Adicionar link"
          item={(i) => (
            <>
              <Selecao rotulo={`Tipo do link ${i + 1}`} {...register(`links.${i}.tipo`)}>{opcoes(TIPOS_LINK, ROTULOS.link)}</Selecao>
              <Campo rotulo={`Endereço do link ${i + 1}`} type="url" placeholder="https://" {...register(`links.${i}.url`)} erro={erro(`links.${i}.url`)} />
            </>
          )}
        />
      </Secao>

      <Secao titulo="Objetivo e resumo">
        <div className="sm:col-span-2"><Campo rotulo="Objetivo profissional" maxLength={200} {...register('objetivo')} erro={erro('objetivo')} /></div>
        <div className="sm:col-span-2"><AreaTexto rotulo="Resumo (perfil profissional)" maxLength={1000} {...register('resumo')} erro={erro('resumo')} /></div>
      </Secao>

      <Secao titulo="Formação acadêmica">
        <p className="text-sm text-slate-600 sm:col-span-2">
          Graduação atual: {g.curso} · {g.faculdade} · {g.semestre}º semestre · previsão de conclusão {g.previsaoConclusao.ano}/{g.previsaoConclusao.periodo}
        </p>
        <Lista
          control={control}
          nome="formacoes"
          titulo="Outras formações"
          novo={{ nivel: 'ENSINO_MEDIO', curso: '', instituicao: '', inicio: '', conclusao: '', situacao: 'CONCLUIDO' }}
          rotuloAdicionar="Adicionar formação"
          item={(i) => (
            <>
              <Selecao rotulo={`Nível da formação ${i + 1}`} {...register(`formacoes.${i}.nivel`)}>{opcoes(NIVEIS_FORMACAO, ROTULOS.nivelFormacao)}</Selecao>
              <Selecao rotulo={`Situação da formação ${i + 1}`} {...register(`formacoes.${i}.situacao`)}>{opcoes(SITUACOES_FORMACAO, ROTULOS.situacaoFormacao)}</Selecao>
              <Campo rotulo={`Curso da formação ${i + 1}`} {...register(`formacoes.${i}.curso`)} erro={erro(`formacoes.${i}.curso`)} />
              <Campo rotulo={`Instituição da formação ${i + 1}`} {...register(`formacoes.${i}.instituicao`)} erro={erro(`formacoes.${i}.instituicao`)} />
              <Campo rotulo={`Início da formação ${i + 1}`} type="date" {...register(`formacoes.${i}.inicio`)} />
              <Campo rotulo={`Conclusão da formação ${i + 1}`} type="date" {...register(`formacoes.${i}.conclusao`)} erro={erro(`formacoes.${i}.conclusao`)} />
            </>
          )}
        />
      </Secao>

      <Secao titulo="Experiência">
        <Lista
          control={control}
          nome="experiencias"
          titulo="Experiências"
          novo={{ tipo: 'ESTAGIO', organizacao: '', cargo: '', inicio: '', fim: '', descricao: '' }}
          rotuloAdicionar="Adicionar experiência"
          item={(i) => (
            <>
              <Selecao rotulo={`Tipo da experiência ${i + 1}`} {...register(`experiencias.${i}.tipo`)}>{opcoes(TIPOS_EXPERIENCIA, ROTULOS.experiencia)}</Selecao>
              <Campo rotulo={`Organização da experiência ${i + 1}`} {...register(`experiencias.${i}.organizacao`)} erro={erro(`experiencias.${i}.organizacao`)} />
              <Campo rotulo={`Cargo da experiência ${i + 1}`} {...register(`experiencias.${i}.cargo`)} erro={erro(`experiencias.${i}.cargo`)} />
              <Campo rotulo={`Início da experiência ${i + 1}`} type="date" {...register(`experiencias.${i}.inicio`)} erro={erro(`experiencias.${i}.inicio`)} />
              <Campo rotulo={`Fim da experiência ${i + 1} (vazio = atual)`} type="date" {...register(`experiencias.${i}.fim`)} erro={erro(`experiencias.${i}.fim`)} />
              <div className="sm:col-span-2">
                <AreaTexto rotulo={`Atividades e resultados da experiência ${i + 1}`} rows={3} maxLength={2000} {...register(`experiencias.${i}.descricao`)} />
              </div>
            </>
          )}
        />
      </Secao>

      <Secao titulo="Cursos e certificações">
        <Lista
          control={control}
          nome="cursos"
          titulo="Cursos"
          novo={{ nome: '', instituicao: '', cargaHoraria: '', conclusao: '', certificadoUrl: '' }}
          rotuloAdicionar="Adicionar curso"
          item={(i) => (
            <>
              <Campo rotulo={`Nome do curso ${i + 1}`} {...register(`cursos.${i}.nome`)} erro={erro(`cursos.${i}.nome`)} />
              <Campo rotulo={`Instituição do curso ${i + 1}`} {...register(`cursos.${i}.instituicao`)} erro={erro(`cursos.${i}.instituicao`)} />
              <Campo rotulo={`Carga horária do curso ${i + 1} (h)`} type="number" min={1} {...register(`cursos.${i}.cargaHoraria`)} />
              <Campo rotulo={`Conclusão do curso ${i + 1}`} type="date" {...register(`cursos.${i}.conclusao`)} />
              <div className="sm:col-span-2">
                <Campo rotulo={`Link do certificado do curso ${i + 1}`} type="url" {...register(`cursos.${i}.certificadoUrl`)} erro={erro(`cursos.${i}.certificadoUrl`)} />
              </div>
            </>
          )}
        />
      </Secao>

      <Secao titulo="Idiomas">
        <Lista
          control={control}
          nome="idiomas"
          titulo="Idiomas"
          novo={{ idioma: '', nivel: 'BASICO' }}
          rotuloAdicionar="Adicionar idioma"
          item={(i) => (
            <>
              <Campo rotulo={`Idioma ${i + 1}`} {...register(`idiomas.${i}.idioma`)} erro={erro(`idiomas.${i}.idioma`)} />
              <Selecao rotulo={`Nível do idioma ${i + 1}`} {...register(`idiomas.${i}.nivel`)}>{opcoes(NIVEIS_IDIOMA, ROTULOS.idioma)}</Selecao>
            </>
          )}
        />
      </Secao>

      <Secao titulo="Habilidades">
        <Campo rotulo="Habilidades técnicas (separe por vírgula)" {...register('habilidadesTecnicas')} erro={erro('habilidadesTecnicas')} />
        <Campo rotulo="Habilidades comportamentais (separe por vírgula)" {...register('habilidadesComportamentais')} erro={erro('habilidadesComportamentais')} />
      </Secao>

      <Secao titulo="Projetos">
        <Lista
          control={control}
          nome="projetos"
          titulo="Projetos"
          novo={{ titulo: '', descricao: '', link: '' }}
          rotuloAdicionar="Adicionar projeto"
          item={(i) => (
            <>
              <Campo rotulo={`Título do projeto ${i + 1}`} {...register(`projetos.${i}.titulo`)} erro={erro(`projetos.${i}.titulo`)} />
              <Campo rotulo={`Link do projeto ${i + 1}`} type="url" {...register(`projetos.${i}.link`)} erro={erro(`projetos.${i}.link`)} />
              <div className="sm:col-span-2">
                <AreaTexto rotulo={`Descrição do projeto ${i + 1}`} rows={3} maxLength={2000} {...register(`projetos.${i}.descricao`)} erro={erro(`projetos.${i}.descricao`)} />
              </div>
            </>
          )}
        />
      </Secao>

      <Secao titulo="Informações adicionais">
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium text-slate-800">Disponibilidade de horário</legend>
          <div className="flex flex-wrap gap-4">
            {DISPONIBILIDADES.map((d) => (
              <Caixa key={d} rotulo={ROTULOS.disponibilidade[d]} value={d} {...register('disponibilidade')} />
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <AreaTexto rotulo="CNH, disponibilidade para viagem ou mudança, prêmios" maxLength={1000} {...register('informacoesAdicionais')} erro={erro('informacoesAdicionais')} />
        </div>
      </Secao>

      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-200 bg-slate-50 py-4">
        {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
        <div>
          <Botao type="submit" disabled={formState.isSubmitting}>Salvar currículo</Botao>
        </div>
      </div>
    </form>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Cartao>
      <h2 className="mb-4 text-lg font-semibold">{titulo}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Cartao>
  );
}

function Lista<N extends ArrayPath<Form>>({
  control,
  nome,
  titulo,
  novo,
  rotuloAdicionar,
  item,
}: {
  control: Control<Form>;
  nome: N;
  titulo: string;
  novo: FieldArray<Form, N>;
  rotuloAdicionar: string;
  item: (indice: number) => ReactNode;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: nome });
  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      <ul aria-label={titulo} className="flex flex-col gap-3">
        {fields.map((f, i) => (
          <li key={f.id} className="grid gap-3 rounded-md bg-slate-50 p-3 sm:grid-cols-2">
            {item(i)}
            <div className="sm:col-span-2">
              <button type="button" className="text-sm text-red-700 hover:underline" onClick={() => remove(i)}>
                Remover item {i + 1} de {titulo.toLowerCase()}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div>
        <Botao type="button" variante="secundario" onClick={() => append(novo)}>
          {rotuloAdicionar}
        </Botao>
      </div>
    </div>
  );
}

