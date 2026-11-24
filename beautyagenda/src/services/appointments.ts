import { supabase } from '../lib/supabase.ts';
import type { AppointmentDetail, AppointmentStatus, BookingResult } from '../types/index.ts';
import { unwrap, unwrapList } from './api.ts';

/** Agendamentos que começam entre from (inclusive) e to (exclusive), instantes ISO. */
export async function listAppointments(fromIso: string, toIso: string, professionalId?: string | null) {
  let query = supabase.from('appointment_details').select('*')
    .gte('starts_at', fromIso).lt('starts_at', toIso).order('starts_at');
  if (professionalId) query = query.eq('professional_id', professionalId);
  return unwrapList<AppointmentDetail>(await query).map((a) => ({ ...a, price: Number(a.price) }));
}

export async function getAppointment(id: string): Promise<AppointmentDetail> {
  return unwrap(await supabase.from('appointment_details').select('*').eq('id', id).single()) as AppointmentDetail;
}

export async function listClientAppointments(clientId: string) {
  return unwrapList<AppointmentDetail>(
    await supabase.from('appointment_details').select('*').eq('client_id', clientId)
      .order('starts_at', { ascending: false }).limit(200),
  );
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
  const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function updateAppointmentNotes(id: string, notes: string | null): Promise<void> {
  const { error } = await supabase.from('appointments').update({ notes }).eq('id', id);
  if (error) throw error;
}

export async function rescheduleAppointment(input: {
  id: string; startsAt: string; professionalId: string | null; force: boolean;
}) {
  return unwrap(
    await supabase.rpc('admin_reschedule_appointment', {
      p_appointment_id: input.id,
      p_starts_at: input.startsAt,
      p_professional_id: input.professionalId,
      p_force: input.force,
    }),
  );
}

export async function adminCreateAppointment(input: {
  serviceId: string;
  startsAt: string;
  professionalId: string | null;
  clientName: string;
  clientWhatsapp: string;
  notes: string | null;
  force: boolean;
}): Promise<BookingResult> {
  return unwrap(
    await supabase.rpc('admin_create_appointment', {
      p_service_id: input.serviceId,
      p_starts_at: input.startsAt,
      p_client_name: input.clientName,
      p_client_whatsapp: input.clientWhatsapp,
      p_professional_id: input.professionalId,
      p_notes: input.notes,
      p_force: input.force,
    }),
  ) as BookingResult;
}
