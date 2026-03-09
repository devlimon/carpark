import { format, differenceInDays, parseISO } from 'date-fns';

/**
 * Calculate number of days between two dates (minimum 1)
 */
export function calcDays(dateIn: Date | string, dateOut: Date | string): number {
  const d1 = typeof dateIn === 'string' ? parseISO(dateIn) : dateIn;
  const d2 = typeof dateOut === 'string' ? parseISO(dateOut) : dateOut;
  const diff = differenceInDays(d2, d1);
  return Math.max(1, diff);
}

/**
 * Calculate parking charge based on number of days and daily rate
 */
export function calcAmount(days: number, dailyRate: number, creditPercent = 0): number {
  const gross = days * dailyRate;
  const discount = (gross * creditPercent) / 100;
  return Math.round((gross - discount) * 100) / 100;
}

/**
 * Format a Date for display
 */
export function fmtDate(date: Date | string | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'd MMM yy');
}

/**
 * Format a Date as period label e.g. "March 2026"
 */
export function fmtPeriod(year: number, month: number): string {
  return format(new Date(year, month - 1, 1), 'MMMM yyyy');
}

/**
 * Generate a URL-safe slug from a name
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Build a CSV string from headers and rows
 */
export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ];
  return lines.join('\r\n');
}

/**
 * Return NZD formatted amount string
 */
export function fmtCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Get current NZ period (YYYY-MM)
 */
export function currentPeriod(): string {
  return format(new Date(), 'yyyy-MM');
}

/**
 * Parse date safely - returns null if invalid
 */
export function safeParseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
