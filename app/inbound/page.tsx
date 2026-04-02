import { redirect } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/server';
import {
  InventorySchemaError,
  loadInventoryAccess,
  loadMovementRows,
  loadProductOptions,
  loadWarehouseOptions,
} from '@/src/lib/inventory/queries';
import type {
  InventoryAccess,
  MovementRow,
  ProductOption,
  WarehouseOption,
} from '@/src/lib/inventory/types';
import { isUnauthorizedError } from '@/src/lib/auth/access';
import WmsShell from '@/src/components/wms-shell';
import InboundClient from '@/app/inbound/inbound-client';

export default async function InboundPage() {
  const supabase = await createClient();

  let access: InventoryAccess;
  try {
    access = await loadInventoryAccess(supabase);
  } catch (error) {
    if (
      isUnauthorizedError(error) ||
      (error instanceof Error && error.message === 'Unauthorized')
    ) {
      redirect('/login?next=/inbound');
    }
    throw error;
  }

  let products: ProductOption[] = [];
  let warehouses: WarehouseOption[] = [];
  let recentRows: MovementRow[] = [];
  let loadErrorMessage: string | null = null;

  try {
    [products, warehouses, recentRows] = await Promise.all([
      loadProductOptions(supabase, access),
      loadWarehouseOptions(supabase, access),
      loadMovementRows(supabase, access, 'IN', 80),
    ]);
  } catch (error) {
    if (error instanceof InventorySchemaError) {
      loadErrorMessage = error.message;
    } else if (error instanceof Error) {
      loadErrorMessage = error.message;
    } else {
      loadErrorMessage = '加载入库页面时发生未知错误。';
    }
  }

  return (
    <WmsShell
      title="入库管理"
      subtitle="按日期、产品和仓库登记入库记录。"
      currentPath="/inbound"
      access={access}
    >
      <InboundClient
        access={access}
        products={products}
        warehouses={warehouses}
        recentRows={recentRows}
        loadErrorMessage={loadErrorMessage}
      />
    </WmsShell>
  );
}
