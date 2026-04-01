'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';
import { useRouter } from 'next/navigation';
import { addProduct, deleteProduct, updateProduct } from '@/app/products/actions';

export type ProductView = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number | null;
  warehouse: string;
  status: string;
  createdAt: string;
};

type ProductFormValues = {
  sku: string;
  name: string;
  category?: string;
  unit?: string;
  quantity?: number;
  warehouse?: string;
};

type DashboardClientProps = {
  products: ProductView[];
  hasQuantityColumn: boolean;
  hasWarehouseColumn: boolean;
  canManageAllWarehouses: boolean;
  currentWarehouse: string | null;
  loadErrorMessage: string | null;
};

const ALL_WAREHOUSES_VALUE = '__ALL__';

function toFormData(values: ProductFormValues, id?: string) {
  const formData = new FormData();

  if (id) {
    formData.set('id', id);
  }

  formData.set('sku', values.sku ?? '');
  formData.set('name', values.name ?? '');
  formData.set('category', values.category ?? '');
  formData.set('unit', values.unit ?? '');
  formData.set('quantity', String(values.quantity ?? 0));
  formData.set('warehouse', values.warehouse ?? '');

  return formData;
}

function normalizeWarehouse(value: string | null | undefined) {
  const text = String(value ?? '').trim();
  return text || '';
}

function formatDate(text: string) {
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) {
    return text;
  }
  return date.toLocaleString();
}

export default function DashboardClient({
  products,
  hasQuantityColumn,
  hasWarehouseColumn,
  canManageAllWarehouses,
  currentWarehouse,
  loadErrorMessage,
}: DashboardClientProps) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [isPending, startTransition] = useTransition();
  const [keyword, setKeyword] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState(ALL_WAREHOUSES_VALUE);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ProductView | null>(null);
  const [createForm] = Form.useForm<ProductFormValues>();
  const [editForm] = Form.useForm<ProductFormValues>();

  const canWriteInScope =
    !hasWarehouseColumn || canManageAllWarehouses || !!currentWarehouse;
  const showWarehouseFilter = canManageAllWarehouses && hasWarehouseColumn;

  const warehouseValues = useMemo(() => {
    if (!showWarehouseFilter) {
      return [];
    }

    return Array.from(
      new Set(
        products
          .map((item) => normalizeWarehouse(item.warehouse))
          .filter((item) => item.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [products, showWarehouseFilter]);

  const warehouseOptions = useMemo(() => {
    if (!showWarehouseFilter) {
      return [];
    }

    return [
      { label: '所有仓库', value: ALL_WAREHOUSES_VALUE },
      ...warehouseValues.map((warehouse) => ({ label: warehouse, value: warehouse })),
    ];
  }, [showWarehouseFilter, warehouseValues]);

  const effectiveWarehouseFilter =
    showWarehouseFilter &&
    (warehouseFilter === ALL_WAREHOUSES_VALUE ||
      warehouseValues.includes(warehouseFilter))
      ? warehouseFilter
      : ALL_WAREHOUSES_VALUE;

  const warehouseScopedProducts = useMemo(() => {
    if (
      !showWarehouseFilter ||
      effectiveWarehouseFilter === ALL_WAREHOUSES_VALUE
    ) {
      return products;
    }

    return products.filter(
      (item) => normalizeWarehouse(item.warehouse) === effectiveWarehouseFilter
    );
  }, [products, showWarehouseFilter, effectiveWarehouseFilter]);

  const filteredProducts = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    if (!key) return warehouseScopedProducts;

    return warehouseScopedProducts.filter((item) =>
      [item.sku, item.name, item.category, item.unit, item.warehouse]
        .join(' ')
        .toLowerCase()
        .includes(key)
    );
  }, [warehouseScopedProducts, keyword]);

  const totalCategories = useMemo(
    () =>
      new Set(
        warehouseScopedProducts
          .map((item) => item.category.trim())
          .filter((category) => category.length > 0)
      ).size,
    [warehouseScopedProducts]
  );

  const totalQuantity = useMemo(() => {
    if (!hasQuantityColumn) return null;
    return warehouseScopedProducts.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  }, [hasQuantityColumn, warehouseScopedProducts]);

  const lowInventoryRows = useMemo(() => {
    if (!hasQuantityColumn) return [];
    return warehouseScopedProducts.filter(
      (item) => (item.quantity ?? 0) > 0 && (item.quantity ?? 0) <= 10
    );
  }, [hasQuantityColumn, warehouseScopedProducts]);

  const noInventoryRows = useMemo(() => {
    if (!hasQuantityColumn) return [];
    return warehouseScopedProducts.filter((item) => (item.quantity ?? 0) === 0);
  }, [hasQuantityColumn, warehouseScopedProducts]);

  const openCreateModal = () => {
    createForm.resetFields();
    createForm.setFieldsValue({
      unit: 'pcs',
      quantity: 0,
      warehouse: normalizeWarehouse(currentWarehouse),
    });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      const payload: ProductFormValues = {
        ...values,
        warehouse: hasWarehouseColumn
          ? canManageAllWarehouses
            ? normalizeWarehouse(values.warehouse)
            : normalizeWarehouse(currentWarehouse)
          : '',
      };

      startTransition(async () => {
        try {
          await addProduct(toFormData(payload));
          messageApi.success('增加产品成功');
          createForm.resetFields();
          setCreateOpen(false);
          router.refresh();
        } catch (error) {
          messageApi.error(
            error instanceof Error ? error.message : '增加产品失败'
          );
        }
      });
    } catch {
      // Form validation messages are shown by Ant Design.
    }
  };

  const openEditModal = (row: ProductView) => {
    setEditingRow(row);
    editForm.setFieldsValue({
      sku: row.sku,
      name: row.name,
      category: row.category,
      unit: row.unit,
      quantity: row.quantity ?? 0,
      warehouse: row.warehouse,
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editingRow) return;

    try {
      const values = await editForm.validateFields();
      const payload: ProductFormValues = {
        ...values,
        warehouse: hasWarehouseColumn
          ? canManageAllWarehouses
            ? normalizeWarehouse(values.warehouse)
            : normalizeWarehouse(currentWarehouse || editingRow.warehouse)
          : '',
      };

      startTransition(async () => {
        try {
          await updateProduct(toFormData(payload, editingRow.id));
          messageApi.success('更新产品成功');
          setEditOpen(false);
          setEditingRow(null);
          router.refresh();
        } catch (error) {
          messageApi.error(
            error instanceof Error ? error.message : '更新产品失败'
          );
        }
      });
    } catch {
      // Form validation messages are shown by Ant Design.
    }
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('id', id);
        await deleteProduct(formData);
        messageApi.success('删除产品成功');
        router.refresh();
      } catch (error) {
        messageApi.error(
          error instanceof Error ? error.message : '删除产品失败'
        );
      }
    });
  };

  const columns: ColumnsType<ProductView> = [
    { title: '产品代码', dataIndex: 'sku', key: 'sku', width: 140 },
    { title: '产品名称', dataIndex: 'name', key: 'name', width: 180 },
    { title: '产品类别', dataIndex: 'category', key: 'category', width: 140 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 100 },
  ];

  if (hasWarehouseColumn) {
    columns.push({
      title: '所属仓库',
      dataIndex: 'warehouse',
      key: 'warehouse',
      width: 140,
    });
  }

  columns.push(
    {
      title: '库存数量',
      key: 'quantity',
      width: 100,
      render: (_, row) =>
        hasQuantityColumn ? (row.quantity === null ? '--' : row.quantity) : '--',
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, row) => (
        <Tag
          color={
            row.status === '正常'
              ? 'green'
              : row.status === '低库存'
              ? 'orange'
              : row.status === '缺货'
              ? 'red'
              : 'default'
          }
        >
          {row.status}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 200,
      render: (text) => formatDate(String(text)),
    },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => openEditModal(row)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定删除 ${row.name || row.sku || 'this product'}?`}
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDelete(row.id)}
          >
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    }
  );

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      {contextHolder}

      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="总类别" value={totalCategories} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="总数量" value={totalQuantity ?? '--'} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="低库存" value={lowInventoryRows.length} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="缺货" value={noInventoryRows.length} />
          </Card>
        </Col>
      </Row>

      {!hasWarehouseColumn ? (
        <Alert
          type="warning"
          showIcon
          title="Missing warehouse column"
          description='Please add "warehouse" column to products table to enable warehouse-based permissions.'
        />
      ) : null}

      {!canManageAllWarehouses && hasWarehouseColumn && !currentWarehouse ? (
        <Alert
          type="error"
          showIcon
          title="No warehouse assignment"
          description="Your account has no warehouse assignment. Please contact admin."
        />
      ) : null}

      {!hasQuantityColumn ? (
        <Alert
          type="warning"
          showIcon
          title="Missing quantity column"
          description='Please add "quantity" column to products table to enable inventory metrics.'
        />
      ) : null}

      {loadErrorMessage ? (
        <Alert
          type="error"
          showIcon
          title="Failed to load products"
          description={loadErrorMessage}
        />
      ) : null}

      {!loadErrorMessage && hasQuantityColumn && noInventoryRows.length > 0 ? (
        <Alert
          type="error"
          showIcon
          title={`缺货提醒: ${noInventoryRows.length}`}
          description={noInventoryRows
            .slice(0, 5)
            .map((row) => `产品代码：${row.sku || '(no sku)'} - 产品名称：${row.name || '(no name)'}`)
            .join(' | ')}
        />
      ) : null}

      {!loadErrorMessage && hasQuantityColumn && lowInventoryRows.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          title={`低库存提醒: ${lowInventoryRows.length}`}
          description={lowInventoryRows
            .slice(0, 5)
            .map((row) => `产品代码：${row.sku || '(no sku)'} - 库存数量：${row.quantity ?? 0}`)
            .join(' | ')}
        />
      ) : null}

      <Card>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle" gutter={[12, 12]}>
            <Col xs={24} md={showWarehouseFilter ? 18 : 12}>
              <Space wrap style={{ width: '100%' }} size={12}>
                <Input
                  allowClear
                  placeholder="搜索产品代码、名称、类别、单位"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  style={{ width: isMobile ? '100%' : 320 }}
                />
                {showWarehouseFilter ? (
                  <Select
                    value={effectiveWarehouseFilter}
                    options={warehouseOptions}
                    onChange={setWarehouseFilter}
                    style={{ width: isMobile ? '100%' : 220 }}
                    placeholder="Filter by warehouse"
                  />
                ) : null}
              </Space>
            </Col>
            <Col>
              <Button
                type="primary"
                onClick={openCreateModal}
                disabled={!canWriteInScope}
              >
                添加产品
              </Button>
            </Col>
          </Row>

          <Table<ProductView>
            rowKey="id"
            columns={columns}
            dataSource={filteredProducts}
            loading={isPending}
            size={isMobile ? 'small' : 'middle'}
            scroll={{ x: 1200 }}
            pagination={{ pageSize: 8 }}
          />
        </Space>
      </Card>

      <Modal
        open={createOpen}
        title="添加产品"
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={isPending}
        width={isMobile ? 'calc(100vw - 24px)' : 520}
        style={isMobile ? { top: 12 } : undefined}
        styles={
          isMobile ? { body: { maxHeight: '70vh', overflowY: 'auto' } } : undefined
        }
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            label="产品代码"
            name="sku"
            rules={[{ required: true, message: 'Please input SKU' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="产品名称"
            name="name"
            rules={[{ required: true, message: 'Please input name' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="产品类别" name="category">
            <Input />
          </Form.Item>
          <Form.Item label="单位" name="unit">
            <Input />
          </Form.Item>
          {hasWarehouseColumn ? (
            <Form.Item
              label="所属仓库"
              name="warehouse"
              rules={
                canManageAllWarehouses
                  ? [{ required: true, message: 'Please input warehouse' }]
                  : undefined
              }
            >
              <Input
                disabled={!canManageAllWarehouses}
                placeholder={
                  canManageAllWarehouses
                    ? 'Input warehouse name'
                    : 'Warehouse assigned by admin'
                }
              />
            </Form.Item>
          ) : null}
          <Form.Item label="库存数量" name="quantity">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={0}
              disabled={!hasQuantityColumn}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={editOpen}
        title="编辑产品"
        onCancel={() => {
          setEditOpen(false);
          setEditingRow(null);
        }}
        onOk={handleEdit}
        confirmLoading={isPending}
        width={isMobile ? 'calc(100vw - 24px)' : 520}
        style={isMobile ? { top: 12 } : undefined}
        styles={
          isMobile ? { body: { maxHeight: '70vh', overflowY: 'auto' } } : undefined
        }
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label="产品代码"
            name="sku"
            rules={[{ required: true, message: 'Please input SKU' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="产品名称"
            name="name"
            rules={[{ required: true, message: 'Please input name' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="产品类别" name="category">
            <Input />
          </Form.Item>
          <Form.Item label="单位" name="unit">
            <Input />
          </Form.Item>
          {hasWarehouseColumn ? (
            <Form.Item
              label="所属仓库"
              name="warehouse"
              rules={
                canManageAllWarehouses
                  ? [{ required: true, message: 'Please input warehouse' }]
                  : undefined
              }
            >
              <Input
                disabled={!canManageAllWarehouses}
                placeholder={
                  canManageAllWarehouses
                    ? 'Input warehouse name'
                    : 'Warehouse assigned by admin'
                }
              />
            </Form.Item>
          ) : null}
          <Form.Item label="库存数量" name="quantity">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={0}
              disabled={!hasQuantityColumn}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
