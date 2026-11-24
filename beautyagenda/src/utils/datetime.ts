/**
 * Datas e horários sempre no fuso do estabelecimento (America/Sao_Paulo),
 * independentemente do fuso do aparelho de quem acessa.
 * Datas "de calendário" circulam como string 'YYYY-MM-DD'.
 */
export const APP_TIMEZONE = 'America/Sao_Paulo';

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function zonedParts(date: Date): Parts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    year: out.year, month: out.month, day: out.day,
    hour: out.hour % 24, minute: out.minute, second: out.second,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Diferença (minutos) entre o horário local do fuso e UTC naquele instante. */
function offsetMinutes(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** 'YYYY-MM-DD' + 'HH:MM' no fuso do estabelecimento → Date (instante UTC). */
export function zonedToDate(date: string, time = '00:00'): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let result = guess - offsetMinutes(new Date(guess)) * 60000;
  const second = guess - offsetMinutes(new Date(result)) * 60000;
  if (second !== result) result = second;
  return new Date(result);
}

/** Instante → data 'YYYY-MM-DD' no fuso do estabelecimento. */
export function toDateKey(value: Date | string): string {
  const p = zonedParts(typeof value === 'string' ? new Date(value) : value);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Instante → 'HH:MM' (24h) no fuso do estabelecimento. */
export function toTimeLabel(value: Date | string): string {
  const p = zonedParts(typeof value === 'string' ? new Date(value) : value);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Minutos desde 00:00 no fuso do estabelecimento. */
export function minutesOfDay(value: Date | string): number {
  const p = zonedParts(typeof value === 'string' ? new Date(value) : value);
  return p.hour * 60 + p.minute;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addMonths(dateKey: string, months: number): string {
  const [y, m] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-01`;
}

/** 0 = domingo ... 6 = sábado */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Segunda-feira da semana da data. */
export function startOfWeek(dateKey: string): string {
  const dow = weekdayOf(dateKey);
  return addDays(dateKey, dow === 0 ? -6 : 1 - dow);
}

export function startOfMonth(dateKey: string): string {
  return dateKey.slice(0, 8) + '01';
}

export function endOfMonth(dateKey: string): string {
  return addDays(addMonths(dateKey, 1), -1);
}

export function daysBetween(fromKey: string, toKey: string): number {
  const a = Date.UTC(...(fromKey.split('-').map(Number) as [number, number, number]));
  const b = Date.UTC(...(toKey.split('-').map(Number) as [number, number, number]));
  return Math.round((b - a) / 86400000);
}

/** Grade do mês (semanas começando na segunda), com datas dos meses vizinhos. */
export function monthGrid(monthKey: string): string[][] {
  const first = startOfMonth(monthKey);
  let cursor = startOfWeek(first);
  const last = endOfMonth(monthKey);
  const weeks: string[][] = [];
  while (cursor <= last || weeks.length < 5) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
    if (cursor > last && weeks.length >= 5) break;
  }
  return weeks;
}

/** 'HH:MM' ou 'HH:MM:SS' → minutos */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}
