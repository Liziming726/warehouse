import { Button, Card, Space, Tag } from 'antd';
import { logout } from '@/app/login/actions';
import type { InventoryAccess } from '@/src/lib/inventory/types';
import WmsNav from '@/src/components/wms-nav';

type WmsShellProps = {
  title: string;
  subtitle: string;
  currentPath: '/' | '/inventory' | '/inbound' | '/outbound';
  access: InventoryAccess;
  children: React.ReactNode;
};

function getScopeLabel(access: InventoryAccess) {
  if (access.isAdmin) {
    return '全部仓库';
  }

  return access.warehouseName ?? '未分配仓库';
}

export default function WmsShell({
  title,
  subtitle,
  currentPath,
  access,
  children,
}: WmsShellProps) {
  return (
    <div style={{ padding: 16, maxWidth: 1280, margin: '0 auto' }}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Card
          styles={{
            body: {
              padding: 18,
              background:
                'linear-gradient(135deg, rgba(238,246,255,0.9) 0%, rgba(246,251,244,0.9) 100%)',
              borderRadius: 16,
            },
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Space orientation="vertical" size={2}>
              <h2>
                {title}
              </h2>
              <h3>
                {subtitle}
              </h3>
              <Space wrap size="small">
                <Tag color={access.isAdmin ? 'gold' : 'blue'}>
                  {access.isAdmin ? '管理员' : '员工'}
                </Tag>
                <Tag color="default">{getScopeLabel(access)}</Tag>
                <h3>当前用户：{access.nickname ?? access.username}</h3>
              </Space>
            </Space>

            <form action={logout}>
              <Button htmlType="submit" danger>
                退出登录
              </Button>
            </form>
          </div>
        </Card>

        <WmsNav currentPath={currentPath} />

        {children}
      </Space>
    </div>
  );
}
