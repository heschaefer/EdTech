import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256 bits aleatórios em base64url (refresh token e tokens de e-mail, seção 8.1). */
export const gerarTokenOpaco = () => randomBytes(32).toString('base64url');

/** Só o SHA-256 vai para o banco. */
export const sha256 = (valor: string) => createHash('sha256').update(valor).digest('hex');

export function iguaisEmTempoConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
