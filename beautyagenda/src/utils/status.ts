import type { AppointmentStatus } from '../types/index.ts';

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};

/** Classes Tailwind de cada status (fundo/texto/borda) */
export const STATUS_STYLE: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  completed: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
  no_show: 'bg-orange-50 text-orange-800 ring-orange-200',
};

export const ACTIVE_STATUSES: AppointmentStatus[] = ['pending', 'confirmed'];
