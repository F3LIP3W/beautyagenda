/** Bloqueios de horário e exceções de expediente */
import { supabase } from '../lib/supabase.ts';
import type { ScheduleException, TimeBlock } from '../types/index.ts';
import { trimOrNull, unwrapList } from './api.ts';

export async function listTimeBlocks(fromIso: string, toIso?: string): Promise<TimeBlock[]> {
  let query = supabase.from('time_blocks').select('*').gte('ends_at', fromIso).order('starts_at');
  if (toIso) query = query.lt('starts_at', toIso);
  return unwrapList<TimeBlock>(await query);
}

export async function createTimeBlock(values: {
  professional_id: string | null; starts_at: string; ends_at: string; reason: string | null;
}) {
  const { error } = await supabase.from('time_blocks').insert({ ...values, reason: trimOrNull(values.reason) });
  if (error) throw error;
}

export async function deleteTimeBlock(id: string) {
  const { error } = await supabase.from('time_blocks').delete().eq('id', id);
  if (error) throw error;
}

export async function listExceptions(fromDate: string): Promise<ScheduleException[]> {
  return unwrapList<ScheduleException>(
    await supabase.from('schedule_exceptions').select('*').gte('exception_date', fromDate).order('exception_date'),
  );
}

export async function createException(values: Omit<ScheduleException, 'id'>) {
  const { error } = await supabase.from('schedule_exceptions').insert({ ...values, reason: trimOrNull(values.reason) });
  if (error) throw error;
}

export async function deleteException(id: string) {
  const { error } = await supabase.from('schedule_exceptions').delete().eq('id', id);
  if (error) throw error;
}
