import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  ClipboardCheck,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { supabase } from '../../../lib/supabase';
import {
  fetchHeadRecommendedApplications,
  mapLiveRowToApplication,
  type LiveApplicationRow,
} from '../../../services/liveBackendService';
import type { Application, ApplicationStatus } from '../../../types/admin';
import { canOverrideApplicationDecision, normalizeDepartmentSlug } from '../../../utils/adminPermissions';
import {
  canViewHeadRecommended,
  filterHeadRecommendedApplications,
} from '../../../utils/applicationFilters';
import { formatDecisionByLabel } from '../../../utils/decisionAttribution';
import { OverrideDecisionModal } from '../OverrideDecisionModal';
import { RecommendationBadge, StatusBadge } from '../StatusBadge';
import { WmSkeleton } from '../WmSkeleton';
import { LiveApplicationDossierCard } from './LiveApplicationsView';

const TRACK_LABELS: Record<string, string> = {
  volunteer: 'Volunteers',
  volunteers: 'Volunteers',
  media: 'Media',
  press: 'Press',
  security: 'Security',
  delegate: 'Delegate',
  staff: 'Staff',
};

function formatRecommendationDate(app: Application): string {
  const raw = app.recommendedAt || app.updatedAt || app.submittedAt;
  if (!raw) return 'Date unavailable';
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return 'Date unavailable';
  return new Date(parsed).toLocaleString();
}

export function HeadRecommendedView({
  selectedId = null,
  externalSearch,
  onSelectApplication,
}: {
  selectedId?: string | null;
  externalSearch?: string;
  onSelectApplication?: (id: string | null) => void;
}) {
  const { currentUser, data: storeData, pushToast, overrideApplicationDecision } = useAdminStore();
  const canOverride = canOverrideApplicationDecision(currentUser);

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [overrideTarget, setOverrideTarget] = useState<Application | null>(null);
  const [overrideSaving, setOverrideSaving] = useState(false);

  const [query, setQuery] = useState(externalSearch ?? '');
  const [recommendationFilter, setRecommendationFilter] = useState<
    'all' | 'recommend_accept' | 'recommend_reject'
  >('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (externalSearch !== undefined) {
      setQuery(externalSearch);
    }
  }, [externalSearch]);

  const isAuthorizedAdmin = canViewHeadRecommended(currentUser, storeData.departments);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!isAuthorizedAdmin || !currentUser) {
        setApplications([]);
        setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setError('');
      const res = await fetchHeadRecommendedApplications(currentUser, storeData.departments);
      if (res.error) {
        setError(res.error);
      } else {
        setApplications(res.applications);
      }
      setLoading(false);
    },
    [currentUser, isAuthorizedAdmin, storeData.departments],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !busyId && isAuthorizedAdmin) {
        void load({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [busyId, isAuthorizedAdmin, load]);

  const deptNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of storeData.departments) {
      map.set(d.id, d.name);
      map.set(d.slug, d.name);
      map.set(normalizeDepartmentSlug(d.slug), d.name);
    }
    return map;
  }, [storeData.departments]);

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of storeData.users) {
      if (u.id && u.fullName) map.set(u.id, u.fullName);
    }
    return map;
  }, [storeData.users]);

  const getTrackAndDeptLabel = useCallback(
    (app: Application) => {
      const trackKey = (app.applicationType || app.category || '').toLowerCase();
      const trackLabel = TRACK_LABELS[trackKey] || app.category || 'Application';
      const deptLabel =
        deptNameByKey.get(app.departmentId) ||
        deptNameByKey.get(normalizeDepartmentSlug(app.departmentId)) ||
        TRACK_LABELS[normalizeDepartmentSlug(app.departmentId)] ||
        app.departmentId ||
        trackLabel;
      return { trackLabel, deptLabel };
    },
    [deptNameByKey],
  );

  const getRecommendingHeadLabel = useCallback(
    (app: Application) => {
      if (app.recommendedByName && app.recommendedByName.trim()) {
        return app.recommendedByName.trim();
      }
      if (app.recommendedBy) {
        return userNameById.get(app.recommendedBy) || 'Department Head';
      }
      return 'Department Head';
    },
    [userNameById],
  );

  const filtered = useMemo(
    () =>
      filterHeadRecommendedApplications(
        applications,
        {
          search: query,
          recommendation: recommendationFilter,
          departmentId: departmentFilter,
          status: statusFilter,
        },
        storeData.departments,
      ),
    [
      applications,
      departmentFilter,
      query,
      recommendationFilter,
      statusFilter,
      storeData.departments,
    ],
  );

  const counts = useMemo(() => {
    let acceptCount = 0;
    let rejectCount = 0;
    let pendingCount = 0;
    for (const app of applications) {
      if (app.headRecommendation === 'recommend_accept') acceptCount++;
      if (app.headRecommendation === 'recommend_reject') rejectCount++;
      if (app.status === 'pending') pendingCount++;
    }
    return {
      total: applications.length,
      acceptCount,
      rejectCount,
      pendingCount,
    };
  }, [applications]);

  const openId = selectedId ?? localSelectedId;
  const openApplication = useCallback(
    (id: string | null) => {
      if (onSelectApplication) {
        onSelectApplication(id);
      } else {
        setLocalSelectedId(id);
      }
    },
    [onSelectApplication],
  );

  const updateStatus = async (
    app: Application,
    next: 'accepted' | 'rejected' | 'waitlisted' | 'pending',
  ) => {
    if (!isAuthorizedAdmin || !currentUser) return;
    setBusyId(app.id);
    setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('willow-applications', {
      body: {
        action: 'update',
        id: app.id,
        status: next,
        review_notes: notes[app.id] ?? app.adminDecisionNotes ?? '',
      },
    });
    if (invokeError || data?.error) {
      const msg = data?.error || invokeError?.message || 'Could not update application decision.';
      setError(msg);
      pushToast({ tone: 'error', title: 'Update failed', description: msg });
    } else if (data?.application) {
      const mapped = mapLiveRowToApplication(
        data.application as LiveApplicationRow,
        currentUser,
        storeData.departments,
      );
      setApplications((prev) => prev.map((item) => (item.id === app.id ? mapped : item)));
      pushToast({
        tone: 'success',
        title: `Application marked ${next}`,
        description: mapped.applicantName,
      });
    }
    setBusyId('');
  };

  const handleConfirmOverride = async (
    applicationId: string,
    nextStatus: ApplicationStatus,
    reason: string,
  ): Promise<boolean> => {
    if (!currentUser) return false;
    setOverrideSaving(true);
    setError('');
    const ok = await overrideApplicationDecision(applicationId, nextStatus, reason, (updatedRow) => {
      const mapped = mapLiveRowToApplication(
        updatedRow,
        currentUser,
        storeData.departments,
      );
      setApplications((prev) => prev.map((item) => (item.id === applicationId ? mapped : item)));
      setNotes((prev) => ({
        ...prev,
        [applicationId]: mapped.adminDecisionNotes ?? reason,
      }));
    });
    setOverrideSaving(false);
    return ok;
  };

  if (!isAuthorizedAdmin) {
    return (
      <div
        role="alert"
        className="wm-surface-panel border-rose-400/35 bg-rose-500/[0.06] p-8 text-center"
      >
        <ShieldAlert className="mx-auto h-9 w-9 text-rose-300" aria-hidden="true" />
        <h2 className="mt-3 text-base font-semibold text-rose-100">Access Restricted</h2>
        <p className="mt-1.5 text-xs text-[color:var(--wm-ink-secondary)]">
          Only authorized Admin and Super Admin accounts can view cross-department Head recommendations.
        </p>
      </div>
    );
  }

  if (openId) {
    const active = applications.find((a) => a.id === openId) || null;
    const activeLabels = active ? getTrackAndDeptLabel(active) : null;

    return (
      <div className="wm-surface-panel p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => openApplication(null)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3.5 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Head Recommended
          </button>

          {active && (
            <div className="flex flex-wrap items-center gap-2">
              <RecommendationBadge decision={active.headRecommendation} />
              <StatusBadge status={active.status} />
              {canOverride && (
                <button
                  type="button"
                  onClick={() => setOverrideTarget(active)}
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-amber-400/45 bg-amber-500/15 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
                >
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Override</span>
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <WmSkeleton variant="dossier" />
        ) : error ? (
          <div
            role="alert"
            className="rounded-md border border-rose-400/35 bg-rose-500/10 p-4 text-sm text-rose-200 flex flex-wrap items-center justify-between gap-3"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded border border-rose-300/40 px-3 py-1 text-xs font-semibold hover:bg-rose-500/20 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : !active ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-sm font-medium text-[color:var(--wm-ink)]">
              Recommended application not found
            </p>
            <p className="text-xs text-[color:var(--wm-ink-muted)]">
              This record may not exist or does not currently have a Department Head recommendation.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-b border-[color:var(--wm-hairline)] pb-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-accent)]">
                {active.applicationCode} · {activeLabels?.trackLabel}
                {activeLabels && activeLabels.deptLabel !== activeLabels.trackLabel
                  ? ` · ${activeLabels.deptLabel}`
                  : ''}
                {active.gender ? ` · ${active.gender}` : ''}
              </p>
              <h2 className="wm-serif mt-1.5 text-2xl font-semibold text-[color:var(--wm-ink)]">
                {active.applicantName}
              </h2>
              <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                {active.email} · {active.position} · Recommended by{' '}
                <strong className="text-[color:var(--wm-ink)]">
                  {getRecommendingHeadLabel(active)}
                </strong>{' '}
                on {formatRecommendationDate(active)}
                {formatDecisionByLabel(active.status, active.finalDecisionBy)
                  ? ` · ${formatDecisionByLabel(active.status, active.finalDecisionBy)}`
                  : ''}
              </p>
            </div>

            <LiveApplicationDossierCard
              app={active}
              actor={currentUser}
              busy={busyId === active.id}
              notes={notes[active.id] ?? active.adminDecisionNotes ?? ''}
              setNotes={(v) => setNotes((n) => ({ ...n, [active.id]: v }))}
              onStatus={(next) => void updateStatus(active, next)}
            />
          </div>
        )}
        <OverrideDecisionModal
          application={overrideTarget}
          saving={overrideSaving}
          onClose={() => setOverrideTarget(null)}
          onConfirm={handleConfirmOverride}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="wm-surface-panel p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">
              Stage 2 Administrative Review
            </p>
            <h2 className="mt-1 text-base font-semibold text-[color:var(--wm-ink)]">
              Department Head Recommendations
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--wm-ink-secondary)]">
              Live cross-department queue of applicants recommended for acceptance or rejection by Department Heads.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3.5 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Total Recommended', counts.total],
            ['Recommend Accept', counts.acceptCount],
            ['Recommend Reject', counts.rejectCount],
            ['Pending Decision', counts.pendingCount],
          ].map(([label, val]) => (
            <div key={String(label)} className="wm-surface-inset px-4 py-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
                {label}
              </p>
              <p className="wm-serif mt-1 text-xl font-semibold tabular-nums text-[color:var(--wm-ink)]">
                {val}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search applicant, Head, email…"
              className="h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
            />
          </label>

          <select
            aria-label="Filter by Head recommendation"
            value={recommendationFilter}
            onChange={(e) =>
              setRecommendationFilter(
                e.target.value as 'all' | 'recommend_accept' | 'recommend_reject',
              )
            }
            className="h-10 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
          >
            <option value="all">All Recommendations</option>
            <option value="recommend_accept">Recommend Accept</option>
            <option value="recommend_reject">Recommend Reject</option>
          </select>

          <select
            aria-label="Filter by department"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="h-10 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
          >
            <option value="all">All Departments</option>
            {storeData.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by application status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | 'all')}
            className="h-10 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="waitlisted">Waitlisted</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-rose-400/35 bg-rose-500/10 p-4 text-sm text-rose-200 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-rose-300/40 px-3 py-1 text-xs font-semibold hover:bg-rose-500/20 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <WmSkeleton variant="table" rows={5} />
      ) : filtered.length === 0 ? (
        <div className="wm-surface-panel p-10 text-center">
          <ClipboardCheck className="mx-auto h-8 w-8 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-[color:var(--wm-ink)]">
            {applications.length === 0
              ? 'No Head recommendations submitted yet'
              : 'No recommended applicants match your active filters'}
          </p>
          <p className="mt-1 text-xs text-[color:var(--wm-ink-muted)]">
            {applications.length === 0
              ? 'Applicants recommended for acceptance or rejection by Department Heads will appear here automatically.'
              : 'Clear or adjust your search, department, recommendation, or status filters above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => {
            const { trackLabel, deptLabel } = getTrackAndDeptLabel(app);
            const headName = getRecommendingHeadLabel(app);
            const recDate = formatRecommendationDate(app);
            return (
              <article key={app.id} className="wm-surface-panel p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--wm-accent)]">
                        {trackLabel}
                        {deptLabel && deptLabel.toLowerCase() !== trackLabel.toLowerCase()
                          ? ` · ${deptLabel}`
                          : ''}
                      </span>
                      {app.gender && (
                        <span className="rounded border border-[color:var(--wm-hairline)] px-2 py-0.5 text-[10px] capitalize text-[color:var(--wm-ink-secondary)]">
                          {app.gender}
                        </span>
                      )}
                      <RecommendationBadge decision={app.headRecommendation} />
                      <StatusBadge status={app.status} />
                      {formatDecisionByLabel(app.status, app.finalDecisionBy) && (
                        <span className="rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-2 py-0.5 text-[11px] text-[color:var(--wm-ink-secondary)]">
                          {formatDecisionByLabel(app.status, app.finalDecisionBy)}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                        {app.applicantName}
                      </h3>
                      <p className="mt-0.5 text-xs text-[color:var(--wm-ink-secondary)]">
                        <span className="font-mono">{app.applicationCode}</span>
                        {app.email ? ` · ${app.email}` : ''}
                        {app.schoolOrUniversity ? ` · ${app.schoolOrUniversity}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[color:var(--wm-ink-muted)]">
                      <span className="inline-flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
                        <span>
                          Recommended by{' '}
                          <strong className="font-medium text-[color:var(--wm-ink-secondary)]">
                            {headName}
                          </strong>
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
                        <span>{recDate}</span>
                      </span>
                    </div>

                    {app.headNotes && (
                      <p className="border-l-2 border-[color:var(--wm-accent)]/60 pl-3 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
                        {app.headNotes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openApplication(app.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3.5 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
                      <span>Open Application</span>
                    </button>
                    {canOverride && (
                      <button
                        type="button"
                        data-testid={`override-btn-${app.id}`}
                        onClick={() => setOverrideTarget(app)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-400/45 bg-amber-500/15 px-3.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Override</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <OverrideDecisionModal
        application={overrideTarget}
        saving={overrideSaving}
        onClose={() => setOverrideTarget(null)}
        onConfirm={handleConfirmOverride}
      />
    </div>
  );
}
