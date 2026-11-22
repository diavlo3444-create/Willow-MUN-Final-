import { useCallback, useEffect, useState } from 'react';

const NAV_EVENT = 'willowmun:navigate';

export function normalizePathname(path: string | null | undefined): string {
  const raw = (path || '/').trim();
  if (!raw || raw === '/') return '/';
  const withoutTrailing = raw.replace(/\/+$/, '');
  const withLeading = withoutTrailing.startsWith('/') ? withoutTrailing : `/${withoutTrailing}`;
  return withLeading || '/';
}

export function getCurrentPathname(): string {
  if (typeof window === 'undefined') return '/';
  return normalizePathname(window.location.pathname || '/');
}

export function navigateTo(path: string): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizePathname(path);
  if (getCurrentPathname() !== normalized) {
    window.history.pushState({}, '', normalized);
    window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: normalized }));
  }
  window.scrollTo({ top: 0, behavior: 'auto' });
}

export function usePathname(): [string, (path: string) => void] {
  const [pathname, setPathname] = useState<string>(() => getCurrentPathname());

  useEffect(() => {
    const sync = () => setPathname(getCurrentPathname());
    window.addEventListener('popstate', sync);
    window.addEventListener(NAV_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(NAV_EVENT, sync);
    };
  }, []);

  const navigate = useCallback((nextPath: string) => {
    navigateTo(nextPath);
  }, []);

  return [pathname, navigate];
}

export function getLegalRouteKind(pathname: string): 'privacy' | 'terms' | null {
  const clean = normalizePathname(pathname);
  if (clean === '/privacy') return 'privacy';
  if (clean === '/terms') return 'terms';
  return null;
}

export function isAdminRoute(pathname: string): boolean {
  const clean = normalizePathname(pathname);
  return (
    clean === '/portal' ||
    clean.startsWith('/portal/') ||
    clean === '/super-admin' ||
    clean.startsWith('/super-admin/') ||
    clean === '/admin' ||
    clean.startsWith('/admin/') ||
    clean === '/head' ||
    clean.startsWith('/head/') ||
    clean === '/security' ||
    clean.startsWith('/security/') ||
    clean === '/staff' ||
    clean.startsWith('/staff/') ||
    clean === '/eb' || clean.startsWith('/eb/') ||
    clean === '/admin-login' || clean === '/eb-login' || clean === '/head-login' || clean === '/super-admin-login' || clean === '/security-login' || clean === '/staff-login' || clean === '/eb-signup' || clean === '/team-signup' || clean === '/head-setup'
  );
}
