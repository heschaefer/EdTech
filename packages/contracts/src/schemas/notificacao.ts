import { z } from 'zod';

/** ALU-11: `?naoLidas=true` mostra só as não lidas. */
export const filtroNotificacoesSchema = z
  .object({
    naoLidas: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type FiltroNotificacoes = z.infer<typeof filtroNotificacoesSchema>;

export type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lidaEm: string | null;
  criadaEm: string;
};
