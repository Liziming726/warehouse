'use server';

import { createClient } from '@/src/lib/supabase/server';

function normalizeBigintInput(value: string) {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  return trimmed.replace(/^0+(?!$)/, '');
}

function getSupabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    ''
  );
}

export type TestDbState = {
  ok: boolean;
  summary: string;
  submitted: {
    usernameRaw: string;
    passwordLength: number;
    receivedAt: string;
  };
  normalized: {
    username: string | null;
    password: string | null;
  };
  keyConfig: {
    hasPublishableKey: boolean;
    hasServiceRoleKey: boolean;
    serviceRoleLooksPublishable: boolean;
    hasUsablePrivilegedKey: boolean;
  };
  database: {
    products: {
      ok: boolean;
      sampleCount: number;
      firstSku: string | null;
      error: string | null;
    };
    appUsers: {
      ok: boolean;
      userFound: boolean | null;
      passwordMatched: boolean | null;
      sampleUsernames: string[];
      error: string | null;
    };
  };
};

export async function runTestDbCheck(
  _prevState: TestDbState,
  formData: FormData
): Promise<TestDbState> {
  const usernameRaw = String(formData.get('username') || '').trim();
  const passwordRaw = String(formData.get('password') || '').trim();
  const username = normalizeBigintInput(usernameRaw);
  const password = normalizeBigintInput(passwordRaw);

  const submitted = {
    usernameRaw,
    passwordLength: passwordRaw.length,
    receivedAt: new Date().toISOString(),
  };

  if (!usernameRaw || !passwordRaw) {
    return {
      ok: false,
      summary: 'Request reached server, but username or password is empty.',
      submitted,
      normalized: { username, password },
      keyConfig: {
        hasPublishableKey: !!getSupabasePublishableKey(),
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        serviceRoleLooksPublishable:
          !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
          process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_publishable_'),
        hasUsablePrivilegedKey: false,
      },
      database: {
        products: {
          ok: false,
          sampleCount: 0,
          firstSku: null,
          error: 'Skipped (missing username/password)',
        },
        appUsers: {
          ok: false,
          userFound: null,
          passwordMatched: null,
          sampleUsernames: [],
          error: 'Skipped (missing username/password)',
        },
      },
    };
  }

  if (!username || !password) {
    return {
      ok: false,
      summary:
        'Request reached server. Input format is invalid for current schema: username/password must be digits only because app_users uses bigint.',
      submitted,
      normalized: { username, password },
      keyConfig: {
        hasPublishableKey: !!getSupabasePublishableKey(),
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        serviceRoleLooksPublishable:
          !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
          process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_publishable_'),
        hasUsablePrivilegedKey: false,
      },
      database: {
        products: {
          ok: false,
          sampleCount: 0,
          firstSku: null,
          error: 'Skipped (invalid bigint input)',
        },
        appUsers: {
          ok: false,
          userFound: null,
          passwordMatched: null,
          sampleUsernames: [],
          error: 'Skipped (invalid bigint input)',
        },
      },
    };
  }

  const supabase = await createClient();
  const publishableKey = getSupabasePublishableKey();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceRoleLooksPublishable =
    !!serviceRoleKey && serviceRoleKey.startsWith('sb_publishable_');
  const hasUsablePrivilegedKey = false;

  const [productsResult, usersByUsernameResult, usersByCredentialResult, sampleUsersResult] =
    await Promise.all([
      supabase.from('products').select('id,sku').limit(5),
      supabase
        .from('app_users')
        .select('id,password')
        .eq('username', username)
        .limit(5),
      supabase
        .from('app_users')
        .select('id')
        .eq('username', username)
        .eq('password', password)
        .limit(1),
      supabase.from('app_users').select('username').limit(5),
    ]);

  const productsError = productsResult.error?.message ?? null;
  const appUsersError =
    usersByUsernameResult.error?.message ??
    usersByCredentialResult.error?.message ??
    sampleUsersResult.error?.message ??
    null;

  const usersByUsername = usersByUsernameResult.data ?? [];
  const usersByCredential = usersByCredentialResult.data ?? [];
  const sampleUsers = sampleUsersResult.data ?? [];

  const userFound = usersByUsername.length > 0;
  const passwordMatched = usersByCredential.length > 0;
  const hasDbAccess = !productsError;
  const canReadAppUsers = !appUsersError;
  const isHealthy = hasDbAccess && canReadAppUsers;

  let summary = 'Request reached server and database is accessible.';

  if (!hasDbAccess) {
    summary = 'Request reached server, but products table is not accessible.';
  } else if (!canReadAppUsers) {
    summary =
      'Request reached server, but app_users query failed (likely RLS or permissions).';
  } else if (!userFound) {
    summary =
      'Request reached server, database is accessible, but username was not found.';
  } else if (!passwordMatched) {
    summary = 'Request reached server, username exists, but password does not match.';
  }

  return {
    ok: isHealthy,
    summary,
    submitted,
    normalized: { username, password },
    keyConfig: {
      hasPublishableKey: !!publishableKey,
      hasServiceRoleKey: !!serviceRoleKey,
      serviceRoleLooksPublishable,
      hasUsablePrivilegedKey,
    },
    database: {
      products: {
        ok: !productsError,
        sampleCount: (productsResult.data ?? []).length,
        firstSku: (productsResult.data ?? [])[0]?.sku ?? null,
        error: productsError,
      },
      appUsers: {
        ok: !appUsersError,
        userFound,
        passwordMatched,
        sampleUsernames: sampleUsers.map((u) => String(u.username)),
        error: appUsersError,
      },
    },
  };
}
