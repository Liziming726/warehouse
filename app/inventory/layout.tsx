import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '远宏交通库存总览',
  description: '查看库存快照并维护产品资料',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
