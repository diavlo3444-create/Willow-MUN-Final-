import { ExecutivePortal } from './ExecutivePortal';

interface AdminPortalProps {
  pathname: string;
  onNavigate: (path: string) => void;
}

export function AdminPortal({ pathname, onNavigate }: AdminPortalProps) {
  return <ExecutivePortal portal="admin" pathname={pathname} onNavigate={onNavigate} />;
}
