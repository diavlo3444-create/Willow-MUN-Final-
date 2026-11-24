import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ExternalLink,
  Mail,
  Phone,
  RefreshCw,
  School,
  Search,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import {
  fetchScopedApplicationsForActor,
  submitHeadRecommendation,
} from '../../../services/liveBackendService';
import type { AdminUser, Application } from '../../../types/admin';
import {
  canAccessApplication,
  getActorDepartmentSlug,
  getActorGenderScope,
  normalizeDepartmentSlug,
} from '../../../utils/adminPermissions';
import { scopeApplicationsForActor } from '../../../utils/applicationFilters';
import { ApplicationAttachmentsViewer } from '../ApplicationAttachmentsViewer';
import { StatusBadge } from '../StatusBadge';
import { WmSkeleton } from '../WmSkeleton';

interface HeadApplicationsViewProps {
  effectiveHead: AdminUser;
  selectedApplicationId?: string | null;
  onSelectApplication: (appId: string | null) => void;
}

export function HeadApplicationsView({
  effectiveHead,
  selectedApplicationId = null,
  onSelectApplication,
}: HeadApplicationsViewProps) {
  const {
    data,
    pushToast,
    recordSecurityViolation,
  } = useAdminStore();

  const [liveApps, setLiveApps] = useState<Application[]>([]);
  const [source, setSource] = useState<'live' | 'table' | 'local'>('live');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [recommendationFilter, setRecommendationFilter] = useState<
    'all' | 'awaiting' | 'recommend_accept' | 'recommend_reject'
  >('all');
  const [recommendationNotes, setRecommendationNotes] = useState<Record<string, string>>({});

  const isSuperAdmin = effectiveHead.role === 'super_admin';
  const actorGender = getActorGenderScope(effectiveHead);
  const actorDeptSlug = getActorDepartmentSlug(effectiveHead, data.departments);
  const deptName =
    data.departments.find(
      (d) =>
        d.id === effectiveHead.departmentId ||
        d.slug === effectiveHead.departmentId ||
        (actorDeptSlug && normalizeDepartmentSlug(d.slug) === actorDeptSlug),
    )?.name ||
    effectiveHead.departmentSlug ||
    effectiveHead.departmentId ||
    'Assigned Department';

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) setLoading(true);
    const res = await fetchScopedApplicationsForActor(effectiveHead, data.departments);
    setLiveApps(res.applications);
    setSource(res.source);
    if (!silent && res.error && res.applications.length === 0) {
      pushToast({ tone: 'error', title: 'Could not load applications', description: res.error });
    }
    if (!silent) setLoading(false);
  }, [effectiveHead, data.departments, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Silently sync pending applications when returning to the tab or while reviewing so Admin decisions disappear promptly.
  useEffect(() => {
    const handleRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (busyId) return;
      void load({ silent: true });
    };
    window.addEventListener('focus', handleRefresh);
    document.addEventListener('visibilitychange', handleRefresh);
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (busyId) return;
      void load({ silent: true });
    }, 12000);
    return () => {
      window.removeEventListener('focus', handleRefresh);
      document.removeEventListener('visibilitychange', handleRefresh);
      window.clearInterval(timer);
    };
  }, [load, busyId]);

  // Heads must only ever see pending applications in their assigned department and division.
  const scopedApps = useMemo(() => {
    const base = source !== 'local' ? liveApps : data.applications;
    const visible = isSuperAdmin
      ? base.filter((app) => String(app.status || '').trim().toLowerCase() === 'pending')
      : scopeApplicationsForActor(base, effectiveHead, data.departments);
    return visible
      .filter((app) => String(app.status || '').trim().toLowerCase() === 'pending')
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [source, liveApps, data.applications, data.departments, effectiveHead, isSuperAdmin]);

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedApps.filter((app) => {
      if (recommendationFilter === 'awaiting' && app.headRecommendation !== 'none') return false;
      if (
        recommendationFilter === 'recommend_accept' &&
        app.headRecommendation !== 'recommend_accept'
      ) {
        return false;
      }
      if (
        recommendationFilter === 'recommend_reject' &&
        app.headRecommendation !== 'recommend_reject'
      ) {
        return false;
      }
      if (!q) return true;
      const hay = `${app.applicantName} ${app.applicationCode} ${app.email} ${app.schoolOrUniversity} ${app.position}`.toLowerCase();
      return hay.includes(q);
    });
  }, [scopedApps, recommendationFilter, search]);

  const counts = useMemo(() => {
    let awaiting = 0;
    let recommendAccept = 0;
    let recommendReject = 0;
    for (const app of scopedApps) {
      if (app.headRecommendation === 'recommend_accept') recommendAccept++;
      else if (app.headRecommendation === 'recommend_reject') recommendReject++;
      else awaiting++;
    }
    return { total: scopedApps.length, awaiting, recommendAccept, recommendReject };
  }, [scopedApps]);

  const selectedApp = useMemo(() => {
    if (!selectedApplicationId) return null;
    return scopedApps.find((a) => a.id === selectedApplicationId) || null;
  }, [selectedApplicationId, scopedApps]);

  // Security guard: if head manually navigated to an application ID outside their pending dept/gender queue
  useEffect(() => {
    if (!isSuperAdmin && !loading && selectedApplicationId && !selectedApp) {
      recordSecurityViolation(
        'application',
        selectedApplicationId,
        `Department Head attempted access to unavailable or out-of-scope application "${selectedApplicationId}" in ${deptName} (${actorGender ?? 'unknown'}).`,
      );
    }
  }, [loading, selectedApplicationId, selectedApp, recordSecurityViolation, deptName, actorGender, isSuperAdmin]);

  const handleRecommendation = async (app: Application, recommendation: 'recommend_accept' | 'recommend_reject') => {
    if ((!isSuperAdmin && !canAccessApplication(effectiveHead, app, data.departments)) || app.status !== 'pending') {
      setLiveApps((prev) => prev.filter((row) => row.id !== app.id));
      if (selectedApplicationId === app.id) onSelectApplication(null);
      pushToast({ tone: 'info', title: 'Application no longer pending', description: 'Only pending applications in your assigned department and division can be recommended.' });
      return;
    }
    setBusyId(app.id);
    const res = await submitHeadRecommendation(effectiveHead, app.id, recommendation, recommendationNotes[app.id] ?? app.headNotes ?? '', data.departments);
    setBusyId(null);
    if (!res.ok) {
      if (res.noLongerPending) {
        setLiveApps((prev) => prev.filter((row) => row.id !== app.id));
        if (selectedApplicationId === app.id) onSelectApplication(null);
        void load({ silent: true });
        pushToast({
          tone: 'info',
          title: 'Application no longer pending',
          description: 'This application is no longer pending and was removed from your queue.',
        });
        return;
      }
      pushToast({ tone: 'error', title: 'Could not save recommendation', description: res.error || 'Please refresh and try again.' });
      return;
    }
    if (res.application) setLiveApps(prev => prev.map(row => row.id === app.id ? res.application! : row));
    pushToast({ tone: 'success', title: 'Recommendation submitted', description: 'Sent to Admin for review. The application remains pending until an Admin makes the final decision.' });
  };

  if (selectedApplicationId && loading) {
    return <WmSkeleton variant="dossier" />;
  }

  if (selectedApplicationId && !selectedApp) {
    return (
      <div className="wm-surface-panel p-6 sm:p-8">
        <button
          type="button"
          onClick={() => onSelectApplication(null)}
          className="mb-5 inline-flex items-center gap-2 text-xs text-[color:var(--wm-accent)] hover:text-[color:var(--wm-focal)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to applications
        </button>
        <div className="rounded-lg border border-rose-400/35 bg-rose-500/[0.08] p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-rose-100">Application Unavailable</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--wm-ink-secondary)]">
                This application is no longer pending or is outside {deptName} ({actorGender ?? 'assigned'} division).
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedApp && (isSuperAdmin || canAccessApplication(effectiveHead, selectedApp, data.departments))) {
    const busy = busyId === selectedApp.id;
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onSelectApplication(null)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] px-3.5 text-xs font-medium text-[color:var(--wm-ink)] transition-colors hover:bg-[color:var(--wm-inset)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to {deptName} Applications
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <StatusBadge status={selectedApp.status} />
            <span className="rounded-md border border-[color:var(--wm-hairline)] px-3 py-2 text-[11px] text-[color:var(--wm-ink-secondary)]">{selectedApp.headRecommendation === 'recommend_accept' ? 'Recommended: Accept' : selectedApp.headRecommendation === 'recommend_reject' ? 'Recommended: Reject' : 'No recommendation yet'}</span>
          </div>
        </div>

        <section className="wm-surface-panel p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--wm-hairline)] pb-5">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">
                {selectedApp.applicationCode} · {deptName}
                {selectedApp.gender ? ` · ${selectedApp.gender}` : ''}
              </p>
              <h2 className="wm-serif mt-2 text-2xl font-semibold text-[color:var(--wm-ink)]">
                {selectedApp.applicantName}
              </h2>
              <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                {selectedApp.position} · Submitted {new Date(selectedApp.submittedAt).toLocaleString()}
              </p>
            </div>
            <StatusBadge status={selectedApp.status} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="wm-surface-inset flex items-start gap-2.5 p-3.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">Email</p>
                <p className="mt-0.5 truncate text-xs text-[color:var(--wm-ink)]">{selectedApp.email || '—'}</p>
              </div>
            </div>
            <div className="wm-surface-inset flex items-start gap-2.5 p-3.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">Phone &amp; Guardian</p>
                <p className="mt-0.5 truncate text-xs text-[color:var(--wm-ink)]">
                  {selectedApp.phone || '—'}
                  {selectedApp.guardianPhone ? ` · Guardian: ${selectedApp.guardianPhone}` : ''}
                </p>
              </div>
            </div>
            <div className="wm-surface-inset flex items-start gap-2.5 p-3.5">
              <School className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">School &amp; Grade</p>
                <p className="mt-0.5 truncate text-xs text-[color:var(--wm-ink)]">
                  {selectedApp.schoolOrUniversity || '—'}
                  {selectedApp.gradeOrYear ? ` · ${selectedApp.gradeOrYear}` : ''}
                  {selectedApp.age ? ` · Age ${selectedApp.age}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)]">
              Submitted Responses
            </h3>
            {selectedApp.answers.length === 0 ? (
              <p className="text-xs text-[color:var(--wm-ink-muted)]">No written responses provided.</p>
            ) : (
              selectedApp.answers.map((ans) => (
                <div key={ans.questionId} className="wm-surface-inset p-4">
                  <p className="text-[11px] font-semibold text-[color:var(--wm-focal)]">{ans.label}</p>
                  {/^https?:\/\//i.test(ans.answer) ? (
                    <a
                      href={ans.answer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[color:var(--wm-accent)] underline hover:text-[color:var(--wm-focal)]"
                    >
                      {ans.answer}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : (
                    <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
                      {ans.answer}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)]">
              Attachments &amp; Portfolio
            </h3>
            <ApplicationAttachmentsViewer
              application={selectedApp}
              actor={effectiveHead}
              departments={data.departments}
            />
          </div>
          <div className="mt-6 rounded-lg border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] p-4">
            <h3 className="text-xs font-mono uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)]">Department Recommendation</h3>
            <p className="mt-2 text-xs text-[color:var(--wm-ink-secondary)]">This is a recommendation only. The application stays pending until an Administrator makes the final decision.</p>
            <textarea value={recommendationNotes[selectedApp.id] ?? selectedApp.headNotes ?? ''} onChange={(e) => setRecommendationNotes(current => ({ ...current, [selectedApp.id]: e.target.value }))} rows={3} placeholder="Evaluation notes for the Admin team (optional)…" className="mt-3 w-full rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] p-3 text-xs text-[color:var(--wm-ink)]" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy || selectedApp.status !== 'pending'} onClick={() => void handleRecommendation(selectedApp, 'recommend_accept')} className="rounded-md bg-[color:var(--wm-emerald)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Recommend acceptance'}</button>
              <button type="button" disabled={busy || selectedApp.status !== 'pending'} onClick={() => void handleRecommendation(selectedApp, 'recommend_reject')} className="rounded-md border border-rose-400/40 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-200 disabled:opacity-50">{busy ? 'Saving…' : 'Recommend rejection'}</button>
            </div>
            {selectedApp.recommendedByName && <p className="mt-3 text-[11px] text-[color:var(--wm-ink-muted)]">Latest recommendation by {selectedApp.recommendedByName}{selectedApp.recommendedAt ? ' · ' + new Date(selectedApp.recommendedAt).toLocaleString() : ''}</p>}
          </div>
        </section>

        </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="wm-surface-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">
              Department Review · {actorGender ? `${actorGender} division` : 'Scoped access'}
            </p>
            <h1 className="wm-serif mt-1.5 text-2xl font-semibold text-[color:var(--wm-ink)]">
              {deptName} Applications
            </h1>
            <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
              Review pending applications from your division and submit recommendations for Admin review. Finalized applications leave this queue automatically.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3.5 text-xs font-medium text-[color:var(--wm-ink)] transition-colors hover:bg-[color:var(--wm-overlay)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pending applicant name, email, or school…"
              className="h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {([
              ['all', `All Pending (${counts.total})`],
              ['awaiting', `Awaiting Review (${counts.awaiting})`],
              ['recommend_accept', `Recommend Accept (${counts.recommendAccept})`],
              ['recommend_reject', `Recommend Reject (${counts.recommendReject})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRecommendationFilter(key)}
                className={[
                  'h-10 rounded-md border px-3 text-xs font-medium transition-colors',
                  recommendationFilter === key
                    ? 'border-[color:var(--wm-accent)] bg-[#2d6a4f]/35 text-[color:var(--wm-ink)]'
                    : 'border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <WmSkeleton variant="table" rows={5} />
      ) : !actorGender ? (
        <div className="wm-surface-panel p-8 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-amber-300" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-semibold text-[color:var(--wm-ink)]">Division Not Configured</h2>
          <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
            Your Department Head profile does not specify a Female or Male division. Contact the Super Admin to assign your division before reviewing applications.
          </p>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="wm-surface-panel p-10 text-center">
          <UserCheck className="mx-auto h-8 w-8 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-[color:var(--wm-ink)]">No applications match your filters</p>
          <p className="mt-1 text-xs text-[color:var(--wm-ink-muted)]">
            Only {actorGender} applications submitted to {deptName} appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {filteredApps.map((app) => (
              <motion.article
                key={app.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="wm-surface-panel flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:border-[color:var(--wm-hairline-strong)]"
              >
                <button type="button" onClick={() => onSelectApplication(app.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--wm-accent)]">{app.applicationCode}</span>
                    <StatusBadge status={app.status} />
                    <span className="text-[10px] text-[color:var(--wm-ink-muted)]">{app.headRecommendation === 'recommend_accept' ? 'Recommended: Accept' : app.headRecommendation === 'recommend_reject' ? 'Recommended: Reject' : 'Awaiting recommendation'}</span>
                  </div>
                  <h3 className="mt-1.5 truncate text-sm font-semibold text-[color:var(--wm-ink)]">{app.applicantName}</h3>
                  <p className="mt-0.5 truncate text-xs text-[color:var(--wm-ink-secondary)]">{app.schoolOrUniversity || app.email} · Applied {new Date(app.submittedAt).toLocaleDateString()}</p>
                </button>
                <button type="button" onClick={() => onSelectApplication(app.id)} className="inline-flex h-8 items-center rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-xs font-medium text-[color:var(--wm-ink)]">Review &amp; recommend</button>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}

    </div>
  );
}
