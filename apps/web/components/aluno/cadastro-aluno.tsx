'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AreaTexto, Botao, Caixa, Campo, Cartao } from '@vagas/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { z } from 'zod';
import { cadastroAlunoSchema, refinarSenhaComEmail } from '@vagas/contracts';
import { Aviso } from '@/components/aviso';
import { api, ErroApi } from '@/lib/api';
import { etiquetas, formatarCpf, formatarTelefone } from '@/lib/formatar';
import { aplicarErrosApi } from '@/lib/formulario';
import { CamposVinculo } from './campos-vinculo';
import type { OpcoesFaculdade } from './tipos';

// No formulário o currículo do passo 3 vem em campos simples; vira o objeto da API no envio.
const formSchema = cadastroAlunoSchema.innerType().omit({ curriculo: true }).extend({
  aceiteTermos: z.boolean().refine((v) => v, 'É preciso aceitar os termos de uso e a política de privacidade'),
  objetivo: z.string().max(200, 'Até 200 caracteres').optional(),
  resumo: z.string().max(1000, 'Até 1 000 caracteres').optional(),
  habilidades: z.string().optional(),
  linkedin: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.senha !== d.confirmacao) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmacao'], message: 'As senhas não conferem' });
  refinarSenhaComEmail(d.senha, d.email, ctx);
});
type Dados = z.input<typeof formSchema>;

const PASSOS = ['Dados pessoais', 'Vínculo acadêmico', 'Currículo'] as const;
const CAMPOS_PASSO: FieldPath<Dados>[][] = [
  ['nome', 'cpf', 'email', 'telefone', 'senha', 'confirmacao'],
  ['cursoId', 'turmaId', 'semestreAtual', 'aceiteTermos'],
  [],
];
const passoDoCampo = (campo: string) => CAMPOS_PASSO.findIndex((c) => c.includes(campo as FieldPath<Dados>));

/** ALU-01: assistente em 3 passos; o passo do currículo pode ser pulado. */
export function CadastroAluno() {
  const [passo, setPasso] = useState(0);
  const [opcoes, setOpcoes] = useState<OpcoesFaculdade | null>(null);
  const [erro, setErro] = useState('');
  const [concluido, setConcluido] = useState<string | null>(null);
  // Valida ao avançar, não no blur: limpar um erro no blur desloca o botão entre o mousedown e o mouseup e o clique se perde.
  const form = useForm<Dados>({ resolver: zodResolver(formSchema), criteriaMode: 'all' });
  const { register, handleSubmit, setError, clearErrors, trigger, watch, setValue, formState } = form;
  const errosSenha = Object.values(formState.errors.senha?.types ?? {}).flat().map(String);

  /** RN-01: ao sair do campo e-mail, a faculdade aparece preenchida e bloqueada. */
  const consultarDominio = async (email: string) => {
    setOpcoes(null);
    if (!z.string().email().safeParse(email.trim()).success) return;
    try {
      const r = await api<OpcoesFaculdade>(`/faculdades/por-dominio?email=${encodeURIComponent(email.trim())}`);
      setOpcoes(r);
      clearErrors('email');
    } catch (e) {
      setError('email', { type: 'server', message: e instanceof ErroApi && e.status === 404 ? 'Sua faculdade ainda não usa a plataforma' : 'Não foi possível consultar o domínio' });
    }
  };

  const avancar = async () => {
    if (!(await trigger(CAMPOS_PASSO[passo]))) return;
    // As regras cruzadas do schema só rodam com o formulário inteiro válido; no 1º passo checamos aqui.
    if (passo === 0 && form.getValues('senha') !== form.getValues('confirmacao')) {
      setError('confirmacao', { type: 'manual', message: 'As senhas não conferem' });
      return;
    }
    if (passo === 0 && !opcoes) {
      setError('email', { type: 'server', message: formState.errors.email?.message ?? 'Sua faculdade ainda não usa a plataforma' });
      return;
    }
    setPasso((p) => p + 1);
  };

  const enviar = async ({ objetivo, resumo, habilidades, linkedin, ...dados }: Dados, pular = false) => {
    setErro('');
    const curriculo = pular
      ? undefined
      : {
          objetivo: objetivo || undefined,
          resumo: resumo || undefined,
          habilidadesTecnicas: etiquetas(habilidades ?? ''),
          links: linkedin ? [{ tipo: 'LINKEDIN', url: linkedin }] : [],
        };
    try {
      const r = await api<{ email: string }>('/auth/alunos', { method: 'POST', corpo: { ...dados, curriculo } });
      setConcluido(r.email);
    } catch (e) {
      const msg = aplicarErrosApi(e, setError);
      if (e instanceof ErroApi) {
        const primeiro = e.problema.errors?.map((x) => passoDoCampo(x.campo.split('.')[0])).find((p) => p >= 0);
        if (primeiro !== undefined) setPasso(primeiro);
        if (e.status === 429) return setErro('Muitos cadastros a partir desta rede. Tente novamente mais tarde.');
      }
      setErro(msg);
    }
  };

  if (concluido) {
    return (
      <Cartao>
        <h1 className="mb-4 text-xl font-semibold">Quase lá!</h1>
        <Aviso tipo="sucesso">
          Enviamos um link de verificação para {concluido}. Abra o e-mail e confirme em até 24 horas para ativar a conta.
        </Aviso>
        <Link href="/login" className="mt-4 inline-block text-sm text-indigo-700 hover:underline">
          Ir para o login
        </Link>
      </Cartao>
    );
  }

  return (
    <Cartao>
      <h1 className="mb-1 text-xl font-semibold">Cadastro de aluno</h1>
      <ol aria-label="Etapas do cadastro" className="mb-6 flex flex-wrap gap-2 text-xs">
        {PASSOS.map((p, i) => (
          <li key={p} aria-current={i === passo ? 'step' : undefined} className={`rounded-full px-3 py-1 ${i === passo ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {i + 1}. {p}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit((d) => enviar(d))} className="flex flex-col gap-4" noValidate>
        <h2 className="text-lg font-medium">{PASSOS[passo]}</h2>

        {passo === 0 && (
          <>
            <Campo rotulo="Nome completo" autoComplete="name" {...register('nome')} erro={formState.errors.nome?.message} />
            <Campo
              rotulo="CPF"
              inputMode="numeric"
              {...register('cpf', { onChange: (e) => setValue('cpf', formatarCpf(e.target.value)) })}
              erro={formState.errors.cpf?.message}
            />
            <Campo
              rotulo="E-mail institucional"
              type="email"
              autoComplete="email"
              {...register('email', { onBlur: (e) => consultarDominio(e.target.value) })}
              erro={formState.errors.email?.message}
            />
            <Campo
              rotulo="Telefone"
              type="tel"
              autoComplete="tel"
              {...register('telefone', { onChange: (e) => setValue('telefone', formatarTelefone(e.target.value)) })}
              erro={formState.errors.telefone?.message}
            />
            <Campo rotulo="Senha" type="password" autoComplete="new-password" {...register('senha', { deps: ['confirmacao'] })} erro={errosSenha.length ? errosSenha : formState.errors.senha?.message} />
            <Campo rotulo="Confirmação da senha" type="password" autoComplete="new-password" {...register('confirmacao')} erro={formState.errors.confirmacao?.message} />
          </>
        )}

        {passo === 1 && opcoes && (
          <>
            <Campo rotulo="Faculdade" value={opcoes.faculdade.nome} readOnly aria-readonly className="bg-slate-100" />
            <CamposVinculo cursos={opcoes.cursos} register={register} watch={watch} errors={formState.errors} />
            <Caixa
              rotulo={
                <>
                  Li e aceito os{' '}
                  <Link href="/termos" target="_blank" className="text-indigo-700 underline">
                    termos de uso e a política de privacidade
                  </Link>
                </>
              }
              {...register('aceiteTermos', { onChange: () => formState.errors.aceiteTermos && trigger('aceiteTermos') })}
              erro={formState.errors.aceiteTermos?.message}
            />
          </>
        )}

        {passo === 2 && (
          <>
            <p className="text-sm text-slate-600">Opcional: você pode completar o currículo depois, no seu perfil.</p>
            <Campo rotulo="Objetivo profissional" maxLength={200} {...register('objetivo')} erro={formState.errors.objetivo?.message} />
            <AreaTexto rotulo="Resumo" maxLength={1000} {...register('resumo')} erro={formState.errors.resumo?.message} />
            <Campo rotulo="Habilidades técnicas (separe por vírgula)" {...register('habilidades')} />
            <Campo rotulo="LinkedIn" type="url" placeholder="https://www.linkedin.com/in/..." {...register('linkedin')} />
          </>
        )}

        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="flex flex-wrap justify-between gap-3">
          {passo > 0 ? (
            <Botao type="button" variante="secundario" onClick={() => setPasso((p) => p - 1)}>
              Voltar
            </Botao>
          ) : (
            <span />
          )}
          {passo < 2 ? (
            <Botao type="button" onClick={avancar}>
              Continuar
            </Botao>
          ) : (
            <div className="flex gap-2">
              <Botao type="button" variante="secundario" disabled={formState.isSubmitting} onClick={handleSubmit((d) => enviar(d, true))}>
                Pular e concluir
              </Botao>
              <Botao type="submit" disabled={formState.isSubmitting}>
                Concluir cadastro
              </Botao>
            </div>
          )}
        </div>
      </form>
      <p className="mt-4 text-sm">
        Já tem conta?{' '}
        <Link href="/login" className="text-indigo-700 underline">
          Entrar
        </Link>
      </p>
    </Cartao>
  );
}
