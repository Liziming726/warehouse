'use client';

import { useDeferredValue, useMemo, useState } from 'react';
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
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';
import type {
  InventoryAccess,
  InventoryRow,
  MovementRow,
  WarehouseOption,
} from '@/src/lib/inventory/types';

type HomeClientProps = {
  access: InventoryAccess;
  inventoryRows: InventoryRow[];
  inboundRows: MovementRow[];
  outboundRows: MovementRow[];
  warehouses: WarehouseOption[];
  loadErrorMessage: string | null;
};

const ALL_WAREHOUSES = '__ALL__';

function statusColor(status: string) {
  if (status === 'OUT_OF_STOCK') {
    return 'red';
  }
  if (status === 'LOW_STOCK') {
    return 'orange';
  }
  return 'green';
}

function formatStockStatus(status: string) {
  if (status === 'OUT_OF_STOCK') {
    return '缺货';
  }
  if (status === 'LOW_STOCK') {
    return '低库存';
  }
  if (status === 'NORMAL') {
    return '正常';
  }
  return status;
}

function formatDateTime(text: string) {
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) {
    return text || '-';
  }
  return date.toLocaleString();
}

export default function HomeClient({
  access,
  inventoryRows,
  inboundRows,
  outboundRows,
  warehouses,
  loadErrorMessage,
}: HomeClientProps) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [keyword, setKeyword] = useState('');
  const deferredKeyword = useDeferredValue(keyword);
  const [warehouseFilter, setWarehouseFilter] = useState(ALL_WAREHOUSES);

  const warehouseOptions = useMemo(() => {
    if (!access.isAdmin) {
      return [];
    }
    return [
      { value: ALL_WAREHOUSES, label: '全部仓库' },
      ...warehouses.map((warehouse) => ({
        value: warehouse.id,
        label: `${warehouse.name} (${warehouse.code})`,
      })),
    ];
  }, [access.isAdmin, warehouses]);

  const warehouseScopedRows = useMemo(() => {
    if (!access.isAdmin || warehouseFilter === ALL_WAREHOUSES) {
      return inventoryRows;
    }
    return inventoryRows.filter((row) => row.warehouseId === warehouseFilter);
  }, [access.isAdmin, inventoryRows, warehouseFilter]);

  const filteredInventoryRows = useMemo(() => {
    const key = deferredKeyword.trim().toLowerCase();
    if (!key) {
      return warehouseScopedRows;
    }
    return warehouseScopedRows.filter((row) =>
      [
        row.sku,
        row.productName,
        row.category,
        row.warehouseName,
        row.stockStatus,
      ]
        .join(' ')
        .toLowerCase()
        .includes(key)
    );
  }, [deferredKeyword, warehouseScopedRows]);

  const totalSku = filteredInventoryRows.length;
  const totalQty = filteredInventoryRows.reduce(
    (sum, row) => sum + row.currentQty,
    0
  );
  const lowStockRows = filteredInventoryRows.filter(
    (row) => row.stockStatus === 'LOW_STOCK'
  );
  const outOfStockRows = filteredInventoryRows.filter(
    (row) => row.stockStatus === 'OUT_OF_STOCK'
  );

  const inventoryColumns: ColumnsType<InventoryRow> = [
    { title: '产品型号', dataIndex: 'sku', key: 'sku', width: 140 },
    {
      title: '产品名称',
      dataIndex: 'productName',
      key: 'productName',
      width: 220,
    },
    { title: '所属仓库', dataIndex: 'warehouseName', key: 'warehouseName', width: 170 },
    { title: '当前库存', dataIndex: 'currentQty', key: 'currentQty', width: 100 },
    { title: '安全库存', dataIndex: 'safeStock', key: 'safeStock', width: 100 },
    {
      title: '状态',
      key: 'stockStatus',
      width: 130,
      render: (_, row) => (
        <Tag color={statusColor(row.stockStatus)}>
          {formatStockStatus(row.stockStatus)}
        </Tag>
      ),
    },
  ];

  const movementColumns: ColumnsType<MovementRow> = [
    { title: '业务日期', dataIndex: 'bizDate', key: 'bizDate', width: 120 },
    {
      title: '产品',
      key: 'product',
      width: 220,
      render: (_, row) => `${row.sku} | ${row.productName}`,
    },
    {
      title: '数量',
      key: 'quantity',
      width: 110,
      render: (_, row) => `${row.quantity} ${row.unit}`,
    },
    { title: '仓库', dataIndex: 'warehouseName', key: 'warehouseName', width: 140 },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (value) => formatDateTime(String(value)),
    },
  ];

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      {loadErrorMessage ? (
        <Alert
          type="error"
          showIcon
          message="主面板数据加载失败"
          description={loadErrorMessage}
        />
      ) : null}

      <Row gutter={[12, 12]}>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title="产品数" value={totalSku} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title="库存总量" value={totalQty} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title="低库存" value={lowStockRows.length} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title="缺货" value={outOfStockRows.length} />
          </Card>
        </Col>
      </Row>

      {outOfStockRows.length > 0 ? (
        <Alert
          type="error"
          showIcon
          title={`缺货提醒：${outOfStockRows.length}`}
          description={outOfStockRows
            .slice(0, 6)
            .map((row) => `${row.sku} ${row.productName}`)
            .join(' | ')}
        />
      ) : null}

      {lowStockRows.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          title={`低库存提醒：${lowStockRows.length}`}
          description={lowStockRows
            .slice(0, 6)
            .map((row) => `${row.sku} ${row.currentQty}/${row.safeStock}`)
            .join(' | ')}
        />
      ) : null}

      <Card
        title="库存快照"
        extra={
          <Space wrap size="small">
            <Input
              allowClear
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索产品型号、名称、分类、仓库"
              style={{ width: isMobile ? '100%' : 230 }}
            />
            {access.isAdmin ? (
              <Select
                value={warehouseFilter}
                options={warehouseOptions}
                onChange={setWarehouseFilter}
                style={{ width: isMobile ? '100%' : 220 }}
              />
            ) : null}
          </Space>
        }
      >
        <Table<InventoryRow>
          rowKey={(row) => `${row.warehouseId ?? '-'}-${row.productId}`}
          columns={inventoryColumns}
          dataSource={filteredInventoryRows}
          virtual
          size={isMobile ? 'small' : 'middle'}
          scroll={{ x: 980, y: isMobile ? 360 : 520 }}
          pagination={{ pageSize: isMobile ? 6 : 10 }}
        />
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} xl={12}>
          <Card title="最新入库">
            <Table<MovementRow>
              rowKey="id"
              columns={movementColumns}
              dataSource={inboundRows}
              virtual
              size={isMobile ? 'small' : 'middle'}
              scroll={{ x: 860, y: isMobile ? 320 : 420 }}
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="最新出库">
            <Table<MovementRow>
              rowKey="id"
              columns={movementColumns}
              dataSource={outboundRows}
              virtual
              size={isMobile ? 'small' : 'middle'}
              scroll={{ x: 860, y: isMobile ? 320 : 420 }}
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </Col>
      </Row>

      {!loadErrorMessage && filteredInventoryRows.length === 0 ? (
        <Card>
          <Typography.Text type="secondary">
            当前范围内暂无库存数据。
          </Typography.Text>
        </Card>
      ) : null}
    </Space>
  );
}
