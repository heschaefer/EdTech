import { z } from 'zod';

export const LIMITE_TEXTO_CURTO = 200;
export const LIMITE_TEXTO_LONGO = 5000;

export const textoCurto = z.string().trim().min(1, 'Obrigatório').max(LIMITE_TEXTO_CURTO);
export const textoLongo = z.string().trim().min(1, 'Obrigatório').max(LIMITE_TEXTO_LONGO);
export const uuid = z.string().uuid();

/** Listas (seção 9): ?page=1&pageSize=20 (máx. 100). */
export const paginacaoSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type Paginacao = z.infer<typeof paginacaoSchema>;

export type Pagina<T> = { data: T[]; meta: { page: number; pageSize: number; total: number } };

/** Erros no formato problem+json (seção 9). */
export type Problema = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: { campo: string; mensagem: string }[];
  [extra: string]: unknown;
};
