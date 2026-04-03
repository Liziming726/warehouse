import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '远宏交通入库管理',
  description: '登记入库流水并自动汇总库存',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
