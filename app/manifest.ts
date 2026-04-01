import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Warehouse WMS',
    short_name: 'WMS',
    description: '仓库管理系统',
    start_url: '/login',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1677ff',
    icons: [
      { src: '../public/image/icons8-x-50.png', sizes: '192x192', type: 'image/png' },
      { src: '../public/image/icons8-x-100.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}