import { redirect } from 'next/navigation';
import { Space, Typography } from 'antd';
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
import WmsNav from '@/src/components/wms-nav';
import OutboundClient from '@/app/outbound/outbound-client';

export default async function OutboundPage() {
  const supabase = await createClient();

  let access: InventoryAccess;
  try {
    access = await loadInventoryAccess(supabase);
  } catch (error) {
    if (
      isUnauthorizedError(error) ||
      (error instanceof Error && error.message === 'Unauthorized')
    ) {
      redirect('/login?next=/outbound');
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
      loadMovementRows(supabase, access, 'OUT', 80),
    ]);
  } catch (error) {
    if (error instanceof InventorySchemaError) {
      loadErrorMessage = error.message;
    } else if (error instanceof Error) {
      loadErrorMessage = error.message;
    } else {
      loadErrorMessage = 'Unknown error while loading outbound page.';
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Space orientation="vertical" size={2}>
          <h2>记录出库操作</h2>
        </Space>

        <WmsNav currentPath="/outbound" />

        <OutboundClient
          access={access}
          products={products}
          warehouses={warehouses}
          recentRows={recentRows}
          loadErrorMessage={loadErrorMessage}
        />
      </Space>
    </div>
  );
}
