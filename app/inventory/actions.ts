'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/src/lib/supabase/server';
import { loadInventoryAccess } from '@/src/lib/inventory/queries';
import {
  PRODUCT_CATEGORY_OPTIONS,
  PRODUCT_UNIT_OPTIONS,
} from '@/src/lib/inventory/types';

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

function parseNonNegativeNumber(
  value: FormDataEntryValue | null,
  fieldLabel: string
) {
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

function parseProductCategory(value: FormDataEntryValue | null) {
  const category = parseRequiredText(value, '产品分类', 20);
  if (
    !PRODUCT_CATEGORY_OPTIONS.includes(
      category as (typeof PRODUCT_CATEGORY_OPTIONS)[number]
    )
  ) {
    throw new Error(
      `产品分类仅支持：${PRODUCT_CATEGORY_OPTIONS.join(' / ')}。`
    );
  }
  return category;
}

function parseProductUnit(value: FormDataEntryValue | null) {
  const unit = parseRequiredText(value, '单位', 10);
  if (!PRODUCT_UNIT_OPTIONS.includes(unit as (typeof PRODUCT_UNIT_OPTIONS)[number])) {
    throw new Error(`单位仅支持：${PRODUCT_UNIT_OPTIONS.join(' / ')}。`);
  }
  return unit;
}

function parseOptionalRemark(value: FormDataEntryValue | null) {
  const text = normalizeText(value);
  return text.slice(0, 500) || null;
}

function revalidateInventoryPages() {
  revalidatePath('/');
  revalidatePath('/inventory');
  revalidatePath('/inbound');
  revalidatePath('/outbound');
}

function mapProductWriteError(message: string, action: '新增' | '更新') {
  if (message.includes('duplicate key')) {
    return `${action}产品失败：产品型号可能重复，请检查后重试。`;
  }

  return `${action}产品失败：${message}`;
}

export async function createProduct(formData: FormData) {
  const supabase = await createClient();
  const access = await loadInventoryAccess(supabase);
  if (!access.isAdmin) {
    throw new Error('仅管理员可以新增产品。');
  }

  const sku = parseRequiredText(formData.get('sku'), '产品型号', 100);
  const name = parseRequiredText(formData.get('name'), '产品名称', 200);
  const category = parseProductCategory(formData.get('category'));
  const unit = parseProductUnit(formData.get('unit'));
  const safeStock = parseNonNegativeNumber(formData.get('safeStock'), '安全库存');
  const remark = parseOptionalRemark(formData.get('remark'));

  const { error } = await supabase.from('products').insert({
    sku,
    name,
    category,
    unit,
    safe_stock: safeStock,
    warehouse_id: null,
    status: true,
    remark,
  });

  if (error) {
    throw new Error(mapProductWriteError(error.message, '新增'));
  }

  revalidateInventoryPages();
}

export async function updateProduct(formData: FormData) {
  const supabase = await createClient();
  const access = await loadInventoryAccess(supabase);
  if (!access.isAdmin) {
    throw new Error('仅管理员可以编辑产品。');
  }

  const productId = parseUuidField(formData.get('productId'), '产品');
  const sku = parseRequiredText(formData.get('sku'), '产品型号', 100);
  const name = parseRequiredText(formData.get('name'), '产品名称', 200);
  const category = parseProductCategory(formData.get('category'));
  const unit = parseProductUnit(formData.get('unit'));
  const safeStock = parseNonNegativeNumber(formData.get('safeStock'), '安全库存');
  const remark = parseOptionalRemark(formData.get('remark'));

  const { data, error } = await supabase
    .from('products')
    .update({
      sku,
      name,
      category,
      unit,
      safe_stock: safeStock,
      warehouse_id: null,
      remark,
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

function mapDeleteError(message: string) {
  if (message.includes('foreign key')) {
    return '删除产品失败：存在关联数据，请稍后重试。';
  }
  return `删除产品失败：${message}`;
}

export async function deleteProduct(formData: FormData) {
  const supabase = await createClient();
  const access = await loadInventoryAccess(supabase);
  if (!access.isAdmin) {
    throw new Error('仅管理员可以删除产品。');
  }

  const productId = parseUuidField(formData.get('productId'), '产品');

  // Hard delete: remove stock movements first, then remove product master.
  const movementDeleteResult = await supabase
    .from('stock_movements')
    .delete()
    .eq('product_id', productId);

  if (movementDeleteResult.error) {
    throw new Error(mapDeleteError(movementDeleteResult.error.message));
  }

  const deleteResult = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (deleteResult.error) {
    throw new Error(mapDeleteError(deleteResult.error.message));
  }

  if (!deleteResult.data) {
    throw new Error('产品不存在或已被删除。');
  }

  revalidateInventoryPages();
}

export async function updateProductRemark(formData: FormData) {
  const supabase = await createClient();
  await loadInventoryAccess(supabase);

  const productId = parseUuidField(formData.get('productId'), '产品');
  const remark = parseOptionalRemark(formData.get('remark'));

  const { error } = await supabase
    .from('products')
    .update({ remark })
    .eq('id', productId);

  if (error) {
    throw new Error(`更新备注失败：${error.message}`);
  }

  revalidateInventoryPages();
}

export async function updateMovementRemark(formData: FormData) {
  const supabase = await createClient();
  await loadInventoryAccess(supabase);

  const movementId = parseUuidField(formData.get('movementId'), '流水');
  const remark = parseOptionalRemark(formData.get('remark'));

  const { error } = await supabase
    .from('stock_movements')
    .update({ remark })
    .eq('id', movementId);

  if (error) {
    throw new Error(`更新备注失败：${error.message}`);
  }

  revalidateInventoryPages();
}