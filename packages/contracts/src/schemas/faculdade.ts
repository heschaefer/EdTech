import { z } from 'zod';
import { emailSchema } from './auth';
import { telefoneSchema } from './admin';
import { textoCurto, textoLongo, uuid } from './comum';

/** FAC-02: CNPJ e domínios só o admin altera. */
export const atualizarFaculdadeSchema = z
  .object({
    razaoSocial: textoCurto.optional(),
    nomeFantasia: textoCurto.optional(),
    telefone: telefoneSchema.optional(),
    email: emailSchema.optional(),
  })
  .strict();
export type AtualizarFaculdadeInput = z.infer<typeof atualizarFaculdadeSchema>;

export const DURACAO_MIN_ANOS = 1;
export const DURACAO_MAX_ANOS = 6;

const duracaoAnos = z.coerce
  .number({ invalid_type_error: 'Informe a duração' })
  .int('Use anos inteiros')
  .min(DURACAO_MIN_ANOS, `Mínimo de ${DURACAO_MIN_ANOS} ano`)
  .max(DURACAO_MAX_ANOS, `Máximo de ${DURACAO_MAX_ANOS} anos`);

/** FAC-03 */
export const criarCursoSchema = z
  .object({
    nome: textoCurto,
    areaId: uuid,
    duracaoAnos,
    ementa: textoLongo,
  })
  .strict();
export type CriarCursoInput = z.infer<typeof criarCursoSchema>;

export const atualizarCursoSchema = z
  .object({
    nome: textoCurto.optional(),
    areaId: uuid.optional(),
    duracaoAnos: duracaoAnos.optional(),
    ementa: textoLongo.optional(),
    ativo: z.boolean().optional(),
  })
  .strict();
export type AtualizarCursoInput = z.infer<typeof atualizarCursoSchema>;

/** FAC-04 */
export const criarAulaSchema = z.object({ nome: textoCurto, ementa: textoLongo }).strict();
export const atualizarAulaSchema = z
  .object({ nome: textoCurto.optional(), ementa: textoLongo.optional(), ordem: z.coerce.number().int().min(1).optional() })
  .strict();

/** FAC-05 */
export const criarTurmaSchema = z
  .object({
    anoIngresso: z.coerce.number().int().min(1950, 'Ano inválido').max(2100, 'Ano inválido'),
    periodoIngresso: z.coerce.number().int().min(1).max(2).default(1),
  })
  .strict();
export const atualizarTurmaSchema = criarTurmaSchema.partial().extend({ ativa: z.boolean().optional() }).strict();
