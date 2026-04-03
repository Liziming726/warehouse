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
    return '库存不足，无法完成本次出库。';
  }
  if (message.includes('duplicate key')) {
    return '创建出库记录失败：流水号冲突。';
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
  const bizDate = access.isAdmin ? parseBizDate(formData.get('bizDate')) : null;
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
