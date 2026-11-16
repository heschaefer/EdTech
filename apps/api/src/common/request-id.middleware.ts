import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { contextoRequisicao } from './contexto';

/** Cada requisição carrega um request-id (seção 8.3) e abre o contexto da requisição. */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const recebido = req.headers['x-request-id'];
  const id = typeof recebido === 'string' && /^[\w-]{8,64}$/.test(recebido) ? recebido : randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  // O IP vai para a auditoria (seção 8.4) sem precisar ser repassado por cada serviço.
  contextoRequisicao.run({ requestId: id, ip: req.ip }, next);
}
