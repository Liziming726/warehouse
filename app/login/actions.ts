'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/server';
import {
  encodeSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '@/src/lib/auth/session';

type LoginState = {
  error: string | null;
};

function normalizeBigintInput(value: string) {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  return trimmed.replace(/^0+(?!$)/, '');
}

function getSafeRedirectTarget(target: string) {
  if (!target.startsWith('/') || target.startsWith('//')) {
    return '/';
  }

  return target;
}

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const usernameRaw = String(formData.get('username') || '').trim();
  const passwordRaw = String(formData.get('password') || '').trim();
  const username = normalizeBigintInput(usernameRaw);
  const password = normalizeBigintInput(passwordRaw);
  const redirectTo = getSafeRedirectTarget(
    String(formData.get('redirectTo') || '/')
  );

  if (!usernameRaw || !passwordRaw) {
    return { error: 'Please enter both username and password.' };
  }

  if (!username || !password) {
    return {
      error:
        'Current database schema requires numeric username/password (bigint).',
    };
  }

  const supabase = await createClient();
  const { data: usersByUsername, error } = await supabase
    .from('app_users')
    .select('id,username,password,is_admin,warehouse')
    .eq('username', username)
    .limit(20);

  if (error) {
    console.error('[login] Supabase query failed:', error);
    return {
      error: 'Login query failed in Supabase.',
    };
  }

  if (!usersByUsername?.length) {
    return { error: 'Username does not exist.' };
  }

  const matchedUser = usersByUsername.find(
    (user) => String(user.password).trim() === password
  );

  if (!matchedUser) {
    return { error: 'Password is incorrect.' };
  }

  const warehouseRaw =
    matchedUser.warehouse === null || matchedUser.warehouse === undefined
      ? ''
      : String(matchedUser.warehouse);
  const warehouse = warehouseRaw.trim() || null;

  if (!matchedUser.is_admin && !warehouse) {
    return { error: 'Your account is not assigned to a warehouse.' };
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: encodeSessionCookie({
      userId: String(matchedUser.id),
      username: String(matchedUser.username),
      isAdmin: !!matchedUser.is_admin,
      warehouse,
    }),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect(redirectTo);
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
  });

  redirect('/login');
}
