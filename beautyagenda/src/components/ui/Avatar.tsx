import { initials } from '../../utils/format.ts';

export function Avatar({ name, src, size = 40, color }: { name: string; src?: string | null; size?: number; color?: string }) {
  if (src) {
    return <img src={src} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover ring-2 ring-white" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: color ?? '#2e2e33' }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Cores fixas por profissional (calendário e avatares) */
export const PRO_COLORS = ['#b8913a', '#0f766e', '#7c3aed', '#be185d', '#1d4ed8', '#c2410c', '#4d7c0f', '#0e7490'];

export function proColor(index: number) {
  return PRO_COLORS[((index % PRO_COLORS.length) + PRO_COLORS.length) % PRO_COLORS.length];
}
