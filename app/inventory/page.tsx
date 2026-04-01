import { redirect } from 'next/navigation';
import { Space, Typography } from 'antd';
import { createClient } from '@/src/lib/supabase/server';
import {
  InventorySchemaError,
  loadInventoryAccess,
  loadInventoryRows,
  loadWarehouseOptions,
} from '@/src/lib/inventory/queries';
import type {
  InventoryAccess,
  InventoryRow,
  WarehouseOption,
} from '@/src/lib/inventory/types';
import { isUnauthorizedError } from '@/src/lib/auth/access';
import WmsNav from '@/src/components/wms-nav';
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
  let warehouses: WarehouseOption[] = [];
  let loadErrorMessage: string | null = null;

  try {
    [rows, warehouses] = await Promise.all([
      loadInventoryRows(supabase, access),
      loadWarehouseOptions(supabase, access),
    ]);
  } catch (error) {
    if (error instanceof InventorySchemaError) {
      loadErrorMessage = error.message;
    } else if (error instanceof Error) {
      loadErrorMessage = error.message;
    } else {
      loadErrorMessage = 'Unknown error while loading inventory page.';
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Space orientation="vertical" size={2}>
          <h2>库存概览</h2>
        </Space>

        <WmsNav currentPath="/inventory" />

        <InventoryClient
          access={access}
          rows={rows}
          warehouses={warehouses}
          loadErrorMessage={loadErrorMessage}
        />
      </Space>
    </div>
  );
}
