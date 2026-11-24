import { MONTHS, WEEKDAYS, toDateKey, toTimeLabel, weekdayOf } from './datetime.ts';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCurrency(value: number | string | null | undefined): string {
  return currency.format(Number(value ?? 0));
}

/** 'YYYY-MM-DD' → 'DD/MM/AAAA' */
export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Instante → 'DD/MM/AAAA' no fuso do estabelecimento */
export function formatDate(value: Date | string): string {
  return formatDateKey(toDateKey(value));
}

/** Instante → 'DD/MM/AAAA às HH:MM' */
export function formatDateTime(value: Date | string): string {
  return `${formatDate(value)} às ${toTimeLabel(value)}`;
}

/** 'YYYY-MM-DD' → 'Terça, 19/11' */
export function formatDayShort(dateKey: string): string {
  const [, m, d] = dateKey.split('-');
  return `${WEEKDAYS[weekdayOf(dateKey)]}, ${d}/${m}`;
}

/** 'YYYY-MM-DD' → 'Terça-feira, 19/11/2026' */
export function formatDayLong(dateKey: string): string {
  const dow = weekdayOf(dateKey);
  const name = dow === 0 || dow === 6 ? WEEKDAYS[dow] : `${WEEKDAYS[dow]}-feira`;
  return `${name}, ${formatDateKey(dateKey)}`;
}

export function formatMonthYear(dateKey: string): string {
  const [y, m] = dateKey.split('-').map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/** Valor digitado ("45", "45,50", "1.234,5") → número */
export function parseMoney(input: string): number {
  const clean = input.replace(/[^\d,.-]/g, '');
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
