import { ExecutivePortal } from './ExecutivePortal';

interface SuperAdminPortalProps {
  pathname: string;
  onNavigate: (path: string) => void;
}

export function SuperAdminPortal({ pathname, onNavigate }: SuperAdminPortalProps) {
  return <ExecutivePortal portal="super_admin" pathname={pathname} onNavigate={onNavigate} />;
}
