import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { env } from '../../config/env';

/**
 * AES-256-GCM para dados sensíveis (CPF, segredo TOTP) e HMAC-SHA256 como índice cego do CPF (seção 8.4).
 * Formato cifrado: v1.<iv>.<tag>.<dados>, tudo em base64url.
 */
@Injectable()
export class CifraService {
  private readonly chave = Buffer.from(env().DADOS_ENC_KEY, 'base64');
  private readonly chaveHmac = Buffer.from(env().CPF_HMAC_KEY, 'base64');

  cifrar(texto: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.chave, iv);
    const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
    return ['v1', iv, c.getAuthTag(), dados].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
  }

  decifrar(cifrado: string): string {
    const [versao, iv, tag, dados] = cifrado.split('.');
    if (versao !== 'v1') throw new Error('Formato de cifra desconhecido');
    const d = createDecipheriv('aes-256-gcm', this.chave, Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(dados, 'base64url')), d.final()]).toString('utf8');
  }

  /** Índice cego: permite o índice único sem guardar o CPF em claro (RN-02). */
  hmac(valor: string): string {
    return createHmac('sha256', this.chaveHmac).update(valor).digest('hex');
  }
}
