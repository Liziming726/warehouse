import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '出库管理',
  description: '登记出库流水并实时校验库存',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
