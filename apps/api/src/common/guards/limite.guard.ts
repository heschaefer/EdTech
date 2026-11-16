import { ExecutionContext, Injectable, SetMetadata, applyDecorators } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { env } from '../../config/env';
import type { UsuarioSessao } from '../sessao';

type ChaveLimite = 'ip' | 'ip+email' | 'email' | 'usuario';
const CHAVE_LIMITE = 'chave-limite';

/**
 * Rate limit por rota (seção 8.3). Ex.: @Limite(5, 60_000, 'ip+email') no login.
 * Sem o decorator vale o padrão de 100/min por usuário (ou IP, se anônimo).
 */
export const Limite = (limite: number, ttlMs: number, chave: ChaveLimite) =>
  applyDecorators(Throttle({ default: { limit: limite, ttl: ttlMs } }), SetMetadata(CHAVE_LIMITE, chave));

@Injectable()
export class LimiteGuard extends ThrottlerGuard {
  protected override async shouldSkip(ctx: ExecutionContext): Promise<boolean> {
    return env().THROTTLE_DESLIGADO || super.shouldSkip(ctx);
  }

  protected override async getTracker(req: Request & { usuario?: UsuarioSessao; chaveLimite?: ChaveLimite }): Promise<string> {
    return this.chave(req, req.usuario ? 'usuario' : 'ip');
  }

  // O tracker não recebe o contexto; guardamos a chave no request em canActivate.
  override async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { chaveLimite?: ChaveLimite }>();
    req.chaveLimite = this.reflector.getAllAndOverride<ChaveLimite>(CHAVE_LIMITE, [ctx.getHandler(), ctx.getClass()]);
    return super.canActivate(ctx);
  }

  private chave(req: Request & { usuario?: UsuarioSessao; chaveLimite?: ChaveLimite }, padrao: ChaveLimite): string {
    const tipo = req.chaveLimite ?? padrao;
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const ip = req.ip ?? 'sem-ip';
    switch (tipo) {
      case 'ip+email':
        return `ip-email:${ip}:${email}`;
      case 'email':
        return `email:${email}`;
      case 'usuario':
        return req.usuario ? `usuario:${req.usuario.id}` : `ip:${ip}`;
      default:
        return `ip:${ip}`;
    }
  }
}
