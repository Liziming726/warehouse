import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Button, Space, Tag } from 'antd';
import { createClient } from '@/src/lib/supabase/server';
import { logout } from '@/app/login/actions';
import DashboardClient, { type ProductView } from './dashboard-client';
import {
  parseSessionCookie,
  SESSION_COOKIE_NAME,
} from '@/src/lib/auth/session';

type ProductRow = {
  id: string;
  sku: string | null;
  name: string | null;
  category: string | null;
  unit: string | null;
  created_at: string | null;
  quantity?: number | null;
  warehouse?: string | null;
};

type AppUserRow = {
  id: string | number;
  username: string | number | null;
  is_admin: boolean | null;
  warehouse: string | null;
  nickname?: string | null;
};

type QueryError = {
  code?: string;
  message?: string;
};

type UserAccess = {
  userId: string;
  username: string;
  isAdmin: boolean;
  warehouse: string | null;
  nickname?: string;
};

type LoadProductsResult = {
  rows: ProductRow[];
  error: QueryError | null;
  hasQuantityColumn: boolean;
  hasWarehouseColumn: boolean;
};

function normalizeWarehouse(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
}

function toQuantity(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }

  return Math.max(0, Math.floor(n));
}

function getStockStatus(quantity: number) {
  if (quantity === 0) return '缺货';
  if (quantity <= 10) return '低库存';
  return '正常';
}

async function hasProductColumn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  column: 'quantity' | 'warehouse'
) {
  const { error } = await supabase.from('products').select(column).limit(1);

  if (!error) {
    return { exists: true, error: null as QueryError | null };
  }

  if (error.code === '42703') {
    return { exists: false, error: null as QueryError | null };
  }

  return { exists: false, error: error as QueryError };
}

async function loadUserAccess(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<UserAccess | null> {
  const cookieStore = await cookies();
  const session = parseSessionCookie(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );

  if (!session) {
    return null;
  }

  const userById = await supabase
    .from('app_users')
    .select('id,username,is_admin,warehouse,nickname')
    .eq('id', session.userId)
    .maybeSingle<AppUserRow>();

  if (userById.error) {
    console.error('[home] Failed to load app_users by id:', userById.error);
    return null;
  }

  let row = userById.data;

  if (!row) {
    const userByUsername = await supabase
      .from('app_users')
      .select('id,username,is_admin,warehouse,nickname')
      .eq('nickname', session.username)
      .maybeSingle<AppUserRow>();

    if (userByUsername.error) {
      console.error(
        '[home] Failed to load app_users by nickname:',
        userByUsername.error
      );
      return null;
    }

    row = userByUsername.data;
  }

  if (!row) {
    return null;
  }

  const userId = String(row.id || session.userId).trim();
  const username = String(row.username || session.username).trim();
  const nickname = row.nickname ? String(row.nickname).trim() : undefined;

  if (!userId || !username) {
    return null;
  }

  return {
    userId,
    username,
    nickname,
    isAdmin: !!row.is_admin,
    warehouse: normalizeWarehouse(row.warehouse),
  };
}

async function loadProducts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  access: UserAccess
): Promise<LoadProductsResult> {
  const [quantityCheck, warehouseCheck] = await Promise.all([
    hasProductColumn(supabase, 'quantity'),
    hasProductColumn(supabase, 'warehouse'),
  ]);

  if (quantityCheck.error) {
    return {
      rows: [],
      error: quantityCheck.error,
      hasQuantityColumn: false,
      hasWarehouseColumn: warehouseCheck.exists,
    };
  }

  if (warehouseCheck.error) {
    return {
      rows: [],
      error: warehouseCheck.error,
      hasQuantityColumn: quantityCheck.exists,
      hasWarehouseColumn: false,
    };
  }

  if (!warehouseCheck.exists && !access.isAdmin) {
    return {
      rows: [],
      error: {
        message:
          'products table is missing warehouse column. Cannot scope data for non-admin users.',
      },
      hasQuantityColumn: quantityCheck.exists,
      hasWarehouseColumn: false,
    };
  }

  if (!access.isAdmin && !access.warehouse) {
    return {
      rows: [],
      error: {
        message: 'Your account is not assigned to a warehouse.',
      },
      hasQuantityColumn: quantityCheck.exists,
      hasWarehouseColumn: warehouseCheck.exists,
    };
  }

  const selectColumns = [
    'id',
    'sku',
    'name',
    'category',
    'unit',
    'created_at',
    warehouseCheck.exists ? 'warehouse' : null,
    quantityCheck.exists ? 'quantity' : null,
  ]
    .filter(Boolean)
    .join(',');

  let query = supabase
    .from('products')
    .select(selectColumns)
    .order('created_at', { ascending: false });

  if (warehouseCheck.exists && !access.isAdmin && access.warehouse) {
    query = query.eq('warehouse', access.warehouse);
  }

  const { data, error } = await query;

  return {
    rows: ((data ?? []) as unknown) as ProductRow[],
    error: (error ?? null) as QueryError | null,
    hasQuantityColumn: quantityCheck.exists,
    hasWarehouseColumn: warehouseCheck.exists,
  };
}

export default async function HomePage() {
  const supabase = await createClient();
  const access = await loadUserAccess(supabase);

  if (!access) {
    redirect('/login?next=/');
  }

  const { rows, error, hasQuantityColumn, hasWarehouseColumn } =
    await loadProducts(supabase, access);

  const products: ProductView[] = rows.map((row) => {
    const quantity = hasQuantityColumn ? toQuantity(row.quantity) : null;

    return {
      id: row.id,
      sku: row.sku ?? '',
      name: row.name ?? '',
      category: row.category ?? '',
      unit: row.unit ?? 'pcs',
      quantity,
      warehouse: normalizeWarehouse(row.warehouse) ?? 'Unassigned',
      status: quantity === null ? 'N/A' : getStockStatus(quantity),
      createdAt: row.created_at ?? '-',
    };
  });

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Space orientation="vertical" size={2}>
            <h1 style={{ margin: 0 }}>仓库管理系统</h1>
            <Space size="small" wrap>
              <Tag color={access.isAdmin ? 'gold' : 'blue'}>
                {access.isAdmin ? '管理员' : '员工'}
              </Tag>
              <span>
                {access.isAdmin
                  ? '管理范围: 所有仓库'
                  : `管理范围: ${access.warehouse ?? '未分配'}`}
              </span>
            </Space>
          </Space>

          <form action={logout}>
            <Button htmlType="submit" danger>
              登出 ({access.username})
            </Button>
          </form>
        </div>

        <DashboardClient
          products={products}
          hasQuantityColumn={hasQuantityColumn}
          hasWarehouseColumn={hasWarehouseColumn}
          canManageAllWarehouses={access.isAdmin}
          currentWarehouse={access.warehouse}
          loadErrorMessage={error?.message ?? null}
        />
      </Space>
    </div>
  );
}
