import { useEffect, useState, type ReactNode } from 'react';
import {
  CalendarClock, CircleCheck, Clock, MessageCircle, RotateCcw, Scissors, UserRound, UserX, CircleX,
} from 'lucide-react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { Field, Select, Toggle } from '../ui/Field.tsx';
import { Spinner, StatusBadge } from '../ui/Feedback.tsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx';
import { SlotPicker } from './SlotPicker.tsx';
import { DateInput } from '../ui/DateInput.tsx';
import { TimeSelect } from '../ui/TimeSelect.tsx';
import { useToast } from '../../contexts/ToastContext.tsx';
import { getAppointment, rescheduleAppointment, setAppointmentStatus } from '../../services/appointments.ts';
import { listProfessionals } from '../../services/professionals.ts';
import { getSettings } from '../../services/settings.ts';
import type { AppointmentDetail, AppointmentStatus, ProfessionalWithDetails } from '../../types/index.ts';
import { toDateKey, toTimeLabel, zonedToDate } from '../../utils/datetime.ts';
import { formatCurrency, formatDate, formatDateTime, formatDayLong, formatDuration } from '../../utils/format.ts';
import { formatPhone } from '../../utils/phone.ts';
import { buildAdminReminderMessage, buildWhatsappLink } from '../../utils/whatsapp.ts';
import { getErrorMessage } from '../../utils/errors.ts';

interface Props {
  appointmentId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

export function AppointmentDetailsModal({ appointmentId, onClose, onChanged }: Props) {
  const toast = useToast();
  const [appt, setAppt] = useState<AppointmentDetail | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<AppointmentStatus | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [mode, setMode] = useState<'view' | 'reschedule'>('view');

  useEffect(() => {
    setAppt(null);
    setError(null);
    setMode('view');
    if (!appointmentId) return;
    Promise.all([getAppointment(appointmentId), getSettings()])
      .then(([a, s]) => {
        setAppt(a);
        setBusinessName(s.name);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [appointmentId]);

  const changeStatus = async (status: AppointmentStatus) => {
    if (!appt) return;
    setBusy(status);
    try {
      await setAppointmentStatus(appt.id, status);
      setAppt({ ...appt, status });
      toast.success(
        status === 'cancelled' ? 'Agendamento cancelado. O horário foi liberado.'
          : status === 'completed' ? 'Atendimento concluído.'
          : status === 'no_show' ? 'Marcado como não compareceu.'
          : 'Agendamento confirmado.',
      );
      onChanged();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const waLink = appt && buildWhatsappLink(appt.client_whatsapp, buildAdminReminderMessage({
    businessName, clientName: appt.client_name, service: appt.service_name, professional: appt.professional_name,
    date: formatDate(appt.starts_at), time: toTimeLabel(appt.starts_at), price: formatCurrency(appt.price),
  }));
  const active = appt && (appt.status === 'pending' || appt.status === 'confirmed');

  return (
    <>
      <Modal open={Boolean(appointmentId)} onClose={onClose} size="lg"
        title={mode === 'reschedule' ? 'Reagendar' : 'Detalhes do agendamento'}
        subtitle={appt ? `Código ${appt.code}` : undefined}>
        {error ? <p className="text-red-600">{error}</p> : !appt ? <Spinner /> : mode === 'reschedule' ? (
          <RescheduleForm appt={appt} onCancel={() => setMode('view')} onDone={async () => {
            const fresh = await getAppointment(appt.id);
            setAppt(fresh);
            setMode('view');
            onChanged();
          }} />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusBadge status={appt.status} />
              <span className="text-xs text-zinc-500">
                {appt.source === 'online' ? 'Agendado online' : 'Criado no painel'} em {formatDateTime(appt.created_at)}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Info icon={<CalendarClock className="size-4" />} label="Data e horário"
                value={`${formatDayLong(toDateKey(appt.starts_at))}`} sub={`${toTimeLabel(appt.starts_at)} – ${toTimeLabel(appt.ends_at)}`} />
              <Info icon={<Scissors className="size-4" />} label="Serviço" value={appt.service_name}
                sub={`${formatDuration(appt.duration_minutes)} · ${formatCurrency(appt.price)}`} />
              <Info icon={<UserRound className="size-4" />} label="Profissional" value={appt.professional_name} />
              <Info icon={<MessageCircle className="size-4" />} label="Cliente" value={appt.client_name} sub={formatPhone(appt.client_whatsapp)} />
            </div>

            {appt.notes && <p className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700"><b>Observações:</b> {appt.notes}</p>}

            {waLink && (
              <a href={waLink} target="_blank" rel="noreferrer"
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[15px] font-medium text-white hover:bg-emerald-700">
                <MessageCircle className="size-5" /> Conversar com o cliente no WhatsApp
              </a>
            )}

            <div className="border-t border-zinc-100 pt-5">
              <p className="mb-3 text-sm font-medium text-zinc-700">Ações</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {appt.status === 'pending' && (
                  <Button variant="success" icon={<CircleCheck className="size-4" />} loading={busy === 'confirmed'}
                    onClick={() => changeStatus('confirmed')}>Confirmar</Button>
                )}
                {active && (
                  <>
                    <Button variant="primary" icon={<CircleCheck className="size-4" />} loading={busy === 'completed'}
                      onClick={() => changeStatus('completed')}>Concluído</Button>
                    <Button variant="secondary" icon={<UserX className="size-4" />} loading={busy === 'no_show'}
                      onClick={() => changeStatus('no_show')}>Não compareceu</Button>
                    <Button variant="secondary" icon={<Clock className="size-4" />} onClick={() => setMode('reschedule')}>Reagendar</Button>
                    <Button variant="danger" icon={<CircleX className="size-4" />} onClick={() => setConfirmCancel(true)}>Cancelar</Button>
                  </>
                )}
                {!active && (
                  <Button variant="secondary" icon={<RotateCcw className="size-4" />} loading={busy === 'confirmed'}
                    onClick={() => changeStatus('confirmed')}>Voltar para confirmado</Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={confirmCancel} onClose={() => setConfirmCancel(false)} danger confirmLabel="Cancelar agendamento"
        title="Cancelar agendamento?"
        message="O horário será liberado para novas reservas. O histórico do agendamento é mantido."
        onConfirm={() => changeStatus('cancelled')} />
    </>
  );
}

function Info({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-zinc-500 uppercase">{icon}{label}</p>
      <p className="mt-1 font-medium text-zinc-900">{value}</p>
      {sub && <p className="text-sm text-zinc-500">{sub}</p>}
    </div>
  );
}

function RescheduleForm({ appt, onCancel, onDone }: { appt: AppointmentDetail; onCancel: () => void; onDone: () => Promise<void> }) {
  const toast = useToast();
  const [pros, setPros] = useState<ProfessionalWithDetails[]>([]);
  const [professionalId, setProfessionalId] = useState(appt.professional_id);
  const [date, setDate] = useState(toDateKey(appt.starts_at));
  const [slot, setSlot] = useState<string | null>(null);
  const [force, setForce] = useState(false);
  const [time, setTime] = useState(toTimeLabel(appt.starts_at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProfessionals().then((list) => setPros(list.filter((p) => p.active && p.service_ids.includes(appt.service_id))))
      .catch((e) => setError(getErrorMessage(e)));
  }, [appt.service_id]);

  const submit = async () => {
    setError(null);
    const startsAt = force ? zonedToDate(date, time).toISOString() : slot;
    if (!startsAt) return setError('Escolha o novo horário.');
    setBusy(true);
    try {
      await rescheduleAppointment({ id: appt.id, startsAt, professionalId, force });
      toast.success('Agendamento reagendado.');
      await onDone();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        Atual: <b>{formatDayLong(toDateKey(appt.starts_at))}</b> às <b>{toTimeLabel(appt.starts_at)}</b> com {appt.professional_name}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Profissional">
          <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            {!pros.some((p) => p.id === appt.professional_id) && <option value={appt.professional_id}>{appt.professional_name}</option>}
          </Select>
        </Field>
        <Field label="Nova data"><DateInput value={date} onChange={setDate} aria-label="Nova data" className="w-full" /></Field>
      </div>
      <Toggle checked={force} onChange={setForce} label="Encaixe (horário manual)" />
      {force ? (
        <div><span className="label">Novo horário</span><TimeSelect value={time} step={5} onChange={(v) => setTime(v ?? time)} aria-label="Novo horário" /></div>
      ) : (
        <div>
          <span className="label">Horários livres</span>
          <SlotPicker serviceId={appt.service_id} date={date} professionalId={professionalId}
            excludeAppointmentId={appt.id} value={slot} onChange={(s) => setSlot(s?.slot_start ?? null)} />
        </div>
      )}
      {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Voltar</Button>
        <Button onClick={submit} loading={busy}>Salvar novo horário</Button>
      </div>
    </div>
  );
}
