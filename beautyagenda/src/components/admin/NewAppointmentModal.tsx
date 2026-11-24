import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { Field, Input, Select, Textarea, Toggle } from '../ui/Field.tsx';
import { Spinner } from '../ui/Feedback.tsx';
import { SlotPicker } from './SlotPicker.tsx';
import { DateInput } from '../ui/DateInput.tsx';
import { TimeSelect } from '../ui/TimeSelect.tsx';
import { useAdminCatalog } from '../../hooks/useAdminCatalog.ts';
import { useDebounced } from '../../hooks/useAsync.ts';
import { useToast } from '../../contexts/ToastContext.tsx';
import { adminCreateAppointment } from '../../services/appointments.ts';
import { listClients } from '../../services/clients.ts';
import type { ClientOverview } from '../../types/index.ts';
import { todayKey, zonedToDate } from '../../utils/datetime.ts';
import { formatCurrency, formatDuration } from '../../utils/format.ts';
import { formatPhone, maskPhoneInput, normalizeWhatsapp } from '../../utils/phone.ts';
import { getErrorMessage } from '../../utils/errors.ts';

export interface NewAppointmentDefaults {
  date?: string;
  time?: string;
  professionalId?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaults?: NewAppointmentDefaults;
}

export function NewAppointmentModal({ open, onClose, onCreated, defaults }: Props) {
  const toast = useToast();
  const catalog = useAdminCatalog(open);
  const [serviceId, setServiceId] = useState('');
  const [professionalId, setProfessionalId] = useState<string>('');
  const [date, setDate] = useState(todayKey());
  const [slot, setSlot] = useState<string | null>(null);
  const [force, setForce] = useState(false);
  const [manualTime, setManualTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ClientOverview[]>([]);
  const searchTerm = useDebounced(name.length >= 2 ? name : phone.replace(/\D/g, '').length >= 4 ? phone : '', 300);

  useEffect(() => {
    if (!open) return;
    setServiceId('');
    setProfessionalId(defaults?.professionalId ?? '');
    setDate(defaults?.date ?? todayKey());
    setSlot(null);
    setForce(Boolean(defaults?.time));
    setManualTime(defaults?.time ?? '');
    setName('');
    setPhone('');
    setNotes('');
    setError(null);
  }, [open, defaults]);

  useEffect(() => {
    let alive = true;
    if (!open || !searchTerm) {
      setSuggestions([]);
      return;
    }
    listClients(searchTerm).then((c) => alive && setSuggestions(c.slice(0, 5))).catch(() => {});
    return () => {
      alive = false;
    };
  }, [searchTerm, open]);

  const services = useMemo(() => (catalog.data?.services ?? []).filter((s) => s.active), [catalog.data]);
  const service = services.find((s) => s.id === serviceId);
  const professionals = useMemo(
    () => (catalog.data?.professionals ?? []).filter((p) => p.active && (!serviceId || p.service_ids.includes(serviceId))),
    [catalog.data, serviceId],
  );

  useEffect(() => {
    if (professionalId && serviceId && !professionals.some((p) => p.id === professionalId)) setProfessionalId('');
  }, [professionals, professionalId, serviceId]);

  const pickClient = (c: ClientOverview) => {
    setName(c.name);
    setPhone(formatPhone(c.whatsapp));
    setSuggestions([]);
  };

  const submit = async () => {
    setError(null);
    if (!serviceId) return setError('Escolha o serviço.');
    if (force && !professionalId) return setError('Para encaixe em horário manual, escolha o profissional.');
    const startsAt = force ? (manualTime ? zonedToDate(date, manualTime).toISOString() : null) : slot;
    if (!startsAt) return setError(force ? 'Informe o horário.' : 'Escolha um horário livre.');
    if (name.trim().length < 2) return setError('Informe o nome do cliente.');
    if (!normalizeWhatsapp(phone)) return setError('WhatsApp inválido. Informe DDD + número.');
    setBusy(true);
    try {
      const res = await adminCreateAppointment({
        serviceId, startsAt, professionalId: professionalId || null, clientName: name,
        clientWhatsapp: phone, notes: notes.trim() || null, force,
      });
      toast.success(`Agendamento ${res.code} criado com ${res.professional_name}.`);
      onCreated();
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo agendamento" size="lg"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit} loading={busy}>Salvar agendamento</Button>
      </>}>
      {catalog.loading ? <Spinner /> : catalog.error ? <p className="text-red-600">{catalog.error}</p> : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Serviço">
              <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                <option value="">Selecione...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.category} · {s.name} ({formatDuration(s.duration_minutes)} · {formatCurrency(s.price)})</option>
                ))}
              </Select>
            </Field>
            <Field label="Profissional">
              <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
                <option value="">Qualquer profissional disponível</option>
                {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Data">
              <DateInput value={date} onChange={setDate} aria-label="Data" className="w-full" />
            </Field>
            <div className="flex items-end pb-2">
              <Toggle checked={force} onChange={setForce} label="Encaixe (horário manual)" />
            </div>
          </div>

          <div>
            <span className="label">Horário</span>
            {force ? (
              <div className="space-y-1.5">
                <TimeSelect value={manualTime || null} step={5} allowEmpty onChange={(v) => setManualTime(v ?? '')} aria-label="Horário do encaixe" />
                <p className="text-xs text-zinc-500">
                  Encaixe ignora expediente e bloqueios, mas o banco nunca permite sobrepor outro atendimento do profissional.
                </p>
              </div>
            ) : (
              <SlotPicker serviceId={serviceId} date={date} professionalId={professionalId || null}
                value={slot} onChange={(s) => setSlot(s?.slot_start ?? null)} />
            )}
          </div>

          <div className="relative grid gap-4 sm:grid-cols-2">
            <Field label="Nome do cliente">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" autoComplete="off" />
            </Field>
            <Field label="WhatsApp" hint="Com DDD. O DDI 55 é adicionado automaticamente.">
              <Input value={phone} onChange={(e) => setPhone(maskPhoneInput(e.target.value))} inputMode="tel" placeholder="(11) 98888-7777" />
            </Field>
            {suggestions.length > 0 && (
              <div className="sm:col-span-2 -mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-1.5">
                <p className="px-2 py-1 text-xs text-zinc-500">Clientes encontrados</p>
                {suggestions.map((c) => (
                  <button key={c.id} type="button" onClick={() => pickClient(c)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-white">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-zinc-500">{formatPhone(c.whatsapp)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Field label="Observações (opcional)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} />
          </Field>

          {service && (
            <p className="rounded-xl bg-gold-50 px-3.5 py-2.5 text-sm text-gold-700">
              {service.name}: {formatDuration(service.duration_minutes)} · {formatCurrency(service.price)}
            </p>
          )}
          {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
