import { useEffect, useState, type ReactNode } from 'react';
import {
  ChartColumn, CalendarDays, Clock, ExternalLink, LayoutDashboard, LogOut, Menu, Scissors, Settings, Users, UserRound, X,
} from 'lucide-react';
import { Link, useLocation } from '../lib/router.tsx';
import { Logo } from '../components/ui/Logo.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/admin/profissionais', label: 'Profissionais', icon: UserRound },
  { to: '/admin/servicos', label: 'Serviços', icon: Scissors },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/horarios', label: 'Horários e folgas', icon: Clock },
  { to: '/admin/relatorios', label: 'Relatórios', icon: ChartColumn },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = to === '/admin' ? pathname === '/admin' : pathname.startsWith(to);
        return (
          <Link key={to} to={to} onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors
              ${active ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
            <Icon className={`size-5 ${active ? 'text-gold-400' : ''}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  const { session, signOut } = useAuth();
  return (
    <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
      <a href="/agendar" target="_blank" rel="noreferrer"
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">
        <ExternalLink className="size-4" /> Página de agendamento
      </a>
      <button onClick={() => signOut()}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">
        <LogOut className="size-4" /> Sair
      </button>
      <p className="truncate px-3 pt-2 text-xs text-zinc-500">{session?.user.email}</p>
    </div>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  const current = NAV.find((n) => (n.to === '/admin' ? pathname === '/admin' : pathname.startsWith(n.to)));

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Menu lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink-950 px-4 py-6 lg:flex">
        <div className="mb-8 px-2"><Logo dark /></div>
        <NavList />
        <SidebarFooter />
      </aside>

      {/* Barra superior (celular) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ink-950 px-4 lg:hidden">
        <button onClick={() => setOpen(true)} className="-ml-2 rounded-lg p-2 text-white" aria-label="Abrir menu">
          <Menu className="size-6" />
        </button>
        <span className="text-sm font-medium text-white">{current?.label ?? 'Painel'}</span>
        <Logo dark compact />
      </header>

      {/* Menu deslizante (celular) */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col bg-ink-950 px-4 py-5">
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo dark />
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-zinc-400" aria-label="Fechar menu">
                <X className="size-5" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
            <SidebarFooter />
          </aside>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
