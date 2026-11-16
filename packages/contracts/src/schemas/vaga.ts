import { z } from 'zod';
import { Modalidade, TipoVaga } from '../enums';
import { ufSchema } from './aluno';
import { textoCurto, textoLongo, uuid } from './comum';

export const ROTULOS_VAGA = {
  tipo: { ESTAGIO: 'Estágio', JOVEM_APRENDIZ: 'Jovem aprendiz', TRAINEE: 'Trainee', CLT: 'CLT', PJ: 'PJ', TEMPORARIO: 'Temporário' },
  modalidade: { PRESENCIAL: 'Presencial', HIBRIDO: 'Híbrido', REMOTO: 'Remoto' },
  status: { ABERTA: 'Aberta', PAUSADA: 'Pausada', PRAZO_EXPIRADO: 'Prazo expirado', ENCERRADA: 'Encerrada' },
} as const;

const dataCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');
const valor = z.coerce.number().positive('Valor inválido').max(1_000_000);

/** Salário: faixa (mínimo e/ou máximo) ou "a combinar" (ambos nulos). */
export const salarioSchema = z
  .object({ aCombinar: z.boolean(), min: valor.optional().nullable(), max: valor.optional().nullable() })
  .strict()
  .superRefine((s, ctx) => {
    if (s.aCombinar) return;
    if (s.min == null && s.max == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['min'], message: 'Informe a faixa ou marque "a combinar"' });
    if (s.min != null && s.max != null && s.min > s.max) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['max'], message: 'O máximo não pode ser menor que o mínimo' });
  });

const camposVaga = {
  funcao: textoCurto,
  tipo: TipoVaga,
  modalidade: Modalidade,
  areaIds: z.array(uuid).min(1, 'Escolha ao menos uma área de formação').max(10),
  atividades: textoLongo,
  requisitos: textoLongo,
  salario: salarioSchema,
  beneficios: textoLongo,
  processoSeletivo: textoLongo,
  cultura: textoLongo,
  cidade: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(100).nullable().optional()),
  uf: z.preprocess((v) => (v === '' ? null : v), ufSchema.nullable().optional()),
  semestreMinimo: z.preprocess((v) => (v === '' ? null : v), z.coerce.number().int().min(1).max(12).nullable().optional()),
};

/** EMP-03: cidade e UF obrigatórias para vaga presencial ou híbrida. */
const localObrigatorio = (d: { modalidade?: string; cidade?: string | null; uf?: string | null }, ctx: z.RefinementCtx) => {
  if (d.modalidade && d.modalidade !== 'REMOTO') {
    if (!d.cidade) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cidade'], message: 'Obrigatória para vaga presencial ou híbrida' });
    if (!d.uf) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['uf'], message: 'Obrigatória para vaga presencial ou híbrida' });
  }
};

export const etapasSchema = z
  .array(z.object({ id: uuid.optional(), nome: z.string().trim().min(1, 'Informe o nome da etapa').max(100) }).strict())
  .min(1, 'Cadastre ao menos uma etapa')
  .max(15);

/** EMP-03 */
export const criarVagaSchema = z
  .object({ ...camposVaga, etapas: etapasSchema, prazo: dataCivil })
  .strict()
  .superRefine(localObrigatorio);
export type CriarVagaInput = z.infer<typeof criarVagaSchema>;

/** EMP-04: o prazo muda só pela prorrogação (EMP-07); `versao` é o controle otimista. */
export const atualizarVagaSchema = z
  .object({ ...camposVaga, etapas: etapasSchema, versao: z.number().int().min(0) })
  .partial()
  .required({ versao: true })
  .strict();
export type AtualizarVagaInput = z.infer<typeof atualizarVagaSchema>;

/** EMP-07 */
export const prorrogarVagaSchema = z.object({ prazo: dataCivil }).strict();

/** ALU-05: filtros na URL. */
export const filtroVagasSchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    tipo: TipoVaga.optional(),
    modalidade: Modalidade.optional(),
    uf: ufSchema.optional(),
    cidade: z.string().trim().max(100).optional(),
    salarioMin: z.coerce.number().positive().optional(),
    dias: z.coerce.number().pipe(z.union([z.literal(7), z.literal(15), z.literal(30)])).optional(),
    ordem: z.enum(['recentes', 'prazo']).default('recentes'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type FiltroVagas = z.infer<typeof filtroVagasSchema>;

export const filtroVagasEmpresaSchema = z
  .object({ status: z.enum(['ABERTA', 'PAUSADA', 'PRAZO_EXPIRADO', 'ENCERRADA']).optional() })
  .strict();


/** EMP-11: zero ou mais selecionados entre os candidatos em processo (ids de candidatura). */
export const encerrarVagaSchema = z.object({ selecionados: z.array(uuid).max(1000).default([]) }).strict();
export type EncerrarVagaInput = z.infer<typeof encerrarVagaSchema>;
