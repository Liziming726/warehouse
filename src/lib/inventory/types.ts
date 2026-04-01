export type InventoryAccess = {
  userId: string;
  username: string;
  nickname: string | null;
  isAdmin: boolean;
  warehouseId: string | null;
  warehouseName: string | null;
  legacyWarehouse: string | null;
};

export type WarehouseOption = {
  id: string;
  code: string;
  name: string;
};

export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  warehouseId: string | null;
  warehouseName: string | null;
};

export type MovementType = 'IN' | 'OUT';

export type MovementRow = {
  id: string;
  movementNo: string;
  movementType: MovementType;
  bizDate: string;
  warehouseId: string | null;
  warehouseName: string;
  productId: string | null;
  sku: string;
  productName: string;
  unit: string;
  quantity: number;
  operatorUserId: string | null;
  operatorName: string;
  remark: string | null;
  isVoid: boolean;
  createdAt: string;
};

export type InventoryRow = {
  warehouseId: string | null;
  warehouseCode: string;
  warehouseName: string;
  productId: string;
  sku: string;
  productName: string;
  category: string;
  unit: string;
  safeStock: number;
  currentQty: number;
  stockStatus: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | string;
};

