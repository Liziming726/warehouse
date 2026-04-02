import Link from 'next/link';
import { Button, Space } from 'antd';

type WmsNavProps = {
  currentPath: '/' | '/inventory' | '/inbound' | '/outbound';
};

function navType(target: WmsNavProps['currentPath'], current: WmsNavProps['currentPath']) {
  return target === current ? 'primary' : 'default';
}

export default function WmsNav({ currentPath }: WmsNavProps) {
  return (
    <Space wrap size="small">
      <Link href="/">
        <Button type={navType(currentPath, '/')}>主面板</Button>
      </Link>
      <Link href="/inventory">
        <Button type={navType(currentPath, '/inventory')}>库存</Button>
      </Link>
      <Link href="/inbound">
        <Button type={navType(currentPath, '/inbound')}>入库</Button>
      </Link>
      <Link href="/outbound">
        <Button type={navType(currentPath, '/outbound')}>出库</Button>
      </Link>
    </Space>
  );
}
