import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAME, verificarTokenSesion, type SesionCookiePayload } from '@/lib/auth-cookie';

const PUBLIC_PREFIXES = ['/_next', '/favicon.ico'];

const PUBLIC_API = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/setup-status',
]);

function esAdminPayload(p: SesionCookiePayload): boolean {
  return p.es_admin || p.rol_nombre.trim().toLowerCase() === 'administrador';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const payload = await verificarTokenSesion(token);

  if (pathname === '/login') {
    if (payload) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (PUBLIC_API.has(pathname)) {
    return NextResponse.next();
  }

  if (!payload) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const admin = esAdminPayload(payload);

  if ((pathname === '/usuarios' || pathname.startsWith('/api/usuarios')) && !admin) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (pathname !== '/dashboard' && !admin) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
