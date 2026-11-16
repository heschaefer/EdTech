import type { Problema } from '@vagas/contracts';

export const API = '/api/v1';

export class ErroApi extends Error {
  constructor(readonly status: number, readonly problema: Problema) {
    super(problema.detail ?? problema.title);
  }
  /** Erros por campo, prontos para o React Hook Form. */
  campos(): Record<string, string[]> {
    const mapa: Record<string, string[]> = {};
    for (const e of this.problema.errors ?? []) (mapa[e.campo] ??= []).push(e.mensagem);
    return mapa;
  }
}

const lerCookie = (nome: string) =>
  typeof document === 'undefined' ? '' : decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith(`${nome}=`))?.split('=')[1] ?? '');

let renovando: Promise<boolean> | null = null;

/** AUTH-02: várias requisições com 401 ao mesmo tempo disparam um único refresh. */
export function renovarSessao(): Promise<boolean> {
  renovando ??= fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'same-origin' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => setTimeout(() => (renovando = null), 0));
  return renovando;
}

type Opcoes = Omit<RequestInit, 'body'> & { corpo?: unknown; semRenovar?: boolean };

export async function api<T = unknown>(caminho: string, { corpo, semRenovar, headers, ...init }: Opcoes = {}): Promise<T> {
  const executar = () =>
    fetch(API + caminho, {
      credentials: 'same-origin',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        'X-CSRF-Token': lerCookie('csrf'),
        ...headers,
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });

  let res = await executar();
  if (res.status === 401 && !semRenovar && !caminho.startsWith('/auth/')) {
    if (await renovarSessao()) res = await executar();
    else if (typeof window !== 'undefined') {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
  }

  if (res.status === 204) return undefined as T;
  const corpoResp = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErroApi(res.status, { type: 'about:blank', title: 'Erro', status: res.status, ...corpoResp });
  return corpoResp as T;
}

export async function sair() {
  await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
  window.location.href = '/login';
}
