import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Navigate, useLocation } from './lib/router.tsx';
import { isSupabaseConfigured } from './lib/supabase.ts';
import { useAuth } from './contexts/AuthContext.tsx';
import { Spinner } from './components/ui/Feedback.tsx';
import { BookingPage } from './pages/public/BookingPage.tsx';
import { NotFoundPage, SetupRequiredPage } from './pages/public/SystemPages.tsx';

// O painel é carregado sob demanda: a página pública fica mais leve e rápida
const AdminLayout = lazy(() => import('./layouts/AdminLayout.tsx').then((m) => ({ default: m.AdminLayout })));
const LoginPage = lazy(() => import('./pages/admin/LoginPage.tsx'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage.tsx'));
const CalendarPage = lazy(() => import('./pages/admin/CalendarPage.tsx'));
const ProfessionalsPage = lazy(() => import('./pages/admin/ProfessionalsPage.tsx'));
const ServicesPage = lazy(() => import('./pages/admin/ServicesPage.tsx'));
const ClientsPage = lazy(() => import('./pages/admin/ClientsPage.tsx'));
const SchedulePage = lazy(() => import('./pages/admin/SchedulePage.tsx'));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage.tsx'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage.tsx'));

const ADMIN_PAGES: Record<string, ComponentType> = {
  '/admin': DashboardPage,
  '/admin/agenda': CalendarPage,
  '/admin/profissionais': ProfessionalsPage,
  '/admin/servicos': ServicesPage,
  '/admin/clientes': ClientsPage,
  '/admin/horarios': SchedulePage,
  '/admin/relatorios': ReportsPage,
  '/admin/configuracoes': SettingsPage,
};

/** Bloqueia o painel para quem não é administrador autenticado. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <Spinner className="min-h-dvh" label="Verificando acesso..." />;
  if (!session || !isAdmin) return <Navigate to={`/admin/login?next=${encodeURIComponent(pathname)}`} />;
  return <>{children}</>;
}

export default function App() {
  const { pathname } = useLocation();

  if (!isSupabaseConfigured) return <SetupRequiredPage />;

  if (pathname === '/') return <Navigate to="/agendar" />;
  if (pathname === '/agendar') return <BookingPage />;

  if (pathname === '/admin/login') {
    return (
      <Suspense fallback={<Spinner className="min-h-dvh" />}>
        <LoginPage />
      </Suspense>
    );
  }

  const AdminPage = ADMIN_PAGES[pathname];
  if (AdminPage) {
    return (
      <RequireAdmin>
        <Suspense fallback={<Spinner className="min-h-dvh" />}>
          <AdminLayout>
            <Suspense fallback={<Spinner />}>
              <AdminPage />
            </Suspense>
          </AdminLayout>
        </Suspense>
      </RequireAdmin>
    );
  }

  return <NotFoundPage />;
}
