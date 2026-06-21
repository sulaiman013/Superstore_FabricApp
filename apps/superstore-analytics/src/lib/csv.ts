import type { DataTable } from '@microsoft/fabric-visuals-core';

/** Export a DataTable to a CSV download (opens in Excel). */
export function downloadCsv(table: DataTable, filename: string): void {
  const headers = table.columns.map((c) => c.displayName ?? c.name);
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.map(esc).join(','),
    ...table.rows.map((r) => r.map(esc).join(',')),
  ];
  const blob = new Blob(['﻿' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
