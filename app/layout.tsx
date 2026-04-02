import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import 'antd/dist/reset.css';
import './globals.css';

export const metadata: Metadata = {
  title: '仓库管理系统',
  description: '基于 Next.js 与 Ant Design 的仓库管理系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" data-be-installed="true">
      <body data-liner-extension-version="7.18.5">
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}
