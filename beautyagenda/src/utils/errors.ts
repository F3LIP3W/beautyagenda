/**
 * Converte erros do Supabase/PostgreSQL em mensagens claras em português.
 * As funções do banco já devolvem mensagens em português (message) e um
 * código lógico em "hint" (ex.: SLOT_UNAVAILABLE).
 */
export interface AppErrorLike {
  message?: string;
  code?: string;
  hint?: string | null;
  details?: string | null;
}

export function errorHint(err: unknown): string | undefined {
  return (err as AppErrorLike | null)?.hint ?? undefined;
}

export function getErrorMessage(err: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const e = err as AppErrorLike;
  const msg = e.message ?? '';

  if (e.code === 'P0001' && msg) return msg;              // mensagens das nossas funções
  switch (e.code) {
    case '23P01':
      return 'Conflito de horário: o profissional já tem um atendimento nesse período.';
    case '23503':
      return 'Este registro está vinculado a agendamentos e não pode ser excluído. Você pode desativá-lo.';
    case '23505':
      return 'Já existe um registro com esses dados.';
    case '23514':
      return 'Algum campo tem um valor inválido. Revise os dados.';
    case '42501':
      return 'Você não tem permissão para esta ação.';
    case 'PGRST116':
      return 'Registro não encontrado.';
  }
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado no Supabase.';
  if (/failed to fetch|network|load failed/i.test(msg)) return 'Sem conexão com o servidor. Verifique sua internet.';
  if (/JWT expired/i.test(msg)) return 'Sua sessão expirou. Entre novamente.';
  if (/payload too large|exceeded the maximum allowed size/i.test(msg)) return 'Arquivo muito grande (máximo 2 MB).';
  if (/mime type/i.test(msg)) return 'Formato de imagem não permitido. Use PNG, JPG ou WEBP.';
  return msg || fallback;
}
