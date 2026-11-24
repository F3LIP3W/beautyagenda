import { Link } from '../../lib/router.tsx';
import { Logo } from '../../components/ui/Logo.tsx';

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo />
      <h1 className="mt-6 text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-zinc-500">O endereço acessado não existe.</p>
      <Link to="/agendar" className="rounded-xl bg-ink-950 px-5 py-3 font-medium text-white">Ir para o agendamento</Link>
    </div>
  );
}

/** Mostrada quando as variáveis do Supabase não foram configuradas. */
export function SetupRequiredPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50 px-6">
      <div className="card max-w-lg p-8">
        <Logo />
        <h1 className="mt-6 text-xl font-semibold">Configuração pendente</h1>
        <p className="mt-2 text-zinc-600">
          As variáveis <code className="rounded bg-zinc-100 px-1">VITE_SUPABASE_URL</code> e{' '}
          <code className="rounded bg-zinc-100 px-1">VITE_SUPABASE_ANON_KEY</code> não foram definidas.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-zinc-600">
          <li>No computador: copie <b>.env.example</b> para <b>.env</b>, preencha e reinicie o <code>npm run dev</code>.</li>
          <li>Na Vercel: Project → Settings → Environment Variables, adicione as duas e faça um novo deploy.</li>
        </ul>
      </div>
    </div>
  );
}
