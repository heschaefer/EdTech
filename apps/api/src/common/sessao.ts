import type { Papel, StatusUsuario } from '@prisma/client';

/** O que o JwtAuthGuard coloca em req.usuario a partir das claims do access token. */
export type UsuarioSessao = {
  id: string;
  papel: Papel;
  status: StatusUsuario;
  jti: string;
};

export const COOKIE_ACCESS = 'at';
export const COOKIE_REFRESH = 'rt';
export const COOKIE_CSRF = 'csrf';
export const HEADER_CSRF = 'x-csrf-token';
export const CAMINHO_REFRESH = '/api/v1/auth';
