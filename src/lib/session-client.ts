// src/lib/session-client.ts

export function setSessionToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('session', token);
  }
}

export function getSessionToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('session');
  }
  return null;
}

export function removeSessionToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('session');
  }
} 