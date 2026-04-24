'use client';

import { useDeferredValue, useMemo, useState, useTransition } from 'react';
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
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';
import { useRouter } from 'next/navigation';
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from '@/app/inventory/actions';
import type {
  InventoryAccess,
  InventoryRow,
  ProductManageRow,
  WarehouseOption,
} from '@/src/lib/inventory/types';
import {
  PRODUCT_CATEGORY_OPTIONS,
  PRODUCT_UNIT_OPTIONS,
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
  category: string;
  unit: string;
  safeStock: number;
};

const ALL_WAREHOUSES = '__ALL__';

const PRODUCT_CATEGORY_SELECT_OPTIONS = PRODUCT_CATEGORY_OPTIONS.map((value) => ({
  label: value,
  value,
}));

const PRODUCT_UNIT_SELECT_OPTIONS = PRODUCT_UNIT_OPTIONS.map((value) => ({
  label: value,
  value,
}));

function normalizeProductCategory(value: string) {
  return PRODUCT_CATEGORY_OPTIONS.includes(value as (typeof PRODUCT_CATEGORY_OPTIONS)[number])
    ? value
    : PRODUCT_CATEGORY_OPTIONS[0];
}

function normalizeProductUnit(value: string) {
  return PRODUCT_UNIT_OPTIONS.includes(value as (typeof PRODUCT_UNIT_OPTIONS)[number])
    ? value
    : PRODUCT_UNIT_OPTIONS[0];
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
  const deferredKeyword = useDeferredValue(keyword);
  const [productKeyword, setProductKeyword] = useState('');
  const deferredProductKeyword = useDeferredValue(productKeyword);
  const [warehouseFilter, setWarehouseFilter] = useState(ALL_WAREHOUSES);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductManageRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [productForm] = Form.useForm<ProductFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const router = useRouter();

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

  const warehouseScopedRows = useMemo(() => {
    if (!access.isAdmin || warehouseFilter === ALL_WAREHOUSES) {
      return rows;
    }
    return rows.filter((row) => row.warehouseId === warehouseFilter);
  }, [access.isAdmin, rows, warehouseFilter]);

  const filteredRows = useMemo(() => {
    const key = deferredKeyword.trim().toLowerCase();
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
  }, [deferredKeyword, warehouseScopedRows]);

  const warehouseScopedProducts = useMemo(() => {
    if (!access.isAdmin || warehouseFilter === ALL_WAREHOUSES) {
      return products;
    }
    return products.filter(
      (row) => !row.warehouseId || row.warehouseId === warehouseFilter
    );
  }, [access.isAdmin, products, warehouseFilter]);

  const filteredProducts = useMemo(() => {
    const key = deferredProductKeyword.trim().toLowerCase();
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
      ]
        .join(' ')
        .toLowerCase()
        .includes(key)
    );
  }, [deferredProductKeyword, warehouseScopedProducts]);

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
      title: '产品型号',
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
      title: '适用仓库',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      width: 180,
      render: () => '全部仓库',
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
      title: '产品型号',
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
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value) => formatDateTime(String(value)),
    },
  ];

  if (access.isAdmin) {
    productColumns.push({
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, row) => (
        <Space size={8}>
          <Button size="small" onClick={() => openEditProductModal(row)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该产品？"
            description="删除后会同步清理该产品的出入库流水，且无法恢复。"
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDeleteProduct(row)}
          >
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    });
  }

  function openCreateProductModal() {
    if (!access.isAdmin) {
      return;
    }
    setEditingProduct(null);
    productForm.resetFields();
    productForm.setFieldsValue({
      sku: '',
      name: '',
      category: PRODUCT_CATEGORY_OPTIONS[0],
      unit: PRODUCT_UNIT_OPTIONS[0],
      safeStock: 0,
    });
    setIsProductModalOpen(true);
  }

  function openEditProductModal(product: ProductManageRow) {
    if (!access.isAdmin) {
      return;
    }
    setEditingProduct(product);
    productForm.setFieldsValue({
      sku: product.sku,
      name: product.name,
      category: normalizeProductCategory(product.category),
      unit: normalizeProductUnit(product.unit),
      safeStock: product.safeStock,
    });
    setIsProductModalOpen(true);
  }

  function closeProductModal() {
    setIsProductModalOpen(false);
    setEditingProduct(null);
    productForm.resetFields();
  }

  const handleDeleteProduct = (row: ProductManageRow) => {
    if (!access.isAdmin) {
      messageApi.error('仅管理员可以删除产品。');
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('productId', row.id);
        await deleteProduct(formData);
        messageApi.success('产品删除成功。');
        router.refresh();
      } catch (error) {
        messageApi.error(
          error instanceof Error ? error.message : '删除产品失败。'
        );
      }
    });
  };

  const handleSubmitProduct = async () => {
    if (!access.isAdmin) {
      messageApi.error('仅管理员可以新增或编辑产品。');
      return;
    }

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
          formData.set('category', values.category);
          formData.set('unit', values.unit);
          formData.set('safeStock', String(values.safeStock ?? 0));

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
            virtual
            size={isMobile ? 'small' : 'middle'}
            scroll={{ x: 1200, y: isMobile ? 380 : 560 }}
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
              placeholder="搜索产品：型号、名称、分类"
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
            {access.isAdmin ? (
              <Button type="primary" onClick={openCreateProductModal}>
                新增产品
              </Button>
            ) : null}
          </Space>
        }
      >
        {access.isAdmin && !canUseWarehouseShortcut ? (
          <Typography.Text type="secondary">
            请选择上方“仓库筛选”中的具体仓库后，即可快捷跳转并自动带入仓库。
          </Typography.Text>
        ) : null}

        {!access.isAdmin ? (
          <Typography.Text type="secondary">
            为保证名称口径统一，产品新增与编辑仅管理员可操作。
          </Typography.Text>
        ) : null}

        {filteredProducts.length === 0 ? (
          <Typography.Text type="secondary">
            {access.isAdmin
              ? '暂无产品数据，可点击“新增产品”开始维护。'
              : '暂无可用产品，请联系管理员维护产品档案。'}
          </Typography.Text>
        ) : null}

        <Table<ProductManageRow>
          rowKey="id"
          columns={productColumns}
          dataSource={filteredProducts}
          virtual
          size={isMobile ? 'small' : 'middle'}
          scroll={{ x: 1300, y: isMobile ? 360 : 520 }}
          pagination={{ pageSize: isMobile ? 8 : 10 }}
        />
      </Card>

      {access.isAdmin ? (
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
              category: PRODUCT_CATEGORY_OPTIONS[0],
              unit: PRODUCT_UNIT_OPTIONS[0],
              safeStock: 0,
            }}
          >
            <Form.Item
              label="产品型号"
              name="sku"
              rules={[{ required: true, message: '请输入产品型号。' }]}
            >
              <Input maxLength={100} placeholder="例如：HM-1000" />
            </Form.Item>

            <Form.Item
              label="产品名称"
              name="name"
              rules={[{ required: true, message: '请输入产品名称。' }]}
            >
              <Input maxLength={200} placeholder="例如：热熔划线机" />
            </Form.Item>

            <Form.Item
              label="产品分类"
              name="category"
              rules={[{ required: true, message: '请选择产品分类。' }]}
            >
              <Select
                options={PRODUCT_CATEGORY_SELECT_OPTIONS}
                placeholder="请选择产品分类"
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              label="单位"
              name="unit"
              rules={[{ required: true, message: '请选择单位。' }]}
            >
              <Select
                options={PRODUCT_UNIT_SELECT_OPTIONS}
                placeholder="请选择单位"
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              label="安全库存"
              name="safeStock"
              rules={[{ required: true, message: '请输入安全库存。' }]}
            >
              <InputNumber min={0} step={1} style={{ width: '100%' }} />
            </Form.Item>

            <Typography.Text type="secondary">
              适用仓库：全部仓库
            </Typography.Text>
          </Form>
        </Modal>
      ) : null}
    </Space>
  );
}
