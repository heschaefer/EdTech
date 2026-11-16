import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Cada requisição carrega um request-id (seção 8.3). */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const recebido = req.headers['x-request-id'];
  const id = typeof recebido === 'string' && /^[\w-]{8,64}$/.test(recebido) ? recebido : randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  next();
}
