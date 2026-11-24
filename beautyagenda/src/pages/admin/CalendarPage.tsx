import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.ts';
import { listAppointments } from '../../services/appointments.ts';
import { listProfessionals } from '../../services/professionals.ts';
import { getWorkingHours } from '../../services/settings.ts';
import { listExceptions, listTimeBlocks } from '../../services/schedule.ts';
import type { AppointmentDetail, ProfessionalWithDetails, ScheduleException, TimeBlock, WorkingHour } from '../../types/index.ts';
import {
  addDays, addMonths, minutesOfDay, minutesToTime, monthGrid, startOfWeek, todayKey, toDateKey, WEEKDAYS_SHORT, zonedToDate,
} from '../../utils/datetime.ts';
import { formatDateKey, formatDayLong, formatMonthYear } from '../../utils/format.ts';
import { businessWindows, invert, layoutLanes, professionalWindows, type Interval } from '../../utils/schedule.ts';
import { STATUS_LABEL } from '../../utils/status.ts';
import { Button } from '../../components/ui/Button.tsx';
import { DateInput } from '../../components/ui/DateInput.tsx';
import { Select, Toggle } from '../../components/ui/Field.tsx';
import { ErrorState, Spinner } from '../../components/ui/Feedback.tsx';
import { Avatar, proColor } from '../../components/ui/Avatar.tsx';
import { NewAppointmentModal, type NewAppointmentDefaults } from '../../components/admin/NewAppointmentModal.tsx';
import { AppointmentDetailsModal } from '../../components/admin/AppointmentDetailsModal.tsx';

type View = 'day' | 'week' | 'month';
const PX_PER_MIN = 1.1;

interface CalendarData {
  appointments: AppointmentDetail[];
  blocks: TimeBlock[];
  professionals: ProfessionalWithDetails[];
  hours: WorkingHour[];
  exceptions: ScheduleException[];
}

function rangeFor(view: View, anchor: string): [string, string] {
  if (view === 'day') return [anchor, addDays(anchor, 1)];
  if (view === 'week') {
    const s = startOfWeek(anchor);
    return [s, addDays(s, 7)];
  }
  const grid = monthGrid(anchor);
  return [grid[0][0], addDays(grid[grid.length - 1][6], 1)];
}

export default function CalendarPage() {
  const [view, setView] = useState<View>(() => (window.innerWidth < 768 ? 'day' : 'week'));
  const [anchor, setAnchor] = useState(todayKey());
  const [proFilter, setProFilter] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newDefaults, setNewDefaults] = useState<NewAppointmentDefaults | null>(null);

  const [from, to] = rangeFor(view, anchor);
  const { data, error, loading, reload } = useAsync<CalendarData>(async () => {
    const fromIso = zonedToDate(from).toISOString();
    const toIso = zonedToDate(to).toISOString();
    const [appointments, blocks, professionals, hours, exceptions] = await Promise.all([
      listAppointments(fromIso, toIso), listTimeBlocks(fromIso, toIso), listProfessionals(), getWorkingHours(), listExceptions(from),
    ]);
    return { appointments, blocks, professionals, hours, exceptions };
  }, [from, to]);

  const colorOf = useMemo(() => {
    const map = new Map<string, string>();
    (data?.professionals ?? []).forEach((p, i) => map.set(p.id, proColor(i)));
    return (id: string) => map.get(id) ?? '#52525b';
  }, [data?.professionals]);

  const appointments = useMemo(
    () => (data?.appointments ?? []).filter((a) =>
      (showCancelled || (a.status !== 'cancelled' && a.status !== 'no_show')) && (!proFilter || a.professional_id === proFilter)),
    [data?.appointments, showCancelled, proFilter],
  );

  const move = (dir: number) => {
    if (view === 'day') setAnchor(addDays(anchor, dir));
    else if (view === 'week') setAnchor(addDays(anchor, 7 * dir));
    else setAnchor(addMonths(anchor, dir));
  };

  const title = view === 'day' ? formatDayLong(anchor)
    : view === 'week' ? `${formatDateKey(from).slice(0, 5)} a ${formatDateKey(addDays(to, -1))}`
    : formatMonthYear(anchor);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="mt-0.5 text-sm text-zinc-500">{title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-zinc-300 bg-white p-0.5">
            {(['day', 'week', 'month'] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-ink-950 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}>
                {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center rounded-xl border border-zinc-300 bg-white">
            <button onClick={() => move(-1)} className="rounded-l-xl p-2 hover:bg-zinc-100" aria-label="Anterior"><ChevronLeft className="size-5" /></button>
            <button onClick={() => setAnchor(todayKey())} className="px-3 text-sm font-medium hover:bg-zinc-100">Hoje</button>
            <button onClick={() => move(1)} className="rounded-r-xl p-2 hover:bg-zinc-100" aria-label="Próximo"><ChevronRight className="size-5" /></button>
          </div>
          <DateInput value={anchor} onChange={setAnchor} className="h-10" aria-label="Ir para data" />
          <Button icon={<Plus className="size-4" />} onClick={() => setNewDefaults({ date: anchor, professionalId: proFilter || null })}>
            Agendar
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={proFilter} onChange={(e) => setProFilter(e.target.value)} className="h-10 w-auto min-w-52 py-1.5">
          <option value="">Todos os profissionais</option>
          {(data?.professionals ?? []).filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Toggle checked={showCancelled} onChange={setShowCancelled} label="Mostrar cancelados / faltas" />
        <div className="ml-auto hidden items-center gap-4 text-xs text-zinc-500 md:flex">
          <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-zinc-200 bg-white" />Livre</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-zinc-200" />Fora do expediente</span>
          <span className="flex items-center gap-1.5"><span className="blocked-stripes size-3 rounded" />Bloqueado</span>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <Spinner /> : (
        <div className={loading ? 'opacity-60 transition-opacity' : ''}>
          {view === 'month' ? (
            <MonthView anchor={anchor} appointments={appointments} colorOf={colorOf}
              onPickDay={(d) => { setAnchor(d); setView('day'); }} />
          ) : (
            <TimeGrid
              view={view} days={view === 'day' ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(from, i))}
              data={data} appointments={appointments} proFilter={proFilter} colorOf={colorOf}
              onOpen={setOpenId}
              onEmptyClick={(date, time, professionalId) => setNewDefaults({ date, time, professionalId })}
            />
          )}
        </div>
      )}

      <NewAppointmentModal open={Boolean(newDefaults)} defaults={newDefaults ?? undefined}
        onClose={() => setNewDefaults(null)} onCreated={reload} />
      <AppointmentDetailsModal appointmentId={openId} onClose={() => setOpenId(null)} onChanged={reload} />
    </>
  );
}

/* ------------------------------------------------------------------ Grade */
interface Column {
  key: string;
  date: string;
  professionalId: string | null;
  header: ReactNode;
  windows: Interval[];
}

function TimeGrid({ view, days, data, appointments, proFilter, colorOf, onOpen, onEmptyClick }: {
  view: View; days: string[]; data: CalendarData; appointments: AppointmentDetail[]; proFilter: string;
  colorOf: (id: string) => string; onOpen: (id: string) => void;
  onEmptyClick: (date: string, time: string, professionalId: string | null) => void;
}) {
  const activePros = data.professionals.filter((p) => (proFilter ? p.id === proFilter : p.active));
  const proHours = data.professionals.flatMap((p) => p.hours);

  const columns: Column[] = view === 'day'
    ? activePros.map((p) => ({
        key: p.id, date: days[0], professionalId: p.id,
        header: (
          <div className="flex items-center gap-2">
            <Avatar name={p.name} src={p.photo_url} size={28} color={colorOf(p.id)} />
            <span className="truncate">{p.name}</span>
          </div>
        ),
        windows: professionalWindows(days[0], p.id, proHours, data.hours, data.exceptions),
      }))
    : days.map((d) => ({
        key: d, date: d, professionalId: proFilter || null,
        header: (
          <div className={`text-center ${d === todayKey() ? 'text-gold-600' : ''}`}>
            <span className="block text-xs font-medium text-zinc-500 uppercase">{WEEKDAYS_SHORT[new Date(d + 'T12:00:00Z').getUTCDay()]}</span>
            <span className="text-lg font-semibold">{d.slice(8)}</span>
          </div>
        ),
        windows: proFilter
          ? professionalWindows(d, proFilter, proHours, data.hours, data.exceptions)
          : businessWindows(d, data.hours, data.exceptions),
      }));

  // Faixa de horas exibida: expediente ± 1h, ajustada para incluir agendamentos
  const allWindows = columns.flatMap((c) => c.windows);
  let startMin = Math.min(8 * 60, ...allWindows.map((w) => w[0]));
  let endMin = Math.max(19 * 60, ...allWindows.map((w) => w[1]));
  for (const a of appointments) {
    startMin = Math.min(startMin, minutesOfDay(a.starts_at));
    endMin = Math.max(endMin, Math.min(24 * 60, minutesOfDay(a.starts_at) + a.duration_minutes));
  }
  startMin = Math.max(0, Math.floor(startMin / 60) * 60);
  endMin = Math.min(24 * 60, Math.ceil(endMin / 60) * 60);
  const height = (endMin - startMin) * PX_PER_MIN;
  const hours = Array.from({ length: (endMin - startMin) / 60 }, (_, i) => startMin + i * 60);

  if (columns.length === 0) {
    return <div className="card p-8 text-center text-sm text-zinc-500">Nenhum profissional ativo. Cadastre profissionais para usar a agenda.</div>;
  }

  const handleClick = (e: MouseEvent<HTMLDivElement>, col: Column) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minute = startMin + Math.floor((e.clientY - rect.top) / PX_PER_MIN / 15) * 15;
    onEmptyClick(col.date, minutesToTime(minute), col.professionalId);
  };

  return (
    <div className="card overflow-x-auto">
      <div style={{ minWidth: view === 'day' ? Math.max(360, 64 + columns.length * 170) : 820 }}>
        <div className="sticky top-0 z-20 flex border-b border-zinc-200 bg-white">
          <div className="w-16 shrink-0" />
          {columns.map((c) => <div key={c.key} className="min-w-0 flex-1 border-l border-zinc-100 px-2 py-2.5 text-sm font-medium">{c.header}</div>)}
        </div>
        <div className="relative flex" style={{ height }}>
          <div className="relative w-16 shrink-0">
            {hours.map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-xs text-zinc-400" style={{ top: (h - startMin) * PX_PER_MIN }}>
                {h === startMin ? '' : minutesToTime(h)}
              </span>
            ))}
          </div>
          {columns.map((col) => {
            const offWork = invert(col.windows, startMin, endMin);
            const dayStart = zonedToDate(col.date).getTime();
            const dayEnd = zonedToDate(addDays(col.date, 1)).getTime();
            const blocks = data.blocks
              // Bloqueio geral aparece sempre; bloqueio individual só na coluna daquele profissional
              .filter((b) => (b.professional_id === null || (col.professionalId !== null && b.professional_id === col.professionalId))
                && new Date(b.starts_at).getTime() < dayEnd && new Date(b.ends_at).getTime() > dayStart);
            const events = layoutLanes(
              appointments
                .filter((a) => toDateKey(a.starts_at) === col.date && (!col.professionalId || a.professional_id === col.professionalId))
                .map((a) => ({ ...a, start: minutesOfDay(a.starts_at), end: minutesOfDay(a.starts_at) + a.duration_minutes })),
            );
            return (
              <div key={col.key} className="relative min-w-0 flex-1 cursor-pointer border-l border-zinc-100 hover:bg-gold-50/30"
                onClick={(e) => handleClick(e, col)} title="Clique em um horário livre para agendar">
                {hours.map((h) => (
                  <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-zinc-100" style={{ top: (h - startMin) * PX_PER_MIN }} />
                ))}
                {offWork.map(([s, e]) => (
                  <div key={`off${s}`} className="pointer-events-none absolute inset-x-0 bg-zinc-100/80"
                    style={{ top: (s - startMin) * PX_PER_MIN, height: (e - s) * PX_PER_MIN }} />
                ))}
                {blocks.map((b) => {
                  const s = Math.max(startMin, new Date(b.starts_at).getTime() < dayStart ? 0 : minutesOfDay(b.starts_at));
                  const e = Math.min(endMin, new Date(b.ends_at).getTime() >= dayEnd ? 24 * 60 : minutesOfDay(b.ends_at));
                  if (e <= s) return null;
                  return (
                    <div key={b.id} className="blocked-stripes pointer-events-none absolute inset-x-0 overflow-hidden px-1.5 py-1 text-[11px] text-zinc-500"
                      style={{ top: (s - startMin) * PX_PER_MIN, height: (e - s) * PX_PER_MIN }}>
                      {b.reason || 'Bloqueado'}
                    </div>
                  );
                })}
                {events.map((a) => {
                  const color = colorOf(a.professional_id);
                  const faded = a.status === 'cancelled' || a.status === 'no_show';
                  return (
                    <button key={a.id} onClick={() => onOpen(a.id)}
                      className={`absolute overflow-hidden rounded-lg border-l-4 bg-white px-2 py-1 text-left shadow-sm ring-1 ring-zinc-200 transition hover:z-10 hover:shadow-md ${faded ? 'opacity-50 line-through' : ''}`}
                      style={{
                        top: (a.start - startMin) * PX_PER_MIN + 1,
                        height: Math.max(22, a.duration_minutes * PX_PER_MIN - 2),
                        left: `calc(${(a.lane / a.lanes) * 100}% + 2px)`,
                        width: `calc(${100 / a.lanes}% - 4px)`,
                        borderLeftColor: color,
                        backgroundColor: a.status === 'pending' ? '#fffbeb' : undefined,
                      }}
                      title={`${minutesToTime(a.start)} ${a.client_name} — ${a.service_name} (${a.professional_name}) · ${STATUS_LABEL[a.status]}`}>
                      <p className="truncate text-xs font-semibold text-zinc-900">{minutesToTime(a.start)} {a.client_name}</p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {a.service_name}{view === 'week' && !proFilter ? ` · ${a.professional_name}` : ''}
                      </p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- Mês */
function MonthView({ anchor, appointments, colorOf, onPickDay }: {
  anchor: string; appointments: AppointmentDetail[]; colorOf: (id: string) => string; onPickDay: (d: string) => void;
}) {
  const grid = monthGrid(anchor);
  const month = anchor.slice(0, 7);
  const byDay = new Map<string, AppointmentDetail[]>();
  for (const a of appointments) {
    const k = toDateKey(a.starts_at);
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-xs font-medium text-zinc-500 uppercase">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      {grid.map((week) => (
        <div key={week[0]} className="grid grid-cols-7 border-b border-zinc-100 last:border-0">
          {week.map((d) => {
            const items = byDay.get(d) ?? [];
            const inMonth = d.startsWith(month);
            return (
              <button key={d} onClick={() => onPickDay(d)}
                className={`min-h-20 border-l border-zinc-100 p-1.5 text-left align-top first:border-0 hover:bg-gold-50/50 sm:min-h-28 sm:p-2 ${inMonth ? '' : 'bg-zinc-50/70 text-zinc-400'}`}>
                <span className={`inline-flex size-7 items-center justify-center rounded-full text-sm font-medium ${d === todayKey() ? 'bg-ink-950 text-white' : ''}`}>
                  {Number(d.slice(8))}
                </span>
                {items.length > 0 && (
                  <>
                    <span className="mt-1 block text-xs font-medium text-gold-700 sm:hidden">{items.length} agend.</span>
                    <div className="mt-1 hidden space-y-1 sm:block">
                      {items.slice(0, 3).map((a) => (
                        <span key={a.id} className="flex items-center gap-1 truncate text-[11px] text-zinc-700">
                          <span className="size-1.5 shrink-0 rounded-full" style={{ background: colorOf(a.professional_id) }} />
                          {minutesToTime(minutesOfDay(a.starts_at))} {a.client_name.split(' ')[0]}
                        </span>
                      ))}
                      {items.length > 3 && <span className="block text-[11px] font-medium text-zinc-500">+{items.length - 3} mais</span>}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
