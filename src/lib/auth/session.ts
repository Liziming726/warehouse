import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'wms_session_user';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export type LoginSession = {
  userId: string;
  username: string;
  isAdmin: boolean;
  warehouse: string | null;
};

function getSessionSecret() {
  const secret = process.env.APP_SESSION_SECRET || process.env.SESSION_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Missing APP_SESSION_SECRET (or SESSION_SECRET) for signed session cookies.'
    );
  }

  return 'dev-insecure-session-secret';
}

function signSessionBody(body: string) {
  return createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
}

function isValidSignature(body: string, signature: string) {
  const expected = signSessionBody(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function encodeSessionCookie(session: LoginSession) {
  const warehouse = session.warehouse?.trim() || null;

  const body = Buffer.from(
    JSON.stringify({
      userId: session.userId.trim(),
      username: session.username.trim(),
      isAdmin: session.isAdmin,
      warehouse,
    }),
    'utf8'
  ).toString('base64url');

  const signature = signSessionBody(body);
  return `${body}.${signature}`;
}

export function parseSessionCookie(
  rawValue: string | null | undefined
): LoginSession | null {
  if (!rawValue) {
    return null;
  }

  try {
    const [body, signature] = rawValue.split('.');

    if (!body || !signature || !isValidSignature(body, signature)) {
      return null;
    }

    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as Partial<LoginSession>;

    const userId = String(parsed.userId || '').trim();
    const username = String(parsed.username || '').trim();
    const isAdmin = !!parsed.isAdmin;
    const warehouseRaw =
      parsed.warehouse === null || parsed.warehouse === undefined
        ? ''
        : String(parsed.warehouse);
    const warehouse = warehouseRaw.trim() || null;

    if (!/^\d+$/.test(userId) || !/^\d+$/.test(username)) {
      return null;
    }

    return { userId, username, isAdmin, warehouse };
  } catch {
    return null;
  }
}
