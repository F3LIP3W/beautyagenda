import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, children, className = '' }: FieldProps) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? (
        <span className="mt-1 block text-sm text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-zinc-500">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`input appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9 ${className}`}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input min-h-20 ${className}`} {...rest} />;
}

export function Toggle({ checked, onChange, label, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-sm text-zinc-700 disabled:opacity-50"
    >
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-gold-500' : 'bg-zinc-300'}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}

export function Checkbox({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition
      ${checked ? 'border-gold-400 bg-gold-50' : 'border-zinc-200 hover:border-zinc-300'}`}>
      <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-gold-500)]" checked={checked}
        onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-800">{label}</span>
        {description && <span className="block text-xs text-zinc-500">{description}</span>}
      </span>
    </label>
  );
}
