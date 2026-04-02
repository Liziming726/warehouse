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
    return '登录时发生服务端错误，请稍后重试。';
  }

  if (
    error.message.includes('APP_SESSION_SECRET') ||
    error.message.includes('SESSION_SECRET')
  ) {
    return '服务端缺少 APP_SESSION_SECRET，请先配置环境变量。';
  }

  if (error.message.includes('NEXT_PUBLIC_SUPABASE_URL')) {
    return '服务端缺少 NEXT_PUBLIC_SUPABASE_URL，请先配置环境变量。';
  }

  if (error.message.includes('Supabase publishable key')) {
    return '服务端缺少 Supabase Publishable Key，请配置 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY。';
  }

  return '登录时发生服务端错误，请稍后重试。';
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
    return { error: '请输入用户名和密码。' };
  }

  if (!username || !password) {
    return {
      error: '当前数据库要求用户名和密码为纯数字。',
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
        error: '登录查询失败，请检查数据库权限配置。',
      };
    }

    if (!usersByUsername?.length) {
      return { error: '用户名不存在。' };
    }

    const matchedUser = usersByUsername.find(
      (user) => String(user.password).trim() === password
    );

    if (!matchedUser) {
      return { error: '密码不正确。' };
    }

    const warehouseRaw =
      matchedUser.warehouse === null || matchedUser.warehouse === undefined
        ? ''
        : String(matchedUser.warehouse);
    const warehouse = warehouseRaw.trim() || null;

    if (!matchedUser.is_admin && !warehouse) {
      return { error: '当前账号未分配仓库，请联系管理员。' };
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
