import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  if (path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
}

export const config = {
  matcher: ['/', '/login'],
};

