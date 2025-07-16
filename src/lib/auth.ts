
'use server';

import { SignJWT, jwtVerify } from 'jose';
import type { SessionPayload } from '@/types';

// IMPORTANT: Set this in your .env.local file
// You can generate a good secret with: `openssl rand -base64 32`
let secretKey = process.env.SESSION_SECRET;

if (!secretKey) {
  secretKey = 'this-is-a-temporary-and-insecure-secret-key-for-development';
  console.warn(
    '\n' +
    '******************************************************************************************\n' +
    '** WARNING: SESSION_SECRET is not set in your .env.local file.                        **\n' +
    '** Using a default, insecure key for development purposes.                            **\n' +
    '** For production, please generate a strong secret and add it to your .env.local file.**\n' +
    '** Example: `openssl rand -base64 32`                                                 **\n' +
    '******************************************************************************************\n'
  );
}

const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: any) {
  // The token no longer has a built-in expiration time.
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(key);
}

export async function decrypt(session: string | undefined = ''): Promise<SessionPayload | null> {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, key, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    // It's normal for this to fail if the token is invalid or expired
    console.log('Failed to verify session.');
    return null;
  }
}

// --- LocalStorage Fallback for Client ---

// Only available in browser

export async function createSession(userId: string, username: string, roles: string[]): Promise<string> {
  const sessionPayload: SessionPayload = { userId, username, roles };
  const session = await encrypt(sessionPayload);
  return session;
}

export async function getSession(): Promise<SessionPayload | null> {
  // const token = getSessionToken(); // Removed localStorage fallback
  // return await decrypt(token || undefined);
  return null; // No session token available in this file
}

export async function deleteSession() {
  // removeSessionToken(); // Removed localStorage fallback
}
