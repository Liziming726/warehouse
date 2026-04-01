'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/src/lib/supabase/server';
import {
  assertProductInWarehouse,
  loadInventoryAccess,
  resolveWriteWarehouseId,
} from '@/src/lib/inventory/queries';
import {
  parseBizDate,
  parseOptionalUuid,
  parsePositiveQuantity,
  parseRemark,
  parseUuid,
  toOperatorUserId,
} from '@/src/lib/inventory/validators';

function revalidateInventoryPages() {
  revalidatePath('/');
  revalidatePath('/inventory');
  revalidatePath('/inbound');
  revalidatePath('/outbound');
}

function mapOutboundRpcError(message: string) {
  if (message.includes('Insufficient stock')) {
    return 'Insufficient stock for this outbound request.';
  }
  if (message.includes('duplicate key')) {
    return 'Failed to create outbound movement: movement number conflict.';
  }
  return message;
}

export async function createOutbound(formData: FormData) {
  const supabase = await createClient();
  const access = await loadInventoryAccess(supabase);

  const productId = parseUuid(formData.get('productId'), 'productId');
  const warehouseId = resolveWriteWarehouseId(
    access,
    parseOptionalUuid(formData.get('warehouseId'), 'warehouseId')
  );
  const quantity = parsePositiveQuantity(formData.get('quantity'), 'quantity');
  const bizDate = parseBizDate(formData.get('bizDate'));
  const remark = parseRemark(formData.get('remark'));
  const operatorUserId = toOperatorUserId(access.userId);

  await assertProductInWarehouse(supabase, productId, warehouseId);

  const { error } = await supabase.rpc('create_stock_out', {
    p_product_id: productId,
    p_warehouse_id: warehouseId,
    p_quantity: quantity,
    p_biz_date: bizDate,
    p_operator_user_id: operatorUserId,
    p_remark: remark,
  });

  if (error) {
    throw new Error(mapOutboundRpcError(error.message));
  }

  revalidateInventoryPages();
}

