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

function formatStatusDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  return `${y}/${m}/${d} 星期${week}`;
}

export default function WmsShell({
  title,
  subtitle,
  currentPath,
  access,
  children,
}: WmsShellProps) {
  return (
    <>
      <div className="wms-status-bar">
        <div className="wms-status-bar-left">
          <span className="wms-status-dot" />
          <span>远宏交通仓库管理系统</span>
        </div>
        <div className="wms-status-bar-right">
          <span>{formatStatusDate()}</span>
          <span>{access.nickname ?? access.username}</span>
        </div>
      </div>

      <div className="wms-shell">
        <WmsNav currentPath={currentPath} />

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

        {children}
      </Space>
      </div>
    </>
  );
}
