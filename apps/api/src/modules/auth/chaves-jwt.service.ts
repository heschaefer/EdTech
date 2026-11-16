import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { Papel, StatusUsuario } from '@prisma/client';
import { env } from '../../config/env';
import type { UsuarioSessao } from '../../common/sessao';

export const VIDA_ACCESS_SEG = 15 * 60;

type Claims = { sub: string; papel: Papel; status: StatusUsuario; jti: string };

/**
 * Access token JWT RS256 de 15 min com `kid` no cabeçalho (seção 8.1). Chaves antigas continuam
 * aceitas pelo kid, então trocar a chave não derruba sessões ativas.
 */
@Injectable()
export class ChavesJwtService {
  private readonly jwt = new JwtService({});
  private readonly publicas: Record<string, string>;

  constructor() {
    const anteriores = env().JWT_PUBLIC_KEYS_ANTERIORES ? JSON.parse(env().JWT_PUBLIC_KEYS_ANTERIORES!) : {};
    this.publicas = { ...anteriores, [env().JWT_KID]: env().JWT_PUBLIC_KEY };
  }

  assinar(u: { id: string; papel: Papel; status: StatusUsuario }): string {
    const claims: Claims = { sub: u.id, papel: u.papel, status: u.status, jti: randomUUID() };
    return this.jwt.sign(claims, {
      algorithm: 'RS256',
      privateKey: env().JWT_PRIVATE_KEY,
      keyid: env().JWT_KID,
      expiresIn: VIDA_ACCESS_SEG,
    });
  }

  /** SEG-10: alterado, expirado, sem kid conhecido ou com alg diferente de RS256 → null. */
  verificar(token: string): UsuarioSessao | null {
    try {
      const cabecalho = JSON.parse(Buffer.from(token.split('.')[0] ?? '', 'base64url').toString('utf8'));
      const chave = this.publicas[cabecalho?.kid];
      if (!chave || cabecalho.alg !== 'RS256') return null;
      const c = this.jwt.verify<Claims>(token, { algorithms: ['RS256'], publicKey: chave });
      return { id: c.sub, papel: c.papel, status: c.status, jti: c.jti };
    } catch {
      return null;
    }
  }
}
