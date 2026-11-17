import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ClipboardCheck,
  FolderKanban,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { canAccessDepartment } from '../../../utils/adminPermissions';
import {
  computeApplicationStats,
  computeDailyApplicationTrend,
  scopeApplicationsForActor,
} from '../../../utils/applicationFilters';
import { AdminShell } from '../AdminShell';
import { PortalAuthView } from '../PortalAuthView';
import { ApplicationTrendChart } from '../SimpleCharts';
import { RecommendationBadge, StatusBadge } from '../StatusBadge';
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
  const trend = computeDailyApplicationTrend(scopedApps, 10);
  const deptTasks = data.workspaceRecords.filter((w) => w.departmentId === assignedDepartment.id);
  const deptGroups = data.teamGroups.filter((g) => g.departmentId === assignedDepartment.id);
  const deptShifts = data.shifts.filter((s) => s.departmentId === assignedDepartment.id);
  const deptLogs = data.logs.filter((l) => l.departmentId === assignedDepartment.id);

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
        <div className="space-y-6">
          {/* Two-Stage Process Notice */}
          <div className="wm-surface-panel bg-[#1b2210] px-5 py-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-start gap-2.5 max-w-3xl">
              <ClipboardCheck
                className="h-4 w-4 shrink-0 text-[color:var(--wm-accent)] mt-0.5"
                aria-hidden="true"
              />
              <p className="text-[color:var(--wm-ink-secondary)] leading-relaxed">
                <strong className="text-[color:var(--wm-ink)]">Two-Stage Selection Workflow:</strong>{' '}
                Evaluate candidate dossiers, write internal notes, and submit{' '}
                <strong className="text-[color:var(--wm-accent)]">Stage 1 Recommendations</strong>{' '}
                (Accept or Reject). Official status stays{' '}
                <strong className="text-amber-200">Pending</strong> until Stage 2 confirmation by
                Admin or Super Admin leadership.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/head/applications')}
              className="shrink-0 min-h-[38px] rounded bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer transition-colors duration-150"
            >
              Review Queue ({stats.total})
            </button>
          </div>

          {/* Unified Departmental Metric Ledger Strip */}
          <section
            aria-label="Department overview metrics"
            className="wm-surface-panel overflow-hidden grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x [&>*:nth-child(1)]:border-r [&>*:nth-child(3)]:border-r lg:[&>*:nth-child(1)]:border-r-0 lg:[&>*:nth-child(3)]:border-r-0 divide-[color:var(--wm-hairline)]"
          >
            {[
              { label: 'Dept Applications', value: stats.total },
              { label: 'Pending Final Admin', value: stats.pending },
              { label: 'Stage 1 Recommended', value: stats.recommended },
              { label: 'Final Accepted', value: stats.accepted },
              {
                label: 'Active Units & Shifts',
                value: `${deptGroups.length} / ${deptShifts.length}`,
              },
            ].map((kpi, idx) => (
              <div
                key={kpi.label}
                className={`p-5 ${idx === 4 ? 'col-span-2 lg:col-span-1' : ''}`}
              >
                <p className="wm-section-kicker">{kpi.label}</p>
                <p className="mt-2 font-serif text-3xl font-medium text-[color:var(--wm-ink)] tabular-nums">
                  {kpi.value}
                </p>
              </div>
            ))}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-6 wm-surface-panel p-5">
              <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
                <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                  {assignedDepartment.name} Intake Trend
                </h2>
                <span className="font-mono text-xs text-[color:var(--wm-ink-secondary)] tabular-nums">
                  Accepted: {stats.accepted}/{assignedDepartment.capacity}
                </span>
              </div>
              <ApplicationTrendChart data={trend} />
            </section>

            <section className="lg:col-span-6 wm-surface-panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] px-5 py-4">
                <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                  {assignedDepartment.name} Applicant Queue
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('/head/applications')}
                  className="text-xs font-medium text-[color:var(--wm-accent)] hover:text-[color:var(--wm-ink)] cursor-pointer"
                >
                  Open all
                </button>
              </div>
              <div className="divide-y divide-[color:var(--wm-hairline)]">
                {scopedApps.length === 0 ? (
                  <p className="p-6 text-xs text-[color:var(--wm-ink-muted)]">
                    No applications currently assigned to {assignedDepartment.name}.
                  </p>
                ) : (
                  scopedApps.slice(0, 5).map((app) => (
                    <div
                      key={app.id}
                      className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-[#ede6ca]/[0.03]"
                    >
                      <button
                        type="button"
                        onClick={() => onNavigate(`/head/applications/${app.id}`)}
                        className="text-left min-w-0 cursor-pointer group"
                      >
                        <p className="text-xs font-semibold text-[color:var(--wm-ink)] group-hover:text-[color:var(--wm-accent)] truncate">
                          {app.applicantName}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-[color:var(--wm-ink-muted)] truncate">
                          {app.applicationCode} · {app.position}
                        </p>
                      </button>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={app.status} />
                        {app.headRecommendation !== 'none' && (
                          <RecommendationBadge decision={app.headRecommendation} />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="wm-surface-panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] px-5 py-4">
                <h2 className="text-sm font-semibold text-[color:var(--wm-ink)] inline-flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
                  <span>Operations Hub Items ({deptTasks.length})</span>
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('/head/workspace')}
                  className="text-xs font-medium text-[color:var(--wm-accent)] hover:text-[color:var(--wm-ink)] cursor-pointer"
                >
                  Open Hub
                </button>
              </div>
              {deptTasks.length === 0 ? (
                <p className="p-5 text-xs text-[color:var(--wm-ink-muted)]">
                  No workspace tasks or incident logs yet for {assignedDepartment.name}.
                </p>
              ) : (
                <div className="divide-y divide-[color:var(--wm-hairline)]">
                  {deptTasks.slice(0, 4).map((t) => (
                    <div
                      key={t.id}
                      className="px-5 py-3 text-xs flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[color:var(--wm-ink)] truncate">{t.title}</p>
                        <p className="mt-0.5 text-[11px] text-[color:var(--wm-ink-muted)] truncate">
                          {t.assignedTo} · Due <span className="font-mono">{t.deadline}</span>
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[color:var(--wm-accent)]">
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="wm-surface-panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] px-5 py-4">
                <h2 className="text-sm font-semibold text-[color:var(--wm-ink)] inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
                  <span>Recent {assignedDepartment.name} Activity</span>
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('/head/teams')}
                  className="text-xs font-medium text-[color:var(--wm-accent)] hover:text-[color:var(--wm-ink)] cursor-pointer"
                >
                  Teams & Units
                </button>
              </div>
              <div className="divide-y divide-[color:var(--wm-hairline)]">
                {deptLogs.length === 0 ? (
                  <p className="p-5 text-xs text-[color:var(--wm-ink-muted)]">
                    No department activity logged yet.
                  </p>
                ) : (
                  deptLogs.slice(0, 4).map((log) => (
                    <div
                      key={log.id}
                      className="px-5 py-3 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-[color:var(--wm-ink)]">
                          {log.actorName}
                        </span>{' '}
                        <span className="text-[color:var(--wm-accent)]">{log.action}</span>
                        <p className="text-[color:var(--wm-ink-secondary)] mt-0.5">{log.details}</p>
                      </div>
                      <span className="font-mono text-[11px] text-[color:var(--wm-ink-muted)] tabular-nums shrink-0">
                        {new Date(log.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  ))
                )}
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
