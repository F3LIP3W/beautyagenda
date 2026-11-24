import { supabase } from '../lib/supabase.ts';
import type { BusinessSettings, WorkingHour } from '../types/index.ts';
import { unwrap, unwrapList } from './api.ts';

export async function getSettings(): Promise<BusinessSettings> {
  return unwrap(await supabase.from('business_settings').select('*').eq('id', 1).single()) as BusinessSettings;
}

export async function updateSettings(values: Partial<Omit<BusinessSettings, 'id'>>): Promise<BusinessSettings> {
  return unwrap(
    await supabase.from('business_settings').update(values).eq('id', 1).select('*').single(),
  ) as BusinessSettings;
}

export async function getWorkingHours(): Promise<WorkingHour[]> {
  return unwrapList<WorkingHour>(await supabase.from('working_hours').select('*').order('weekday'));
}

export async function saveWorkingHours(rows: WorkingHour[]): Promise<void> {
  const { error } = await supabase.from('working_hours').upsert(rows, { onConflict: 'weekday' });
  if (error) throw error;
}
