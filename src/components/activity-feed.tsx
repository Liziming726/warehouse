'use client';

import { useMemo } from 'react';
import { Tag } from 'antd';
import type { MovementRow } from '@/src/lib/inventory/types';

type ActivityFeedProps = {
  inboundRows: MovementRow[];
  outboundRows: MovementRow[];
  max?: number;
};

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  if (!Number.isFinite(date.getTime())) return dateStr || '-';
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString('zh-CN');
}

export default function ActivityFeed({ inboundRows, outboundRows, max = 8 }: ActivityFeedProps) {
  const merged = useMemo(() => {
    return [...inboundRows, ...outboundRows]
      .sort((a, b) => {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        if (!Number.isFinite(da)) return 1;
        if (!Number.isFinite(db)) return -1;
        return db - da;
      })
      .slice(0, max);
  }, [inboundRows, outboundRows, max]);

  if (merged.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 24, color: '#a59f97' }}>
        暂无动态
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {merged.map((item, i) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            gap: 12,
            padding: '10px 0',
            borderBottom: i < merged.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
          }}
        >
          <Tag
            color={item.movementType === 'IN' ? 'blue' : 'red'}
            style={{ flexShrink: 0, margin: 0, marginTop: 1 }}
          >
            {item.movementType === 'IN' ? '入库' : '出库'}
          </Tag>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
              {item.productName}
              <span style={{ fontWeight: 400, color: '#777169', marginLeft: 6 }}>
                {item.quantity} {item.unit}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#a59f97', marginTop: 1, display: 'flex', gap: 8 }}>
              <span>{item.warehouseName}</span>
              <span>{item.operatorName}</span>
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#a59f97', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {timeAgo(item.createdAt)}
          </div>
        </div>
      ))}
    </div>
  );
}
