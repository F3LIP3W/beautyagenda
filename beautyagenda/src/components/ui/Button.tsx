import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';

type Variant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink-950 text-white hover:bg-ink-800 shadow-sm',
  gold: 'bg-gold-500 text-ink-950 hover:bg-gold-400 shadow-sm',
  secondary: 'bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-50 shadow-xs',
  ghost: 'text-zinc-700 hover:bg-zinc-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-xl',
  lg: 'h-13 px-6 text-base gap-2 rounded-xl font-semibold',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export function Button({
  variant = 'primary', size = 'md', loading, icon, block, className = '', children, disabled, type = 'button', ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex select-none items-center justify-center font-medium transition-colors
        disabled:cursor-not-allowed disabled:opacity-55 ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
