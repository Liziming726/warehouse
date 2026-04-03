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

export const PRODUCT_CATEGORY_OPTIONS = ['设备', '配件', '划线斗'] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORY_OPTIONS)[number];

export const PRODUCT_UNIT_OPTIONS = ['台', '件', '套'] as const;

export type ProductUnit = (typeof PRODUCT_UNIT_OPTIONS)[number];

export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  warehouseId: string | null;
  warehouseName: string | null;
};

export type ProductManageRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  safeStock: number;
  warehouseId: string | null;
  warehouseName: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
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
