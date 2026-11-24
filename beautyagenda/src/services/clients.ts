import { supabase } from '../lib/supabase.ts';
import type { ClientOverview } from '../types/index.ts';
import { trimOrNull, unwrapList } from './api.ts';

export const CLIENTS_PAGE_SIZE = 30;

/** Lista clientes com estatísticas; busca por nome ou telefone. */
export async function listClients(search: string, page = 0): Promise<ClientOverview[]> {
  let query = supabase.from('client_overview').select('*').order('name')
    .range(page * CLIENTS_PAGE_SIZE, page * CLIENTS_PAGE_SIZE + CLIENTS_PAGE_SIZE - 1);
  const term = search.trim().replace(/[%,()]/g, ' ').trim();
  if (term) {
    const digits = term.replace(/\D/g, '');
    query = digits.length >= 3
      ? query.or(`name.ilike.%${term}%,whatsapp.ilike.%${digits}%`)
      : query.ilike('name', `%${term}%`);
  }
  return unwrapList<ClientOverview>(await query).map((c) => ({
    ...c,
    total_appointments: Number(c.total_appointments),
    completed_appointments: Number(c.completed_appointments),
    total_spent: Number(c.total_spent),
  }));
}

export async function updateClient(id: string, values: { name: string; notes: string | null }) {
  const { error } = await supabase.from('clients')
    .update({ name: values.name.trim(), notes: trimOrNull(values.notes) }).eq('id', id);
  if (error) throw error;
}
