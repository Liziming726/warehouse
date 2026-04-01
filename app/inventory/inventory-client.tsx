'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { InventoryAccess, InventoryRow, WarehouseOption } from '@/src/lib/inventory/types';

type InventoryClientProps = {
  access: InventoryAccess;
  rows: InventoryRow[];
  warehouses: WarehouseOption[];
  loadErrorMessage: string | null;
};

const ALL_WAREHOUSES = '__ALL__';

export default function InventoryClient({
  access,
  rows,
  warehouses,
  loadErrorMessage,
}: InventoryClientProps) {
  const [keyword, setKeyword] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState(ALL_WAREHOUSES);

  const warehouseOptions = useMemo(() => {
    if (!access.isAdmin) {
      return [];
    }
    return [
      { label: 'All Warehouses', value: ALL_WAREHOUSES },
      ...warehouses.map((warehouse) => ({
        label: `${warehouse.name} (${warehouse.code})`,
        value: warehouse.id,
      })),
    ];
  }, [access.isAdmin, warehouses]);

  const warehouseScopedRows = useMemo(() => {
    if (!access.isAdmin || warehouseFilter === ALL_WAREHOUSES) {
      return rows;
    }
    return rows.filter((row) => row.warehouseId === warehouseFilter);
  }, [access.isAdmin, rows, warehouseFilter]);

  const filteredRows = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    if (!key) {
      return warehouseScopedRows;
    }
    return warehouseScopedRows.filter((row) =>
      [
        row.sku,
        row.productName,
        row.category,
        row.unit,
        row.warehouseName,
        row.stockStatus,
      ]
        .join(' ')
        .toLowerCase()
        .includes(key)
    );
  }, [keyword, warehouseScopedRows]);

  const totalSku = filteredRows.length;
  const totalQty = filteredRows.reduce((sum, row) => sum + row.currentQty, 0);
  const lowStockCount = filteredRows.filter(
    (row) => row.stockStatus === 'LOW_STOCK'
  ).length;
  const outOfStockCount = filteredRows.filter(
    (row) => row.stockStatus === 'OUT_OF_STOCK'
  ).length;

  const columns: ColumnsType<InventoryRow> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 140,
    },
    {
      title: 'Product',
      dataIndex: 'productName',
      key: 'productName',
      width: 220,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 140,
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
    },
    {
      title: 'Warehouse',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      width: 180,
    },
    {
      title: 'Current Qty',
      dataIndex: 'currentQty',
      key: 'currentQty',
      width: 130,
    },
    {
      title: 'Safe Stock',
      dataIndex: 'safeStock',
      key: 'safeStock',
      width: 120,
    },
    {
      title: 'Status',
      key: 'stockStatus',
      width: 130,
      render: (_, row) => (
        <Tag
          color={
            row.stockStatus === 'OUT_OF_STOCK'
              ? 'red'
              : row.stockStatus === 'LOW_STOCK'
              ? 'orange'
              : 'green'
          }
        >
          {row.stockStatus}
        </Tag>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Current Inventory
          </Typography.Title>
          <Typography.Text type="secondary">
            Current user: {access.nickname ?? access.username} | Scope:{' '}
            {access.isAdmin
              ? 'All warehouses'
              : access.warehouseName ?? 'Warehouse not assigned'}
          </Typography.Text>
        </Space>
      </Card>

      {loadErrorMessage ? (
        <Alert
          type="error"
          showIcon
          message="Failed to load inventory data"
          description={loadErrorMessage}
        />
      ) : null}

      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Products" value={totalSku} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Total Quantity" value={totalQty} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Low Stock" value={lowStockCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Out of Stock" value={outOfStockCount} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <Input
              allowClear
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search sku / product / category / warehouse"
              style={{ width: 320 }}
            />
            {access.isAdmin ? (
              <Select
                value={warehouseFilter}
                options={warehouseOptions}
                onChange={setWarehouseFilter}
                style={{ width: 260 }}
              />
            ) : null}
          </Space>

          <Table<InventoryRow>
            rowKey={(row) => `${row.warehouseId ?? '-'}-${row.productId}`}
            columns={columns}
            dataSource={filteredRows}
            scroll={{ x: 1200 }}
            pagination={{ pageSize: 12 }}
          />
        </Space>
      </Card>
    </Space>
  );
}

