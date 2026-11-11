import { NextRequest, NextResponse } from 'next/server';
import { authenticated, SITE_COOKIE } from '@/lib/server/auth';
import { siteLockConfig } from '@/lib/server/config';

export function proxy(request: NextRequest) {
 if (process.env.DIARY_SITE_LOCK !== 'true') return NextResponse.next();
 const path = request.nextUrl.pathname;
 if (path === '/api/site/session') return NextResponse.next();
 let unlocked = false;
 try { unlocked = authenticated(request, siteLockConfig(), Date.now(), SITE_COOKIE); }
 catch { /* Leave the lock closed until its configuration is available. */ }
 if (unlocked || path === '/unlock') {
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
 }
 if (path.startsWith('/api/')) return NextResponse.json({ error: '먼저 다이어리 잠금을 해제해 주세요.' }, {
  status: 401, headers: { 'Cache-Control': 'no-store' },
 });
 const redirect = request.nextUrl.clone();
 redirect.pathname = '/unlock';
 redirect.search = '';
 redirect.searchParams.set('next', path + request.nextUrl.search);
 const response = NextResponse.redirect(redirect);
 response.headers.set('Cache-Control', 'no-store');
 return response;
}

export const config = {
 matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
