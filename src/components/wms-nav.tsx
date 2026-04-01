import Link from 'next/link';
import { Button, Space } from 'antd';

type WmsNavProps = {
  currentPath: '/inventory' | '/inbound' | '/outbound' | '/';
};

function navType(target: WmsNavProps['currentPath'], current: string) {
  return target === current ? 'primary' : 'default';
}

export default function WmsNav({ currentPath }: WmsNavProps) {
  return (
    <Space wrap>
      <Link href="/">
        <Button type={navType(currentPath, '/')}>Dashboard</Button>
      </Link>
      <Link href="/inventory">
        <Button type={navType(currentPath, '/inventory')}>Inventory</Button>
      </Link>
      <Link href="/inbound">
        <Button type={navType(currentPath, '/inbound')}>Inbound</Button>
      </Link>
      <Link href="/outbound">
        <Button type={navType(currentPath, '/outbound')}>Outbound</Button>
      </Link>
    </Space>
  );
}

