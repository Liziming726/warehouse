import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider } from 'antd';
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
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: '#1677ff',
                colorInfo: '#1677ff',
                colorSuccess: '#15803d',
                colorWarning: '#d97706',
                colorError: '#dc2626',
                borderRadius: 12,
                borderRadiusLG: 18,
                boxShadowSecondary: '0 12px 30px rgba(22, 119, 255, 0.12)',
                colorBorder: '#d2def2',
                colorBgLayout: '#eef4ff',
                fontFamily:
                  '"SF Pro Display","SF Pro Text","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif',
              },
              components: {
                Button: {
                  borderRadius: 12,
                  controlHeight: 38,
                },
                Card: {
                  borderRadiusLG: 20,
                },
                Input: {
                  borderRadius: 12,
                },
                Select: {
                  borderRadius: 12,
                },
                Table: {
                  borderColor: '#e5eaf2',
                  headerBg: '#f8fafc',
                  rowHoverBg: '#f6f9ff',
                },
              },
            }}
          >
            {children}
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
