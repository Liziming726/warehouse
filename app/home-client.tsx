'use client';

import { useDeferredValue, useMemo, useState, useTransition } from 'react';
import {
  Alert,
  Button,
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
  message,
} from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';
import { useRouter } from 'next/navigation';
import { updateMovementRemark, updateProductRemark } from '@/app/inventory/actions';
import CountUp from '@/src/components/count-up';
import ActivityFeed from '@/src/components/activity-feed';
import { downloadExcel } from '@/src/lib/export-excel';
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
const ALL_STATUSES = '__ALL__';

const STATUS_OPTIONS = [
  { label: '全部状态', value: ALL_STATUSES },
  { label: '正常', value: 'NORMAL' },
  { label: '低库存', value: 'LOW_STOCK' },
  { label: '缺货', value: 'OUT_OF_STOCK' },
];

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
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [isPending, startTransition] = useTransition();
  const [messageApi, contextHolder] = message.useMessage();
  const router = useRouter();

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
    let result = warehouseScopedRows;
    if (statusFilter !== ALL_STATUSES) {
      result = result.filter((row) => row.stockStatus === statusFilter);
    }
    const key = deferredKeyword.trim().toLowerCase();
    if (key) {
      result = result.filter((row) =>
        [row.sku, row.productName, row.category, row.warehouseName, row.stockStatus]
          .join(' ')
          .toLowerCase()
          .includes(key)
      );
    }
    return result;
  }, [deferredKeyword, warehouseScopedRows, statusFilter]);

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

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayInbound = useMemo(
    () => inboundRows.filter((r) => r.bizDate === todayStr).length,
    [inboundRows, todayStr]
  );
  const todayOutbound = useMemo(
    () => outboundRows.filter((r) => r.bizDate === todayStr).length,
    [outboundRows, todayStr]
  );

  function RemarkCell({ value, onSave }: { value: string | null; onSave: (newValue: string) => void }) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(value ?? '');

    if (!editing) {
      return (
        <div
          onClick={() => { setText(value ?? ''); setEditing(true); }}
          style={{ cursor: 'pointer', minHeight: 24, padding: '4px 0' }}
        >
          {value || <Typography.Text type="secondary">-</Typography.Text>}
        </div>
      );
    }

    return (
      <Input
        size="small"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { onSave(text); setEditing(false); }}
        onPressEnter={() => { onSave(text); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === 'Escape') { setText(value ?? ''); setEditing(false); } }}
        onClick={(e) => e.stopPropagation()}
        maxLength={500}
        placeholder="输入备注"
        style={{ width: '100%' }}
      />
    );
  }

  function saveRemark(productId: string, oldValue: string | null, newValue: string) {
    const trimmed = newValue.trim();
    if (trimmed === (oldValue ?? '').trim()) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('productId', productId);
        formData.set('remark', trimmed);
        await updateProductRemark(formData);
        router.refresh();
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : '更新备注失败。');
      }
    });
  }

  function saveMovementRemark(movementId: string, oldValue: string | null, newValue: string) {
    const trimmed = newValue.trim();
    if (trimmed === (oldValue ?? '').trim()) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('movementId', movementId);
        formData.set('remark', trimmed);
        await updateMovementRemark(formData);
        router.refresh();
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : '更新备注失败。');
      }
    });
  }

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
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 180,
      render: (text, row) => (
        <RemarkCell
          value={text}
          onSave={(newValue) => saveRemark(row.productId, text, newValue)}
        />
      ),
    },
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
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 180,
      render: (text, row) => (
        <RemarkCell
          value={text}
          onSave={(newValue) => saveMovementRemark(row.id, text, newValue)}
        />
      ),
    },
  ];

  const handleExportInventory = () => {
    downloadExcel(
      filteredInventoryRows as unknown as Record<string, unknown>[],
      [
        { title: '产品型号', dataIndex: 'sku', key: 'sku' },
        { title: '产品名称', dataIndex: 'productName', key: 'productName' },
        { title: '所属仓库', dataIndex: 'warehouseName', key: 'warehouseName' },
        { title: '当前库存', dataIndex: 'currentQty', key: 'currentQty' },
        { title: '安全库存', dataIndex: 'safeStock', key: 'safeStock' },
        { title: '状态', key: 'stockStatus', render: (_v, r) => formatStockStatus(r.stockStatus as string) },
        { title: '备注', dataIndex: 'remark', key: 'remark' },
      ],
      `库存快照_${new Date().toISOString().slice(0, 10)}`
    );
  };

  const handleExportInbound = () => {
    downloadExcel(
      inboundRows as unknown as Record<string, unknown>[],
      [
        { title: '业务日期', dataIndex: 'bizDate', key: 'bizDate' },
        { title: '流水号', dataIndex: 'movementNo', key: 'movementNo' },
        { title: '产品型号', dataIndex: 'sku', key: 'sku' },
        { title: '产品名称', dataIndex: 'productName', key: 'productName' },
        { title: '数量', dataIndex: 'quantity', key: 'quantity' },
        { title: '仓库', dataIndex: 'warehouseName', key: 'warehouseName' },
        { title: '操作人', dataIndex: 'operatorName', key: 'operatorName' },
        { title: '备注', dataIndex: 'remark', key: 'remark' },
      ],
      `入库记录_${new Date().toISOString().slice(0, 10)}`
    );
  };

  const handleExportOutbound = () => {
    downloadExcel(
      outboundRows as unknown as Record<string, unknown>[],
      [
        { title: '业务日期', dataIndex: 'bizDate', key: 'bizDate' },
        { title: '流水号', dataIndex: 'movementNo', key: 'movementNo' },
        { title: '产品型号', dataIndex: 'sku', key: 'sku' },
        { title: '产品名称', dataIndex: 'productName', key: 'productName' },
        { title: '数量', dataIndex: 'quantity', key: 'quantity' },
        { title: '仓库', dataIndex: 'warehouseName', key: 'warehouseName' },
        { title: '操作人', dataIndex: 'operatorName', key: 'operatorName' },
        { title: '备注', dataIndex: 'remark', key: 'remark' },
      ],
      `出库记录_${new Date().toISOString().slice(0, 10)}`
    );
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      {contextHolder}

      {loadErrorMessage ? (
        <Alert
          type="error"
          showIcon
          message="主面板数据加载失败"
          description={loadErrorMessage}
        />
      ) : null}

      <Row gutter={[12, 12]}>
        <Col xs={12} lg={4}>
          <Card>
            <Statistic title="产品数" formatter={() => <CountUp end={totalSku} />} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card>
            <Statistic title="库存总量" formatter={() => <CountUp end={totalQty} />} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card>
            <Statistic
              title="低库存"
              value={lowStockRows.length}
              formatter={() => <CountUp end={lowStockRows.length} />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card>
            <Statistic
              title="缺货"
              value={outOfStockRows.length}
              formatter={() => <CountUp end={outOfStockRows.length} />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card>
            <Statistic
              title="今日入库"
              valueStyle={{ color: '#1677ff' }}
              formatter={() => <CountUp end={todayInbound} />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card>
            <Statistic
              title="今日出库"
              valueStyle={{ color: '#dc2626' }}
              formatter={() => <CountUp end={todayOutbound} />}
            />
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
            <Select
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={setStatusFilter}
              style={{ width: isMobile ? '100%' : 150 }}
            />
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleExportInventory}
            >
              导出
            </Button>
          </Space>
        }
      >
        <Table<InventoryRow>
          rowKey={(row) => `${row.warehouseId ?? '-'}-${row.productId}`}
          columns={inventoryColumns}
          dataSource={filteredInventoryRows}
          virtual
          size={isMobile ? 'small' : 'middle'}
          scroll={{ x: 1200, y: isMobile ? 360 : 520 }}
          pagination={{ pageSize: isMobile ? 6 : 10 }}
        />
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} xl={8}>
          <Card title="实时动态">
            <ActivityFeed inboundRows={inboundRows} outboundRows={outboundRows} max={10} />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card
            title="最新入库"
            extra={
              <Button size="small" icon={<DownloadOutlined />} onClick={handleExportInbound}>
                导出
              </Button>
            }
          >
            <Table<MovementRow>
              rowKey="id"
              columns={movementColumns}
              dataSource={inboundRows.slice(0, 5)}
              virtual
              size={isMobile ? 'small' : 'middle'}
              scroll={{ x: 1020, y: isMobile ? 260 : 360 }}
              pagination={false}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card
            title="最新出库"
            extra={
              <Button size="small" icon={<DownloadOutlined />} onClick={handleExportOutbound}>
                导出
              </Button>
            }
          >
            <Table<MovementRow>
              rowKey="id"
              columns={movementColumns}
              dataSource={outboundRows.slice(0, 5)}
              virtual
              size={isMobile ? 'small' : 'middle'}
              scroll={{ x: 1020, y: isMobile ? 260 : 360 }}
              pagination={false}
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
