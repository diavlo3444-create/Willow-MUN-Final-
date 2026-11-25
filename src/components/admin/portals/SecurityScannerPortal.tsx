import {
  ArrowLeft,
  LogOut,
  QrCode,
  ShieldAlert,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import {
  canAccessPortal,
  getPortalHomeRouteForUser,
  hasPermission,
  isSecurityAccount,
} from '../../../utils/adminPermissions';
import { MyQrCard, MyQrModal } from '../MyQrModal';
import { PortalAuthView } from '../PortalAuthView';
import { DepartmentQrSectionView } from '../views/DepartmentQrSectionView';

interface SecurityScannerPortalProps {
  pathname: string;
  onNavigate: (path: string) => void;
}

export function SecurityScannerPortal({
  pathname,
  onNavigate,
}: SecurityScannerPortalProps) {
  const { currentUser, data, signOut, openMyQrModal } = useAdminStore();

  const authorized =
    currentUser !== null && canAccessPortal(currentUser, 'security', data.departments);
  const canViewHeadApps =
    currentUser !== null &&
    (currentUser.role === 'department_head' || currentUser.role === 'executive_board') &&
    hasPermission(currentUser, 'applications.view', data.departments);

  const subPath = pathname.replace(/^\/security\/?/, '');
  const isPersonalQrRoute = subPath.startsWith('qr');

  if (!currentUser) {
    return <PortalAuthView portal="security" onNavigate={onNavigate} />;
  }

  if (!authorized || !isSecurityAccount(currentUser, data.departments)) {
    return (
      <div className="wm-admin min-h-[100dvh] flex items-center justify-center bg-[color:var(--wm-canvas)] p-6 text-[color:var(--wm-ink)]">
        <div className="wm-surface-panel max-w-md border-rose-400/35 p-6 text-center">
          <ShieldAlert className="mx-auto h-9 w-9 text-rose-300" aria-hidden="true" />
          <h1 className="wm-serif mt-3 text-xl font-semibold text-rose-100">
            Security Scanner Access Restricted
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
            This terminal is restricted to authorized Willow MUN Security accounts.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate(getPortalHomeRouteForUser(currentUser, data.departments))}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Open My Portal
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] px-3.5 text-xs text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wm-admin min-h-[100dvh] bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)]">
              <img src="/assets/logo-transparent.png" alt="" className="h-full w-full object-contain p-1" />
            </span>
            <div>
              <p className="wm-display text-[12.5px] tracking-[0.12em] text-[color:var(--wm-ink)]">
                WILLOW MUN <span className="text-[color:var(--wm-accent)]">SECURITY</span>
              </p>
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)]">
                {currentUser.fullName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentUser.role === 'super_admin' && (
              <button
                type="button"
                onClick={() => onNavigate('/super-admin')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-[11px] text-[color:var(--wm-focal)] hover:bg-[color:var(--wm-overlay)]"
              >
                <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                Super Admin
              </button>
            )}
            {canViewHeadApps && (
              <button
                type="button"
                onClick={() => onNavigate('/head/applications')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-[11px] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]"
              >
                <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                Head Portal
              </button>
            )}
            <button
              type="button"
              onClick={openMyQrModal}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[#2d6a4f]/28 px-3 text-[11px] font-medium text-[color:var(--wm-focal)] hover:bg-[#2d6a4f]/45"
            >
              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
              My QR
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline)] px-3 text-[11px] text-[color:var(--wm-ink-secondary)] hover:border-rose-400/40 hover:text-rose-200"
            >
              <LogOut className="h-3 w-3" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
        {isPersonalQrRoute ? (
          <div className="mx-auto max-w-xl space-y-4">
            <button
              type="button"
              onClick={() => onNavigate('/security')}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3.5 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to QR Scanner
            </button>
            <MyQrCard actorOverride={currentUser} />
          </div>
        ) : (
          <DepartmentQrSectionView section="security" actor={currentUser} autoStartCamera />
        )}
      </main>

      <MyQrModal />
    </div>
  );
}
