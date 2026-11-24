/** API pública da página de agendamento (funções RPC do banco). */
import { supabase } from '../lib/supabase.ts';
import type { AvailableSlot, BookingCatalog, BookingResult } from '../types/index.ts';
import { unwrap, unwrapList } from './api.ts';

export async function getBookingCatalog(): Promise<BookingCatalog> {
  return unwrap(await supabase.rpc('get_booking_catalog')) as BookingCatalog;
}

export async function getAvailableDates(
  serviceId: string, from: string, to: string, professionalId: string | null,
): Promise<string[]> {
  const rows = unwrapList<string | { get_available_dates?: string; available_date?: string }>(
    await supabase.rpc('get_available_dates', {
      p_service_id: serviceId, p_from: from, p_to: to, p_professional_id: professionalId,
    }),
  );
  // setof date → lista de 'YYYY-MM-DD' (aceita também o formato de objeto)
  return rows.map((r) => (typeof r === 'string' ? r : r.available_date ?? r.get_available_dates ?? '')).filter(Boolean);
}

export async function getAvailableSlots(
  serviceId: string, date: string, professionalId: string | null, excludeAppointmentId?: string | null,
): Promise<AvailableSlot[]> {
  return unwrapList<AvailableSlot>(
    await supabase.rpc('get_available_slots', {
      p_service_id: serviceId,
      p_date: date,
      p_professional_id: professionalId,
      p_exclude_appointment: excludeAppointmentId ?? null,
    }),
  );
}

export async function bookAppointment(input: {
  serviceId: string;
  startsAt: string;
  professionalId: string | null;
  clientName: string;
  clientWhatsapp: string;
}): Promise<BookingResult> {
  return unwrap(
    await supabase.rpc('book_appointment', {
      p_service_id: input.serviceId,
      p_starts_at: input.startsAt,
      p_client_name: input.clientName,
      p_client_whatsapp: input.clientWhatsapp,
      p_professional_id: input.professionalId,
      p_notes: null,
    }),
  ) as BookingResult;
}
