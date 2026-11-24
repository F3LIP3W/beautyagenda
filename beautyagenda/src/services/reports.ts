import { supabase } from '../lib/supabase.ts';
import type { DashboardStats, ReportData } from '../types/index.ts';
import { unwrap } from './api.ts';

export async function getDashboardStats(date?: string): Promise<DashboardStats> {
  return unwrap(await supabase.rpc('dashboard_stats', { p_date: date ?? null })) as DashboardStats;
}

export async function getReport(from: string, to: string, group: 'day' | 'week' | 'month'): Promise<ReportData> {
  return unwrap(await supabase.rpc('report_data', { p_from: from, p_to: to, p_group: group })) as ReportData;
}
