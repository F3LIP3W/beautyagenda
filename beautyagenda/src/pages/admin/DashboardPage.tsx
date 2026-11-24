import { useState } from 'react';
import {
  CalendarCheck, CalendarDays, CalendarPlus, CalendarX, Clock3, DollarSign, MessageCircle, Plus, Scissors, UserPlus, Users,
} from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.ts';
import { getDashboardStats } from '../../services/reports.ts';
import { getSettings } from '../../services/settings.ts';
import { Link } from '../../lib/router.tsx';
import { PageHeader, StatCard } from '../../components/ui/PageHeader.tsx';
import { EmptyState, ErrorState, Spinner, StatusBadge } from '../../components/ui/Feedback.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { NewAppointmentModal } from '../../components/admin/NewAppointmentModal.tsx';
import { AppointmentDetailsModal } from '../../components/admin/AppointmentDetailsModal.tsx';
import { formatCurrency, formatDate, formatDayLong } from '../../utils/format.ts';
import { toTimeLabel, todayKey, toDateKey } from '../../utils/datetime.ts';
import { buildAdminReminderMessage, buildWhatsappLink } from '../../utils/whatsapp.ts';

export default function DashboardPage() {
  const { data, error, loading, reload } = useAsync(() => Promise.all([getDashboardStats(), getSettings()]), []);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorState message={error ?? 'Erro ao carregar.'} onRetry={reload} />;
  const [stats, settings] = data;
  const maxTop = Math.max(1, ...stats.top_services.map((s) => Number(s.total)));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Hoje, ${formatDayLong(todayKey())}`}
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Novo agendamento</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Hoje" value={stats.total} icon={<CalendarDays className="size-4" />} hint="agendamentos ativos" />
        <StatCard label="Confirmados" value={stats.confirmed} tone="green" icon={<CalendarCheck className="size-4" />} />
        <StatCard label="Pendentes" value={stats.pending} tone="amber" icon={<Clock3 className="size-4" />} />
        <StatCard label="Cancelados" value={stats.cancelled} tone="red" icon={<CalendarX className="size-4" />} />
        <StatCard label="Previsto hoje" value={formatCurrency(stats.expected_revenue)} tone="gold"
          icon={<DollarSign className="size-4" />} hint={`Realizado: ${formatCurrency(stats.realized_revenue)}`} />
        <StatCard label="Clientes" value={stats.clients_count} icon={<Users className="size-4" />} hint="cadastrados" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Novo agendamento', icon: CalendarPlus, onClick: () => setCreating(true) },
          { label: 'Cadastrar profissional', icon: UserPlus, to: '/admin/profissionais?novo=1' },
          { label: 'Cadastrar serviço', icon: Scissors, to: '/admin/servicos?novo=1' },
          { label: 'Ver calendário', icon: CalendarDays, to: '/admin/agenda' },
        ].map((a) => {
          const inner = (
            <>
              <span className="rounded-xl bg-gold-50 p-2.5 text-gold-600 transition group-hover:bg-gold-100"><a.icon className="size-5" /></span>
              <span className="text-sm font-medium text-zinc-800">{a.label}</span>
            </>
          );
          const cls = 'group card flex items-center gap-3 p-3.5 text-left transition hover:border-gold-300 hover:shadow-sm';
          return a.to
            ? <Link key={a.label} to={a.to} className={cls}>{inner}</Link>
            : <button key={a.label} onClick={a.onClick} className={cls}>{inner}</button>;
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="font-semibold">Próximos atendimentos</h2>
            <Link to="/admin/agenda" className="text-sm font-medium text-gold-600 hover:underline">Ver agenda</Link>
          </div>
          {stats.upcoming.length === 0 ? (
            <div className="p-5"><EmptyState title="Nenhum atendimento futuro" description="Os próximos agendamentos aparecerão aqui." /></div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {stats.upcoming.map((a) => {
                const isToday = toDateKey(a.starts_at) === todayKey();
                const link = buildWhatsappLink(a.client_whatsapp, buildAdminReminderMessage({
                  businessName: settings.name, clientName: a.client_name, service: a.service_name,
                  professional: a.professional_name, date: formatDate(a.starts_at), time: toTimeLabel(a.starts_at),
                  price: formatCurrency(a.price),
                }));
                return (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3.5">
                    <button onClick={() => setOpenId(a.id)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-base font-semibold text-zinc-900">{toTimeLabel(a.starts_at)}</p>
                        <p className="text-xs text-zinc-500">{isToday ? 'Hoje' : formatDate(a.starts_at).slice(0, 5)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-zinc-900">{a.client_name}</p>
                        <p className="truncate text-sm text-zinc-500">{a.service_name} · {a.professional_name}</p>
                      </div>
                      <span className="hidden sm:inline"><StatusBadge status={a.status} /></span>
                    </button>
                    {link && (
                      <a href={link} target="_blank" rel="noreferrer" aria-label="Abrir WhatsApp do cliente"
                        className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><MessageCircle className="size-5" /></a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="font-semibold">Serviços mais realizados</h2>
            <p className="text-xs text-zinc-500">Últimos 30 dias (confirmados e concluídos)</p>
          </div>
          <div className="space-y-4 p-5">
            {stats.top_services.length === 0 && <p className="text-sm text-zinc-500">Ainda não há dados suficientes.</p>}
            {stats.top_services.map((s) => (
              <div key={s.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium text-zinc-700">{s.name}</span>
                  <span className="text-zinc-500">{s.total}</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100">
                  <div className="h-2 rounded-full bg-gold-500" style={{ width: `${(Number(s.total) / maxTop) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <NewAppointmentModal open={creating} onClose={() => setCreating(false)} onCreated={reload} />
      <AppointmentDetailsModal appointmentId={openId} onClose={() => setOpenId(null)} onChanged={reload} />
    </>
  );
}
