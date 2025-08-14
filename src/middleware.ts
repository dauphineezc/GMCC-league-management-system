// Mock auth: sets/reads x-user-id + cookie

import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';

export function middleware(req: Request) {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/api')) return NextResponse.next();

  // Try header, then cookie; else mint a dev id
  const headers = new Headers(req.headers);
  let userId = headers.get('x-user-id') || '';
  const cookies = (req as any).cookies;
  const cookieId = cookies?.get?.('auth_user')?.value;
  if (!userId && cookieId) userId = cookieId;
  if (!userId) userId = uuid();

  const res = NextResponse.next({
    request: { headers: new Headers({ ...Object.fromEntries(headers), 'x-user-id': userId }) },
  });
  // Persist cookie (non-HTTPOnly for convenience in dev)
  res.cookies.set('auth_user', userId, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 180 });
  return res;
}

export const config = {
  // Apply to all API routes
  matcher: ['/api/:path*'],
};
