import { importSPKI, jwtVerify, type JWTPayload } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';
import { PAINEL_POR_PAPEL, type Papel } from '@vagas/contracts';

/**
 * Seção 8.1: valida o JWT (cookie `at`) com a chave pública e barra rota de outro papel
 * antes de renderizar. Também aplica CSP com nonce e os cabeçalhos de segurança (seção 8.3).
 */
const PREFIXOS: Record<string, Papel> = { '/aluno': 'ALUNO', '/empresa': 'EMPRESA', '/faculdade': 'FACULDADE', '/admin': 'ADMIN' };
// RN-22: aluno INATIVO só acessa troca de faculdade e histórico (e as próprias notificações).
const ROTAS_ALUNO_INATIVO = ['/aluno/trocar-faculdade', '/aluno/candidaturas', '/aluno/notificacoes'];

let chave: Promise<CryptoKey> | undefined;
const chavePublica = () => (chave ??= importSPKI((process.env.JWT_PUBLIC_KEY ?? '').replace(/\\n/g, '\n'), 'RS256'));

type Claims = JWTPayload & { papel: Papel; status: string };

async function sessao(req: NextRequest): Promise<Claims | null> {
  const token = req.cookies.get('at')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<Claims>(token, await chavePublica(), { algorithms: ['RS256'] });
    return payload;
  } catch {
    return null;
  }
}

function comCabecalhos(res: NextResponse, csp: string) {
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res;
}

export async function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://viacep.com.br",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');

  const { pathname, search } = req.nextUrl;
  const prefixo = Object.keys(PREFIXOS).find((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (prefixo) {
    const s = await sessao(req);
    if (!s) {
      const login = new URL('/login', req.url);
      login.searchParams.set('next', pathname + search);
      return comCabecalhos(NextResponse.redirect(login), csp);
    }
    if (PREFIXOS[prefixo] !== s.papel) {
      return comCabecalhos(NextResponse.redirect(new URL(PAINEL_POR_PAPEL[s.papel], req.url)), csp);
    }
    if (s.papel === 'ALUNO' && s.status === 'INATIVO' && !ROTAS_ALUNO_INATIVO.some((r) => pathname.startsWith(r))) {
      return comCabecalhos(NextResponse.redirect(new URL('/aluno/trocar-faculdade', req.url)), csp);
    }
  }

  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  return comCabecalhos(NextResponse.next({ request: { headers } }), csp);
}

export const config = {
  runtime: 'nodejs',
  matcher: [{ source: '/((?!api|_next/static|_next/image|favicon.ico).*)' }],
};
