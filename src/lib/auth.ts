
'use server';

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { SessionPayload } from '@/types';

// IMPORTANT: Set this in your .env.local file
// You can generate a good secret with: `openssl rand -base64 32`
const secretKey = process.env.SESSION_SECRET;

if (!secretKey) {
  throw new Error('SESSION_SECRET environment variable is not set. Please add it to your .env.local file.');
}

const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: any) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d') // 1 day session
    .sign(key);
}

export async function decrypt(session: string | undefined = ''): Promise<SessionPayload | null> {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, key, {
      algorithms: ['HS256'],
    });
    return payload as SessionPayload;
  } catch (error) {
    // It's normal for this to fail if the cookie is invalid or expired
    console.log('Failed to verify session.');
    return null;
  }
}

export async function createSession(userId: string, username: string, roles: string[]) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now
  const sessionPayload: Omit<SessionPayload, 'expiresAt'> & { expiresAt: Date } = { userId, username, roles, expiresAt };

  const session = await encrypt(sessionPayload);

  cookies().set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const sessionCookie = cookies().get('session')?.value;
  const session = await decrypt(sessionCookie);
  return session;
}

export async function deleteSession() {
  cookies().delete('session');
}
