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

function getFriendlyLoginErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Server error occurred during login. Please try again.';
  }

  if (
    error.message.includes('APP_SESSION_SECRET') ||
    error.message.includes('SESSION_SECRET')
  ) {
    return 'Server is missing APP_SESSION_SECRET. Please configure it in environment variables.';
  }

  if (error.message.includes('NEXT_PUBLIC_SUPABASE_URL')) {
    return 'Server is missing NEXT_PUBLIC_SUPABASE_URL. Please configure it in environment variables.';
  }

  if (error.message.includes('Supabase publishable key')) {
    return 'Server is missing Supabase publishable key. Please configure NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.';
  }

  return 'Server error occurred during login. Please try again.';
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

  try {
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
  } catch (error) {
    console.error('[login] Unexpected error:', error);
    return {
      error: getFriendlyLoginErrorMessage(error),
    };
  }

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
