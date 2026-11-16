import { z } from 'zod';
import { cnpjSchema, telefoneSchema } from './admin';
import { ufSchema } from './aluno';
import { emailSchema, refinarSenhaComEmail, senhaNovaSchema } from './auth';
import { textoCurto } from './comum';

/** D6: endereço completo e obrigatório; complemento opcional. */
export const enderecoSchema = z.object({
  cep: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 8, 'CEP inválido'),
  logradouro: textoCurto,
  numero: z.string().trim().min(1, 'Obrigatório').max(20),
  complemento: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(100).optional()),
  bairro: textoCurto,
  cidade: textoCurto,
  uf: ufSchema,
});

const dadosEmpresa = z
  .object({
    razaoSocial: textoCurto,
    nomeFantasia: textoCurto,
    telefone: telefoneSchema,
    ramoAtuacao: textoCurto,
  })
  .merge(enderecoSchema);

/** EMP-01 */
export const cadastroEmpresaSchema = dadosEmpresa
  .extend({ cnpj: cnpjSchema, email: emailSchema, senha: senhaNovaSchema, confirmacao: z.string() })
  .strict()
  .superRefine((d, ctx) => {
    if (d.senha !== d.confirmacao) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmacao'], message: 'As senhas não conferem' });
    refinarSenhaComEmail(d.senha, d.email, ctx);
  });
export type CadastroEmpresaInput = z.infer<typeof cadastroEmpresaSchema>;

/** EMP-02: tudo, menos o CNPJ (o e-mail de login também não muda por aqui). */
export const atualizarEmpresaSchema = dadosEmpresa.extend({ email: emailSchema }).partial().strict();
export type AtualizarEmpresaInput = z.infer<typeof atualizarEmpresaSchema>;

/** ADM-04 */
export const reprovarEmpresaSchema = z.object({ motivo: z.string().trim().min(3, 'Informe o motivo').max(1000) }).strict();

/** ADM-05 */
export const filtroEmpresasSchema = z
  .object({
    aprovacao: z.enum(['PENDENTE', 'APROVADA', 'REPROVADA']).optional(),
    ativa: z.enum(['true', 'false']).optional(),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const atualizarEmpresaAdminSchema = z.object({ ativa: z.boolean() }).strict();
