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

/**
 * Turns raw typed characters into a masked `YYYY-MM-DD` string, auto-inserting
 * the dashes as the user types the year and month. A trailing dash is added
 * right after a completed segment (so "2026" -> "2026-").
 */
export const formatDateInput = (raw: string): string => {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  let out = d.slice(0, 4);
  if (d.length > 4) out += '-' + d.slice(4, 6);
  else if (d.length === 4) out += '-';
  if (d.length > 6) out += '-' + d.slice(6, 8);
  else if (d.length === 6) out += '-';
  return out;
};

/**
 * Validates an expiry date string. Returns an error message, or null when the
 * value is empty (optional) or a valid date that is today or later.
 */
export const validateExpiryDate = (s: string): string | null => {
  const v = s.trim();
  if (!v) return null; // optional field
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Enter date as YYYY-MM-DD';
  const [y, m, day] = v.split('-').map(Number);
  const date = new Date(y, m - 1, day);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== day) {
    return 'That date does not exist';
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) return 'Expiry date is in the past';
  return null;
};
