import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { iguaisEmTempoConstante } from '../cripto/tokens';
import { PUBLICA, SEM_CSRF } from '../decorators';
import { proibido } from '../problema';
import { COOKIE_CSRF, HEADER_CSRF } from '../sessao';

const MUTACOES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Double submit (seção 8.1): em mutações autenticadas, o header X-CSRF-Token tem de ser igual
 * ao cookie `csrf`. Rotas públicas e @SemCsrf() ficam isentas (SameSite + rate limit).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!MUTACOES.has(req.method)) return true;
    const alvos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICA, alvos)) return true;
    if (this.reflector.getAllAndOverride<boolean>(SEM_CSRF, alvos)) return true;

    const cookie = req.cookies?.[COOKIE_CSRF];
    const header = req.headers[HEADER_CSRF];
    if (typeof cookie !== 'string' || typeof header !== 'string' || !cookie || !iguaisEmTempoConstante(cookie, header)) {
      throw proibido('Token CSRF ausente ou inválido');
    }
    return true;
  }
}
