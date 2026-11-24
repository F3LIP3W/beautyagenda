import { supabase } from '../lib/supabase.ts';
import type { Professional, ProfessionalHour, ProfessionalWithDetails } from '../types/index.ts';
import { trimOrNull, unwrap, unwrapList } from './api.ts';

export async function listProfessionals(): Promise<ProfessionalWithDetails[]> {
  const [pros, links, hours] = await Promise.all([
    supabase.from('professionals').select('*').order('name'),
    supabase.from('professional_services').select('professional_id, service_id'),
    supabase.from('professional_working_hours').select('*').order('weekday'),
  ]);
  const list = unwrapList<Professional>(pros);
  const linkRows = unwrapList<{ professional_id: string; service_id: string }>(links);
  const hourRows = unwrapList<ProfessionalHour>(hours);
  return list.map((p) => ({
    ...p,
    service_ids: linkRows.filter((l) => l.professional_id === p.id).map((l) => l.service_id),
    hours: hourRows.filter((h) => h.professional_id === p.id),
  }));
}

export interface ProfessionalInput {
  name: string;
  phone: string | null;
  specialties: string | null;
  photo_url: string | null;
  active: boolean;
  service_ids: string[];
  hours: Omit<ProfessionalHour, 'professional_id'>[];
}

/** Cria ou atualiza o profissional, seus serviços e sua jornada semanal. */
export async function saveProfessional(id: string | null, input: ProfessionalInput): Promise<string> {
  const values = {
    name: input.name.trim(),
    phone: trimOrNull(input.phone),
    specialties: trimOrNull(input.specialties),
    photo_url: trimOrNull(input.photo_url),
    active: input.active,
  };
  const saved = id
    ? unwrap(await supabase.from('professionals').update(values).eq('id', id).select('id').single())
    : unwrap(await supabase.from('professionals').insert(values).select('id').single());
  const professionalId = (saved as { id: string }).id;

  // Serviços: remove os desmarcados e insere os novos
  const current = unwrapList<{ service_id: string }>(
    await supabase.from('professional_services').select('service_id').eq('professional_id', professionalId),
  ).map((r) => r.service_id);
  const toRemove = current.filter((s) => !input.service_ids.includes(s));
  const toAdd = input.service_ids.filter((s) => !current.includes(s));
  if (toRemove.length) {
    const { error } = await supabase.from('professional_services').delete()
      .eq('professional_id', professionalId).in('service_id', toRemove);
    if (error) throw error;
  }
  if (toAdd.length) {
    const { error } = await supabase.from('professional_services')
      .insert(toAdd.map((service_id) => ({ professional_id: professionalId, service_id })));
    if (error) throw error;
  }

  // Jornada: grava os 7 dias (dia sem trabalho = folga)
  const { error: hoursError } = await supabase.from('professional_working_hours').upsert(
    input.hours.map((h) => ({ ...h, professional_id: professionalId })),
    { onConflict: 'professional_id,weekday' },
  );
  if (hoursError) throw hoursError;

  return professionalId;
}

export async function setProfessionalActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('professionals').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function deleteProfessional(id: string): Promise<void> {
  const { error } = await supabase.from('professionals').delete().eq('id', id);
  if (error) throw error;
}
