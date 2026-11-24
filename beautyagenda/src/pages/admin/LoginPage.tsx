import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { navigate, useLocation } from '../../lib/router.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Logo } from '../../components/ui/Logo.tsx';
import { getErrorMessage } from '../../utils/errors.ts';

export default function LoginPage() {
  const { signIn, session, isAdmin, loading } = useAuth();
  const { search } = useLocation();
  const next = search.get('next')?.startsWith('/admin') ? search.get('next')! : '/admin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session && isAdmin) navigate(next, { replace: true });
  }, [loading, session, isAdmin, next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo dark />
        <div className="relative z-10 max-w-md">
          <p className="font-display text-4xl font-semibold leading-tight text-white">
            Sua agenda organizada, <span className="text-gold-400">seus clientes bem atendidos.</span>
          </p>
          <p className="mt-4 text-zinc-400">Agendamentos, profissionais, serviços e relatórios em um só lugar.</p>
        </div>
        <p className="text-sm text-zinc-500">Acesso restrito ao administrador.</p>
        <div className="absolute -right-32 -bottom-32 size-96 rounded-full border border-gold-500/20" />
        <div className="absolute -right-12 -bottom-12 size-64 rounded-full border border-gold-500/30" />
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-sm" noValidate>
          <div className="mb-10 lg:hidden"><Logo /></div>
          <h1 className="text-2xl font-semibold tracking-tight">Entrar no painel</h1>
          <p className="mt-1 text-sm text-zinc-500">Use o e-mail e a senha do administrador.</p>

          <div className="mt-8 space-y-4">
            <label className="block">
              <span className="label">E-mail</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
                <input className="input pl-10" type="email" autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="admin@seusalao.com.br" />
              </div>
            </label>
            <label className="block">
              <span className="label">Senha</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
                <input className="input px-10" type={show ? 'text' : 'password'} autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>
          </div>

          {error && <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">{error}</p>}

          <Button type="submit" block size="lg" loading={busy} className="mt-6">Entrar</Button>
          <p className="mt-6 text-center text-sm text-zinc-500">
            É cliente? <a href="/agendar" className="font-medium text-gold-600 hover:underline">Agende seu horário</a>
          </p>
        </form>
      </div>
    </div>
  );
}
