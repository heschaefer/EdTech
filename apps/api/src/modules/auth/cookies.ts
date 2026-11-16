import type { CookieOptions, Response } from 'express';
import { env } from '../../config/env';
import { CAMINHO_REFRESH, COOKIE_ACCESS, COOKIE_CSRF, COOKIE_REFRESH } from '../../common/sessao';
import { VIDA_ACCESS_SEG } from './chaves-jwt.service';

export const VIDA_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

const base = (): CookieOptions => ({ secure: env().COOKIE_SECURE });

/** Seção 8.1: `at` httpOnly Lax em /, `rt` httpOnly Strict em /api/v1/auth, `csrf` legível pelo JS. */
export function gravarCookiesSessao(res: Response, s: { access: string; refresh: string; csrf: string }) {
  res.cookie(COOKIE_ACCESS, s.access, { ...base(), httpOnly: true, sameSite: 'lax', path: '/', maxAge: VIDA_ACCESS_SEG * 1000 });
  res.cookie(COOKIE_REFRESH, s.refresh, { ...base(), httpOnly: true, sameSite: 'strict', path: CAMINHO_REFRESH, maxAge: VIDA_REFRESH_MS });
  res.cookie(COOKIE_CSRF, s.csrf, { ...base(), httpOnly: false, sameSite: 'lax', path: '/', maxAge: VIDA_REFRESH_MS });
}

export function limparCookiesSessao(res: Response) {
  res.clearCookie(COOKIE_ACCESS, { ...base(), path: '/' });
  res.clearCookie(COOKIE_REFRESH, { ...base(), path: CAMINHO_REFRESH });
  res.clearCookie(COOKIE_CSRF, { ...base(), path: '/' });
}
