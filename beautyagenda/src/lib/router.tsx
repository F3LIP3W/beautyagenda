/**
 * Roteador mínimo (History API). Evita uma dependência extra para as poucas
 * rotas do sistema. A Vercel reescreve todas as URLs para index.html.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore,
  type AnchorHTMLAttributes, type MouseEvent, type ReactNode,
} from 'react';

const NAV_EVENT = 'beautyagenda:navigate';

function subscribe(cb: () => void) {
  window.addEventListener('popstate', cb);
  window.addEventListener(NAV_EVENT, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener(NAV_EVENT, cb);
  };
}

const getPath = () => window.location.pathname + window.location.search;

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (to === getPath()) return;
  if (opts.replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(NAV_EVENT));
  window.scrollTo({ top: 0 });
}

interface RouterState {
  pathname: string;
  search: URLSearchParams;
}

const RouterContext = createContext<RouterState>({ pathname: '/', search: new URLSearchParams() });

export function RouterProvider({ children }: { children: ReactNode }) {
  const full = useSyncExternalStore(subscribe, getPath, () => '/');
  const value = useMemo<RouterState>(() => {
    const [pathname, query = ''] = full.split('?');
    return { pathname: pathname.replace(/\/+$/, '') || '/', search: new URLSearchParams(query) };
  }, [full]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useLocation() {
  return useContext(RouterContext);
}

export function useNavigate() {
  return useCallback((to: string, opts?: { replace?: boolean }) => navigate(to, opts), []);
}

export function Navigate({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

export function Link({ to, onClick, children, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || rest.target) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} onClick={handle} {...rest}>
      {children}
    </a>
  );
}
