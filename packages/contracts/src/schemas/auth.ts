import { z } from 'zod';
import { MENSAGENS_SENHA, requisitosSenhaNaoAtendidos } from '../validadores/senha';
import { normalizarEmail } from '../validadores/email';
import { Papel, StatusUsuario } from '../enums';

export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .email('E-mail inválido')
  .transform(normalizarEmail);

/** Senha que segue a RN-04; a checagem do e-mail é feita com `refinarSenhaComEmail`. */
export const senhaNovaSchema = z.string().superRefine((senha, ctx) => {
  for (const r of requisitosSenhaNaoAtendidos(senha)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: MENSAGENS_SENHA[r], params: { requisito: r } });
  }
});

export function refinarSenhaComEmail(senha: string, email: string, ctx: z.RefinementCtx, caminho = 'senha') {
  if (requisitosSenhaNaoAtendidos(senha, email).includes('CONTEM_EMAIL')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [caminho], message: MENSAGENS_SENHA.CONTEM_EMAIL });
  }
}

export const loginSchema = z
  .object({
    email: emailSchema,
    senha: z.string().min(1).max(128),
    totp: z.string().regex(/^\d{6}$/, 'Código de 6 dígitos').optional(),
  })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;

export const tokenSchema = z.object({ token: z.string().min(20).max(200) }).strict();

export const reenviarVerificacaoSchema = z.object({ email: emailSchema }).strict();
export const esqueciSenhaSchema = z.object({ email: emailSchema }).strict();

export const redefinirSenhaSchema = z
  .object({ token: z.string().min(20).max(200), senha: senhaNovaSchema, confirmacao: z.string() })
  .strict()
  .refine((d) => d.senha === d.confirmacao, { path: ['confirmacao'], message: 'As senhas não conferem' });

export const aceitarConviteSchema = redefinirSenhaSchema;

export const meSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  papel: Papel,
  status: StatusUsuario,
  nome: z.string(),
});
export type Me = z.infer<typeof meSchema>;
