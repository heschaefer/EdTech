import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ChavesJwtService } from '../../modules/auth/chaves-jwt.service';
import { PERMITE_INATIVO, PUBLICA } from '../decorators';
import { naoAutenticado, proibido } from '../problema';
import { COOKIE_ACCESS } from '../sessao';

/**
 * Global (seção 8.2): toda rota exige sessão, salvo @Public(). O status vem do banco a cada
 * requisição, então desligar aluno ou inativar faculdade vale na hora, sem esperar o token expirar.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly chaves: ChavesJwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const alvos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICA, alvos)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { usuario?: unknown }>();
    const token = req.cookies?.[COOKIE_ACCESS];
    const sessao = typeof token === 'string' ? this.chaves.verificar(token) : null;
    if (!sessao) throw naoAutenticado();

    const usuario = await this.prisma.usuario.findUnique({ where: { id: sessao.id }, select: { status: true, papel: true } });
    if (!usuario || usuario.papel !== sessao.papel) throw naoAutenticado();

    if (usuario.status !== 'ATIVO') {
      // RN-22: aluno INATIVO só passa nas rotas @PermitirInativo(); os demais papéis perdem o acesso.
      const permiteInativo = this.reflector.getAllAndOverride<boolean>(PERMITE_INATIVO, alvos);
      if (!(usuario.papel === 'ALUNO' && usuario.status === 'INATIVO')) throw naoAutenticado('Conta inativa');
      if (!permiteInativo) throw proibido('Conta inativa: acesso restrito à troca de faculdade e ao histórico');
    }

    req.usuario = { ...sessao, status: usuario.status };
    return true;
  }
}
