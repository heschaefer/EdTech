import { z } from 'zod';

/** Seção 8.4: pedido de exclusão (anonimização) confirmado com a senha e a palavra EXCLUIR. */
export const excluirContaSchema = z
  .object({
    senha: z.string().min(1, 'Informe sua senha').max(128),
    confirmacao: z.literal('EXCLUIR', { errorMap: () => ({ message: 'Digite EXCLUIR para confirmar' }) }),
  })
  .strict();
export type ExcluirContaInput = z.infer<typeof excluirContaSchema>;

/** Nome exibido no lugar do titular anonimizado. */
export const NOME_TITULAR_REMOVIDO = 'Titular removido';

/** Seção 8.4: trilha de auditoria para o admin. */
export const filtroAuditoriaSchema = z
  .object({
    acao: z.string().trim().max(60).optional(),
    entidade: z.string().trim().max(40).optional(),
    entidadeId: z.string().trim().max(60).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export type FiltroAuditoria = z.infer<typeof filtroAuditoriaSchema>;
