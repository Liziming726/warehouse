'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import { createOutbound } from '@/app/outbound/actions';
import type {
  InventoryAccess,
  MovementRow,
  ProductOption,
  WarehouseOption,
} from '@/src/lib/inventory/types';

type OutboundFormValues = {
  productId: string;
  warehouseId?: string;
  quantity: number;
  bizDate: string;
  remark?: string;
};

type OutboundClientProps = {
  access: InventoryAccess;
  products: ProductOption[];
  warehouses: WarehouseOption[];
  recentRows: MovementRow[];
  loadErrorMessage: string | null;
};

function formatDateTime(text: string) {
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) {
    return text || '-';
  }
  return date.toLocaleString();
}

function toFormData(values: OutboundFormValues) {
  const formData = new FormData();
  formData.set('productId', values.productId);
  formData.set('warehouseId', values.warehouseId ?? '');
  formData.set('quantity', String(values.quantity));
  formData.set('bizDate', values.bizDate);
  formData.set('remark', values.remark ?? '');
  return formData;
}

export default function OutboundClient({
  access,
  products,
  warehouses,
  recentRows,
  loadErrorMessage,
}: OutboundClientProps) {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<OutboundFormValues>();
  const [isPending, startTransition] = useTransition();
  const [keyword, setKeyword] = useState('');
  const router = useRouter();

  const canSubmit =
    !loadErrorMessage &&
    products.length > 0 &&
    (access.isAdmin ? warehouses.length > 0 : !!access.warehouseId);

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.sku} | ${product.name}`,
      })),
    [products]
  );

  const warehouseOptions = useMemo(
    () =>
      warehouses.map((warehouse) => ({
        value: warehouse.id,
        label: `${warehouse.name} (${warehouse.code})`,
      })),
    [warehouses]
  );

  const rows = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    if (!key) {
      return recentRows;
    }
    return recentRows.filter((row) =>
      [
        row.movementNo,
        row.sku,
        row.productName,
        row.warehouseName,
        row.operatorName,
        row.remark ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(key)
    );
  }, [keyword, recentRows]);

  const columns: ColumnsType<MovementRow> = [
    {
      title: 'Biz Date',
      dataIndex: 'bizDate',
      key: 'bizDate',
      width: 120,
    },
    {
      title: 'Movement No',
      dataIndex: 'movementNo',
      key: 'movementNo',
      width: 220,
    },
    {
      title: 'Product',
      key: 'product',
      width: 240,
      render: (_, row) => `${row.sku} | ${row.productName}`,
    },
    {
      title: 'Quantity',
      key: 'quantity',
      width: 120,
      render: (_, row) => `${row.quantity} ${row.unit}`,
    },
    {
      title: 'Warehouse',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      width: 180,
    },
    {
      title: 'Operator',
      dataIndex: 'operatorName',
      key: 'operatorName',
      width: 140,
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text) => formatDateTime(String(text)),
    },
    {
      title: 'Remark',
      dataIndex: 'remark',
      key: 'remark',
      width: 260,
      render: (text) => text || '-',
    },
  ];

  const defaultWarehouseId =
    access.warehouseId ?? warehouses[0]?.id ?? undefined;

  const defaultBizDate = new Date().toISOString().slice(0, 10);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: OutboundFormValues = {
        ...values,
        warehouseId: access.isAdmin ? values.warehouseId : access.warehouseId ?? '',
      };

      startTransition(async () => {
        try {
          await createOutbound(toFormData(payload));
          messageApi.success('Outbound record created.');
          form.resetFields();
          form.setFieldsValue({
            bizDate: defaultBizDate,
            quantity: 1,
            warehouseId: defaultWarehouseId,
          });
          router.refresh();
        } catch (error) {
          messageApi.error(
            error instanceof Error ? error.message : 'Failed to create outbound record.'
          );
        }
      });
    } catch {
      // antd will display field-level validation messages.
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {contextHolder}

      <Card>
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Outbound
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
          message="Failed to load outbound page data"
          description={loadErrorMessage}
        />
      ) : null}

      {products.length === 0 ? (
        <Alert
          type="warning"
          showIcon
          message="No products available"
          description="Please create products and bind them to a warehouse first."
        />
      ) : null}

      <Card title="Create Outbound Record">
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            bizDate: defaultBizDate,
            quantity: 1,
            warehouseId: defaultWarehouseId,
          }}
        >
          <Form.Item
            label="Product"
            name="productId"
            rules={[{ required: true, message: 'Please select a product.' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select product"
              options={productOptions}
            />
          </Form.Item>

          <Form.Item
            label="Warehouse"
            name="warehouseId"
            rules={
              access.isAdmin
                ? [{ required: true, message: 'Please select a warehouse.' }]
                : undefined
            }
          >
            <Select
              placeholder="Select warehouse"
              options={warehouseOptions}
              disabled={!access.isAdmin}
            />
          </Form.Item>

          <Form.Item
            label="Quantity"
            name="quantity"
            rules={[{ required: true, message: 'Please input quantity.' }]}
          >
            <InputNumber min={0.01} step={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="Business Date"
            name="bizDate"
            rules={[{ required: true, message: 'Please select business date.' }]}
          >
            <Input type="date" />
          </Form.Item>

          <Form.Item label="Remark" name="remark">
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>

          <Button
            type="primary"
            danger
            onClick={handleSubmit}
            loading={isPending}
            disabled={!canSubmit}
          >
            Submit Outbound
          </Button>
        </Form>
      </Card>

      <Card
        title="Recent Outbound Records"
        extra={
          <Input
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Search by movement/product/warehouse"
            style={{ width: 280 }}
          />
        }
      >
        <Table<MovementRow>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={isPending}
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </Space>
  );
}

