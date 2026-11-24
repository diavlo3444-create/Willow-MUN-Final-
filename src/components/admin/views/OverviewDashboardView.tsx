import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Inbox,
  Users,
  XCircle,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { supabase } from '../../../lib/supabase';
import { mapLiveRowToApplication, type LiveApplicationRow } from '../../../services/liveBackendService';
import type { ApplicationStatus } from '../../../types/admin';
import { computeApplicationStats, scopeApplicationsForActor } from '../../../utils/applicationFilters';
import { formatDecisionByLabel } from '../../../utils/decisionAttribution';
import { StatusBadge } from '../StatusBadge';

interface OverviewDashboardViewProps {
  onFilterApplications: (status?: ApplicationStatus | 'all', deptId?: string) => void;
  onSelectApplication: (appId: string) => void;
}

export function OverviewDashboardView({
  onFilterApplications,
  onSelectApplication,
}: OverviewDashboardViewProps) {
  const { data, currentUser } = useAdminStore();
  const [liveApplications, setLiveApplications] = useState<ReturnType<typeof mapLiveRowToApplication>[] | null>(null);
  const [liveLoadError, setLiveLoadError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const loadLiveApplications = async () => {
      setLiveLoadError(null);
      const { data: response, error } = await supabase.functions.invoke('willow-applications', { body: { action: 'list' } });
      if (cancelled) return;
      if (error || response?.error || !Array.isArray(response?.applications)) {
        setLiveLoadError(error?.message || response?.error || 'Unable to load live applications.');
        setLiveApplications(null);
        return;
      }
      setLiveApplications((response.applications as LiveApplicationRow[]).map((row) => mapLiveRowToApplication(row, currentUser, data.departments)));
    };
    void loadLiveApplications();
    return () => { cancelled = true; };
  }, [currentUser, data.departments]);
  const applications = useMemo(
    () => scopeApplicationsForActor(liveApplications ?? data.applications, currentUser, data.departments),
    [liveApplications, data.applications, currentUser, data.departments],
  );
  const stats = useMemo(() => computeApplicationStats(applications), [applications]);
  const recent = useMemo(
    () => [...applications].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 6),
    [applications],
  );
  const attention = useMemo(
    () =>
      [...applications]
        .filter((app) => app.status === 'pending')
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
        .slice(0, 4),
    [applications],
  );
  const statusSegments = [
    { label: 'Accepted', count: applications.filter((app) => app.status === 'accepted').length, color: '#52b788' },
    { label: 'Pending', count: applications.filter((app) => app.status === 'pending').length, color: '#7fa08c' },
    { label: 'Rejected', count: applications.filter((app) => app.status === 'rejected').length, color: '#fb7185' },
    { label: 'Waitlisted', count: applications.filter((app) => app.status === 'waitlisted').length, color: '#fbbf24' },
  ];
  const donut = (() => {
    if (!stats.total) return 'conic-gradient(#132c21 0deg 360deg)';
    let cursor = 0;
    const stops: string[] = [];
    statusSegments.forEach((segment) => {
      if (!segment.count) return;
      const start = (cursor / stats.total) * 360;
      cursor += segment.count;
      const end = (cursor / stats.total) * 360;
      stops.push(`${segment.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`);
    });
    return `conic-gradient(${stops.join(', ')})`;
  })();
  const firstName = (currentUser?.fullName || currentUser?.email || 'organiser').split(/[\s@]/)[0];
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const reviewed = applications.filter((app) =>
    ['accepted', 'rejected', 'waitlisted', 'withdrawn'].includes(app.status),
  ).length;
  const completion = stats.total ? Math.round((reviewed / stats.total) * 100) : 0;

  return (
    <div className="space-y-5">
      {liveLoadError && <div role="alert" className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">Live application data could not be loaded: {liveLoadError}. Showing local fallback data.</div>}
      <section className="flex flex-col gap-3 border-b border-[color:var(--wm-hairline)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[color:var(--wm-accent)]">
            Conference operations
          </p>
          <h1 className="wm-serif mt-2 text-3xl text-[color:var(--wm-ink)]">Overview</h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
            Welcome back, {firstName}. Monitor conference registrations, committee rosters, and administrative operations in one place.
          </p>
          <p className="mt-3 text-[10px] font-mono uppercase tracking-[0.12em] text-[color:var(--wm-ink-muted)]">
            {today}
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={() => onFilterApplications('pending')}
          className="inline-flex min-h-9 items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] transition-colors hover:bg-[#357a5b]"
        >
          Review queue{' '}
          <span className="rounded bg-[#06110c]/40 px-1.5 py-0.5 font-mono text-[10px]">
            {stats.pending}
          </span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </motion.button>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Total applications',
            value: stats.total,
            helper: 'All submitted applications',
            icon: Users,
            action: () => onFilterApplications('all'),
          },
          {
            label: 'Awaiting review',
            value: stats.pending,
            helper: stats.pending ? 'Oldest unresolved first' : 'Nothing waiting',
            icon: Clock3,
            action: () => onFilterApplications('pending'),
          },
          {
            label: 'Accepted',
            value: stats.accepted,
            helper: `${stats.total ? Math.round((stats.accepted / stats.total) * 100) : 0}% of applications`,
            icon: CheckCircle2,
            action: () => onFilterApplications('accepted'),
          },
          {
            label: 'Rejected',
            value: applications.filter((app) => app.status === 'rejected').length,
            helper: 'Final decisions',
            icon: XCircle,
            action: () => onFilterApplications('rejected'),
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className="wm-surface-panel p-4 text-left transition-colors hover:border-[color:var(--wm-hairline-strong)] hover:bg-[color:var(--wm-inset)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-[color:var(--wm-ink-secondary)]">{item.label}</span>
                <Icon className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
              </div>
              <p className="wm-serif mt-3 text-3xl tabular-nums text-[color:var(--wm-ink)]">{item.value}</p>
              <p className="mt-1 text-[10px] text-[color:var(--wm-ink-muted)]">{item.helper}</p>
            </button>
          );
        })}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="wm-surface-panel overflow-hidden xl:col-span-7">
          <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] px-4 py-3">
            <div>
              <h2 className="text-xs font-semibold text-[color:var(--wm-ink)]">Recent applications</h2>
              <p className="mt-0.5 text-[10px] text-[color:var(--wm-ink-muted)]">
                Latest candidates across the conference
              </p>
            </div>
            <button
              type="button"
              onClick={() => onFilterApplications('all')}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--wm-accent)] hover:text-[color:var(--wm-focal)]"
            >
              View all <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
          {recent.length ? (
            <ul className="divide-y divide-[color:var(--wm-hairline)]">
              {recent.map((app) => (
                <li key={app.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[color:var(--wm-inset)]/55">
                  <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] text-[9px] font-semibold text-[color:var(--wm-focal)] sm:flex">
                    {app.applicantName
                      .split(/\s+/)
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onSelectApplication(app.id)}
                      className="block max-w-full truncate text-left text-xs font-medium text-[color:var(--wm-ink)] hover:text-[color:var(--wm-focal)]"
                    >
                      {app.applicantName}
                    </button>
                    <p className="mt-0.5 truncate text-[10px] text-[color:var(--wm-ink-muted)]">
                      {app.position} · {app.applicationCode}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={app.status} />
                    {formatDecisionByLabel(app.status, app.finalDecisionBy) && (
                      <p className="mt-1 text-[10px] text-[color:var(--wm-ink-muted)]">
                        {formatDecisionByLabel(app.status, app.finalDecisionBy)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-xs text-[color:var(--wm-ink-muted)]">
              No local applications yet.
            </p>
          )}
        </section>

        <section className="wm-surface-panel overflow-hidden xl:col-span-5">
          <div className="border-b border-[color:var(--wm-hairline)] px-4 py-3">
            <h2 className="text-xs font-semibold text-[color:var(--wm-ink)]">Needs attention</h2>
            <p className="mt-0.5 text-[10px] text-[color:var(--wm-ink-muted)]">
              Oldest pending applications first
            </p>
          </div>
          {attention.length ? (
            <ul className="divide-y divide-[color:var(--wm-hairline)]">
              {attention.map((app) => (
                <li key={app.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[color:var(--wm-ink)]">{app.applicantName}</p>
                    <p className="mt-0.5 truncate text-[10px] text-[color:var(--wm-ink-muted)]">
                      {app.position} · {app.applicationCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectApplication(app.id)}
                    className="shrink-0 text-[11px] font-medium text-[color:var(--wm-accent)] hover:text-[color:var(--wm-focal)]"
                  >
                    Review <ArrowRight className="ml-1 inline h-3 w-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-xs text-[color:var(--wm-ink-muted)]">
              No pending applications.
            </p>
          )}
        </section>
      </div>

    </div>
  );
}
