import { AsyncLocalStorage } from 'node:async_hooks';

/** Dados da requisição em curso, acessíveis sem passar parâmetro (auditoria, logs). */
export type ContextoRequisicao = { requestId: string; ip?: string };

export const contextoRequisicao = new AsyncLocalStorage<ContextoRequisicao>();
