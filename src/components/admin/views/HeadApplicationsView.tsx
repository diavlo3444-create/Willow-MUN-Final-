import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  School,
  Search,
  ShieldAlert,
  UserCheck,
  X,
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
  hasPermission,
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

type HeadStatusFilter = 'all' | 'pending' | 'accepted' | 'rejected';

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<HeadStatusFilter>('all');
  const [recommendationFilter, setRecommendationFilter] = useState<
    'all' | 'awaiting' | 'recommend_accept' | 'recommend_reject'
  >('all');
  const [recommendationNotes, setRecommendationNotes] = useState<Record<string, string>>({});
  const [expandedNotesIds, setExpandedNotesIds] = useState<Record<string, boolean>>({});

  const isSuperAdmin = effectiveHead.role === 'super_admin';
  const canRecommend =
    isSuperAdmin || hasPermission(effectiveHead, 'applications.recommend', data.departments);
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
    (actorDeptSlug ? actorDeptSlug.toUpperCase() : null) ||
    effectiveHead.departmentId ||
    'Assigned Department';

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) setLoading(true);
    const res = await fetchScopedApplicationsForActor(effectiveHead, data.departments);
    setLiveApps(res.applications);
    setSource(res.source);
    setLoadError(res.error || null);
    if (!silent && res.error && res.applications.length === 0) {
      pushToast({ tone: 'error', title: 'Could not load applications', description: res.error });
    }
    if (!silent) setLoading(false);
  }, [effectiveHead, data.departments, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Silently sync applications when returning to the tab or while reviewing so Admin decisions appear promptly.
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

  // Heads see Pending, Waitlisted, Accepted, and Rejected applications strictly scoped to their own department (and division if configured).
  const scopedApps = useMemo(() => {
    const base = source !== 'local' ? liveApps : data.applications;
    const visible = isSuperAdmin
      ? base
      : scopeApplicationsForActor(base, effectiveHead, data.departments);
    return [...visible].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [source, liveApps, data.applications, data.departments, effectiveHead, isSuperAdmin]);

  const statusCounts = useMemo(() => {
    let pending = 0;
    let accepted = 0;
    let rejected = 0;
    for (const app of scopedApps) {
      const normalized = String(app.status || '').trim().toLowerCase();
      if (normalized === 'accepted') accepted++;
      else if (normalized === 'rejected') rejected++;
      else if (normalized === 'pending' || normalized === 'waitlisted') pending++;
    }
    return {
      all: scopedApps.length,
      pending,
      accepted,
      rejected,
    };
  }, [scopedApps]);

  const statusFilteredApps = useMemo(() => {
    return scopedApps.filter((app) => {
      const normalized = String(app.status || '').trim().toLowerCase();
      if (statusFilter === 'pending') {
        return normalized === 'pending' || normalized === 'waitlisted';
      }
      if (statusFilter === 'accepted') return normalized === 'accepted';
      if (statusFilter === 'rejected') return normalized === 'rejected';
      return true;
    });
  }, [scopedApps, statusFilter]);

  const recommendationCounts = useMemo(() => {
    let awaiting = 0;
    let recommendAccept = 0;
    let recommendReject = 0;
    for (const app of statusFilteredApps) {
      if (app.headRecommendation === 'recommend_accept') recommendAccept++;
      else if (app.headRecommendation === 'recommend_reject') recommendReject++;
      else awaiting++;
    }
    return {
      total: statusFilteredApps.length,
      awaiting,
      recommendAccept,
      recommendReject,
    };
  }, [statusFilteredApps]);

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return statusFilteredApps.filter((app) => {
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
  }, [statusFilteredApps, recommendationFilter, search]);

  const selectedApp = useMemo(() => {
    if (!selectedApplicationId) return null;
    return scopedApps.find((a) => a.id === selectedApplicationId) || null;
  }, [selectedApplicationId, scopedApps]);

  // Security guard: if head manually navigated to an application ID outside their department scope
  useEffect(() => {
    if (!isSuperAdmin && !loading && selectedApplicationId && !selectedApp) {
      recordSecurityViolation(
        'application',
        selectedApplicationId,
        `Department Head attempted access to unavailable or out-of-scope application "${selectedApplicationId}" in ${deptName} (${actorGender ?? 'all divisions'}).`,
      );
    }
  }, [loading, selectedApplicationId, selectedApp, recordSecurityViolation, deptName, actorGender, isSuperAdmin]);

  const handleRecommendation = async (
    app: Application,
    recommendation: 'recommend_accept' | 'recommend_reject',
  ) => {
    if (!isSuperAdmin && !canAccessApplication(effectiveHead, app, data.departments)) {
      pushToast({
        tone: 'error',
        title: 'Out of scope',
        description: 'You can only recommend applicants assigned to your department.',
      });
      return;
    }
    if (String(app.status || '').trim().toLowerCase() !== 'pending') {
      pushToast({
        tone: 'info',
        title: 'Final decision already recorded',
        description: 'Recommendations can only be updated while an application is pending.',
      });
      return;
    }
    setBusyId(app.id);
    const res = await submitHeadRecommendation(
      effectiveHead,
      app.id,
      recommendation,
      recommendationNotes[app.id] ?? app.headNotes ?? '',
      data.departments,
    );
    setBusyId(null);
    if (!res.ok) {
      if (res.noLongerPending) {
        void load({ silent: true });
        pushToast({
          tone: 'info',
          title: 'Application decision updated',
          description: 'An Admin already finalized this application. Status has been refreshed.',
        });
        return;
      }
      pushToast({
        tone: 'error',
        title: 'Could not save recommendation',
        description: res.error || 'Please refresh and try again.',
      });
      return;
    }
    if (res.application) {
      setLiveApps((prev) => prev.map((row) => (row.id === app.id ? res.application! : row)));
    }
    pushToast({
      tone: 'success',
      title: recommendation === 'recommend_accept' ? 'Recommended: Accept' : 'Recommended: Reject',
      description: 'Saved for Admin review. Final acceptance or rejection is confirmed by Admin.',
    });
  };

  const renderRecommendationBox = (app: Application, compact = false) => {
    const normalizedStatus = String(app.status || '').trim().toLowerCase();
    const isPending = normalizedStatus === 'pending';
    const busy = busyId === app.id;
    const notesValue = recommendationNotes[app.id] ?? app.headNotes ?? '';
    const notesOpen = !compact || expandedNotesIds[app.id] || Boolean(notesValue.trim());

    if (!isPending) {
      return (
        <div
          className={[
            'rounded-lg border px-4 py-3',
            normalizedStatus === 'accepted'
              ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
              : normalizedStatus === 'rejected'
                ? 'border-rose-500/30 bg-rose-500/[0.06]'
                : 'border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)]',
          ].join(' ')}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)]">
                {deptName} · Decision Status
              </span>
              <StatusBadge status={app.status} />
            </div>
            <span className="text-[11px] text-[color:var(--wm-ink-secondary)]">
              {app.headRecommendation === 'recommend_accept'
                ? 'Head Recommendation: Accept'
                : app.headRecommendation === 'recommend_reject'
                  ? 'Head Recommendation: Reject'
                  : 'No Head recommendation recorded'}
            </span>
          </div>
          {app.headNotes && (
            <p className="mt-2 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
              <span className="font-medium text-[color:var(--wm-ink)]">Head note:</span> {app.headNotes}
            </p>
          )}
          {app.recommendedByName && (
            <p className="mt-1.5 text-[11px] text-[color:var(--wm-ink-muted)]">
              Recommended by {app.recommendedByName}
              {app.recommendedAt ? ` · ${new Date(app.recommendedAt).toLocaleString()}` : ''}
            </p>
          )}
        </div>
      );
    }

    return (
      <div
        className={[
          'rounded-lg border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)]',
          compact ? 'p-3.5' : 'p-4 sm:p-5',
        ].join(' ')}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[11px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-accent)]">
              Accept / Reject Recommendation Box
            </h3>
            {!compact && (
              <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                Submit your department decision recommendation for {deptName}. Admin finalizes the official status.
              </p>
            )}
          </div>
          <span className="rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] px-2.5 py-1 text-[11px] text-[color:var(--wm-ink-secondary)]">
            {app.headRecommendation === 'recommend_accept'
              ? 'Recommended: Accept'
              : app.headRecommendation === 'recommend_reject'
                ? 'Recommended: Reject'
                : 'Awaiting recommendation'}
          </span>
        </div>

        {notesOpen && (
          <textarea
            value={notesValue}
            onChange={(e) =>
              setRecommendationNotes((current) => ({ ...current, [app.id]: e.target.value }))
            }
            rows={compact ? 2 : 3}
            placeholder="Optional evaluation note for Admin review (strengths, concerns, role fit)…"
            className="mt-3 w-full rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] p-2.5 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
          />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || !canRecommend}
            onClick={() => void handleRecommendation(app, 'recommend_accept')}
            className={[
              'inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-50',
              app.headRecommendation === 'recommend_accept'
                ? 'bg-[color:var(--wm-emerald)] text-white ring-1 ring-emerald-300/60'
                : 'bg-[color:var(--wm-emerald)] text-white hover:bg-[#357a5b]',
            ].join(' ')}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {busy ? 'Saving…' : 'Recommend Accept'}
          </button>

          <button
            type="button"
            disabled={busy || !canRecommend}
            onClick={() => void handleRecommendation(app, 'recommend_reject')}
            className={[
              'inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-50',
              app.headRecommendation === 'recommend_reject'
                ? 'border-rose-400 bg-rose-500/25 text-rose-100'
                : 'border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20',
            ].join(' ')}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            {busy ? 'Saving…' : 'Recommend Reject'}
          </button>

          {compact && !notesOpen && (
            <button
              type="button"
              onClick={() =>
                setExpandedNotesIds((prev) => ({ ...prev, [app.id]: true }))
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] px-3 py-2 text-xs text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Add Note
            </button>
          )}
        </div>

        {app.recommendedByName && (
          <p className="mt-2.5 text-[11px] text-[color:var(--wm-ink-muted)]">
            Latest recommendation by {app.recommendedByName}
            {app.recommendedAt ? ` · ${new Date(app.recommendedAt).toLocaleString()}` : ''}
          </p>
        )}
      </div>
    );
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
                This application was not found in {deptName} ({actorGender ? `${actorGender} division` : 'all divisions'}).
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedApp && (isSuperAdmin || canAccessApplication(effectiveHead, selectedApp, data.departments))) {
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
            <span className="rounded-md border border-[color:var(--wm-hairline)] px-3 py-2 text-[11px] text-[color:var(--wm-ink-secondary)]">
              {selectedApp.headRecommendation === 'recommend_accept'
                ? 'Recommended: Accept'
                : selectedApp.headRecommendation === 'recommend_reject'
                  ? 'Recommended: Reject'
                  : 'No recommendation yet'}
            </span>
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

          <div className="mt-5">
            {renderRecommendationBox(selectedApp, false)}
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
              Department Review · {actorGender ? `${actorGender} division` : 'All divisions'}
            </p>
            <h1 className="wm-serif mt-1.5 text-2xl font-semibold text-[color:var(--wm-ink)]">
              {deptName} Applications
            </h1>
            <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
              View Pending, Accepted, and Rejected applicants for {deptName}, and submit Accept or Reject recommendations on pending applications.
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

        {/* Status Tabs: All / Pending / Accepted / Rejected */}
        <div className="mt-5 flex flex-wrap gap-2 border-b border-[color:var(--wm-hairline)] pb-4">
          {([
            ['all', `All (${statusCounts.all})`],
            ['pending', `Pending (${statusCounts.pending})`],
            ['accepted', `Accepted (${statusCounts.accepted})`],
            ['rejected', `Rejected (${statusCounts.rejected})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={[
                'h-9 rounded-md border px-3.5 text-xs font-semibold transition-colors',
                statusFilter === key
                  ? 'border-[color:var(--wm-accent)] bg-[#2d6a4f]/40 text-[color:var(--wm-ink)]'
                  : 'border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${deptName} applicant name, email, or school…`}
              className="h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {([
              ['all', `All (${recommendationCounts.total})`],
              ['awaiting', `Awaiting Review (${recommendationCounts.awaiting})`],
              ['recommend_accept', `Recommend Accept (${recommendationCounts.recommendAccept})`],
              ['recommend_reject', `Recommend Reject (${recommendationCounts.recommendReject})`],
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

      {loadError && scopedApps.length === 0 && !loading && (
        <div
          role="alert"
          className="wm-surface-panel border-rose-400/35 bg-rose-500/[0.08] p-5"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-rose-100">Unable to Sync Department Applications</h2>
              <p className="mt-1 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
                {loadError}
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <WmSkeleton variant="table" rows={5} />
      ) : filteredApps.length === 0 ? (
        <div className="wm-surface-panel p-10 text-center">
          <UserCheck className="mx-auto h-8 w-8 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-[color:var(--wm-ink)]">No applications match your filters</p>
          <p className="mt-1 text-xs text-[color:var(--wm-ink-muted)]">
            {actorGender
              ? `Only ${actorGender} division applications submitted to ${deptName} appear here.`
              : `Only applications submitted to ${deptName} appear here.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApps.map((app) => (
            <motion.article
              key={app.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.14 }}
              className="wm-surface-panel space-y-3 p-4 sm:p-5 transition-colors hover:border-[color:var(--wm-hairline-strong)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <button
                  type="button"
                  onClick={() => onSelectApplication(app.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--wm-accent)]">
                      {app.applicationCode}
                    </span>
                    <StatusBadge status={app.status} />
                    {app.gender && (
                      <span className="text-[10px] uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
                        {app.gender}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1.5 truncate text-base font-semibold text-[color:var(--wm-ink)]">
                    {app.applicantName}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-[color:var(--wm-ink-secondary)]">
                    {app.position} · {app.schoolOrUniversity || app.email} · Applied{' '}
                    {new Date(app.submittedAt).toLocaleDateString()}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectApplication(app.id)}
                  className="inline-flex h-9 items-center rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3.5 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)]"
                >
                  Open Full Dossier
                </button>
              </div>

              {renderRecommendationBox(app, true)}
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
