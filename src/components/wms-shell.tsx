import { Button, Card, Space, Tag } from 'antd';
import Image from 'next/image';
import { logout } from '@/app/login/actions';
import type { InventoryAccess } from '@/src/lib/inventory/types';
import WmsNav from '@/src/components/wms-nav';

const COMPANY_LOGO_PATH = '/logo.png';

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
    <div className="wms-shell">
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Card className="wms-hero-card">
          <div className="wms-hero">
            <div className="wms-hero-content">
              <div className="wms-hero-main">
                <Space orientation="vertical" size={2}>
                  <h2 className="wms-hero-title">
                    {title}
                  </h2>
                  <p className="wms-hero-subtitle">
                    {subtitle}
                  </p>
                  <Space wrap size="small">
                    <Tag color={access.isAdmin ? 'gold' : 'blue'}>
                      {access.isAdmin ? '管理员' : '员工'}
                    </Tag>
                    <Tag color="default">{getScopeLabel(access)}</Tag>
                    <p className="wms-user-line">
                      当前用户：{access.nickname ?? access.username}
                    </p>
                  </Space>
                </Space>
              </div>

              <div className="wms-hero-right">
                <div className="wms-brand-panel">
                  <Image
                    src={COMPANY_LOGO_PATH}
                    alt="公司 Logo"
                    width={120}
                    height={120}
                    className="wms-brand-logo"
                  />
                </div>

                <form action={logout}>
                  <Button htmlType="submit" danger>
                    退出登录
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </Card>

        <WmsNav currentPath={currentPath} />

        {children}
      </Space>
    </div>
  );
}
