import { useEffect, useRef } from 'react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import {
  getActorGenderScope,
  getRoleLabel,
  hasPermission,
  isDccActor,
  isHrActor,
  normalizeDepartmentSlug,
} from '../../../utils/adminPermissions';
import { AdminShell } from '../AdminShell';
import { MyQrCard } from '../MyQrModal';
import { PortalAuthView } from '../PortalAuthView';
import { CommitteesManagementView } from '../views/CommitteesManagementView';
import { HeadApplicationsView } from '../views/HeadApplicationsView';
import { HrAcceptedApplicantsView } from '../views/HrAcceptedApplicantsView';
import { EmailsDashboardView } from '../views/EmailsDashboardView';
import { QrAttendanceView } from '../views/QrAttendanceView';

interface DepartmentHeadPortalProps {
  pathname: string;
  onNavigate: (path: string) => void;
}

export function DepartmentHeadPortal({ pathname, onNavigate }: DepartmentHeadPortalProps) {
  const {
    currentUser,
    testModeHeadUser,
    exitDepartmentTestMode,
    data,
    recordSecurityViolation,
  } = useAdminStore();

  const subPath = pathname.replace(/^\/head\/?/, '');
  const segments = subPath ? subPath.split('/').filter(Boolean) : [];
  const hasExplicitSection = segments.length > 0;
  const requestedSection = segments[0] || '';
  const paramId = segments[1] || null;

  const isDirectHeadOrEb =
    currentUser !== null &&
    (currentUser.role === 'department_head' || currentUser.role === 'executive_board') &&
    currentUser.isActive &&
    currentUser.status === 'active';

  const effectiveHead = testModeHeadUser ?? (isDirectHeadOrEb ? currentUser : null);

  const assignedDepartment =
    effectiveHead && (effectiveHead.departmentId || effectiveHead.departmentSlug)
      ? data.departments.find(
          (d) =>
            d.id === effectiveHead.departmentId ||
            d.slug === effectiveHead.departmentId ||
            (effectiveHead.departmentSlug &&
              normalizeDepartmentSlug(d.slug) === normalizeDepartmentSlug(effectiveHead.departmentSlug)),
        ) ?? null
      : null;

  const canViewApps = hasPermission(effectiveHead, 'applications.view', data.departments);
  const canScanQr = hasPermission(effectiveHead, 'qr.scan', data.departments);
  const isHrHead = isHrActor(effectiveHead, data.departments);
  const canManageEmails = isHrHead && hasPermission(effectiveHead, 'email.view', data.departments);
  const isDccHead = isDccActor(effectiveHead, data.departments);
  const canViewQr = hasPermission(effectiveHead, 'qr.view_pass', data.departments);

  const defaultSection = canViewApps
    ? 'applications'
    : canScanQr
      ? 'scanner'
      : isHrHead
        ? 'hr-accepted'
        : isDccHead
          ? 'committees'
          : 'qr';

  const section = hasExplicitSection ? requestedSection : defaultSection;

  const isAllowedSection =
    (section === 'applications' && canViewApps) ||
    (section === 'scanner' && canScanQr) ||
    (section === 'qr' && canViewQr) ||
    (section === 'hr-accepted' && isHrHead) ||
    (section === 'emails' && canManageEmails) ||
    (section === 'committees' && isDccHead);

  const isQrOtherUserAttempt =
    effectiveHead !== null &&
    section === 'qr' &&
    paramId !== null &&
    paramId !== effectiveHead.id;

  const isUnauthorizedRoute =
    effectiveHead !== null && (!isAllowedSection || isQrOtherUserAttempt);

  const loggedViolationKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (isUnauthorizedRoute && effectiveHead) {
      const key = `${effectiveHead.id}:${pathname}`;
      if (loggedViolationKeyRef.current === key) return;
      loggedViolationKeyRef.current = key;
      recordSecurityViolation(
        isQrOtherUserAttempt ? 'qr_route' : 'department_route',
        paramId || section,
        `Blocked unauthorized ${effectiveHead.role === 'executive_board' ? 'Executive Board' : 'Department Head'} navigation to ${pathname}.`,
      );
    } else {
      loggedViolationKeyRef.current = null;
    }
  }, [isUnauthorizedRoute, isQrOtherUserAttempt, effectiveHead, paramId, pathname, recordSecurityViolation, section]);

  if (!effectiveHead) {
    return <PortalAuthView portal="department_head" onNavigate={onNavigate} />;
  }

  if (!assignedDepartment) {
    return (
      <div className="wm-admin min-h-[100dvh] flex items-center justify-center bg-[color:var(--wm-canvas)] p-6 text-[color:var(--wm-ink)]">
        <div className="wm-surface-panel max-w-md border-rose-400/35 p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-rose-300" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold">No Department Assigned</h1>
          <p className="mt-1.5 text-xs text-[color:var(--wm-ink-secondary)]">
            This {getRoleLabel(effectiveHead.role)} account does not have an active department assignment. Contact Super IT / Super Admin to link a department.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {testModeHeadUser ? (
              <button
                type="button"
                onClick={() => {
                  exitDepartmentTestMode();
                  onNavigate('/super-admin/account-management');
                }}
                className="min-h-[38px] rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] cursor-pointer"
              >
                Exit Test Session
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('/head-login')}
                className="min-h-[38px] rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] cursor-pointer"
              >
                Return to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const actorGender = getActorGenderScope(effectiveHead);
  const roleDisplay =
    effectiveHead.role === 'executive_board' ? 'Executive Board · Head' : 'Department Head';

  const activeNavId =
    section === 'scanner' && canScanQr
      ? 'scanner'
      : section === 'emails' && canManageEmails
        ? 'emails'
        : section === 'hr-accepted' && isHrHead
        ? 'hr-accepted'
        : section === 'committees' && isDccHead
          ? 'committees'
          : section === 'qr' && canViewQr
            ? 'qr'
            : defaultSection;

  const pageTitles: Record<string, string> = {
    applications: `${assignedDepartment.name} Applications`,
    scanner: 'Entrance QR Pass Scanner',
    'hr-accepted': 'HR · Accepted Applicants',
    emails: 'Email Management & Delivery',
    committees: 'DCC · Committee Management',
    qr: 'My QR Credential',
  };

  const fallbackHomePath =
    defaultSection === 'applications'
      ? '/head/applications'
      : `/head/${defaultSection}`;

  return (
    <AdminShell
      portal="department_head"
      portalLabel={roleDisplay}
      pageTitle={pageTitles[activeNavId] ?? `${assignedDepartment.name} Applications`}
      pageSubtitle={`Isolated scope: ${assignedDepartment.name}${actorGender ? ` (${actorGender} division)` : ''}.`}
      activeNavId={activeNavId}
      onNavigate={onNavigate}
    >
      {isUnauthorizedRoute ? (
        <div
          role="alert"
          className="wm-surface-panel border-rose-400/35 bg-rose-500/[0.06] p-8 text-center"
        >
          <ShieldAlert className="mx-auto h-10 w-10 text-rose-300" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold text-rose-100">
            {isQrOtherUserAttempt ? 'Personal QR Access Restricted' : 'Section Restricted'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
            {isQrOtherUserAttempt
              ? 'You may only view your own personal QR credential. Inspecting or modifying another account QR via URL is blocked.'
              : `Your ${getRoleLabel(effectiveHead.role)} account is strictly scoped to ${assignedDepartment.name}${actorGender ? ` (${actorGender} division)` : ''}. Unassigned management tools and cross-department sections are unavailable.`}
          </p>
          <button
            type="button"
            onClick={() => onNavigate(fallbackHomePath)}
            className="mt-5 inline-flex min-h-[38px] items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Return to Assigned Workspace</span>
          </button>
        </div>
      ) : activeNavId === 'scanner' ? (
        <div className="space-y-4">
          <div className="wm-surface-panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">
                Security Entrance Operations
              </p>
              <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                Validate delegate and staff QR passes below or open the dedicated full-screen Security terminal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/security')}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
            >
              Open Full-Screen Security Scanner
            </button>
          </div>
          <QrAttendanceView mode="qr" actingUserOverride={effectiveHead} />
        </div>
      ) : activeNavId === 'emails' ? (
        <EmailsDashboardView />
      ) : activeNavId === 'hr-accepted' ? (
        <HrAcceptedApplicantsView actingUserOverride={effectiveHead} />
      ) : activeNavId === 'committees' ? (
        <CommitteesManagementView actingUserOverride={effectiveHead} />
      ) : activeNavId === 'qr' ? (
        <div className="space-y-4">
          <div className="wm-surface-panel p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">
              Willow MUN · Identity Pass · {assignedDepartment.name}
            </p>
            <h1 className="wm-serif mt-1.5 text-2xl font-semibold text-[color:var(--wm-ink)]">
              My Personal QR Code
            </h1>
            <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
              Permanent access credential bound to {effectiveHead.fullName} ({effectiveHead.title || getRoleLabel(effectiveHead.role)}
              {actorGender ? ` · ${actorGender} division` : ''}).
            </p>
          </div>
          <MyQrCard actorOverride={effectiveHead} />
        </div>
      ) : (
        <HeadApplicationsView
          effectiveHead={effectiveHead}
          selectedApplicationId={paramId}
          onSelectApplication={(appId) =>
            onNavigate(appId ? `/head/applications/${appId}` : '/head/applications')
          }
        />
      )}
    </AdminShell>
  );
}
