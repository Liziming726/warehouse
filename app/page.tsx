import { redirect } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/server';
import {
  InventorySchemaError,
  loadInventoryAccess,
  loadInventoryRows,
  loadMovementRows,
  loadWarehouseOptions,
} from '@/src/lib/inventory/queries';
import type {
  InventoryAccess,
  InventoryRow,
  MovementRow,
  WarehouseOption,
} from '@/src/lib/inventory/types';
import { isUnauthorizedError } from '@/src/lib/auth/access';
import WmsShell from '@/src/components/wms-shell';
import HomeClient from '@/app/home-client';

export default async function HomePage() {
  const supabase = await createClient();

  let access: InventoryAccess;
  try {
    access = await loadInventoryAccess(supabase);
  } catch (error) {
    if (
      isUnauthorizedError(error) ||
      (error instanceof Error && error.message === 'Unauthorized')
    ) {
      redirect('/login?next=/');
    }
    throw error;
  }

  let inventoryRows: InventoryRow[] = [];
  let inboundRows: MovementRow[] = [];
  let outboundRows: MovementRow[] = [];
  let warehouses: WarehouseOption[] = [];
  let loadErrorMessage: string | null = null;

  try {
    [inventoryRows, inboundRows, outboundRows, warehouses] = await Promise.all([
      loadInventoryRows(supabase, access),
      loadMovementRows(supabase, access, 'IN', 20),
      loadMovementRows(supabase, access, 'OUT', 20),
      loadWarehouseOptions(supabase, access),
    ]);
  } catch (error) {
    if (error instanceof InventorySchemaError) {
      loadErrorMessage = error.message;
    } else if (error instanceof Error) {
      loadErrorMessage = error.message;
    } else {
      loadErrorMessage = '加载主面板时发生未知错误。';
    }
  }

  return (
    <WmsShell
      title="远宏交通仓库管理主面板"
      subtitle="基于出入库流水自动汇总库存，支持多仓统一管理。"
      currentPath="/"
      access={access}
    >
      <HomeClient
        access={access}
        inventoryRows={inventoryRows}
        inboundRows={inboundRows}
        outboundRows={outboundRows}
        warehouses={warehouses}
        loadErrorMessage={loadErrorMessage}
      />
    </WmsShell>
  );
}
