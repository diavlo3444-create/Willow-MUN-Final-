import { useCallback, useEffect, useState } from 'react';

const NAV_EVENT = 'willowmun:navigate';

export function getCurrentPathname(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

export function navigateTo(path: string): void {
  if (typeof window === 'undefined') return;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (window.location.pathname !== normalized) {
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

export function isAdminRoute(pathname: string): boolean {
  return (
    pathname === '/portal' ||
    pathname.startsWith('/portal/') ||
    pathname === '/super-admin' ||
    pathname.startsWith('/super-admin/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/head' ||
    pathname.startsWith('/head/') ||
    pathname === '/eb' || pathname.startsWith('/eb/') ||
    pathname === '/admin-login' || pathname === '/eb-login' || pathname === '/head-login' || pathname === '/super-admin-login' || pathname === '/eb-signup'
  );
}
