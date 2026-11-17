import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ShieldAlert, Users, Clock3, CheckCircle2, XCircle, Inbox, Lock, Unlock } from 'lucide-react';
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

  const statusSegments = [
    { label: 'Accepted', count: stats.accepted, color: '#34d399' },
    { label: 'Pending', count: stats.pending, color: '#9ca3af' },
    { label: 'Rejected', count: scopedApps.filter((app) => app.status === 'rejected').length, color: '#fb7185' },
    { label: 'Waitlisted', count: scopedApps.filter((app) => app.status === 'waitlisted').length, color: '#fbbf24' },
  ];
  const donut = (() => {
    if (!stats.total) return 'conic-gradient(#242428 0deg 360deg)';
    let cursor = 0;
    const stops: string[] = [];
    statusSegments.forEach((item) => {
      if (!item.count) return;
      const start = cursor / stats.total * 360;
      cursor += item.count;
      const end = cursor / stats.total * 360;
      stops.push(item.color + ' ' + start.toFixed(2) + 'deg ' + end.toFixed(2) + 'deg');
    });
    return 'conic-gradient(' + stops.join(', ') + ')';
  })();
  const recentApps = [...scopedApps].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 6);
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
      topActions={<a href="/head/qr" className="rounded-md border border-[#d4af37]/35 px-3 py-2 text-xs font-medium text-[#bfa04a] hover:bg-[#d4af37]/10">My QR Pass</a>}
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
          <section className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#d4af37]">Department command</p>
              <h1 className="wm-serif mt-2 text-3xl text-[#f4f0e4]">{assignedDepartment.name}</h1>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-neutral-400">Welcome back, {effectiveHead.fullName}. This workspace shows applications and operations within your assigned department.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={'inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[9px] font-medium uppercase tracking-[0.08em] ' + (assignedDepartment.registrationOpen ? 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300' : 'border-white/[0.08] bg-white/[0.03] text-neutral-400')}>
                  {assignedDepartment.registrationOpen ? <Unlock className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                  Registration {assignedDepartment.registrationOpen ? 'open' : 'closed'}
                </span>
                <span className="text-[10px] text-neutral-500">Department-wide access</span>
              </div>
            </div>
            <button type="button" onClick={() => onNavigate('/head/applications')} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-[#d4af37] px-4 text-xs font-semibold text-black hover:bg-[#e6ca75]">
              Review applications <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {label:'Applications',value:stats.total,helper:'Assigned to your department',icon:Users},
              {label:'Awaiting review',value:stats.pending,helper:stats.pending ? 'Needs your attention' : 'Nothing waiting on you',icon:Clock3},
              {label:'Accepted',value:stats.accepted,helper:(stats.total ? Math.round(stats.accepted / stats.total * 100) : 0) + '% of applications',icon:CheckCircle2},
              {label:'Rejected',value:scopedApps.filter((app) => app.status === 'rejected').length,helper:'Final declined applications',icon:XCircle},
            ].map((item) => {
              const Icon=item.icon;
              return <div key={item.label} className="rounded-md border border-white/[0.07] bg-[#0c0c0f] p-4">
                <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-medium text-neutral-400">{item.label}</span><Icon className="h-4 w-4 text-[#d4af37]" /></div>
                <p className="mt-3 font-serif text-3xl tabular-nums text-neutral-100">{item.value}</p>
                <p className="mt-1 text-[10px] text-neutral-500">{item.helper}</p>
              </div>;
            })}
          </section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <section className="overflow-hidden rounded-md border border-white/[0.07] bg-[#0c0c0f] xl:col-span-5">
              <div className="border-b border-white/[0.06] px-4 py-3">
                <h2 className="text-xs font-semibold text-neutral-100">Application pipeline</h2>
                <p className="mt-1 text-[10px] text-neutral-500">Status distribution within your department</p>
              </div>
              <div className="p-5">
                {stats.total === 0 ? <div className="py-8 text-center"><Inbox className="mx-auto h-7 w-7 text-neutral-600" /><p className="mt-3 text-xs text-neutral-400">No applications in your scope yet.</p></div> : (
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                    <div className="relative mx-auto h-[124px] w-[124px] shrink-0 rounded-full" style={{background:donut}}>
                      <div className="absolute inset-[9px] flex flex-col items-center justify-center rounded-full border border-white/[0.05] bg-[#0c0c0f]">
                        <span className="text-2xl font-semibold leading-none tabular-nums text-white">{stats.total}</span>
                        <span className="mt-1 text-[8px] font-mono uppercase tracking-[0.16em] text-neutral-500">Total</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      {statusSegments.map((item) => <div key={item.label} className="flex items-center gap-2 text-[11px]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{backgroundColor:item.color}} />
                        <span className="min-w-0 flex-1 text-neutral-400">{item.label}</span>
                        <span className="font-mono text-neutral-200">{item.count}</span>
                      </div>)}
                    </div>
                  </div>
                )}
                <div className="mt-6 border-t border-white/[0.06] pt-4">
                  <div className="mb-2 flex items-center justify-between text-[10px]"><span className="text-neutral-400">Review completion</span><span className="font-mono text-neutral-300">{stats.total ? Math.round((stats.accepted + scopedApps.filter((app) => app.status === 'rejected' || app.status === 'waitlisted').length) / stats.total * 100) : 0}%</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-[#d4af37]" style={{width:(stats.total ? Math.round((stats.accepted + scopedApps.filter((app) => app.status === 'rejected' || app.status === 'waitlisted').length) / stats.total * 100) : 0) + '%'}} /></div>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-md border border-white/[0.07] bg-[#0c0c0f] xl:col-span-7">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <div><h2 className="text-xs font-semibold text-neutral-100">Recent applications</h2><p className="mt-1 text-[10px] text-neutral-500">Latest candidates in your department</p></div>
                <button type="button" onClick={() => onNavigate('/head/applications')} className="inline-flex items-center gap-1 text-[10px] text-[#d4af37] hover:text-[#f3e5ab]">View all <ArrowRight className="h-3 w-3" /></button>
              </div>
              {recentApps.length === 0 ? <div className="px-5 py-10 text-center"><Inbox className="mx-auto h-7 w-7 text-neutral-600" /><p className="mt-3 text-xs text-neutral-400">No candidates yet.</p></div> : (
                <ul className="divide-y divide-white/[0.045]">
                  {recentApps.map((app) => <li key={app.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025]">
                    <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[9px] font-semibold text-neutral-300 sm:flex">{app.applicantName.split(/\s+/).map((part) => part[0]).join('').slice(0,2).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => onNavigate('/head/applications/' + app.id)} className="block max-w-full truncate text-left text-xs font-medium text-neutral-100 hover:text-[#d4af37]">{app.applicantName}</button>
                      <p className="mt-0.5 truncate text-[10px] text-neutral-500">{app.applicationCode} · {app.position}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </li>)}
                </ul>
              )}
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
