export type Currency = string;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CHF: 'CHF ',
  AUD: 'A$',
  CAD: 'C$',
  NZD: 'NZ$',
  JPY: '¥',
  CNY: '¥',
  HKD: 'HK$',
  SGD: 'S$',
  KRW: '₩',
  INR: '₹',
  AED: 'AED ',
  ZAR: 'R',
  BRL: 'R$',
  MXN: 'Mex$',
  ARS: 'AR$',
  SEK: 'kr ',
  NOK: 'kr ',
  DKK: 'kr ',
  PLN: 'zł ',
  CZK: 'Kč ',
  HUF: 'Ft ',
  TRY: '₺',
  RUB: '₽',
  THB: '฿',
  VND: '₫',
  IDR: 'Rp ',
  PHP: '₱',
  ILS: '₪',
  SAR: 'SR ',
};

export function getCurrencySymbol(code: string): string {
  const upper = code.toUpperCase();
  return CURRENCY_SYMBOLS[upper] ?? `${upper} `;
}

export function formatMoney(value: number, currency: Currency = 'USD'): string {
  const symbol = getCurrencySymbol(currency);
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${symbol}${formatted}`;
}

export function formatMoneyCompact(value: number, currency: Currency = 'USD'): string {
  const symbol = getCurrencySymbol(currency);
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`;
  return formatMoney(value, currency);
}

export function formatPnL(value: number, currency: Currency = 'USD'): string {
  if (value > 0) return `+${formatMoney(value, currency)}`;
  return formatMoney(value, currency);
}

export function formatPercent(value: number, digits = 1): string {
  if (!isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatHours(minutes: number): string {
  if (!minutes) return '0h';
  const hours = minutes / 60;
  if (hours < 1) return `${minutes}m`;
  if (hours < 10) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours)}h`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatRate(value: number, currency: Currency = 'USD'): string {
  if (!isFinite(value)) return '—';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${sign}${getCurrencySymbol(currency)}${formatted}/h`;
}

export function todayISO(): string {
  return new Date().toISOString();
}

export function startOfMonthISO(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
