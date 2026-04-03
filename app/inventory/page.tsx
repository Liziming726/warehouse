import { redirect } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/server';
import {
  InventorySchemaError,
  loadInventoryAccess,
  loadInventoryRows,
  loadProductManageRows,
  loadWarehouseOptions,
} from '@/src/lib/inventory/queries';
import type {
  InventoryAccess,
  InventoryRow,
  ProductManageRow,
  WarehouseOption,
} from '@/src/lib/inventory/types';
import { isUnauthorizedError } from '@/src/lib/auth/access';
import WmsShell from '@/src/components/wms-shell';
import InventoryClient from '@/app/inventory/inventory-client';

export default async function InventoryPage() {
  const supabase = await createClient();

  let access: InventoryAccess;
  try {
    access = await loadInventoryAccess(supabase);
  } catch (error) {
    if (
      isUnauthorizedError(error) ||
      (error instanceof Error && error.message === 'Unauthorized')
    ) {
      redirect('/login?next=/inventory');
    }
    throw error;
  }

  let rows: InventoryRow[] = [];
  let products: ProductManageRow[] = [];
  let warehouses: WarehouseOption[] = [];
  let loadErrorMessage: string | null = null;

  try {
    [rows, products, warehouses] = await Promise.all([
      loadInventoryRows(supabase, access),
      loadProductManageRows(supabase, access),
      loadWarehouseOptions(supabase, access),
    ]);
  } catch (error) {
    if (error instanceof InventorySchemaError) {
      loadErrorMessage = error.message;
    } else if (error instanceof Error) {
      loadErrorMessage = error.message;
    } else {
      loadErrorMessage = '加载库存页面时发生未知错误。';
    }
  }

  return (
    <WmsShell
      title="远宏交通库存总览"
      subtitle="当前库存由入库与出库流水自动汇总生成。"
      currentPath="/inventory"
      access={access}
    >
      <InventoryClient
        access={access}
        rows={rows}
        products={products}
        warehouses={warehouses}
        loadErrorMessage={loadErrorMessage}
      />
    </WmsShell>
  );
}
