
import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/auth';

// 1. Specify public routes
const publicRoutes = ['/login'];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 2. Check if the current route is public
  const isPublicRoute = publicRoutes.includes(path);

  // 3. Decrypt the session from the cookie
  const cookie = req.cookies.get('session')?.value;
  const session = await decrypt(cookie);

  // 4. Redirect to /login if the user is not authenticated and the route is not public
  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  // 5. Redirect to / if the user is authenticated and tries to access a public route
  if (session && isPublicRoute) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  return NextResponse.next();
}

// Routes Middleware should not run on
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
