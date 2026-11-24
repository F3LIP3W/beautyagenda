import { useState } from 'react';
import { CalendarCheck, CalendarX, Download, FileSpreadsheet, Receipt, TrendingUp, UserX, Wallet } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.ts';
import { useToast } from '../../contexts/ToastContext.tsx';
import { getReport } from '../../services/reports.ts';
import { listAppointments } from '../../services/appointments.ts';
import type { RankingRow, ReportData } from '../../types/index.ts';
import { addDays, addMonths, endOfMonth, startOfMonth, startOfWeek, todayKey, toTimeLabel, zonedToDate, toDateKey } from '../../utils/datetime.ts';
import { formatCurrency, formatDateKey, formatMonthYear } from '../../utils/format.ts';
import { formatPhone } from '../../utils/phone.ts';
import { STATUS_LABEL } from '../../utils/status.ts';
import { downloadCsv, toCsv } from '../../utils/csv.ts';
import { getErrorMessage } from '../../utils/errors.ts';
import { PageHeader, StatCard } from '../../components/ui/PageHeader.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { DateInput } from '../../components/ui/DateInput.tsx';
import { ErrorState, Spinner } from '../../components/ui/Feedback.tsx';
import { Select } from '../../components/ui/Field.tsx';

type Preset = 'today' | 'week' | 'month' | 'last_month' | '30d' | 'custom';
type Group = 'day' | 'week' | 'month';

function presetRange(p: Preset): [string, string] {
  const t = todayKey();
  switch (p) {
    case 'today': return [t, t];
    case 'week': return [startOfWeek(t), addDays(startOfWeek(t), 6)];
    case 'month': return [startOfMonth(t), endOfMonth(t)];
    case 'last_month': { const m = addMonths(t, -1); return [m, endOfMonth(m)]; }
    case '30d': return [addDays(t, -29), t];
    default: return [startOfMonth(t), t];
  }
}

export default function ReportsPage() {
  const toast = useToast();
  const [preset, setPreset] = useState<Preset>('month');
  const [range, setRange] = useState<[string, string]>(presetRange('month'));
  const [group, setGroup] = useState<Group>('day');
  const [exporting, setExporting] = useState(false);
  const { data, error, loading, reload } = useAsync(() => getReport(range[0], range[1], group), [range[0], range[1], group]);

  const choose = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') setRange(presetRange(p));
  };

  const periodLabel = (period: string) => group === 'month' ? formatMonthYear(period)
    : group === 'week' ? `Semana de ${formatDateKey(period)}` : formatDateKey(period);

  const exportSummary = (r: ReportData) => {
    const rows: { a: string; b: string | number; c: string | number; d: string | number; e: string | number }[] = [
      { a: `Relatório BeautyAgenda — ${formatDateKey(r.from)} a ${formatDateKey(r.to)}`, b: '', c: '', d: '', e: '' },
      { a: 'Faturamento realizado (concluídos)', b: r.summary.realized_revenue, c: '', d: '', e: '' },
      { a: 'Faturamento previsto (pendentes + confirmados)', b: r.summary.forecast_revenue, c: '', d: '', e: '' },
      { a: 'Atendimentos concluídos', b: r.summary.completed, c: '', d: '', e: '' },
      { a: 'Ticket médio', b: r.summary.average_ticket, c: '', d: '', e: '' },
      { a: 'Cancelados', b: r.summary.cancelled, c: '', d: '', e: '' },
      { a: 'Não compareceu', b: r.summary.no_show, c: '', d: '', e: '' },
      { a: '', b: '', c: '', d: '', e: '' },
      { a: 'Período', b: 'Realizado (R$)', c: 'Previsto (R$)', d: 'Concluídos', e: 'Agendamentos' },
      ...r.series.map((s) => ({ a: periodLabel(s.period), b: Number(s.realized), c: Number(s.forecast), d: s.completed, e: s.appointments })),
      { a: '', b: '', c: '', d: '', e: '' },
      { a: 'Serviço', b: 'Concluídos', c: 'Agendados', d: 'Faturamento (R$)', e: '' },
      ...r.services.map((s) => ({ a: s.name, b: s.completed, c: s.booked, d: Number(s.revenue), e: '' })),
      { a: '', b: '', c: '', d: '', e: '' },
      { a: 'Profissional', b: 'Concluídos', c: 'Agendados', d: 'Faturamento (R$)', e: '' },
      ...r.professionals.map((s) => ({ a: s.name, b: s.completed, c: s.booked, d: Number(s.revenue), e: '' })),
      { a: '', b: '', c: '', d: '', e: '' },
      { a: 'Cliente', b: 'WhatsApp', c: 'Concluídos', d: 'Agendados', e: 'Gasto (R$)' },
      ...r.clients.map((s) => ({ a: s.name, b: formatPhone(s.whatsapp), c: s.completed, d: s.booked, e: Number(s.revenue) })),
    ];
    downloadCsv(`relatorio-resumo-${r.from}-a-${r.to}.csv`, toCsv(rows, [
      { header: 'Item', value: (x) => x.a }, { header: 'Valor', value: (x) => x.b }, { header: '', value: (x) => x.c },
      { header: '', value: (x) => x.d }, { header: '', value: (x) => x.e },
    ]));
  };

  const exportAppointments = async () => {
    setExporting(true);
    try {
      const list = await listAppointments(zonedToDate(range[0]).toISOString(), zonedToDate(addDays(range[1], 1)).toISOString());
      downloadCsv(`agendamentos-${range[0]}-a-${range[1]}.csv`, toCsv(list, [
        { header: 'Código', value: (a) => a.code },
        { header: 'Data', value: (a) => formatDateKey(toDateKey(a.starts_at)) },
        { header: 'Horário', value: (a) => toTimeLabel(a.starts_at) },
        { header: 'Cliente', value: (a) => a.client_name },
        { header: 'WhatsApp', value: (a) => formatPhone(a.client_whatsapp) },
        { header: 'Serviço', value: (a) => a.service_name },
        { header: 'Categoria', value: (a) => a.service_category },
        { header: 'Profissional', value: (a) => a.professional_name },
        { header: 'Duração (min)', value: (a) => a.duration_minutes },
        { header: 'Valor (R$)', value: (a) => Number(a.price) },
        { header: 'Status', value: (a) => STATUS_LABEL[a.status] },
        { header: 'Origem', value: (a) => (a.source === 'online' ? 'Online' : 'Painel') },
      ]));
      toast.success(`${list.length} agendamento(s) exportado(s).`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const maxSeries = Math.max(1, ...(data?.series ?? []).map((s) => Number(s.realized) + Number(s.forecast)));

  return (
    <>
      <PageHeader title="Relatórios" description="Faturamento realizado considera somente atendimentos concluídos."
        actions={data && <>
          <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => exportSummary(data)}>Exportar resumo (CSV)</Button>
          <Button variant="secondary" icon={<FileSpreadsheet className="size-4" />} loading={exporting} onClick={exportAppointments}>Exportar agendamentos</Button>
        </>} />

      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {([['today', 'Hoje'], ['week', 'Esta semana'], ['month', 'Este mês'], ['last_month', 'Mês passado'], ['30d', 'Últimos 30 dias'], ['custom', 'Personalizado']] as [Preset, string][]).map(([k, l]) => (
            <button key={k} onClick={() => choose(k)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${preset === k ? 'bg-ink-950 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}>{l}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <DateInput value={range[0]} onChange={(v) => setRange([v, range[1] < v ? v : range[1]])} className="h-10" aria-label="Data inicial" />
            <span className="text-zinc-400">a</span>
            <DateInput value={range[1]} min={range[0]} onChange={(v) => setRange([range[0], v])} className="h-10" aria-label="Data final" />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-zinc-500">Agrupar por</span>
          <Select value={group} onChange={(e) => setGroup(e.target.value as Group)} className="h-10 w-auto py-1.5">
            <option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option>
          </Select>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <Spinner /> : (
        <div className={`space-y-6 ${loading ? 'opacity-60' : ''}`}>
          <p className="text-sm text-zinc-500">Período: <b className="text-zinc-800">{formatDateKey(data.from)} a {formatDateKey(data.to)}</b></p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Faturamento realizado" value={formatCurrency(data.summary.realized_revenue)} tone="green" icon={<Wallet className="size-4" />} hint="atendimentos concluídos" />
            <StatCard label="Previsto" value={formatCurrency(data.summary.forecast_revenue)} tone="gold" icon={<TrendingUp className="size-4" />} hint="pendentes + confirmados" />
            <StatCard label="Atendimentos" value={data.summary.completed} icon={<CalendarCheck className="size-4" />} hint={`${data.summary.confirmed + data.summary.pending} ainda agendados`} />
            <StatCard label="Ticket médio" value={formatCurrency(data.summary.average_ticket)} icon={<Receipt className="size-4" />} />
            <StatCard label="Cancelados" value={data.summary.cancelled} tone="red" icon={<CalendarX className="size-4" />} />
            <StatCard label="Não compareceu" value={data.summary.no_show} tone="amber" icon={<UserX className="size-4" />} />
          </div>

          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Faturamento {group === 'day' ? 'diário' : group === 'week' ? 'semanal' : 'mensal'}</h2>
              <div className="flex gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-600" />Realizado</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-gold-300" />Previsto</span>
              </div>
            </div>
            {data.series.length === 0 ? <p className="py-6 text-center text-sm text-zinc-500">Sem agendamentos no período.</p> : (
              <div className="space-y-2.5">
                {data.series.map((s) => (
                  <div key={s.period} className="grid grid-cols-12 items-center gap-3 text-sm">
                    <span className="col-span-4 truncate text-zinc-600 sm:col-span-3">{periodLabel(s.period)}</span>
                    <div className="col-span-5 flex h-5 overflow-hidden rounded-md bg-zinc-100 sm:col-span-6">
                      <div className="bg-emerald-600" style={{ width: `${(Number(s.realized) / maxSeries) * 100}%` }} />
                      <div className="bg-gold-300" style={{ width: `${(Number(s.forecast) / maxSeries) * 100}%` }} />
                    </div>
                    <span className="col-span-3 text-right font-medium">{formatCurrency(s.realized)}
                      {Number(s.forecast) > 0 && <span className="block text-xs font-normal text-zinc-500">+{formatCurrency(s.forecast)}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <Ranking title="Serviços mais realizados" rows={data.services} />
            <Ranking title="Profissionais com mais atendimentos" rows={data.professionals} />
            <Ranking title="Clientes mais frequentes" rows={data.clients} showPhone />
          </div>
        </div>
      )}
    </>
  );
}

function Ranking({ title, rows, showPhone }: { title: string; rows: RankingRow[]; showPhone?: boolean }) {
  return (
    <section className="card">
      <h2 className="border-b border-zinc-100 px-5 py-4 font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="px-5 py-6 text-sm text-zinc-500">Sem dados no período.</p> : (
        <ol className="divide-y divide-zinc-100">
          {rows.map((r, i) => (
            <li key={r.name + (r.whatsapp ?? '')} className="flex items-center gap-3 px-5 py-3">
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${i < 3 ? 'bg-gold-100 text-gold-700' : 'bg-zinc-100 text-zinc-500'}`}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="text-xs text-zinc-500">
                  {showPhone && r.whatsapp ? `${formatPhone(r.whatsapp)} · ` : ''}{r.completed} concluído(s) · {r.booked} agendado(s)
                </p>
              </div>
              <span className="text-sm font-medium">{formatCurrency(r.revenue)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
