import { cookies } from 'next/headers';
import {
  parseSessionCookie,
  SESSION_COOKIE_NAME,
  type LoginSession,
} from '@/src/lib/auth/session';

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof UnauthorizedError;
}

export async function requireLoginSession(): Promise<LoginSession> {
  const cookieStore = await cookies();
  const session = parseSessionCookie(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );

  if (!session) {
    throw new UnauthorizedError();
  }

  return session;
}

