import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const PROTECTED_PATHS = ['/dashboard', '/customers', '/operations', '/billing', '/staff'];
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/setup', '/pay'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow cron with secret
  if (pathname.startsWith('/api/cron')) {
    const secret = request.headers.get('x-cron-secret');
    if (secret === process.env.CRON_SECRET) return NextResponse.next();
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if this is a protected page route
  const isProtectedPage = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  // Check if this is a protected API route
  const isProtectedApi = pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/login');

  if (isProtectedPage || isProtectedApi) {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      if (isProtectedPage) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      if (isProtectedPage) {
        const res = NextResponse.redirect(new URL('/login', request.url));
        res.cookies.delete('auth-token');
        return res;
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Attach user info to headers for API routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId);
    requestHeaders.set('x-user-role', payload.role);
    requestHeaders.set('x-carpark-id', payload.carparkId);
    requestHeaders.set('x-user-name', payload.name);
    requestHeaders.set('x-user-initials', payload.initials);

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
