import Link from 'next/link';

type WmsNavProps = {
  currentPath: '/' | '/inventory' | '/inbound' | '/outbound';
};

const NAV_ITEMS: Array<{ path: WmsNavProps['currentPath']; label: string }> = [
  { path: '/', label: '主面板' },
  { path: '/inventory', label: '库存' },
  { path: '/inbound', label: '入库' },
  { path: '/outbound', label: '出库' },
];

export default function WmsNav({ currentPath }: WmsNavProps) {
  return (
    <nav className="wms-nav" aria-label="主导航">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.path}
          href={item.path}
          className={`wms-nav-link ${currentPath === item.path ? 'is-active' : ''}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
