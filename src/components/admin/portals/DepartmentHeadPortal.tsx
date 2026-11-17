import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { canAccessDepartment } from '../../../utils/adminPermissions';
import { computeApplicationStats, scopeApplicationsForActor } from '../../../utils/applicationFilters';
import { AdminShell } from '../AdminShell';
import { PortalAuthView } from '../PortalAuthView';
import { StatusBadge } from '../StatusBadge';
import { ApplicationsView } from '../views/ApplicationsView';
import { DepartmentsView } from '../views/DepartmentsView';
import { OperationsView } from '../views/OperationsView';
import { QrAttendanceView } from '../views/QrAttendanceView';
import { WorkspaceModulesView } from '../views/WorkspaceModulesView';

interface DepartmentHeadPortalProps {
  pathname: string;
  onNavigate: (path: string) => void;
}

export function DepartmentHeadPortal({ pathname, onNavigate }: DepartmentHeadPortalProps) {
  const { currentUser, testModeHeadUser, data, recordSecurityViolation } = useAdminStore();
  const [globalSearch, setGlobalSearch] = useState('');

  const subPath = pathname.replace(/^\/head\/?/, '');
  const segments = subPath ? subPath.split('/').filter(Boolean) : [];
  const section = segments[0] || 'overview';
  const paramId = segments[1] || null;

  const isTestingAsHead =
    currentUser !== null &&
    currentUser.role === 'super_admin' &&
    currentUser.isActive &&
    testModeHeadUser !== null;

  const isDirectHead =
    currentUser !== null &&
    currentUser.role === 'department_head' &&
    currentUser.isActive &&
    currentUser.status === 'active';

  const effectiveHead = isTestingAsHead
    ? testModeHeadUser
    : isDirectHead
      ? currentUser
      : null;

  const assignedDepartment =
    effectiveHead && effectiveHead.departmentId
      ? data.departments.find((d) => d.id === effectiveHead.departmentId) ?? null
      : null;

  // Record security violation if a Department Head attempts to access another department slug directly
  const attemptedOtherDept =
    effectiveHead !== null &&
    (section === 'departments' || section === 'department') &&
    paramId !== null &&
    !canAccessDepartment(effectiveHead, paramId);

  const loggedViolationKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (attemptedOtherDept && paramId && effectiveHead) {
      const key = `${effectiveHead.id}:${section}:${paramId}`;
      if (loggedViolationKeyRef.current === key) return;
      loggedViolationKeyRef.current = key;
      recordSecurityViolation(
        'department_route',
        paramId,
        `Blocked direct URL navigation to /head/${section}/${paramId}.`,
      );
    } else {
      loggedViolationKeyRef.current = null;
    }
  }, [attemptedOtherDept, effectiveHead, paramId, recordSecurityViolation, section]);

  if (!effectiveHead) {
    return <PortalAuthView portal="department_head" onNavigate={onNavigate} />;
  }

  if (!assignedDepartment) {
    return (
      <div className="wm-admin min-h-[100dvh] bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)] flex items-center justify-center p-6">
        <div className="max-w-md rounded-md border border-rose-400/35 bg-[color:var(--wm-surface)] p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-rose-200" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold">No Department Assigned</h1>
          <p className="mt-1.5 text-xs text-[color:var(--wm-ink-secondary)]">
            Your Department Head account does not have an active department assignment. Contact a
            Super Admin to retry or complete department linking.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/portal')}
            className="mt-4 min-h-[38px] rounded bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c] cursor-pointer"
          >
            Return to Portal Hub
          </button>
        </div>
      </div>
    );
  }

  const scopedApps = scopeApplicationsForActor(data.applications, effectiveHead);
  const stats = computeApplicationStats(scopedApps);
  const deptTasks = data.workspaceRecords.filter((w) => w.departmentId === assignedDepartment.id);
  const deptGroups = data.teamGroups.filter((g) => g.departmentId === assignedDepartment.id);
  const deptShifts = data.shifts.filter((s) => s.departmentId === assignedDepartment.id);

  const activeNavId =
    section === 'applications'
      ? 'applications'
      : section === 'workspace'
        ? 'workspace'
        : section === 'teams'
          ? 'teams'
          : section === 'shifts'
            ? 'shifts'
            : section === 'qr'
              ? 'qr'
              : section === 'department' || section === 'departments'
                ? 'department'
                : 'overview';

  const pageTitles: Record<string, string> = {
    overview: `${assignedDepartment.name} Overview`,
    applications: `${assignedDepartment.name} Applications & Stage 1 Review`,
    workspace: `${assignedDepartment.name} Operations Hub`,
    teams: `${assignedDepartment.name} Teams & Groups`,
    shifts: `${assignedDepartment.name} Shifts & Deployment`,
    qr: `${assignedDepartment.name} QR Credentials`,
    department: `${assignedDepartment.name} Configuration`,
  };

  return (
    <AdminShell
      portal="department_head"
      portalLabel="Department Head"
      pageTitle={pageTitles[activeNavId] ?? `${assignedDepartment.name} Portal`}
      pageSubtitle={`Isolated scope: ${assignedDepartment.name} (${assignedDepartment.cluster}). Stage 1 Recommendations only.`}
      activeNavId={activeNavId}
      onNavigate={onNavigate}
      globalSearch={activeNavId === 'applications' ? globalSearch : undefined}
      onGlobalSearchChange={activeNavId === 'applications' ? setGlobalSearch : undefined}
    >
      {attemptedOtherDept ? (
        <div
          role="alert"
          className="rounded-md border border-rose-400/35 bg-rose-500/[0.08] p-8 text-center"
        >
          <ShieldAlert className="mx-auto h-10 w-10 text-rose-200" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold text-rose-100">
            Cross-Department Access Blocked
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--wm-ink-secondary)]">
            Department Heads can only access their assigned department ({assignedDepartment.name}).
            Attempted navigation to <code className="text-[color:var(--wm-ink)]">{paramId}</code> has been
            blocked and recorded in the security log.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/head')}
            className="mt-5 inline-flex min-h-[38px] items-center gap-2 rounded bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Return to {assignedDepartment.name} Dashboard</span>
          </button>
        </div>
      ) : activeNavId === 'overview' ? (
        <div className="space-y-5">
          <section className="wm-surface-panel rounded-md flex flex-wrap items-center justify-between gap-4 p-4">
            <div><p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#d4af37]">Your department</p><h2 className="mt-1 text-lg font-semibold text-neutral-100">{assignedDepartment.name}</h2><p className="mt-1 text-xs text-neutral-500">Your department workspace and assigned responsibilities.</p></div>
            <button type="button" onClick={() => onNavigate('/head/applications')} className="inline-flex min-h-9 items-center gap-2 rounded bg-[#d4af37] px-4 text-xs font-semibold text-black hover:bg-[#f3e5ab]">Open applications <ArrowLeft className="h-3.5 w-3.5 rotate-180" /></button>
          </section>
          <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              {label:'Applications',value:stats.total,detail:'Assigned to your department'},
              {label:'Pending review',value:stats.pending,detail:'Awaiting final decision'},
              {label:'Recommended',value:stats.recommended,detail:'Your Stage 1 recommendations'},
              {label:'Accepted',value:stats.accepted,detail:'Final accepted applicants'},
            ].map((item) => <div key={item.label} className="wm-surface-panel rounded-md p-4"><p className="text-[10px] font-medium text-neutral-500">{item.label}</p><p className="mt-2 font-serif text-3xl text-neutral-100 tabular-nums">{item.value}</p><p className="mt-1 text-[10px] text-neutral-500">{item.detail}</p></div>)}
          </section>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(260px,.7fr)] gap-4">
            <section className="wm-surface-panel overflow-hidden rounded-md">
              <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] px-4 py-3"><div><h2 className="text-sm font-semibold text-neutral-100">Applicant queue</h2><p className="mt-0.5 text-[10px] text-neutral-500">The latest applications assigned to your department</p></div><button type="button" onClick={() => onNavigate('/head/applications')} className="text-[11px] text-[#d4af37] hover:text-[#f3e5ab]">View all <ArrowRight className="ml-1 inline h-3 w-3" /></button></div>
              {scopedApps.length === 0 ? <p className="px-4 py-8 text-center text-xs text-neutral-500">No applications are currently assigned to your department.</p> : <div className="divide-y divide-white/[0.055]">{scopedApps.slice(0,6).map((app) => <button key={app.id} type="button" onClick={() => onNavigate('/head/applications/'+app.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.025]"><span className="min-w-0"><span className="block truncate text-xs font-medium text-neutral-200">{app.applicantName}</span><span className="mt-1 block truncate text-[10px] text-neutral-500">{app.applicationCode} · {app.position}</span></span><span className="shrink-0"><StatusBadge status={app.status} /></span></button>)}</div>}
            </section>
            <section className="wm-surface-panel overflow-hidden rounded-md">
              <div className="border-b border-[color:var(--wm-hairline)] px-4 py-3"><h2 className="text-sm font-semibold text-neutral-100">Department tools</h2><p className="mt-0.5 text-[10px] text-neutral-500">Go straight to the work you need</p></div>
              <div className="divide-y divide-white/[0.055]">
                {[
                  {label:'Operations hub',detail:deptTasks.length+' open records',path:'/head/workspace'},
                  {label:'Teams & groups',detail:deptGroups.length+' groups',path:'/head/teams'},
                  {label:'Shifts & deployment',detail:deptShifts.length+' shifts',path:'/head/shifts'},
                  {label:'My QR pass',detail:'View your conference pass',path:'/head/qr'},
                ].map((item) => <button key={item.label} type="button" onClick={() => onNavigate(item.path)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.025]"><span><span className="block text-xs font-medium text-neutral-200">{item.label}</span><span className="mt-1 block text-[10px] text-neutral-500">{item.detail}</span></span><ArrowRight className="h-3.5 w-3.5 text-neutral-600" /></button>)}
              </div>
            </section>
          </div>
        </div>
      ) : activeNavId === 'applications' ? (
        <ApplicationsView
          lockedDepartmentId={assignedDepartment.id}
          externalSearch={globalSearch}
          selectedApplicationIdFromRoute={paramId}
          actingUserOverride={isTestingAsHead ? testModeHeadUser : null}
          onSelectApplicationId={(appId) =>
            onNavigate(appId ? `/head/applications/${appId}` : '/head/applications')
          }
        />
      ) : activeNavId === 'workspace' ? (
        <WorkspaceModulesView lockedDepartmentId={assignedDepartment.id} />
      ) : activeNavId === 'teams' ? (
        <OperationsView mode="teams" lockedDepartmentId={assignedDepartment.id} />
      ) : activeNavId === 'shifts' ? (
        <OperationsView mode="shifts" lockedDepartmentId={assignedDepartment.id} />
      ) : activeNavId === 'qr' ? (
        <QrAttendanceView
          mode="qr"
          actingUserOverride={isTestingAsHead ? testModeHeadUser : null}
        />
      ) : (
        <DepartmentsView
          lockedDepartmentId={assignedDepartment.id}
          actingUserOverride={isTestingAsHead ? testModeHeadUser : null}
          onInspectDepartmentApps={() => onNavigate('/head/applications')}
        />
      )}
    </AdminShell>
  );
}
