'use client';

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react';
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
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';
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
  preferredWarehouseId?: string | null;
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
  preferredWarehouseId,
  loadErrorMessage,
}: OutboundClientProps) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<OutboundFormValues>();
  const [isPending, startTransition] = useTransition();
  const [keyword, setKeyword] = useState('');
  const deferredKeyword = useDeferredValue(keyword);
  const router = useRouter();
  const selectedWarehouseId = Form.useWatch('warehouseId', form);

  const effectiveWarehouseId = access.isAdmin
    ? selectedWarehouseId
    : access.warehouseId ?? undefined;

  const filteredProducts = useMemo(() => {
    if (!effectiveWarehouseId) {
      return access.isAdmin ? [] : products;
    }

    return products;
  }, [access.isAdmin, effectiveWarehouseId, products]);

  const productOptions = useMemo(
    () =>
      filteredProducts.map((product) => ({
        value: product.id,
        label: `${product.sku} | ${product.name}`,
      })),
    [filteredProducts]
  );

  const canSelectProduct = access.isAdmin
    ? !!effectiveWarehouseId
    : !!access.warehouseId;

  const canSubmit =
    !loadErrorMessage &&
    filteredProducts.length > 0 &&
    (access.isAdmin
      ? warehouses.length > 0 && !!effectiveWarehouseId
      : !!access.warehouseId);

  const warehouseOptions = useMemo(
    () =>
      warehouses.map((warehouse) => ({
        value: warehouse.id,
        label: `${warehouse.name} (${warehouse.code})`,
      })),
    [warehouses]
  );

  const rows = useMemo(() => {
    const key = deferredKeyword.trim().toLowerCase();
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
  }, [deferredKeyword, recentRows]);

  const columns: ColumnsType<MovementRow> = [
    {
      title: '业务日期',
      dataIndex: 'bizDate',
      key: 'bizDate',
      width: 120,
    },
    {
      title: '流水号',
      dataIndex: 'movementNo',
      key: 'movementNo',
      width: 220,
    },
    {
      title: '产品',
      key: 'product',
      width: 240,
      render: (_, row) => `${row.sku} | ${row.productName}`,
    },
    {
      title: '数量',
      key: 'quantity',
      width: 120,
      render: (_, row) => `${row.quantity} ${row.unit}`,
    },
    {
      title: '仓库',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      width: 180,
    },
    {
      title: '操作人',
      dataIndex: 'operatorName',
      key: 'operatorName',
      width: 140,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text) => formatDateTime(String(text)),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 260,
      render: (text) => text || '-',
    },
  ];

  const initialWarehouseId = access.isAdmin
    ? preferredWarehouseId ?? warehouses[0]?.id ?? undefined
    : access.warehouseId ?? undefined;

  const defaultBizDate = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!access.isAdmin) {
      return;
    }

    form.setFieldValue('productId', undefined);
  }, [access.isAdmin, form, selectedWarehouseId]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: OutboundFormValues = {
        ...values,
        warehouseId: access.isAdmin ? values.warehouseId : access.warehouseId ?? '',
      };
      const nextWarehouseId = payload.warehouseId || initialWarehouseId;

      startTransition(async () => {
        try {
          await createOutbound(toFormData(payload));
          messageApi.success('出库记录创建成功。');
          form.resetFields();
          form.setFieldsValue({
            bizDate: defaultBizDate,
            quantity: 1,
            warehouseId: nextWarehouseId,
          });
          router.refresh();
        } catch (error) {
          messageApi.error(
            error instanceof Error ? error.message : '创建出库记录失败。'
          );
        }
      });
    } catch {
      // antd will display field-level validation messages.
    }
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      {contextHolder}

      <Card>
        <Space orientation="vertical" size={6} style={{ width: '100%' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            出库登记
          </Typography.Title>
          <Typography.Text type="secondary">
            当前用户：{access.nickname ?? access.username} | 数据范围：
            {access.isAdmin
              ? '全部仓库'
              : access.warehouseName ?? '未分配仓库'}
          </Typography.Text>
        </Space>
      </Card>

      {loadErrorMessage ? (
        <Alert
          type="error"
          showIcon
          message="出库页面数据加载失败"
          description={loadErrorMessage}
        />
      ) : null}

      {products.length === 0 ? (
        <Alert
          type="warning"
          showIcon
          message="暂无可用产品"
          description="请先到“库存”页的“产品管理”中新增产品。"
        />
      ) : null}

      {access.isAdmin &&
      !!effectiveWarehouseId &&
      filteredProducts.length === 0 ? (
        <Alert
          type="warning"
          showIcon
          message="当前仓库暂无可用产品"
          description="请先到“库存”页的“产品管理”中为该仓库新增产品。"
        />
      ) : null}

      <Card title="新增出库记录">
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            bizDate: defaultBizDate,
            quantity: 1,
            warehouseId: initialWarehouseId,
          }}
        >
          <Form.Item
            label="仓库"
            name="warehouseId"
            rules={
              access.isAdmin
                ? [{ required: true, message: '请选择仓库。' }]
                : undefined
            }
          >
            <Select
              placeholder="请选择仓库"
              options={warehouseOptions}
              disabled={!access.isAdmin}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="产品"
            name="productId"
            rules={[{ required: true, message: '请选择产品。' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={
                !canSelectProduct
                  ? '请先选择仓库'
                  : filteredProducts.length === 0
                  ? '该仓库暂无可选产品'
                  : '请选择产品'
              }
              options={productOptions}
              disabled={!canSelectProduct || filteredProducts.length === 0}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="数量"
            name="quantity"
            rules={[{ required: true, message: '请输入数量。' }]}
          >
            <InputNumber min={0.01} step={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="业务日期"
            name="bizDate"
            rules={[{ required: true, message: '请选择业务日期。' }]}
          >
            <Input type="date" />
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>

          <Button
            type="primary"
            danger
            onClick={handleSubmit}
            loading={isPending}
            disabled={!canSubmit}
            style={isMobile ? { width: '100%' } : undefined}
          >
            提交出库
          </Button>
        </Form>
      </Card>

      <Card
        title="最近出库记录"
        extra={
          <Input
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索流水号、产品、仓库"
            style={{ width: isMobile ? '100%' : 280 }}
          />
        }
      >
        <Table<MovementRow>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={isPending}
          virtual
          size={isMobile ? 'small' : 'middle'}
          scroll={{ x: 1300, y: isMobile ? 360 : 520 }}
          pagination={{ pageSize: isMobile ? 8 : 10 }}
        />
      </Card>
    </Space>
  );
}
