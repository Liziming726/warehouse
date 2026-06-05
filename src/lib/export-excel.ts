'use client';

import * as XLSX from 'xlsx';

export function downloadExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: { title: string; dataIndex?: string; key: string; render?: (value: unknown, row: T) => string }[],
  filename: string
) {
  const header = columns.map((c) => c.title);
  const rows = data.map((row) =>
    columns.map((col) => {
      if (col.render) {
        return col.render((col.dataIndex ? row[col.dataIndex] : undefined) as unknown, row);
      }
      if (col.dataIndex) {
        const val = row[col.dataIndex];
        return val != null ? String(val) : '';
      }
      return '';
    })
  );

  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);

  // Auto column width
  const colWidths = header.map((_, i) => {
    const maxLen = Math.max(
      header[i].length,
      ...rows.map((r) => (r[i]?.length ?? 0))
    );
    return { wch: Math.min(maxLen + 4, 50) };
  });
  sheet['!cols'] = colWidths;

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, filename);
  XLSX.writeFile(book, `${filename}.xlsx`);
}
