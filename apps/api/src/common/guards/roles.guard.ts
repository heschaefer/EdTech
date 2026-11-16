import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Papel } from '@prisma/client';
import { PAPEIS, PUBLICA } from '../decorators';
import { proibido } from '../problema';
import type { UsuarioSessao } from '../sessao';

/** Segunda camada (seção 8.2): papel. A posse fica nos serviços. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const alvos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICA, alvos)) return true;
    const papeis = this.reflector.getAllAndOverride<Papel[]>(PAPEIS, alvos);
    if (!papeis?.length) return true;
    const usuario: UsuarioSessao | undefined = ctx.switchToHttp().getRequest().usuario;
    if (!usuario || !papeis.includes(usuario.papel)) throw proibido();
    return true;
  }
}
