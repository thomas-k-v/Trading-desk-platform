export const fmt = (n: number, d = 2) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

export const inr = (n: number, d = 2) => `${n < 0 ? '-' : ''}₹${fmt(Math.abs(n), d)}`;

export const signed = (n: number, d = 2) => `${n > 0 ? '+' : ''}${fmt(n, d)}`;

export const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

/** Compact Indian units: 1.2 L, 3.4 Cr. */
export const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
  return n.toFixed(0);
};

export const time = (ts: number) =>
  new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export const dateTime = (ts: number) =>
  new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

export const tone = (n: number) => (n > 0 ? 'text-up' : n < 0 ? 'text-down' : 'text-slate-500');

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
