import type { ReactNode } from 'react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = 'zinc', hint }: {
  label: string; value: ReactNode; icon: ReactNode; tone?: 'zinc' | 'gold' | 'green' | 'amber' | 'red'; hint?: string;
}) {
  const tones = {
    zinc: 'bg-zinc-100 text-zinc-600',
    gold: 'bg-gold-100 text-gold-700',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-500">{label}</p>
        <span className={`rounded-lg p-2 ${tones[tone]}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[28px]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
