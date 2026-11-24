import { supabase } from '../lib/supabase.ts';

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Confere no banco se o usuário logado é administrador (tabela profiles). */
export async function fetchIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('id, role').eq('id', userId).maybeSingle();
  if (error) throw error;
  return (data as { role?: string } | null)?.role === 'admin';
}

export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
