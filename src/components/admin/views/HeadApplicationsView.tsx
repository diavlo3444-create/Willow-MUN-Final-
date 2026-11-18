import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Mail,
  Phone,
  RefreshCw,
  School,
  Search,
  ShieldAlert,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import {
  fetchScopedApplicationsForActor,
  submitHeadOrAdminDecision,
} from '../../../services/liveBackendService';
import type { AdminUser, Application } from '../../../types/admin';
import {
  canAccessApplication,
  canReviewFinalDecision,
  getActorDepartmentSlug,
  getActorGenderScope,
  normalizeDepartmentSlug,
} from '../../../utils/adminPermissions';
import { scopeApplicationsForActor } from '../../../utils/applicationFilters';
import { ApplicationAttachmentsViewer } from '../ApplicationAttachmentsViewer';
import { ConfirmDialog } from '../ConfirmDialog';
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
    updateApplicationStatus: updateLocalStatus,
  } = useAdminStore();

  const [liveApps, setLiveApps] = useState<Application[]>([]);
  const [source, setSource] = useState<'live' | 'table' | 'local'>('live');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [confirmDeclineApp, setConfirmDeclineApp] = useState<Application | null>(null);

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

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchScopedApplicationsForActor(effectiveHead, data.departments);
    setLiveApps(res.applications);
    setSource(res.source);
    if (res.error && res.applications.length === 0) {
      pushToast({ tone: 'error', title: 'Could not load applications', description: res.error });
    }
    setLoading(false);
  }, [effectiveHead, data.departments, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Combine live apps cleanly with any local store records only when live is empty/offline
  const scopedApps = useMemo(() => {
    const base =
      source !== 'local'
        ? liveApps
        : data.applications;
    return scopeApplicationsForActor(base, effectiveHead, data.departments).sort((a, b) =>
      b.submittedAt.localeCompare(a.submittedAt),
    );
  }, [source, liveApps, data.applications, data.departments, effectiveHead]);

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedApps.filter((app) => {
      if (statusFilter !== 'all' && app.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${app.applicantName} ${app.applicationCode} ${app.email} ${app.schoolOrUniversity} ${app.position}`.toLowerCase();
      return hay.includes(q);
    });
  }, [scopedApps, statusFilter, search]);

  const counts = useMemo(() => {
    let pending = 0;
    let accepted = 0;
    let rejected = 0;
    for (const app of scopedApps) {
      if (app.status === 'pending') pending++;
      else if (app.status === 'accepted') accepted++;
      else if (app.status === 'rejected') rejected++;
    }
    return { total: scopedApps.length, pending, accepted, rejected };
  }, [scopedApps]);

  const selectedApp = useMemo(() => {
    if (!selectedApplicationId) return null;
    return scopedApps.find((a) => a.id === selectedApplicationId) || null;
  }, [selectedApplicationId, scopedApps]);

  // Security guard: if head manually navigated to an application ID outside their dept/gender
  useEffect(() => {
    if (!loading && selectedApplicationId && !selectedApp) {
      recordSecurityViolation(
        'application',
        selectedApplicationId,
        `Department Head attempted access to application "${selectedApplicationId}" outside ${deptName} (${actorGender ?? 'unknown'}) division.`,
      );
    }
  }, [loading, selectedApplicationId, selectedApp, recordSecurityViolation, deptName, actorGender]);

  const handleDecision = async (app: Application, decision: 'accepted' | 'rejected') => {
    if (!canReviewFinalDecision(effectiveHead, app, data.departments)) {
      pushToast({
        tone: 'error',
        title: 'Access blocked',
        description: 'You may only review applicants assigned to your department and division.',
      });
      return;
    }

    setBusyId(app.id);
    const res = await submitHeadOrAdminDecision(effectiveHead, app.id, decision, undefined, data.departments);
    setBusyId(null);

    if (!res.ok) {
      pushToast({
        tone: 'error',
        title: 'Could not save decision',
        description: res.error || 'Please try again.',
      });
      return;
    }

    // Update live state smoothly
    if (res.application) {
      setLiveApps((prev) => prev.map((row) => (row.id === app.id ? res.application! : row)));
    } else if (source === 'local') {
      updateLocalStatus(app.id, decision);
    }

    pushToast({
      tone: 'success',
      title: decision === 'accepted' ? 'Applicant Accepted' : 'Applicant Declined',
      description:
        decision === 'accepted'
          ? `${app.applicantName} is now visible in HR Accepted Applicants and received a personal QR.`
          : `${app.applicantName} has been marked as declined.`,
    });
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
              <h2 className="text-base font-semibold text-rose-100">Application Outside Division Scope</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--wm-ink-secondary)]">
                This application record does not belong to {deptName} ({actorGender ?? 'assigned'} division) or does not exist. Cross-department and cross-gender isolation is strictly enforced.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedApp && canAccessApplication(effectiveHead, selectedApp, data.departments)) {
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
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              disabled={busy || selectedApp.status === 'accepted'}
              onClick={() => void handleDecision(selectedApp, 'accepted')}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] transition-colors hover:bg-[#357a5b] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {selectedApp.status === 'accepted' ? 'Accepted' : 'Accept Application'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              disabled={busy || selectedApp.status === 'rejected'}
              onClick={() => setConfirmDeclineApp(selectedApp)}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-md border border-rose-400/40 bg-rose-500/12 px-4 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-500/22 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              {selectedApp.status === 'rejected' ? 'Declined' : 'Decline Application'}
            </motion.button>
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
        </section>

        <ConfirmDialog
          open={Boolean(confirmDeclineApp)}
          tone="danger"
          title="Decline this application?"
          description={
            confirmDeclineApp
              ? `Mark ${confirmDeclineApp.applicantName}'s application for ${deptName} as Declined.`
              : ''
          }
          confirmLabel="Decline Application"
          cancelLabel="Cancel"
          onConfirm={() => {
            if (confirmDeclineApp) void handleDecision(confirmDeclineApp, 'rejected');
            setConfirmDeclineApp(null);
          }}
          onCancel={() => setConfirmDeclineApp(null)}
        />
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
              Open individual applications from your division to review details and accept or decline candidates.
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
              placeholder="Search applicant name, email, or school…"
              className="h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {([
              ['all', `All (${counts.total})`],
              ['pending', `Pending (${counts.pending})`],
              ['accepted', `Accepted (${counts.accepted})`],
              ['rejected', `Declined (${counts.rejected})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={[
                  'h-10 rounded-md border px-3 text-xs font-medium transition-colors',
                  statusFilter === key
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
            {filteredApps.map((app) => {
              const busy = busyId === app.id;
              return (
                <motion.article
                  key={app.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="wm-surface-panel flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:border-[color:var(--wm-hairline-strong)]"
                >
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
                    </div>
                    <h3 className="mt-1.5 truncate text-sm font-semibold text-[color:var(--wm-ink)] hover:text-[color:var(--wm-focal)]">
                      {app.applicantName}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-[color:var(--wm-ink-secondary)]">
                      {app.schoolOrUniversity || app.email} · Applied {new Date(app.submittedAt).toLocaleDateString()}
                    </p>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectApplication(app.id)}
                      className="inline-flex h-8 items-center rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-xs font-medium text-[color:var(--wm-ink)] transition-colors hover:bg-[color:var(--wm-overlay)]"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      disabled={busy || app.status === 'accepted'}
                      onClick={() => void handleDecision(app, 'accepted')}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[color:var(--wm-emerald)] px-3 text-xs font-semibold text-[#eef4ef] transition-colors hover:bg-[#357a5b] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busy || app.status === 'rejected'}
                      onClick={() => setConfirmDeclineApp(app)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-400/35 bg-rose-500/10 px-3 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Decline
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeclineApp)}
        tone="danger"
        title="Decline this application?"
        description={
          confirmDeclineApp
            ? `Mark ${confirmDeclineApp.applicantName}'s application for ${deptName} as Declined.`
            : ''
        }
        confirmLabel="Decline Application"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (confirmDeclineApp) void handleDecision(confirmDeclineApp, 'rejected');
          setConfirmDeclineApp(null);
        }}
        onCancel={() => setConfirmDeclineApp(null)}
      />
    </div>
  );
}
