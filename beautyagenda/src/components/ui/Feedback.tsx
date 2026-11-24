import type { ReactNode } from 'react';
import { CircleAlert, Inbox, LoaderCircle, RefreshCw } from 'lucide-react';
import type { AppointmentStatus } from '../../types/index.ts';
import { STATUS_LABEL, STATUS_STYLE } from '../../utils/status.ts';
import { Button } from './Button.tsx';

export function Spinner({ label = 'Carregando...', className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-12 text-sm text-zinc-500 ${className}`} role="status">
      <LoaderCircle className="size-5 animate-spin text-gold-500" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
      <CircleAlert className="size-8 text-red-500" />
      <p className="max-w-md text-sm text-red-800">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={<RefreshCw className="size-4" />} onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: {
  title: string; description?: string; action?: ReactNode; icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center">
      <div className="mb-1 rounded-full bg-zinc-100 p-3 text-zinc-400">{icon ?? <Inbox className="size-6" />}</div>
      <p className="font-medium text-zinc-800">{title}</p>
      {description && <p className="max-w-sm text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Badge({ children, tone = 'zinc' }: { children: ReactNode; tone?: 'zinc' | 'gold' | 'green' | 'red' }) {
  const tones = {
    zinc: 'bg-zinc-100 text-zinc-700',
    gold: 'bg-gold-100 text-gold-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
