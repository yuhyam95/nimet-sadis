
import { NextResponse, NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  return NextResponse.next();
}

// Routes Middleware should not run on
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
