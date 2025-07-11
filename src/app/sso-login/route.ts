import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { createSession } from '@/lib/auth';

const SSO_SECRET = process.env.SSO_SECRET!;

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.redirect('/login');

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SSO_SECRET));
    // payload: { username, roles, ... }
    const username = String(payload.username || payload.email || 'sso-user');
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    await createSession(username, username, roles);
    return NextResponse.redirect('/');
  } catch (e) {
    return NextResponse.redirect('/login');
  }
} 