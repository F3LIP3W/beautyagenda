import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { getAvailableSlots } from '../../services/booking.ts';
import type { AvailableSlot } from '../../types/index.ts';
import { getErrorMessage } from '../../utils/errors.ts';

interface SlotPickerProps {
  serviceId: string;
  date: string;
  professionalId: string | null;
  excludeAppointmentId?: string | null;
  value: string | null; // ISO
  onChange: (slot: AvailableSlot | null) => void;
}

/** Grade de horários livres, calculada pelo banco. */
export function SlotPicker({ serviceId, date, professionalId, excludeAppointmentId, value, onChange }: SlotPickerProps) {
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSlots(null);
    setError(null);
    onChange(null);
    if (!serviceId || !date) return;
    getAvailableSlots(serviceId, date, professionalId, excludeAppointmentId)
      .then((s) => alive && setSlots(s))
      .catch((e) => alive && setError(getErrorMessage(e)));
    return () => {
      alive = false;
    };
  }, [serviceId, date, professionalId, excludeAppointmentId]);

  if (!serviceId || !date) return <p className="text-sm text-zinc-500">Escolha serviço e data.</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!slots) return <p className="flex items-center gap-2 text-sm text-zinc-500"><LoaderCircle className="size-4 animate-spin" /> Buscando horários...</p>;
  if (slots.length === 0) return <p className="rounded-xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600">Nenhum horário livre nesta data.</p>;

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {slots.map((s) => {
        const active = value === s.slot_start;
        return (
          <button key={s.slot_start} type="button" onClick={() => onChange(s)}
            className={`h-10 rounded-lg border text-sm font-medium transition
              ${active ? 'border-ink-950 bg-ink-950 text-white' : 'border-zinc-200 bg-white text-zinc-800 hover:border-gold-400'}`}>
            {s.slot_label}
          </button>
        );
      })}
    </div>
  );
}
