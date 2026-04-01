'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/src/lib/supabase/server';
import {
  parseSessionCookie,
  SESSION_COOKIE_NAME,
} from '@/src/lib/auth/session';

type QueryError = {
  code?: string;
  message?: string;
};

type AppUserRow = {
  id: string | number;
  username: string | number | null;
  is_admin: boolean | null;
  warehouse: string | null;
};

type UserAccess = {
  userId: string;
  username: string;
  isAdmin: boolean;
  warehouse: string | null;
};

function parseQuantity(raw: FormDataEntryValue | null) {
  const value = String(raw ?? '').trim();

  if (!value) {
    return 0;
  }

  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }

  return Math.floor(n);
}

function normalizeWarehouse(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
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
): Promise<UserAccess> {
  const cookieStore = await cookies();
  const session = parseSessionCookie(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );

  if (!session) {
    throw new Error('Unauthorized');
  }

  const userById = await supabase
    .from('app_users')
    .select('id,username,is_admin,warehouse')
    .eq('id', session.userId)
    .maybeSingle<AppUserRow>();

  if (userById.error) {
    throw new Error(`Failed to load user profile: ${userById.error.message}`);
  }

  let row = userById.data;

  if (!row) {
    const userByUsername = await supabase
      .from('app_users')
      .select('id,username,is_admin,warehouse')
      .eq('username', session.username)
      .maybeSingle<AppUserRow>();

    if (userByUsername.error) {
      throw new Error(
        `Failed to load user profile: ${userByUsername.error.message}`
      );
    }

    row = userByUsername.data;
  }

  if (!row) {
    throw new Error('Unauthorized');
  }

  return {
    userId: String(row.id || session.userId).trim(),
    username: String(row.username || session.username).trim(),
    isAdmin: !!row.is_admin,
    warehouse: normalizeWarehouse(row.warehouse),
  };
}

function revalidateProductPages() {
  revalidatePath('/');
  revalidatePath('/products');
}

function resolveWarehouseForWrite(
  access: UserAccess,
  rawWarehouse: FormDataEntryValue | null
) {
  if (access.isAdmin) {
    const warehouse = normalizeWarehouse(rawWarehouse);
    if (!warehouse) {
      throw new Error('Warehouse is required for admin operations.');
    }
    return warehouse;
  }

  if (!access.warehouse) {
    throw new Error('Your account is not assigned to a warehouse.');
  }

  return access.warehouse;
}

export async function addProduct(formData: FormData) {
  const supabase = await createClient();
  const access = await loadUserAccess(supabase);
  const sku = String(formData.get('sku') || '').trim();
  const name = String(formData.get('name') || '').trim();
  const categoryRaw = String(formData.get('category') || '').trim();
  const unitRaw = String(formData.get('unit') || '').trim();
  const quantity = parseQuantity(formData.get('quantity'));

  if (!sku || !name) {
    throw new Error('SKU and name are required');
  }

  const [quantityCheck, warehouseCheck] = await Promise.all([
    hasProductColumn(supabase, 'quantity'),
    hasProductColumn(supabase, 'warehouse'),
  ]);

  if (quantityCheck.error) {
    throw new Error(quantityCheck.error.message || 'Failed to inspect schema.');
  }

  if (warehouseCheck.error) {
    throw new Error(warehouseCheck.error.message || 'Failed to inspect schema.');
  }

  if (!warehouseCheck.exists && !access.isAdmin) {
    throw new Error(
      'products table is missing warehouse column. Cannot scope non-admin writes.'
    );
  }

  const payload: {
    sku: string;
    name: string;
    category: string | null;
    unit: string;
    quantity?: number;
    warehouse?: string;
  } = {
    sku,
    name,
    category: categoryRaw || null,
    unit: unitRaw || 'pcs',
  };

  if (quantityCheck.exists) {
    payload.quantity = quantity;
  }

  if (warehouseCheck.exists) {
    payload.warehouse = resolveWarehouseForWrite(access, formData.get('warehouse'));
  }

  const { error } = await supabase.from('products').insert(payload);

  if (error) {
    throw new Error(error.message);
  }

  revalidateProductPages();
}

export async function updateProduct(formData: FormData) {
  const supabase = await createClient();
  const access = await loadUserAccess(supabase);
  const id = String(formData.get('id') || '').trim();
  const sku = String(formData.get('sku') || '').trim();
  const name = String(formData.get('name') || '').trim();
  const categoryRaw = String(formData.get('category') || '').trim();
  const unitRaw = String(formData.get('unit') || '').trim();
  const quantity = parseQuantity(formData.get('quantity'));

  if (!id) {
    throw new Error('Product id is required');
  }

  if (!sku || !name) {
    throw new Error('SKU and name are required');
  }

  const [quantityCheck, warehouseCheck] = await Promise.all([
    hasProductColumn(supabase, 'quantity'),
    hasProductColumn(supabase, 'warehouse'),
  ]);

  if (quantityCheck.error) {
    throw new Error(quantityCheck.error.message || 'Failed to inspect schema.');
  }

  if (warehouseCheck.error) {
    throw new Error(warehouseCheck.error.message || 'Failed to inspect schema.');
  }

  if (!warehouseCheck.exists && !access.isAdmin) {
    throw new Error(
      'products table is missing warehouse column. Cannot scope non-admin writes.'
    );
  }

  if (!access.isAdmin && !access.warehouse) {
    throw new Error('Your account is not assigned to a warehouse.');
  }

  const payload: {
    sku: string;
    name: string;
    category: string | null;
    unit: string;
    quantity?: number;
    warehouse?: string;
  } = {
    sku,
    name,
    category: categoryRaw || null,
    unit: unitRaw || 'pcs',
  };

  if (quantityCheck.exists) {
    payload.quantity = quantity;
  }

  if (warehouseCheck.exists) {
    payload.warehouse = resolveWarehouseForWrite(access, formData.get('warehouse'));
  }

  let query = supabase.from('products').update(payload).eq('id', id);

  if (warehouseCheck.exists && !access.isAdmin) {
    query = query.eq('warehouse', access.warehouse!);
  }

  const { data, error } = await query.select('id').maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(
      access.isAdmin ? 'Product not found.' : 'No permission to edit this product.'
    );
  }

  revalidateProductPages();
}

export async function deleteProduct(formData: FormData) {
  const supabase = await createClient();
  const access = await loadUserAccess(supabase);
  const id = String(formData.get('id') || '').trim();

  if (!id) {
    throw new Error('Product id is required');
  }

  const warehouseCheck = await hasProductColumn(supabase, 'warehouse');

  if (warehouseCheck.error) {
    throw new Error(warehouseCheck.error.message || 'Failed to inspect schema.');
  }

  if (!warehouseCheck.exists && !access.isAdmin) {
    throw new Error(
      'products table is missing warehouse column. Cannot scope non-admin writes.'
    );
  }

  if (!access.isAdmin && !access.warehouse) {
    throw new Error('Your account is not assigned to a warehouse.');
  }

  let query = supabase.from('products').delete().eq('id', id);

  if (warehouseCheck.exists && !access.isAdmin) {
    query = query.eq('warehouse', access.warehouse!);
  }

  const { data, error } = await query.select('id').maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(
      access.isAdmin ? 'Product not found.' : 'No permission to delete this product.'
    );
  }

  revalidateProductPages();
}
