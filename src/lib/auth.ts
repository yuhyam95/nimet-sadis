
'use server';

// Stub functions for compatibility with existing code
export async function createSession(userId: string, username: string, roles: string[]): Promise<string> {
  return "";
}

export async function getSession(): Promise<any> {
  return null;
}

export async function deleteSession() {
  // No-op since we're not using server-side sessions
}
