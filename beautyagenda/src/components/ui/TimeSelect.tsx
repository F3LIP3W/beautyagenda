import { minutesToTime } from '../../utils/datetime.ts';

interface TimeSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  step?: number;          // minutos entre opções
  allowEmpty?: boolean;   // opção "—" (ex.: intervalo opcional)
  className?: string;
  'aria-label'?: string;
}

/** Seletor de horário sempre em 24h (independe do idioma do navegador). */
export function TimeSelect({ value, onChange, step = 15, allowEmpty, className = '', ...rest }: TimeSelectProps) {
  const options: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) options.push(minutesToTime(m));
  const current = value ? value.slice(0, 5) : '';
  if (current && !options.includes(current)) options.push(current), options.sort();
  return (
    <select
      className={`input h-9 w-[5.5rem] py-1 pr-2 tabular-nums ${className}`}
      value={current}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label={rest['aria-label']}
    >
      {allowEmpty && <option value="">—</option>}
      {options.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}
