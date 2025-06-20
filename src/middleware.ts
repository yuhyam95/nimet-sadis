
import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/auth';

const publicRoutes = ['/login'];
const adminRoutes = ['/configuration', '/logs', '/user-management'];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);
  const isAdminRoute = adminRoutes.some(route => path.startsWith(route));

  const cookie = req.cookies.get('session')?.value;
  const session = await decrypt(cookie);

  // Redirect unauthenticated users from protected routes
  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  // Redirect authenticated users from public routes
  if (session && isPublicRoute) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  // Role-based access control for admin routes
  if (session && isAdminRoute) {
    const userRoles = session.roles || [];
    if (!userRoles.includes('admin')) {
      // Redirect non-admins to the dashboard homepage
      return NextResponse.redirect(new URL('/', req.nextUrl));
    }
  }

  return NextResponse.next();
}

// Routes Middleware should not run on
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
