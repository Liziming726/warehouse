import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import 'antd/dist/reset.css';

export const metadata: Metadata = {
  title: '仓库管理系统',
  description: 'Basic WMS demo built with Next.js and Ant Design',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-be-installed="true">
      <body data-liner-extension-version="7.18.5">
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}