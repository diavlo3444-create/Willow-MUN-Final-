import { useEffect, useRef } from 'react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import {
  getActorGenderScope,
  isDccActor,
  isHrActor,
} from '../../../utils/adminPermissions';
import { AdminShell } from '../AdminShell';
import { MyQrCard } from '../MyQrModal';
import { PortalAuthView } from '../PortalAuthView';
import { CommitteesManagementView } from '../views/CommitteesManagementView';
import { HeadApplicationsView } from '../views/HeadApplicationsView';
import { HrAcceptedApplicantsView } from '../views/HrAcceptedApplicantsView';

interface DepartmentHeadPortalProps {
  pathname: string;
  onNavigate: (path: string) => void;
}

export function DepartmentHeadPortal({ pathname, onNavigate }: DepartmentHeadPortalProps) {
  const {
    currentUser,
    testModeHeadUser,
    data,
    recordSecurityViolation,
  } = useAdminStore();

  const subPath = pathname.replace(/^\/head\/?/, '');
  const segments = subPath ? subPath.split('/').filter(Boolean) : [];
  const section = segments[0] || 'applications';
  const paramId = segments[1] || null;

  const isDirectHead =
    currentUser !== null &&
    currentUser.role === 'department_head' &&
    currentUser.isActive &&
    currentUser.status === 'active';

  const effectiveHead = testModeHeadUser ?? (isDirectHead ? currentUser : null);

  const assignedDepartment =
    effectiveHead && effectiveHead.departmentId
      ? data.departments.find((d) => d.id === effectiveHead.departmentId) ?? null
      : null;

  const isHrHead = isHrActor(effectiveHead);
  const isDccHead = isDccActor(effectiveHead);

  const isAllowedSection =
    section === 'applications' ||
    section === 'qr' ||
    (section === 'hr-accepted' && isHrHead) ||
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
        `Blocked unauthorized Department Head navigation to ${pathname}.`,
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
            Your Department Head account does not have an active department assignment. Contact a Super Admin to complete department linking.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/head-login')}
            className="mt-4 min-h-[38px] rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] cursor-pointer"
          >
            Return to Sign In
          </button>
        </div>
      </div>
    );
  }

  const actorGender = getActorGenderScope(effectiveHead);
  const activeNavId =
    section === 'hr-accepted' && isHrHead
      ? 'hr-accepted'
      : section === 'committees' && isDccHead
        ? 'committees'
        : section === 'qr'
          ? 'qr'
          : 'applications';

  const pageTitles: Record<string, string> = {
    applications: `${assignedDepartment.name} Applications`,
    'hr-accepted': 'HR · Accepted Applicants',
    committees: 'DCC · Committee Management',
    qr: 'My QR Credential',
  };

  return (
    <AdminShell
      portal="department_head"
      portalLabel="Department Head"
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
              : `Department Head accounts are strictly scoped to reviewing and accepting or declining applications for ${assignedDepartment.name} (${actorGender ?? 'assigned'} division). Management and configuration tools are unavailable.`}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/head/applications')}
            className="mt-5 inline-flex min-h-[38px] items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Return to {assignedDepartment.name} Applications</span>
          </button>
        </div>
      ) : activeNavId === 'hr-accepted' ? (
        <HrAcceptedApplicantsView actingUserOverride={effectiveHead} />
      ) : activeNavId === 'committees' ? (
        <CommitteesManagementView actingUserOverride={effectiveHead} />
      ) : activeNavId === 'qr' ? (
        <div className="space-y-4">
          <div className="wm-surface-panel p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">
              Willow MUN · Identity Pass
            </p>
            <h1 className="wm-serif mt-1.5 text-2xl font-semibold text-[color:var(--wm-ink)]">
              My Personal QR Code
            </h1>
            <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
              This unique, permanent QR code is permanently linked to your Department Head account for conference check-in.
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
