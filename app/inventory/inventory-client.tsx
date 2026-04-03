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
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';
import { useRouter } from 'next/navigation';
import { createProduct, updateProduct } from '@/app/inventory/actions';
import type {
  InventoryAccess,
  InventoryRow,
  ProductManageRow,
  WarehouseOption,
} from '@/src/lib/inventory/types';

type InventoryClientProps = {
  access: InventoryAccess;
  rows: InventoryRow[];
  products: ProductManageRow[];
  warehouses: WarehouseOption[];
  loadErrorMessage: string | null;
};

type ProductFormValues = {
  sku: string;
  name: string;
  category?: string;
  unit: string;
  safeStock: number;
  warehouseId?: string;
  status: boolean;
};

const ALL_WAREHOUSES = '__ALL__';

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
  return date.toLocaleString('zh-CN', { hour12: false });
}

export default function InventoryClient({
  access,
  rows,
  products,
  warehouses,
  loadErrorMessage,
}: InventoryClientProps) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [keyword, setKeyword] = useState('');
  const [productKeyword, setProductKeyword] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState(ALL_WAREHOUSES);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductManageRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [productForm] = Form.useForm<ProductFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const router = useRouter();

  const defaultWarehouseId = access.warehouseId ?? warehouses[0]?.id ?? undefined;

  const warehouseOptions = useMemo(() => {
    if (!access.isAdmin) {
      return [];
    }
    return [
      { label: '全部仓库', value: ALL_WAREHOUSES },
      ...warehouses.map((warehouse) => ({
        label: `${warehouse.name} (${warehouse.code})`,
        value: warehouse.id,
      })),
    ];
  }, [access.isAdmin, warehouses]);

  const productWarehouseOptions = useMemo(
    () =>
      warehouses.map((warehouse) => ({
        label: `${warehouse.name} (${warehouse.code})`,
        value: warehouse.id,
      })),
    [warehouses]
  );

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

  const warehouseScopedProducts = useMemo(() => {
    if (!access.isAdmin || warehouseFilter === ALL_WAREHOUSES) {
      return products;
    }
    return products.filter((row) => row.warehouseId === warehouseFilter);
  }, [access.isAdmin, products, warehouseFilter]);

  const filteredProducts = useMemo(() => {
    const key = productKeyword.trim().toLowerCase();
    if (!key) {
      return warehouseScopedProducts;
    }
    return warehouseScopedProducts.filter((row) =>
      [
        row.sku,
        row.name,
        row.category,
        row.unit,
        row.warehouseName,
        row.status ? '启用' : '停用',
      ]
        .join(' ')
        .toLowerCase()
        .includes(key)
    );
  }, [productKeyword, warehouseScopedProducts]);

  const totalSku = filteredRows.length;
  const totalQty = filteredRows.reduce((sum, row) => sum + row.currentQty, 0);
  const lowStockCount = filteredRows.filter(
    (row) => row.stockStatus === 'LOW_STOCK'
  ).length;
  const outOfStockCount = filteredRows.filter(
    (row) => row.stockStatus === 'OUT_OF_STOCK'
  ).length;

  const shortcutWarehouseId = access.isAdmin
    ? warehouseFilter === ALL_WAREHOUSES
      ? null
      : warehouseFilter
    : access.warehouseId;

  const canUseWarehouseShortcut = !!shortcutWarehouseId;

  const inboundShortcutPath = shortcutWarehouseId
    ? `/inbound?warehouseId=${encodeURIComponent(shortcutWarehouseId)}`
    : '/inbound';

  const outboundShortcutPath = shortcutWarehouseId
    ? `/outbound?warehouseId=${encodeURIComponent(shortcutWarehouseId)}`
    : '/outbound';

  const inventoryColumns: ColumnsType<InventoryRow> = [
    {
      title: '产品编码',
      dataIndex: 'sku',
      key: 'sku',
      width: 160,
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      key: 'productName',
      width: 220,
    },
    {
      title: '产品分类',
      dataIndex: 'category',
      key: 'category',
      width: 140,
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
    },
    {
      title: '所属仓库',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      width: 180,
    },
    {
      title: '当前库存',
      dataIndex: 'currentQty',
      key: 'currentQty',
      width: 130,
    },
    {
      title: '安全库存',
      dataIndex: 'safeStock',
      key: 'safeStock',
      width: 120,
    },
    {
      title: '状态',
      key: 'stockStatus',
      width: 120,
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
          {formatStockStatus(row.stockStatus)}
        </Tag>
      ),
    },
  ];

  const productColumns: ColumnsType<ProductManageRow> = [
    {
      title: '产品编码',
      dataIndex: 'sku',
      key: 'sku',
      width: 160,
    },
    {
      title: '产品名称',
      dataIndex: 'name',
      key: 'name',
      width: 220,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (value) => value || '-',
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      width: 100,
    },
    {
      title: '安全库存',
      dataIndex: 'safeStock',
      key: 'safeStock',
      width: 120,
    },
    {
      title: '所属仓库',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status ? 'green' : 'red'}>{status ? '启用' : '停用'}</Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value) => formatDateTime(String(value)),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, row) => (
        <Button size="small" onClick={() => openEditProductModal(row)}>
          编辑
        </Button>
      ),
    },
  ];

  function openCreateProductModal() {
    setEditingProduct(null);
    productForm.resetFields();
    productForm.setFieldsValue({
      sku: '',
      name: '',
      category: '',
      unit: '台',
      safeStock: 0,
      warehouseId: defaultWarehouseId,
      status: true,
    });
    setIsProductModalOpen(true);
  }

  function openEditProductModal(product: ProductManageRow) {
    setEditingProduct(product);
    productForm.setFieldsValue({
      sku: product.sku,
      name: product.name,
      category: product.category,
      unit: product.unit,
      safeStock: product.safeStock,
      warehouseId: product.warehouseId ?? undefined,
      status: product.status,
    });
    setIsProductModalOpen(true);
  }

  function closeProductModal() {
    setIsProductModalOpen(false);
    setEditingProduct(null);
    productForm.resetFields();
  }

  const handleSubmitProduct = async () => {
    try {
      const values = await productForm.validateFields();

      startTransition(async () => {
        try {
          const formData = new FormData();
          if (editingProduct) {
            formData.set('productId', editingProduct.id);
          }
          formData.set('sku', values.sku);
          formData.set('name', values.name);
          formData.set('category', values.category ?? '');
          formData.set('unit', values.unit);
          formData.set('safeStock', String(values.safeStock ?? 0));
          formData.set('status', values.status ? 'true' : 'false');
          formData.set(
            'warehouseId',
            access.isAdmin
              ? values.warehouseId ?? ''
              : access.warehouseId ?? ''
          );

          if (editingProduct) {
            await updateProduct(formData);
            messageApi.success('产品更新成功。');
          } else {
            await createProduct(formData);
            messageApi.success('产品创建成功。');
          }

          closeProductModal();
          router.refresh();
        } catch (error) {
          messageApi.error(
            error instanceof Error ? error.message : '保存产品失败。'
          );
        }
      });
    } catch {
      // antd 会在表单项上展示校验信息。
    }
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      {contextHolder}

      <Card>
        <Space orientation="vertical" size={6} style={{ width: '100%' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            当前库存
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
          message="库存数据加载失败"
          description={loadErrorMessage}
        />
      ) : null}

      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="产品数" value={totalSku} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="库存总量" value={totalQty} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="低库存" value={lowStockCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="缺货" value={outOfStockCount} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Space
            wrap
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <Input
              allowClear
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索库存：编码、名称、分类、仓库"
              style={{ width: isMobile ? '100%' : 320 }}
            />
            {access.isAdmin ? (
              <Select
                value={warehouseFilter}
                options={warehouseOptions}
                onChange={setWarehouseFilter}
                style={{ width: isMobile ? '100%' : 260 }}
              />
            ) : null}
          </Space>

          <Table<InventoryRow>
            rowKey={(row) => `${row.warehouseId ?? '-'}-${row.productId}`}
            columns={inventoryColumns}
            dataSource={filteredRows}
            size={isMobile ? 'small' : 'middle'}
            scroll={{ x: 1200 }}
            pagination={{ pageSize: isMobile ? 8 : 12 }}
          />
        </Space>
      </Card>

      <Card
        title="产品管理"
        extra={
          <Space wrap size="small">
            <Input
              allowClear
              value={productKeyword}
              onChange={(event) => setProductKeyword(event.target.value)}
              placeholder="搜索产品：编码、名称、分类、仓库"
              style={{ width: isMobile ? '100%' : 260 }}
            />
            <Button
              onClick={() => router.push(inboundShortcutPath)}
              disabled={access.isAdmin && !canUseWarehouseShortcut}
            >
              去入库
            </Button>
            <Button
              danger
              onClick={() => router.push(outboundShortcutPath)}
              disabled={access.isAdmin && !canUseWarehouseShortcut}
            >
              去出库
            </Button>
            <Button type="primary" onClick={openCreateProductModal}>
              新增产品
            </Button>
          </Space>
        }
      >
        {access.isAdmin && !canUseWarehouseShortcut ? (
          <Typography.Text type="secondary">
            请选择上方“仓库筛选”中的具体仓库后，即可快捷跳转并自动带入仓库。
          </Typography.Text>
        ) : null}

        {filteredProducts.length === 0 ? (
          <Typography.Text type="secondary">
            暂无产品数据，可点击“新增产品”开始维护。
          </Typography.Text>
        ) : null}

        <Table<ProductManageRow>
          rowKey="id"
          columns={productColumns}
          dataSource={filteredProducts}
          size={isMobile ? 'small' : 'middle'}
          scroll={{ x: 1300 }}
          pagination={{ pageSize: isMobile ? 8 : 10 }}
        />
      </Card>

      <Modal
        title={editingProduct ? '编辑产品' : '新增产品'}
        open={isProductModalOpen}
        onCancel={closeProductModal}
        onOk={handleSubmitProduct}
        okText={editingProduct ? '保存修改' : '创建产品'}
        cancelText="取消"
        confirmLoading={isPending}
        forceRender
        destroyOnHidden={false}
        width={isMobile ? '100%' : 560}
        style={isMobile ? { top: 12 } : undefined}
      >
        <Form<ProductFormValues>
          form={productForm}
          layout="vertical"
          initialValues={{
            unit: '台',
            safeStock: 0,
            warehouseId: defaultWarehouseId,
            status: true,
          }}
        >
          <Form.Item
            label="产品编码"
            name="sku"
            rules={[{ required: true, message: '请输入产品编码。' }]}
          >
            <Input maxLength={100} placeholder="例如：WMS-001" />
          </Form.Item>

          <Form.Item
            label="产品名称"
            name="name"
            rules={[{ required: true, message: '请输入产品名称。' }]}
          >
            <Input maxLength={200} placeholder="例如：热熔划线机" />
          </Form.Item>

          <Form.Item label="产品分类" name="category">
            <Input maxLength={100} placeholder="例如：设备类" />
          </Form.Item>

          <Form.Item
            label="单位"
            name="unit"
            rules={[{ required: true, message: '请输入单位。' }]}
          >
            <Input maxLength={50} placeholder="例如：台、件、副" />
          </Form.Item>

          <Form.Item
            label="安全库存"
            name="safeStock"
            rules={[{ required: true, message: '请输入安全库存。' }]}
          >
            <InputNumber min={0} step={1} style={{ width: '100%' }} />
          </Form.Item>

          {access.isAdmin ? (
            <Form.Item
              label="所属仓库"
              name="warehouseId"
              rules={[{ required: true, message: '请选择所属仓库。' }]}
              extra={
                editingProduct
                  ? '编辑产品时不允许调整所属仓库，避免历史库存错乱。'
                  : undefined
              }
            >
              <Select
                options={productWarehouseOptions}
                placeholder="请选择所属仓库"
                disabled={!!editingProduct}
                style={{ width: '100%' }}
              />
            </Form.Item>
          ) : (
            <Typography.Text type="secondary">
              所属仓库：{access.warehouseName ?? '未分配仓库'}
            </Typography.Text>
          )}

          <Form.Item label="状态" name="status" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
