import { NextResponse, type NextRequest } from 'next/server';
import {
  parseSessionCookie,
  SESSION_COOKIE_NAME,
} from '@/src/lib/auth/session';

function getSafeRedirectTarget(target: string | null, fallback: string) {
  if (!target || !target.startsWith('/') || target.startsWith('//')) {
    return fallback;
  }

  return target;
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedPaths = ['/dashboard', '/products', '/inventory'];

  const isProtected =
    pathname === '/' ||
    protectedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const session = parseSessionCookie(
    request.cookies.get(SESSION_COOKIE_NAME)?.value
  );

  if (!session && isProtected) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (session && pathname === '/login') {
    const next = getSafeRedirectTarget(
      request.nextUrl.searchParams.get('next'),
      '/'
    );
    return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.next({
    request,
  });
}
