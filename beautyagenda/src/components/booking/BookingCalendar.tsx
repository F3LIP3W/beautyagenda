import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { getAvailableDates } from '../../services/booking.ts';
import { addDays, addMonths, endOfMonth, monthGrid, startOfMonth, todayKey } from '../../utils/datetime.ts';
import { formatMonthYear } from '../../utils/format.ts';
import { getErrorMessage } from '../../utils/errors.ts';

interface Props {
  serviceId: string;
  professionalId: string | null;
  maxAdvanceDays: number;
  value: string | null;
  onSelect: (date: string) => void;
}

/** Calendário público: só dias com horário livre ficam clicáveis. */
export function BookingCalendar({ serviceId, professionalId, maxAdvanceDays, value, onSelect }: Props) {
  const today = todayKey();
  const lastDay = addDays(today, maxAdvanceDays);
  const [month, setMonth] = useState(startOfMonth(value ?? today));
  const [available, setAvailable] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setAvailable(null);
    setError(null);
    const from = month < today ? today : month;
    const to = endOfMonth(month) > lastDay ? lastDay : endOfMonth(month);
    if (from > to) {
      setAvailable(new Set());
      return;
    }
    getAvailableDates(serviceId, from, to, professionalId)
      .then((dates) => alive && setAvailable(new Set(dates)))
      .catch((e) => alive && setError(getErrorMessage(e)));
    return () => {
      alive = false;
    };
  }, [month, serviceId, professionalId, today, lastDay]);

  const canPrev = month > startOfMonth(today);
  const canNext = addMonths(month, 1) <= lastDay;
  const grid = monthGrid(month);
  const monthPrefix = month.slice(0, 7);
  const noneThisMonth = available && available.size === 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => canPrev && setMonth(addMonths(month, -1))} disabled={!canPrev}
          className="rounded-xl p-2.5 hover:bg-zinc-100 disabled:opacity-30" aria-label="Mês anterior"><ChevronLeft className="size-5" /></button>
        <p className="flex items-center gap-2 font-semibold">
          {formatMonthYear(month)} {!available && !error && <LoaderCircle className="size-4 animate-spin text-gold-500" />}
        </p>
        <button onClick={() => canNext && setMonth(addMonths(month, 1))} disabled={!canNext}
          className="rounded-xl p-2.5 hover:bg-zinc-100 disabled:opacity-30" aria-label="Próximo mês"><ChevronRight className="size-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-400 uppercase">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => <span key={d} className="py-1.5">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.flat().map((d) => {
          const inMonth = d.startsWith(monthPrefix);
          if (!inMonth) return <span key={d} />;
          const past = d < today;
          const isAvailable = available?.has(d) ?? false;
          const selected = value === d;
          return (
            <button key={d} disabled={!isAvailable} onClick={() => onSelect(d)}
              aria-label={`${d.slice(8)}${isAvailable ? ', disponível' : ', indisponível'}`}
              className={`relative aspect-square rounded-xl text-[15px] font-medium transition
                ${selected ? 'bg-ink-950 text-white'
                  : isAvailable ? 'bg-white text-zinc-900 ring-1 ring-zinc-200 hover:ring-gold-400 hover:bg-gold-50'
                  : past ? 'text-zinc-300' : 'text-zinc-300 line-through decoration-zinc-300'}`}>
              {Number(d.slice(8))}
              {d === today && !selected && <span className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-gold-500" />}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {noneThisMonth && (
        <p className="mt-4 rounded-xl bg-zinc-50 px-4 py-3 text-center text-sm text-zinc-600">
          Nenhum dia disponível neste mês{canNext ? ' — veja o próximo.' : '.'}
        </p>
      )}
      <div className="mt-4 flex justify-center gap-5 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-white ring-1 ring-zinc-300" />Disponível</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-zinc-100" />Indisponível</span>
      </div>
    </div>
  );
}
