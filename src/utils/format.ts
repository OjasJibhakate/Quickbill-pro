/** Format a number as Indian Rupees, e.g. 1234.5 -> "₹1,234.50". */
export const formatCurrency = (value: number | null | undefined): string => {
  const n = value ?? 0;
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/** Short date, e.g. "17 Jun 2026". */
export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/** Date + time, e.g. "17 Jun, 04:35 PM". */
export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** YYYY-MM-DD for "today" in local time. */
export const todayKey = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
