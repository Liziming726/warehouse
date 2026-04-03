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

type InboundPageProps = {
  searchParams: Promise<{ warehouseId?: string | string[] }>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseWarehouseIdParam(value?: string | null) {
  if (!value) {
    return null;
  }

  const text = value.trim();
  if (!UUID_RE.test(text)) {
    return null;
  }

  return text;
}

export default async function InboundPage({ searchParams }: InboundPageProps) {
  const supabase = await createClient();
  const params = await searchParams;
  const rawWarehouseId = Array.isArray(params.warehouseId)
    ? params.warehouseId[0]
    : params.warehouseId;
  const requestedWarehouseId = parseWarehouseIdParam(rawWarehouseId);

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
  let preferredWarehouseId: string | null = null;

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

  if (access.isAdmin && requestedWarehouseId) {
    preferredWarehouseId = warehouses.some(
      (warehouse) => warehouse.id === requestedWarehouseId
    )
      ? requestedWarehouseId
      : null;
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
        preferredWarehouseId={preferredWarehouseId}
        loadErrorMessage={loadErrorMessage}
      />
    </WmsShell>
  );
}
