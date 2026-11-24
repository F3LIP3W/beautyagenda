import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CircleCheck, Info, X, CircleX } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: ToastKind; message: string }

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++seq;
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    setTimeout(() => remove(id), kind === 'error' ? 6000 : 3500);
  }, [remove]);

  const api = useMemo<ToastApi>(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }), [push]);

  const icons = {
    success: <CircleCheck className="size-5 shrink-0 text-emerald-500" />,
    error: <CircleX className="size-5 shrink-0 text-red-500" />,
    info: <Info className="size-5 shrink-0 text-gold-500" />,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-ink-950 px-4 py-3 text-sm text-white shadow-xl">
            {icons[t.kind]}
            <p className="flex-1 leading-snug">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-zinc-400 hover:text-white" aria-label="Fechar aviso">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast fora do ToastProvider');
  return ctx;
}
