/** Helpers comuns da camada de dados: lança erro do Supabase em vez de ignorá-lo. */
export function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data as T;
}

export function unwrapList<T>(result: { data: T[] | null; error: unknown }): T[] {
  if (result.error) throw result.error;
  return result.data ?? [];
}

export const trimOrNull = (v: string | null | undefined) => {
  const t = (v ?? '').trim();
  return t ? t : null;
};
