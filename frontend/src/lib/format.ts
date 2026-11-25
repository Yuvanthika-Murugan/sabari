export const formatCurrency = (amount: number): string => '₹' + Math.round(amount).toLocaleString('en-IN');

/** Today's date as YYYY-MM-DD in the browser's local time zone. */
export const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const nowTime = (): string => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const daysBetween = (from: string, to: string): number =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);

export const formatPercent = (value: number | null, suffix: string): string | undefined =>
  value === null ? undefined : `${value > 0 ? '+' : ''}${value}% ${suffix}`;

/** Downloads rows as a CSV file that opens in Excel. */
export function downloadCsv(filename: string, rows: object[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]).filter(k => {
    const v = (rows[0] as Record<string, unknown>)[k];
    return v === null || typeof v !== 'object';
  });
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [keys.join(','), ...rows.map(r => keys.map(k => escape((r as Record<string, unknown>)[k])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** True when an ISO date (yyyy-mm-dd, a longer timestamp is cut to its date) is within from..to; an empty bound is open. */
export function inDateRange(date: string, from: string, to: string): boolean {
  const d = (date ?? '').slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
}
