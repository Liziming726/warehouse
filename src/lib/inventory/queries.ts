import { createClient } from '@/src/lib/supabase/server';
import { requireLoginSession } from '@/src/lib/auth/access';
import type {
  InventoryAccess,
  InventoryRow,
  MovementRow,
  MovementType,
  ProductManageRow,
  ProductOption,
  WarehouseOption,
} from '@/src/lib/inventory/types';

type QueryError = {
  code?: string;
  message?: string;
};

type AppUserRow = {
  id: string | number;
  username: string | number | null;
  is_admin: boolean | null;
  nickname: string | null;
  warehouse: string | null;
  warehouse_id?: string | null;
};

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  status?: boolean | null;
};

type ProductRow = {
  id: string;
  sku: string | null;
  name: string | null;
  category: string | null;
  unit: string | null;
  warehouse_id?: string | null;
  warehouse?: string | null;
  status?: boolean | null;
};

type ProductManageDbRow = {
  id: string;
  sku: string | null;
  name: string | null;
  category: string | null;
  unit: string | null;
  safe_stock: number | string | null;
  warehouse_id: string | null;
  status: boolean | null;
  remark: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MovementViewRow = {
  id: string;
  movement_no: string | null;
  movement_type: MovementType;
  biz_date: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  product_id: string | null;
  sku: string | null;
  product_name: string | null;
  unit: string | null;
  quantity: number | string | null;
  operator_user_id: string | number | null;
  operator_nickname: string | null;
  operator_username: string | number | null;
  remark: string | null;
  is_void: boolean | null;
  created_at: string | null;
};

type InventoryViewRow = {
  warehouse_id: string | null;
  warehouse_code: string | null;
  warehouse_name: string | null;
  product_id: string;
  sku: string | null;
  product_name: string | null;
  category: string | null;
  unit: string | null;
  safe_stock: number | string | null;
  current_qty: number | string | null;
  stock_status: string | null;
  remark: string | null;
};

export class InventorySchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventorySchemaError';
  }
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text || null;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return n;
}

function mapSchemaError(error: QueryError | null) {
  if (!error) {
    return null;
  }

  if (error.code === '42P01') {
    return new InventorySchemaError(
      '库存相关表或视图不存在，请先执行 sql/2026-04-01_inventory_ledger_migration.sql。'
    );
  }

  if (error.code === '42703') {
    return new InventorySchemaError(
      '库存库结构版本过旧，请先执行 sql/2026-04-01_inventory_ledger_migration.sql。'
    );
  }

  return null;
}

export async function loadInventoryAccess(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<InventoryAccess> {
  const session = await requireLoginSession();

  const userById = await supabase
    .from('app_users')
    .select('id,username,is_admin,nickname,warehouse,warehouse_id')
    .eq('id', session.userId)
    .maybeSingle<AppUserRow>();

  if (userById.error) {
    throw new Error(`加载用户信息失败：${userById.error.message}`);
  }

  let row = userById.data;

  if (!row) {
    const userByUsername = await supabase
      .from('app_users')
      .select('id,username,is_admin,nickname,warehouse,warehouse_id')
      .eq('username', session.username)
      .maybeSingle<AppUserRow>();

    if (userByUsername.error) {
      throw new Error(
        `加载用户信息失败：${userByUsername.error.message}`
      );
    }

    row = userByUsername.data;
  }

  if (!row) {
    throw new Error('未登录或登录已失效。');
  }

  const warehouseId = normalizeText(row.warehouse_id);
  let warehouseName = normalizeText(row.warehouse);

  if (warehouseId) {
    const warehouseLookup = await supabase
      .from('warehouses')
      .select('id,name')
      .eq('id', warehouseId)
      .maybeSingle<{ id: string; name: string | null }>();

    if (warehouseLookup.error) {
      const schemaError = mapSchemaError(warehouseLookup.error);
      if (schemaError) {
        throw schemaError;
      }
      throw new Error(
        `加载仓库信息失败：${warehouseLookup.error.message}`
      );
    }

    warehouseName = normalizeText(warehouseLookup.data?.name) ?? warehouseName;
  }

  return {
    userId: String(row.id || session.userId).trim(),
    username: String(row.username || session.username).trim(),
    nickname: normalizeText(row.nickname),
    isAdmin: !!row.is_admin,
    warehouseId,
    warehouseName,
    legacyWarehouse: normalizeText(row.warehouse),
  };
}

export function resolveWriteWarehouseId(
  access: InventoryAccess,
  requestedWarehouseId: string | null
) {
  if (access.isAdmin) {
    if (!requestedWarehouseId) {
      throw new Error('管理员操作必须指定仓库。');
    }
    return requestedWarehouseId;
  }

  if (!access.warehouseId) {
    throw new Error(
      '当前账号未分配仓库，请联系管理员完善账号配置。'
    );
  }

  if (requestedWarehouseId && requestedWarehouseId !== access.warehouseId) {
    throw new Error('你只能操作自己所属仓库的数据。');
  }

  return access.warehouseId;
}

export async function loadWarehouseOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  access: InventoryAccess
): Promise<WarehouseOption[]> {
  let query = supabase
    .from('warehouses')
    .select('id,code,name,status')
    .order('name', { ascending: true });

  if (!access.isAdmin) {
    if (!access.warehouseId) {
      return [];
    }
    query = query.eq('id', access.warehouseId);
  }

  const { data, error } = await query;
  if (error) {
    const schemaError = mapSchemaError(error);
    if (schemaError) {
      throw schemaError;
    }
    throw new Error(`加载仓库列表失败：${error.message}`);
  }

  const rows = (data ?? []) as WarehouseRow[];
  return rows
    .filter((row) => row.status !== false)
    .map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
    }));
}

export async function loadProductOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  _access: InventoryAccess
): Promise<ProductOption[]> {
  void _access;

  const primaryQuery = await supabase
    .from('products')
    .select('id,sku,name,category,unit,warehouse_id,status')
    .order('created_at', { ascending: false });

  let rows: ProductRow[] = [];

  if (primaryQuery.error) {
    if (primaryQuery.error.code === '42703') {
      const legacyQuery = await supabase
        .from('products')
        .select('id,sku,name,category,unit,warehouse')
        .order('created_at', { ascending: false });

      if (legacyQuery.error) {
        throw new Error(`加载产品列表失败：${legacyQuery.error.message}`);
      }
      rows = (legacyQuery.data ?? []) as ProductRow[];
    } else {
      throw new Error(`加载产品列表失败：${primaryQuery.error.message}`);
    }
  } else {
    rows = (primaryQuery.data ?? []) as ProductRow[];
  }

  const filtered = rows.filter((row) => row.status !== false);

  return filtered
    .map((row) => ({
      id: row.id,
      sku: normalizeText(row.sku) ?? '-',
      name: normalizeText(row.name) ?? '未命名产品',
      category: normalizeText(row.category) ?? '',
      unit: normalizeText(row.unit) ?? '件',
      warehouseId: null,
      warehouseName: '全部仓库',
    }))
    .sort((a, b) => `${a.sku} ${a.name}`.localeCompare(`${b.sku} ${b.name}`));
}

export async function loadProductManageRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  _access: InventoryAccess
): Promise<ProductManageRow[]> {
  void _access;

  const query = supabase
    .from('products')
    .select(
      'id,sku,name,category,unit,safe_stock,warehouse_id,status,remark,created_at,updated_at'
    )
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    const schemaError = mapSchemaError(error);
    if (schemaError) {
      throw schemaError;
    }
    throw new Error(`加载产品列表失败：${error.message}`);
  }

  const rows = ((data ?? []) as ProductManageDbRow[]).filter(
    (row) => row.status !== false
  );
  return rows.map((row) => ({
    id: row.id,
    sku: normalizeText(row.sku) ?? '-',
    name: normalizeText(row.name) ?? '未命名产品',
    category: normalizeText(row.category) ?? '',
    unit: normalizeText(row.unit) ?? '件',
    safeStock: toNumber(row.safe_stock),
    warehouseId: null,
    warehouseName: '全部仓库',
    status: row.status !== false,
    remark: normalizeText(row.remark),
    createdAt: normalizeText(row.created_at) ?? '',
    updatedAt: normalizeText(row.updated_at) ?? '',
  }));
}

export async function loadMovementRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  access: InventoryAccess,
  movementType: MovementType,
  limit = 50
): Promise<MovementRow[]> {
  let query = supabase
    .from('v_stock_movements')
    .select(
      'id,movement_no,movement_type,biz_date,warehouse_id,warehouse_name,product_id,sku,product_name,unit,quantity,operator_user_id,operator_nickname,operator_username,remark,is_void,created_at'
    )
    .eq('movement_type', movementType)
    .eq('is_void', false)
    .order('biz_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!access.isAdmin) {
    if (!access.warehouseId) {
      return [];
    }
    query = query.eq('warehouse_id', access.warehouseId);
  }

  const { data, error } = await query;
  if (error) {
    const schemaError = mapSchemaError(error);
    if (schemaError) {
      throw schemaError;
    }
    throw new Error(`加载出入库流水失败：${error.message}`);
  }

  const rows = (data ?? []) as MovementViewRow[];
  return rows.map((row) => ({
    id: row.id,
    movementNo: normalizeText(row.movement_no) ?? '-',
    movementType: row.movement_type,
    bizDate: normalizeText(row.biz_date) ?? '',
    warehouseId: normalizeText(row.warehouse_id),
    warehouseName: normalizeText(row.warehouse_name) ?? '未分配仓库',
    productId: normalizeText(row.product_id),
    sku: normalizeText(row.sku) ?? '-',
    productName: normalizeText(row.product_name) ?? '未命名产品',
    unit: normalizeText(row.unit) ?? 'pcs',
    quantity: toNumber(row.quantity),
    operatorUserId: normalizeText(row.operator_user_id),
    operatorName:
      normalizeText(row.operator_nickname) ??
      normalizeText(row.operator_username) ??
      '-',
    remark: normalizeText(row.remark),
    isVoid: !!row.is_void,
    createdAt: normalizeText(row.created_at) ?? '',
  }));
}

export async function loadInventoryRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  access: InventoryAccess
): Promise<InventoryRow[]> {
  let query = supabase
    .from('v_current_inventory')
    .select(
      'warehouse_id,warehouse_code,warehouse_name,product_id,sku,product_name,category,unit,safe_stock,current_qty,stock_status,remark'
    )
    .order('sku', { ascending: true });

  if (!access.isAdmin) {
    if (!access.warehouseId) {
      return [];
    }
    query = query.eq('warehouse_id', access.warehouseId);
  }

  const { data, error } = await query;
  if (error) {
    const schemaError = mapSchemaError(error);
    if (schemaError) {
      throw schemaError;
    }
    throw new Error(`加载库存汇总失败：${error.message}`);
  }

  const rows = (data ?? []) as InventoryViewRow[];
  return rows.map((row) => ({
    warehouseId: normalizeText(row.warehouse_id),
    warehouseCode: normalizeText(row.warehouse_code) ?? '',
    warehouseName: normalizeText(row.warehouse_name) ?? '未分配仓库',
    productId: row.product_id,
    sku: normalizeText(row.sku) ?? '-',
    productName: normalizeText(row.product_name) ?? '未命名产品',
    category: normalizeText(row.category) ?? '',
    unit: normalizeText(row.unit) ?? 'pcs',
    safeStock: toNumber(row.safe_stock),
    currentQty: toNumber(row.current_qty),
    stockStatus: normalizeText(row.stock_status) ?? 'NORMAL',
    remark: normalizeText(row.remark),
  }));
}

export async function assertProductInWarehouse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  _warehouseId: string
) {
  void _warehouseId;

  const query = await supabase
    .from('products')
    .select('id,status')
    .eq('id', productId)
    .maybeSingle<{ id: string; status: boolean | null }>();

  if (query.error) {
    if (query.error.code === '42P01' || query.error.code === '42703') {
      throw new InventorySchemaError(
        '库存数据库结构不完整，请先执行 sql/2026-04-01_inventory_ledger_migration.sql。'
      );
    }
    throw new Error(`校验产品信息失败：${query.error.message}`);
  }

  if (!query.data) {
    throw new Error('产品不存在。');
  }

  if (query.data.status === false) {
    throw new Error('该产品已停用，不能进行出入库操作。');
  }
}
