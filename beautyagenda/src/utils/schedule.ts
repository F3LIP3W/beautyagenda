/**
 * Cálculo VISUAL de expediente para o calendário do painel (sombrear horários
 * fora do expediente). A regra oficial de disponibilidade fica no banco
 * (função _free_ranges); aqui é só apresentação.
 */
import type { ProfessionalHour, ScheduleException, WorkingHour } from '../types/index.ts';
import { timeToMinutes, weekdayOf } from './datetime.ts';

export type Interval = [number, number]; // minutos do dia [início, fim)

function dayWindow(start: string | null, end: string | null, bStart: string | null, bEnd: string | null): Interval[] {
  if (!start || !end) return [];
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (!bStart || !bEnd) return [[s, e]];
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  return [[s, bs], [be, e]].filter(([a, b]) => b > a) as Interval[];
}

export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const [as, ae] of a) for (const [bs, be] of b) {
    const s = Math.max(as, bs);
    const e = Math.min(ae, be);
    if (e > s) out.push([s, e]);
  }
  return out.sort((x, y) => x[0] - y[0]);
}

export function businessWindows(date: string, hours: WorkingHour[], exceptions: ScheduleException[]): Interval[] {
  const ex = exceptions.find((e) => e.exception_date === date && !e.professional_id);
  if (ex) return ex.is_closed ? [] : dayWindow(ex.start_time, ex.end_time, null, null);
  const wh = hours.find((h) => h.weekday === weekdayOf(date));
  if (!wh || !wh.is_open) return [];
  return dayWindow(wh.open_time, wh.close_time, wh.break_start, wh.break_end);
}

export function professionalWindows(
  date: string, professionalId: string, proHours: ProfessionalHour[],
  hours: WorkingHour[], exceptions: ScheduleException[],
): Interval[] {
  const business = businessWindows(date, hours, exceptions);
  const ex = exceptions.find((e) => e.exception_date === date && e.professional_id === professionalId);
  let own: Interval[];
  if (ex) own = ex.is_closed ? [] : dayWindow(ex.start_time, ex.end_time, null, null);
  else {
    const ph = proHours.find((h) => h.professional_id === professionalId && h.weekday === weekdayOf(date));
    own = ph && ph.is_working ? dayWindow(ph.start_time, ph.end_time, ph.break_start, ph.break_end) : [];
  }
  return intersect(business, own);
}

/** Complemento dos intervalos dentro de [from, to] */
export function invert(intervals: Interval[], from: number, to: number): Interval[] {
  const out: Interval[] = [];
  let cursor = from;
  for (const [s, e] of intervals) {
    if (s > cursor) out.push([cursor, Math.min(s, to)]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < to) out.push([cursor, to]);
  return out.filter(([s, e]) => e > s);
}

/** Distribui eventos sobrepostos em colunas lado a lado. */
export function layoutLanes<T extends { start: number; end: number }>(events: T[]): (T & { lane: number; lanes: number })[] {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
  const result: (T & { lane: number; lanes: number })[] = [];
  let cluster: (T & { lane: number; lanes: number })[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => (c.lanes = lanes));
    result.push(...cluster);
    cluster = [];
  };
  for (const ev of sorted) {
    if (ev.start >= clusterEnd && cluster.length) flush();
    const laneEnds: number[] = [];
    cluster.forEach((c) => (laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? 0, c.end)));
    let lane = laneEnds.findIndex((end) => end <= ev.start);
    if (lane === -1) lane = laneEnds.length;
    cluster.push({ ...ev, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, ev.end);
  }
  if (cluster.length) flush();
  return result;
}
