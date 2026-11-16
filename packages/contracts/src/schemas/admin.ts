import { z } from 'zod';
import { cnpjValido, normalizarCnpj } from '../validadores/cnpj';
import { dominioValido, PROVEDORES_PUBLICOS } from '../validadores/email';
import { emailSchema } from './auth';
import { textoCurto } from './comum';

export const cnpjSchema = z
  .string()
  .transform(normalizarCnpj)
  .refine(cnpjValido, 'CNPJ inválido');

export const telefoneSchema = z
  .string()
  .transform((t) => t.replace(/\D/g, ''))
  .refine((t) => t.length === 10 || t.length === 11, 'Telefone inválido');

export const dominioSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(dominioValido, 'Domínio inválido')
  .refine((d) => !PROVEDORES_PUBLICOS.has(d), 'Domínio de provedor público não é aceito');

export const criarFaculdadeSchema = z
  .object({
    cnpj: cnpjSchema,
    razaoSocial: textoCurto,
    nomeFantasia: textoCurto,
    telefone: telefoneSchema,
    email: emailSchema,
    dominios: z.array(dominioSchema).min(1, 'Informe ao menos um domínio').max(20),
  })
  .strict();
export type CriarFaculdadeInput = z.infer<typeof criarFaculdadeSchema>;

export const atualizarFaculdadeAdminSchema = z
  .object({
    razaoSocial: textoCurto.optional(),
    nomeFantasia: textoCurto.optional(),
    telefone: telefoneSchema.optional(),
    ativa: z.boolean().optional(),
  })
  .strict();

/** ADM-01: lista com busca por nome, CNPJ ou domínio. */
export const filtroFaculdadesSchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const dominioInputSchema = z.object({ dominio: dominioSchema }).strict();

export const criarAreaSchema = z.object({ nome: textoCurto }).strict();
export const atualizarAreaSchema = z
  .object({ nome: textoCurto.optional(), ativa: z.boolean().optional() })
  .strict();
