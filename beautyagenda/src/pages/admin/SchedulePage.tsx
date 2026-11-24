import { useEffect, useState } from 'react';
import { CalendarOff, Plus, Save, Trash2 } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.ts';
import { useToast } from '../../contexts/ToastContext.tsx';
import { getWorkingHours, saveWorkingHours } from '../../services/settings.ts';
import { listProfessionals } from '../../services/professionals.ts';
import {
  createException, createTimeBlock, deleteException, deleteTimeBlock, listExceptions, listTimeBlocks,
} from '../../services/schedule.ts';
import type { WorkingHour } from '../../types/index.ts';
import { addDays, todayKey, toDateKey, toTimeLabel, WEEKDAYS, zonedToDate } from '../../utils/datetime.ts';
import { formatDateKey, formatDayShort } from '../../utils/format.ts';
import { getErrorMessage } from '../../utils/errors.ts';
import { PageHeader } from '../../components/ui/PageHeader.tsx';
import { TimeSelect } from '../../components/ui/TimeSelect.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { DateInput } from '../../components/ui/DateInput.tsx';
import { ErrorState, Spinner } from '../../components/ui/Feedback.tsx';
import { Field, Input, Select, Toggle } from '../../components/ui/Field.tsx';
import { Modal } from '../../components/ui/Modal.tsx';

export default function SchedulePage() {
  return (
    <>
      <PageHeader title="Horários e folgas" description="Funcionamento do estabelecimento, bloqueios e exceções de horário." />
      <div className="space-y-6">
        <BusinessHoursCard />
        <BlocksCard />
      </div>
    </>
  );
}

function BusinessHoursCard() {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(getWorkingHours, []);
  const [rows, setRows] = useState<WorkingHour[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setRows(data.map((r) => ({
      ...r, open_time: r.open_time.slice(0, 5), close_time: r.close_time.slice(0, 5),
      break_start: r.break_start?.slice(0, 5) ?? null, break_end: r.break_end?.slice(0, 5) ?? null,
    })));
  }, [data]);

  const set = (weekday: number, patch: Partial<WorkingHour>) => setRows((rs) => rs.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));

  const save = async () => {
    for (const r of rows) {
      if (r.close_time <= r.open_time) return toast.error(`${WEEKDAYS[r.weekday]}: fechamento deve ser depois da abertura.`);
      if (Boolean(r.break_start) !== Boolean(r.break_end)) return toast.error(`${WEEKDAYS[r.weekday]}: preencha início e fim do intervalo.`);
      if (r.break_start && r.break_end && (r.break_start < r.open_time || r.break_end > r.close_time || r.break_end <= r.break_start)) {
        return toast.error(`${WEEKDAYS[r.weekday]}: intervalo deve estar dentro do horário de funcionamento.`);
      }
    }
    setBusy(true);
    try {
      await saveWorkingHours(rows.map((r) => ({ ...r, break_start: r.break_start || null, break_end: r.break_end || null })));
      toast.success('Horário de funcionamento salvo.');
      reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <div>
          <h2 className="font-semibold">Funcionamento do estabelecimento</h2>
          <p className="text-sm text-zinc-500">Nenhum profissional é agendado fora deste horário. O intervalo geral é opcional.</p>
        </div>
        <Button icon={<Save className="size-4" />} onClick={save} loading={busy} disabled={!data}>Salvar</Button>
      </div>
      {loading && !data ? <Spinner /> : error ? <div className="p-5"><ErrorState message={error} onRetry={reload} /></div> : (
        <div className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <div key={r.weekday} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <div className="w-36"><Toggle checked={r.is_open} onChange={(v) => set(r.weekday, { is_open: v })} label={WEEKDAYS[r.weekday]} /></div>
              {r.is_open ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <TimeSelect value={r.open_time} onChange={(v) => set(r.weekday, { open_time: v ?? '09:00' })} aria-label="Abertura" />
                  <span className="text-zinc-400">às</span>
                  <TimeSelect value={r.close_time} onChange={(v) => set(r.weekday, { close_time: v ?? '09:00' })} aria-label="Fechamento" />
                  <span className="ml-2 text-zinc-500">Intervalo</span>
                  <TimeSelect value={r.break_start ?? ''} onChange={(v) => set(r.weekday, { break_start: v })} aria-label="Início do intervalo" allowEmpty />
                  <span className="text-zinc-400">às</span>
                  <TimeSelect value={r.break_end ?? ''} onChange={(v) => set(r.weekday, { break_end: v })} aria-label="Fim do intervalo" allowEmpty />
                </div>
              ) : <span className="text-sm text-zinc-500">Fechado</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BlocksCard() {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(async () => {
    const [blocks, exceptions, pros] = await Promise.all([
      listTimeBlocks(zonedToDate(todayKey()).toISOString()), listExceptions(todayKey()), listProfessionals(),
    ]);
    return { blocks, exceptions, pros };
  }, []);
  const [form, setForm] = useState<'block' | 'exception' | null>(null);
  const proName = (id: string | null) => (id ? data?.pros.find((p) => p.id === id)?.name ?? '—' : 'Todo o estabelecimento');

  const remove = async (kind: 'block' | 'exception', id: string) => {
    try {
      if (kind === 'block') await deleteTimeBlock(id);
      else await deleteException(id);
      toast.success('Removido. Os horários voltaram a ficar disponíveis.');
      reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="font-semibold">Bloqueios e folgas</h2>
            <p className="text-sm text-zinc-500">Folga em data específica, compromisso, feriado.</p>
          </div>
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setForm('block')}>Bloquear</Button>
        </div>
        {loading && !data ? <Spinner /> : error ? <div className="p-5"><ErrorState message={error} onRetry={reload} /></div> :
          data!.blocks.length === 0 ? <p className="px-5 py-8 text-center text-sm text-zinc-500">Nenhum bloqueio futuro.</p> : (
          <ul className="divide-y divide-zinc-100">
            {data!.blocks.map((b) => {
              const sameDay = toDateKey(b.starts_at) === toDateKey(new Date(new Date(b.ends_at).getTime() - 1));
              return (
                <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                  <CalendarOff className="size-5 shrink-0 text-zinc-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{proName(b.professional_id)}</p>
                    <p className="text-sm text-zinc-500">
                      {sameDay
                        ? `${formatDayShort(toDateKey(b.starts_at))} · ${toTimeLabel(b.starts_at)}–${toTimeLabel(b.ends_at)}`
                        : `${formatDateKey(toDateKey(b.starts_at))} ${toTimeLabel(b.starts_at)} até ${formatDateKey(toDateKey(b.ends_at))} ${toTimeLabel(b.ends_at)}`}
                      {b.reason ? ` · ${b.reason}` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" aria-label="Remover bloqueio" className="text-red-600 hover:bg-red-50"
                    icon={<Trash2 className="size-4" />} onClick={() => remove('block', b.id)} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="font-semibold">Exceções de horário</h2>
            <p className="text-sm text-zinc-500">Horário especial em uma data (substitui o semanal).</p>
          </div>
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setForm('exception')}>Adicionar</Button>
        </div>
        {loading && !data ? <Spinner /> : error ? null : data!.exceptions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-500">Nenhuma exceção futura.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data!.exceptions.map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{formatDayShort(x.exception_date)} · {proName(x.professional_id)}</p>
                  <p className="text-sm text-zinc-500">
                    {x.is_closed ? 'Fechado / sem atendimento' : `Atende das ${x.start_time?.slice(0, 5)} às ${x.end_time?.slice(0, 5)}`}
                    {x.reason ? ` · ${x.reason}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="ghost" aria-label="Remover exceção" className="text-red-600 hover:bg-red-50"
                  icon={<Trash2 className="size-4" />} onClick={() => remove('exception', x.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {form && data && (
        <BlockForm kind={form} pros={data.pros.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }))}
          onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />
      )}
    </div>
  );
}

function BlockForm({ kind, pros, onClose, onSaved }: {
  kind: 'block' | 'exception'; pros: { id: string; name: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [professionalId, setProfessionalId] = useState('');
  const [date, setDate] = useState(todayKey());
  const [endDate, setEndDate] = useState(todayKey());
  const [allDay, setAllDay] = useState(true);
  const [closed, setClosed] = useState(true);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('12:00');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      setBusy(true);
      if (kind === 'block') {
        const last = allDay ? endDate : date;
        if (last < date) throw new Error('A data final deve ser igual ou posterior à inicial.');
        const startsAt = zonedToDate(date, allDay ? '00:00' : start);
        const endsAt = allDay ? zonedToDate(addDays(last, 1)) : zonedToDate(date, end);
        if (endsAt <= startsAt) throw new Error('O fim deve ser depois do início.');
        await createTimeBlock({ professional_id: professionalId || null, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), reason });
        toast.success('Bloqueio criado. Esses horários não serão oferecidos.');
      } else {
        if (!closed && end <= start) throw new Error('O fim deve ser depois do início.');
        await createException({
          exception_date: date, professional_id: professionalId || null, is_closed: closed,
          start_time: closed ? null : start, end_time: closed ? null : end, reason: reason || null,
        });
        toast.success('Exceção de horário criada.');
      }
      onSaved();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={kind === 'block' ? 'Novo bloqueio / folga' : 'Nova exceção de horário'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={busy}>Salvar</Button></>}>
      <div className="space-y-4">
        <Field label="Aplica-se a">
          <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">Todo o estabelecimento</option>
            {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        {kind === 'block' ? (
          <>
            <Toggle checked={allDay} onChange={setAllDay} label="Dia(s) inteiro(s) — folga" />
            <div className="grid grid-cols-2 gap-4">
              <Field label={allDay ? 'De' : 'Data'}><DateInput value={date} onChange={(v) => { setDate(v); if (v > endDate) setEndDate(v); }} aria-label={allDay ? 'De' : 'Data'} className="w-full" /></Field>
              {allDay
                ? <Field label="Até"><DateInput value={endDate} min={date} onChange={setEndDate} aria-label="Até" className="w-full" /></Field>
                : <div />}
            </div>
            {!allDay && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Início"><TimeSelect value={start} step={5} onChange={(v) => setStart(v ?? start)} className="w-full" /></Field>
                <Field label="Fim"><TimeSelect value={end} step={5} onChange={(v) => setEnd(v ?? end)} className="w-full" /></Field>
              </div>
            )}
          </>
        ) : (
          <>
            <Field label="Data"><DateInput value={date} onChange={setDate} aria-label="Data" className="w-full" /></Field>
            <Toggle checked={closed} onChange={setClosed} label="Fechado / sem atendimento nesta data" />
            {!closed && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Abre às"><TimeSelect value={start} step={5} onChange={(v) => setStart(v ?? start)} className="w-full" /></Field>
                <Field label="Fecha às"><TimeSelect value={end} step={5} onChange={(v) => setEnd(v ?? end)} className="w-full" /></Field>
              </div>
            )}
            <p className="text-xs text-zinc-500">
              Exceção do estabelecimento substitui o horário semanal naquela data. Exceção de um profissional substitui a jornada dele.
            </p>
          </>
        )}
        <Field label="Motivo (opcional)"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Ex.: Feriado, consulta médica..." /></Field>
        {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
