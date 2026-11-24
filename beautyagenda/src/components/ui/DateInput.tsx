import { CalendarDays } from 'lucide-react';
import { formatDateKey } from '../../utils/format.ts';

interface DateInputProps {
  value: string;                  // 'YYYY-MM-DD'
  onChange: (value: string) => void;
  min?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Campo de data que SEMPRE exibe DD/MM/AAAA (o campo nativo segue o idioma do
 * sistema). O seletor nativo continua por baixo, transparente, para abrir o
 * calendário do celular/computador ao tocar.
 */
export function DateInput({ value, onChange, min, className = '', ...rest }: DateInputProps) {
  return (
    <span className={`relative inline-flex h-11 min-w-36 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3.5
      text-[15px] text-zinc-900 shadow-xs focus-within:border-gold-500 focus-within:ring-2 focus-within:ring-gold-500/20 ${className}`}>
      <CalendarDays className="size-4 text-zinc-400" aria-hidden />
      <span className="tabular-nums">{value ? formatDateKey(value) : 'DD/MM/AAAA'}</span>
      <input
        type="date"
        value={value}
        min={min}
        aria-label={rest['aria-label'] ?? 'Data'}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        onClick={(e) => {
          try {
            (e.currentTarget as HTMLInputElement).showPicker?.();
          } catch {
            /* navegadores antigos: o toque já abre o seletor */
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  );
}
