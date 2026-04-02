'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/src/lib/supabase/server';
import {
  loadInventoryAccess,
  resolveWriteWarehouseId,
} from '@/src/lib/inventory/queries';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function parseRequiredText(
  value: FormDataEntryValue | null,
  fieldLabel: string,
  maxLength: number
) {
  const text = normalizeText(value);
  if (!text) {
    throw new Error(`${fieldLabel}不能为空。`);
  }
  return text.slice(0, maxLength);
}

function parseOptionalText(value: FormDataEntryValue | null, maxLength: number) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }
  return text.slice(0, maxLength);
}

function parseNonNegativeNumber(value: FormDataEntryValue | null, fieldLabel: string) {
  const text = normalizeText(value);
  if (!text) {
    return 0;
  }

  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${fieldLabel}必须大于或等于 0。`);
  }

  return Math.round(n * 100) / 100;
}

function parseUuidField(value: FormDataEntryValue | null, fieldLabel: string) {
  const text = normalizeText(value);
  if (!UUID_RE.test(text)) {
    throw new Error(`${fieldLabel}格式不正确。`);
  }
  return text;
}

function parseOptionalUuidField(value: FormDataEntryValue | null, fieldLabel: string) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }
  if (!UUID_RE.test(text)) {
    throw new Error(`${fieldLabel}格式不正确。`);
  }
  return text;
}

function parseProductStatus(value: FormDataEntryValue | null) {
  const text = normalizeText(value).toLowerCase();
  if (!text) {
    return true;
  }
  return text === 'true' || text === '1' || text === 'on';
}

function revalidateInventoryPages() {
  revalidatePath('/');
  revalidatePath('/inventory');
  revalidatePath('/inbound');
  revalidatePath('/outbound');
}

function mapProductWriteError(message: string, action: '新增' | '更新') {
  if (message.includes('duplicate key')) {
    return `${action}产品失败：产品编码可能重复，请检查后重试。`;
  }

  if (message.includes('violates foreign key constraint')) {
    return `${action}产品失败：仓库信息无效。`;
  }

  return `${action}产品失败：${message}`;
}

type ProductWarehouseRow = {
  warehouse_id: string | null;
};

async function loadEditableProductWarehouse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string
) {
  const result = await supabase
    .from('products')
    .select('warehouse_id')
    .eq('id', productId)
    .maybeSingle<ProductWarehouseRow>();

  if (result.error) {
    throw new Error(`加载产品信息失败：${result.error.message}`);
  }

  if (!result.data) {
    throw new Error('产品不存在或已被删除。');
  }

  return normalizeText(result.data.warehouse_id);
}

export async function createProduct(formData: FormData) {
  const supabase = await createClient();
  const access = await loadInventoryAccess(supabase);

  const requestedWarehouseId = parseOptionalUuidField(
    formData.get('warehouseId'),
    '仓库'
  );
  const warehouseId = resolveWriteWarehouseId(access, requestedWarehouseId);

  const sku = parseRequiredText(formData.get('sku'), '产品编码', 100);
  const name = parseRequiredText(formData.get('name'), '产品名称', 200);
  const category = parseOptionalText(formData.get('category'), 100);
  const unit = parseRequiredText(formData.get('unit'), '单位', 50);
  const safeStock = parseNonNegativeNumber(formData.get('safeStock'), '安全库存');
  const status = parseProductStatus(formData.get('status'));

  const { error } = await supabase.from('products').insert({
    sku,
    name,
    category,
    unit,
    safe_stock: safeStock,
    warehouse_id: warehouseId,
    status,
  });

  if (error) {
    throw new Error(mapProductWriteError(error.message, '新增'));
  }

  revalidateInventoryPages();
}

export async function updateProduct(formData: FormData) {
  const supabase = await createClient();
  const access = await loadInventoryAccess(supabase);

  const productId = parseUuidField(formData.get('productId'), '产品');
  const productWarehouseId = await loadEditableProductWarehouse(supabase, productId);

  if (!access.isAdmin) {
    if (!access.warehouseId) {
      throw new Error('当前账号未分配仓库，请联系管理员。');
    }
    if (productWarehouseId !== access.warehouseId) {
      throw new Error('你没有权限编辑该产品。');
    }
  }

  const sku = parseRequiredText(formData.get('sku'), '产品编码', 100);
  const name = parseRequiredText(formData.get('name'), '产品名称', 200);
  const category = parseOptionalText(formData.get('category'), 100);
  const unit = parseRequiredText(formData.get('unit'), '单位', 50);
  const safeStock = parseNonNegativeNumber(formData.get('safeStock'), '安全库存');
  const status = parseProductStatus(formData.get('status'));

  const { data, error } = await supabase
    .from('products')
    .update({
      sku,
      name,
      category,
      unit,
      safe_stock: safeStock,
      status,
    })
    .eq('id', productId)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(mapProductWriteError(error.message, '更新'));
  }

  if (!data) {
    throw new Error('产品不存在或已被删除。');
  }

  revalidateInventoryPages();
}
