import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Papel } from '@prisma/client';
import type { UsuarioSessao } from '../sessao';

export const PUBLICA = 'rota-publica';
export const PAPEIS = 'papeis';
export const PERMITE_INATIVO = 'permite-inativo';
export const SEM_CSRF = 'sem-csrf';

/** Rota aberta, sem JwtAuthGuard (seção 8.2). */
export const Public = () => SetMetadata(PUBLICA, true);
/** Papéis aceitos pela rota (RolesGuard). */
export const Roles = (...papeis: Papel[]) => SetMetadata(PAPEIS, papeis);
/** Aluno INATIVO passa só nas rotas marcadas (RN-22). */
export const PermitirInativo = () => SetMetadata(PERMITE_INATIVO, true);
/** Isenta a rota do double submit (refresh, links de e-mail). */
export const SemCsrf = () => SetMetadata(SEM_CSRF, true);

export const UsuarioAtual = createParamDecorator((_: unknown, ctx: ExecutionContext): UsuarioSessao => {
  return ctx.switchToHttp().getRequest().usuario;
});
