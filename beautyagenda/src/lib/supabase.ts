import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** false quando o .env (ou as variáveis na Vercel) não foram preenchidos */
export const isSupabaseConfigured = Boolean(url && anonKey);

// Apenas a chave pública "anon" vai para o navegador. A segurança dos dados
// é garantida pelo RLS e pelas funções do banco — nunca use a service_role aqui.
export const supabase = createClient(url || 'http://localhost', anonKey || 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export const STORAGE_BUCKET = 'public-assets';
