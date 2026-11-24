/** Logo textual BeautyAgenda */
export function Logo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <span className={`flex size-9 items-center justify-center rounded-xl ${dark ? 'bg-gold-500 text-ink-950' : 'bg-ink-950 text-gold-400'}`}>
        <svg viewBox="0 0 32 32" className="size-5" fill="none" aria-hidden>
          <path d="M9 6h7.5a5 5 0 0 1 0 10H9V6Z M9 16h8.5a5 5 0 0 1 0 10H9V16Z" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
          <circle cx="26" cy="6" r="2.2" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <span className={`font-display text-xl font-semibold tracking-tight ${dark ? 'text-white' : 'text-ink-950'}`}>
          Beauty<span className="text-gold-500">Agenda</span>
        </span>
      )}
    </span>
  );
}
