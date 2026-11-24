import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.ts';
import { fetchIsAdmin, signIn as apiSignIn, signOut as apiSignOut } from '../services/auth.ts';

interface AuthState {
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function apply(s: Session | null) {
      if (!alive) return;
      setSession(s);
      if (!s) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      try {
        const admin = await fetchIsAdmin(s.user.id);
        if (alive) setIsAdmin(admin);
      } catch {
        if (alive) setIsAdmin(false);
      } finally {
        if (alive) setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'INITIAL_SESSION') return;
      // Evita chamar o banco dentro do callback (recomendação do supabase-js)
      setTimeout(() => apply(s), 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const s = await apiSignIn(email, password);
    if (!s) throw new Error('Não foi possível entrar.');
    const admin = await fetchIsAdmin(s.user.id);
    if (!admin) {
      await apiSignOut();
      throw new Error('Este usuário não tem permissão de administrador.');
    }
    setSession(s);
    setIsAdmin(true);
  };

  const signOut = async () => {
    await apiSignOut();
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ session, isAdmin, loading, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
