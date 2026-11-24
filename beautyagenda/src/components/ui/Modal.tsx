import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZES = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

/** Modal que vira "folha" de baixo para cima no celular. */
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl ${SIZES[size]}`}>
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="-mr-2 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="safe-bottom flex flex-wrap justify-end gap-2 border-t border-zinc-100 px-5 pt-4 sm:px-6 sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
