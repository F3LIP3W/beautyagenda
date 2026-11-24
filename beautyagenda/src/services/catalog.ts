/** Serviços oferecidos pelo estabelecimento (corte, barba, manicure...) */
import { supabase } from '../lib/supabase.ts';
import type { Service, ServiceWithProfessionals } from '../types/index.ts';
import { trimOrNull, unwrap, unwrapList } from './api.ts';

export async function listServices(): Promise<ServiceWithProfessionals[]> {
  const [services, links] = await Promise.all([
    supabase.from('services').select('*').order('category').order('sort_order').order('name'),
    supabase.from('professional_services').select('professional_id, service_id'),
  ]);
  const linkRows = unwrapList<{ professional_id: string; service_id: string }>(links);
  return unwrapList<Service>(services).map((s) => ({
    ...s,
    price: Number(s.price),
    professional_ids: linkRows.filter((l) => l.service_id === s.id).map((l) => l.professional_id),
  }));
}

export interface ServiceInput {
  name: string;
  category: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  active: boolean;
  sort_order: number;
  professional_ids: string[];
}

export async function saveService(id: string | null, input: ServiceInput): Promise<string> {
  const values = {
    name: input.name.trim(),
    category: input.category.trim(),
    description: trimOrNull(input.description),
    price: input.price,
    duration_minutes: input.duration_minutes,
    active: input.active,
    sort_order: input.sort_order,
  };
  const saved = id
    ? unwrap(await supabase.from('services').update(values).eq('id', id).select('id').single())
    : unwrap(await supabase.from('services').insert(values).select('id').single());
  const serviceId = (saved as { id: string }).id;

  const current = unwrapList<{ professional_id: string }>(
    await supabase.from('professional_services').select('professional_id').eq('service_id', serviceId),
  ).map((r) => r.professional_id);
  const toRemove = current.filter((p) => !input.professional_ids.includes(p));
  const toAdd = input.professional_ids.filter((p) => !current.includes(p));
  if (toRemove.length) {
    const { error } = await supabase.from('professional_services').delete()
      .eq('service_id', serviceId).in('professional_id', toRemove);
    if (error) throw error;
  }
  if (toAdd.length) {
    const { error } = await supabase.from('professional_services')
      .insert(toAdd.map((professional_id) => ({ professional_id, service_id: serviceId })));
    if (error) throw error;
  }
  return serviceId;
}

export async function setServiceActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('services').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) throw error;
}
