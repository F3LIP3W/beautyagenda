import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../utils/errors.ts';

/** Carrega dados assíncronos com estados de carregamento/erro e recarga manual. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reqId = useRef(0);

  const run = useCallback(fn, deps);

  const reload = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await run();
      if (id === reqId.current) setData(result);
    } catch (e) {
      if (id === reqId.current) setError(getErrorMessage(e));
      console.error(e);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

export function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
