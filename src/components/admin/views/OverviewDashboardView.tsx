import { useMemo } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Globe,
  Inbox,
  Users,
  XCircle,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type { ApplicationStatus } from '../../../types/admin';
import {
  computeApplicationStats,
  computeDailyApplicationTrend,
  computeDepartmentBreakdown,
  scopeApplicationsForActor,
} from '../../../utils/applicationFilters';
import { ApplicationTrendChart, DepartmentDistributionChart } from '../SimpleCharts';
import { RecommendationBadge, RoleBadge, StatusBadge } from '../StatusBadge';

interface OverviewDashboardViewProps {
  basePath: '/super-admin' | '/admin';
  onNavigate: (path: string) => void;
  onFilterApplications: (status?: ApplicationStatus | 'all', deptId?: string) => void;
  onSelectApplication: (appId: string) => void;
}

export function OverviewDashboardView({
  basePath,
  onNavigate,
  onFilterApplications,
  onSelectApplication,
}: OverviewDashboardViewProps) {
  const { data, currentUser } = useAdminStore();

  const scopedApps = useMemo(
    () => scopeApplicationsForActor(data.applications, currentUser),
    [data.applications, currentUser],
  );
  const stats = useMemo(() => computeApplicationStats(scopedApps), [scopedApps]);
  const deptBreakdown = useMemo(
    () => computeDepartmentBreakdown(scopedApps, data.departments),
    [scopedApps, data.departments],
  );
  const trendData = useMemo(() => computeDailyApplicationTrend(scopedApps, 14), [scopedApps]);

  const recentApps = useMemo(
    () => [...scopedApps].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 6),
    [scopedApps],
  );
  const recentLogs = useMemo(() => data.logs.slice(0, 6), [data.logs]);
  const openTasks = useMemo(
    () => data.workspaceRecords.filter((w) => w.status !== 'completed').slice(0, 5),
    [data.workspaceRecords],
  );
  const recentWebsiteActions = useMemo(
    () => data.logs.filter((l) => l.category === 'website').slice(0, 4),
    [data.logs],
  );
  const deptNameById = useMemo(
    () => new Map(data.departments.map((d) => [d.id, d.name])),
    [data.departments],
  );

  const recommendedPendingCount = scopedApps.filter(
    (a) => a.status === 'pending' && a.headRecommendation === 'recommend_accept',
  ).length;
  const newInquiriesCount = data.inquiries.filter((i) => i.status === 'new').length;
  const openDeptsCount = data.departments.filter((d) => d.registrationOpen).length;
  const draftDiffers =
    JSON.stringify(data.websiteDraft) !== JSON.stringify(data.websitePublished);
  const checkedInCount = data.qrPasses.filter((p) => p.checkedIn).length;

  return (
    <div className="space-y-6">
      {/* Priority Operational Strip: Stage 2 Queue + Live Sync + Inquiries */}
      <section
        aria-label="Priority operations summary"
        className="wm-surface-panel overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[color:var(--wm-hairline)]"
      >
        <div className="lg:col-span-5 bg-[#1b2210] px-5 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--wm-accent)]">
              Stage 2 Approval Queue
            </p>
            <p className="mt-1 text-sm text-[color:var(--wm-ink)]">
              <strong className="font-mono font-semibold tabular-nums mr-1.5">
                {recommendedPendingCount}
              </strong>
              Head-recommended application{recommendedPendingCount === 1 ? '' : 's'} awaiting final review.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(`${basePath}/recommendations`)}
            className="shrink-0 inline-flex min-h-[38px] items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer transition-colors duration-150"
          >
            <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Review Queue</span>
          </button>
        </div>

        <div className="lg:col-span-4 px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="wm-section-kicker">Website Release State</p>
            <p className="mt-1 text-sm text-[color:var(--wm-ink)] truncate">
              <span className="font-mono">v{data.websiteVersions[0]?.versionNumber ?? 1}</span> ·{' '}
              <span className={draftDiffers ? 'text-amber-200 font-medium' : 'text-emerald-200'}>
                {draftDiffers ? 'Unpublished Draft' : 'Synced Live'}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(`${basePath}/website-editor`)}
            className="shrink-0 inline-flex min-h-[36px] items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer transition-colors duration-150"
          >
            <Globe className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <span>Studio</span>
          </button>
        </div>

        <div className="lg:col-span-3 px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="wm-section-kicker">Inquiries & Gate</p>
            <p className="mt-1 text-sm text-[color:var(--wm-ink)] tabular-nums truncate">
              {newInquiriesCount} new · {checkedInCount}/{data.qrPasses.length} checked in
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(`${basePath}/messages`)}
            className="shrink-0 inline-flex min-h-[36px] items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer transition-colors duration-150"
          >
            <Inbox className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <span>Inbox</span>
          </button>
        </div>
      </section>

      {/* Unified Architectural Metric Ledger Strip (Single rule-divided bar instead of 5 cloned boxes) */}
      <section
        aria-label="Conference application metrics"
        className="wm-surface-panel overflow-hidden grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 divide-y md:divide-y-0 md:divide-x [&>*:nth-child(1)]:border-r [&>*:nth-child(3)]:border-r md:[&>*:nth-child(1)]:border-r-0 md:[&>*:nth-child(3)]:border-r-0 divide-[color:var(--wm-hairline)]"
      >
        <button
          type="button"
          onClick={() => onFilterApplications('all')}
          className="group p-5 text-left hover:bg-[#ede6ca]/[0.03] transition-colors duration-150 cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-[color:var(--wm-ink-muted)]">
            <span className="font-semibold uppercase tracking-[0.12em] text-[10px]">
              Total Applications
            </span>
            <Users className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-serif text-3xl font-medium text-[color:var(--wm-ink)] tabular-nums group-hover:text-[color:var(--wm-focal)]">
            {stats.total}
          </p>
          <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
            Across {data.departments.length} departments
          </p>
        </button>

        <button
          type="button"
          onClick={() => onFilterApplications('pending')}
          className="group p-5 text-left hover:bg-[#ede6ca]/[0.03] transition-colors duration-150 cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-[color:var(--wm-ink-muted)]">
            <span className="font-semibold uppercase tracking-[0.12em] text-[10px]">
              Pending Final Review
            </span>
            <Clock className="h-4 w-4 text-amber-300" aria-hidden="true" />
          </div>
          <p className="mt-2 font-serif text-3xl font-medium text-[color:var(--wm-ink)] tabular-nums">
            {stats.pending}
          </p>
          <p className="mt-1 text-xs text-amber-200 tabular-nums">
            {recommendedPendingCount} Head-recommended ready
          </p>
        </button>

        <button
          type="button"
          onClick={() => onFilterApplications('accepted')}
          className="group p-5 text-left hover:bg-[#ede6ca]/[0.03] transition-colors duration-150 cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-[color:var(--wm-ink-muted)]">
            <span className="font-semibold uppercase tracking-[0.12em] text-[10px]">
              Accepted
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          </div>
          <p className="mt-2 font-serif text-3xl font-medium text-[color:var(--wm-ink)] tabular-nums">
            {stats.accepted}
          </p>
          <p className="mt-1 text-xs text-emerald-200 tabular-nums">
            {stats.acceptanceRate}% acceptance ratio
          </p>
        </button>

        <button
          type="button"
          onClick={() => onFilterApplications('rejected')}
          className="group p-5 text-left hover:bg-[#ede6ca]/[0.03] transition-colors duration-150 cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-[color:var(--wm-ink-muted)]">
            <span className="font-semibold uppercase tracking-[0.12em] text-[10px]">
              Rejected
            </span>
            <XCircle className="h-4 w-4 text-rose-300" aria-hidden="true" />
          </div>
          <p className="mt-2 font-serif text-3xl font-medium text-[color:var(--wm-ink)] tabular-nums">
            {stats.rejected}
          </p>
          <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)] tabular-nums">
            {stats.waitlisted} waitlisted · {stats.withdrawn} withdrawn
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate(`${basePath}/registration`)}
          className="col-span-2 md:col-span-1 group p-5 text-left hover:bg-[#ede6ca]/[0.03] transition-colors duration-150 cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-[color:var(--wm-ink-muted)]">
            <span className="font-semibold uppercase tracking-[0.12em] text-[10px]">
              Open Departments
            </span>
            <Building2 className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-serif text-3xl font-medium text-[color:var(--wm-ink)] tabular-nums">
            {openDeptsCount}/{data.departments.length}
          </p>
          <p className="mt-1 text-xs text-[color:var(--wm-accent)]">
            {data.settings.globalRegistrationOpen ? 'Global Intake Open' : 'Global Intake Closed'}
          </p>
        </button>
      </section>

      {/* Asymmetric Data Row: 14-Day Intake Trend (8 cols) + Department Capacity Breakdown (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 wm-surface-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[color:var(--wm-hairline)]">
            <div>
              <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                Application Submissions (14-Day Window)
              </h2>
              <p className="text-xs text-[color:var(--wm-ink-muted)]">
                Daily submission volume across Delegate, Staff, Security, Media & Volunteer tracks
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(`${basePath}/reports`)}
              className="text-xs font-medium text-[color:var(--wm-accent)] hover:text-[color:var(--wm-ink)] inline-flex items-center gap-1 cursor-pointer transition-colors duration-150"
            >
              <span>Full Reports</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <ApplicationTrendChart data={trendData} />
        </section>

        <section className="lg:col-span-4 wm-surface-panel p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[color:var(--wm-hairline)]">
            <div>
              <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                Department Intake Load
              </h2>
              <p className="text-xs text-[color:var(--wm-ink-muted)]">
                Select a department to filter queue
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(`${basePath}/departments`)}
              className="text-xs font-medium text-[color:var(--wm-accent)] hover:text-[color:var(--wm-ink)] cursor-pointer transition-colors duration-150"
            >
              All Depts
            </button>
          </div>
          <div className="mt-4 flex-1 max-h-60 overflow-y-auto pr-1">
            <DepartmentDistributionChart
              items={deptBreakdown.slice(0, 7)}
              onSelectDepartment={(deptId) => onFilterApplications('all', deptId)}
            />
          </div>
        </section>
      </div>

      {/* Bottom Operational Row: Recent Applications, Recent Activity, Open Workspace Tasks & Website Edits */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-5 wm-surface-panel overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--wm-hairline)]">
            <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
              Recent Applications
            </h2>
            <button
              type="button"
              onClick={() => onFilterApplications('all')}
              className="text-xs font-medium text-[color:var(--wm-accent)] hover:text-[color:var(--wm-ink)] cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="divide-y divide-[color:var(--wm-hairline)]">
            {recentApps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => onSelectApplication(app.id)}
                className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-[#ede6ca]/[0.03] transition-colors duration-150 cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[color:var(--wm-ink)] truncate">
                    {app.applicantName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[color:var(--wm-ink-muted)] truncate">
                    {deptNameById.get(app.departmentId) ?? app.departmentId} · {app.position}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={app.status} />
                  {app.headRecommendation !== 'none' && (
                    <RecommendationBadge decision={app.headRecommendation} />
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="xl:col-span-4 wm-surface-panel overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--wm-hairline)]">
            <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
              Recent Audit Stream
            </h2>
            <button
              type="button"
              onClick={() => onNavigate(`${basePath}/logs`)}
              className="text-xs font-medium text-[color:var(--wm-accent)] hover:text-[color:var(--wm-ink)] cursor-pointer"
            >
              Full Audit
            </button>
          </div>
          <div className="divide-y divide-[color:var(--wm-hairline)]">
            {recentLogs.map((log) => (
              <div key={log.id} className="px-5 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[color:var(--wm-ink)] truncate">
                    {log.action}
                  </p>
                  <RoleBadge role={log.actorRole} />
                </div>
                <p className="text-[11px] text-[color:var(--wm-ink-secondary)] truncate">
                  {log.actorName} · {log.targetLabel}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="xl:col-span-3 wm-surface-panel overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--wm-hairline)]">
              <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                Pending Dept Tasks
              </h2>
              <button
                type="button"
                onClick={() => onNavigate(`${basePath}/groups`)}
                className="text-xs font-medium text-[color:var(--wm-accent)] hover:text-[color:var(--wm-ink)] cursor-pointer"
              >
                Workspace
              </button>
            </div>
            <div className="divide-y divide-[color:var(--wm-hairline)]">
              {openTasks.map((t) => (
                <div key={t.id} className="px-5 py-2.5 text-xs">
                  <p className="font-medium text-[color:var(--wm-ink)] truncate">{t.title}</p>
                  <p className="mt-0.5 text-[11px] text-[color:var(--wm-ink-muted)] truncate">
                    {deptNameById.get(t.departmentId) ?? t.departmentId} · Due{' '}
                    <span className="font-mono tabular-nums">{t.deadline}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[color:var(--wm-hairline)]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)]/50">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
                Recent Website Edits
              </h2>
              <button
                type="button"
                onClick={() => onNavigate(`${basePath}/versions`)}
                className="text-xs text-[color:var(--wm-accent)] hover:text-[color:var(--wm-ink)] cursor-pointer"
              >
                Versions
              </button>
            </div>
            <div className="px-5 py-3 space-y-1.5">
              {recentWebsiteActions.length === 0 ? (
                <p className="text-xs text-[color:var(--wm-ink-muted)]">
                  No draft edits since last live release.
                </p>
              ) : (
                recentWebsiteActions.map((w) => (
                  <p key={w.id} className="text-[11px] text-[color:var(--wm-ink-secondary)] truncate">
                    <span className="text-[color:var(--wm-ink)] font-medium">{w.action}:</span>{' '}
                    {w.details}
                  </p>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
