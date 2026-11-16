/**
 * Destino pós-login (`?next=`): só caminhos internos (seção 8.3, ASVS 5.1.5 — sem open redirect).
 * Recusa URL absoluta, `//host`, barra invertida (`/\host` vira `//host` no navegador) e caracteres de controle.
 */
export function destinoInterno(next: string | null | undefined): string | null {
  if (!next || next.length > 512) return null;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(next)) return null;
  return next;
}
