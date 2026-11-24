import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  History,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { supabase } from '../../../lib/supabase';
import {
  fetchSpoofAssignableAdmins,
  fetchSpoofAuditLogs,
  mapLiveRowToApplication,
  type LiveApplicationRow,
} from '../../../services/liveBackendService';
import type { AdminUser, Application, ApplicationStatus } from '../../../types/admin';
import { canOverrideApplicationDecision } from '../../../utils/adminPermissions';
import {
  formatDecisionByLabel,
  selectAssignableAdminsFromStore,
  type AssignableAdminOption,
  type SpoofAuditEntry,
} from '../../../utils/decisionAttribution';
import { ApplicationAttachmentsViewer } from '../ApplicationAttachmentsViewer';
import { OverrideDecisionModal } from '../OverrideDecisionModal';
import { SpoofDecisionModal } from '../SpoofDecisionModal';
import { StatusBadge } from '../StatusBadge';
import { WmSkeleton } from '../WmSkeleton';

const labels: Record<string, string> = {
  volunteer: 'Volunteers',
  media: 'Media',
  press: 'Press',
  security: 'Security',
  delegate: 'Delegate',
  staff: 'Staff',
};

const SPOOF_STATUS_TABS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'waitlisted', label: 'Waitlisted' },
];

export function LiveApplicationsView({
  selectedId,
  externalSearch,
  onClose,
  spoofMode = false,
}: {
  selectedId?: string | null;
  externalSearch?: string;
  onClose?: () => void;
  spoofMode?: boolean;
}) {
  const {
    currentUser,
    authReady,
    testModeHeadUser,
    data: storeData,
    overrideApplicationDecision,
    spoofApplicationDecision,
  } = useAdminStore();
  const effectiveActor = testModeHeadUser ?? currentUser;
  const canOverride = canOverrideApplicationDecision(effectiveActor);

  const [rawRows, setRawRows] = useState<LiveApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(externalSearch ?? '');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [busyId, setBusyId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [overrideTarget, setOverrideTarget] = useState<Application | null>(null);
  const [overrideSaving, setOverrideSaving] = useState(false);

  // Spoof-mode specific state (strictly Super Admin)
  const [spoofTab, setSpoofTab] = useState<'applicants' | 'audit'>('applicants');
  const [spoofTarget, setSpoofTarget] = useState<Application | null>(null);
  const [spoofSaving, setSpoofSaving] = useState(false);
  const [assignableAdmins, setAssignableAdmins] = useState<AssignableAdminOption[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [auditEntries, setAuditEntries] = useState<SpoofAuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState('');

  useEffect(() => {
    if (externalSearch !== undefined) {
      setQuery(externalSearch);
    }
  }, [externalSearch]);

  const loadSpoofMeta = useCallback(async () => {
    if (!spoofMode || !canOverride) return;
    setLoadingAdmins(true);
    setLoadingAudit(true);
    setAuditError('');

    const [adminsRes, auditRes] = await Promise.all([
      fetchSpoofAssignableAdmins(),
      fetchSpoofAuditLogs(),
    ]);

    if (adminsRes.admins.length > 0) {
      setAssignableAdmins(adminsRes.admins);
    } else {
      const storeAdmins = selectAssignableAdminsFromStore(storeData.users);
      setAssignableAdmins(storeAdmins);
    }
    setLoadingAdmins(false);

    if (auditRes.error) {
      setAuditError(auditRes.error);
    } else {
      setAuditEntries(auditRes.entries);
    }
    setLoadingAudit(false);
  }, [canOverride, spoofMode, storeData.users]);

  const load = useCallback(async () => {
    if (!authReady) return;
    setLoading(true);
    setError('');

    // Wait for Supabase auth hydration before calling the protected Edge Function.
    // On a cold page load, invoking too early can send the publishable API key
    // without the user's access token and produce a 401/local-data fallback.
    let { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    let session = sessionData.session;
    if (!session?.access_token) {
      const refreshed = await supabase.auth.refreshSession();
      sessionError = refreshed.error ?? sessionError;
      session = refreshed.data.session;
    }

    if (!session?.access_token) {
      setError(
        sessionError?.message ||
          'Your login session could not be restored. Sign out and sign in again.',
      );
      setLoading(false);
      return;
    }

    const invokeList = () =>
      supabase.functions.invoke('willow-applications', {
        body: { action: 'list' },
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
    let result = await invokeList();

    // A token can expire between session restoration and the request. Refresh once.
    if (result.error && /401|unauthorized|invalid.*session|expired/i.test(result.error.message || '')) {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.data.session?.access_token) {
        session = refreshed.data.session;
        result = await invokeList();
      }
    }

    if (result.error || result.data?.error) {
      setError(result.data?.error || result.error?.message || 'Could not load applications.');
    } else {
      setRawRows((result.data?.applications || []) as LiveApplicationRow[]);
    }
    setLoading(false);
  }, [authReady]);

  useEffect(() => {
    if (authReady) {
      void load();
      if (spoofMode && canOverride) {
        void loadSpoofMeta();
      }
    }
  }, [authReady, canOverride, load, loadSpoofMeta, spoofMode]);

  const applications = useMemo(
    () =>
      rawRows.map((row) =>
        mapLiveRowToApplication(row, effectiveActor, storeData.departments),
      ),
    [rawRows, effectiveActor, storeData.departments],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: applications.length,
      pending: 0,
      accepted: 0,
      rejected: 0,
      waitlisted: 0,
    };
    for (const app of applications) {
      if (app.status in counts) counts[app.status] += 1;
    }
    return counts;
  }, [applications]);

  const filtered = useMemo(
    () =>
      applications.filter((app) => {
        const q = query.trim().toLowerCase();
        const appType = (app.applicationType || app.category || '').toLowerCase();
        return (
          (type === 'all' || appType === type) &&
          (status === 'all' || app.status === status) &&
          (!q ||
            [
              app.applicantName,
              app.applicationCode,
              app.email,
              app.phone,
              app.guardianPhone || '',
              app.schoolOrUniversity,
              app.gradeOrYear,
              app.cameraModel || '',
              app.finalDecisionBy || '',
            ]
              .join(' ')
              .toLowerCase()
              .includes(q))
        );
      }),
    [applications, query, type, status],
  );

  const updateStatus = async (
    app: Application,
    next: 'accepted' | 'rejected' | 'waitlisted' | 'pending',
  ) => {
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
      setError(data?.error || invokeError?.message || 'Could not update application.');
    } else if (data?.application) {
      setRawRows((current) =>
        current.map((item) =>
          item.id === app.id ? (data.application as LiveApplicationRow) : item,
        ),
      );
    }
    setBusyId('');
  };

  const handleConfirmOverride = async (
    applicationId: string,
    nextStatus: ApplicationStatus,
    reason: string,
  ): Promise<boolean> => {
    setOverrideSaving(true);
    setError('');
    const ok = await overrideApplicationDecision(applicationId, nextStatus, reason, (updatedRow) => {
      setRawRows((current) =>
        current.map((item) => (item.id === applicationId ? updatedRow : item)),
      );
      setNotes((prev) => ({
        ...prev,
        [applicationId]: updatedRow.admin_decision_notes ?? updatedRow.review_notes ?? reason,
      }));
    });
    setOverrideSaving(false);
    return ok;
  };

  const handleConfirmSpoof = async (input: {
    applicationId: string;
    status: ApplicationStatus;
    attributedAdminId: string;
    reason: string;
  }): Promise<boolean> => {
    setSpoofSaving(true);
    setError('');
    const ok = await spoofApplicationDecision({
      applicationId: input.applicationId,
      status: input.status,
      attributedAdminId: input.attributedAdminId,
      reason: input.reason,
      onUpdated: (updatedRow) => {
        setRawRows((current) =>
          current.map((item) => (item.id === input.applicationId ? updatedRow : item)),
        );
      },
    });
    setSpoofSaving(false);
    if (ok) {
      void loadSpoofMeta();
    }
    return ok;
  };

  const deleteApplication = async (app: Application) => {
    if (effectiveActor?.role !== 'super_admin') return;
    if (
      !window.confirm(
        'Permanently delete this applicant and their application, medical record, signup invite, QR pass, and uploaded files when cleanup succeeds? This cannot be undone.',
      )
    )
      return;
    setDeletingId(app.id);
    const { data, error: invokeError } = await supabase.functions.invoke('willow-applications', {
      body: { action: 'delete', id: app.id },
    });
    setDeletingId('');
    if (invokeError || data?.error) {
      setError(data?.error || invokeError?.message || 'Could not delete application.');
      return;
    }
    if (data?.storage_cleanup_warning)
      setError(
        'Application deleted, but uploaded-file cleanup needs attention: ' +
          data.storage_cleanup_warning,
      );
    setRawRows((rows) => rows.filter((row) => row.id !== app.id));
    if (selectedId === app.id) onClose?.();
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const active = selectedId ? applications.find((app) => app.id === selectedId) : null;
  if (selectedId) {
    return (
      <div className="wm-surface-panel p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[color:var(--wm-accent)] underline cursor-pointer"
          >
            ← Back to applications
          </button>
          {active && canOverride && (
            <button
              type="button"
              onClick={() => setOverrideTarget(active)}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded border border-amber-400/45 bg-amber-500/15 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
            >
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Override</span>
            </button>
          )}
        </div>
        {loading ? (
          <WmSkeleton variant="dossier" />
        ) : !active ? (
          <p className="text-sm text-[color:var(--wm-ink-secondary)]">Application not found.</p>
        ) : (
          <LiveApplicationDossierCard
            app={active}
            actor={effectiveActor}
            busy={busyId === active.id}
            notes={notes[active.id] ?? active.adminDecisionNotes ?? ''}
            setNotes={(v) => setNotes((n) => ({ ...n, [active.id]: v }))}
            onStatus={(v) => void updateStatus(active, v)}
          />
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-300">
            {error}
          </p>
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
      <div className="wm-surface-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
              {spoofMode ? 'Spoof — Decision Attribution' : 'Staff & Organizing Team Applications'}
            </h2>
            <p className="mt-1 text-xs text-[color:var(--wm-ink-muted)]">
              {spoofMode
                ? 'Change any Accepted, Rejected, Pending, or Waitlisted decision and attribute it to an existing Admin without sending automated emails.'
                : `${applications.length} submissions · Media, Press, Volunteers, Security`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {spoofMode && canOverride && (
              <div className="inline-flex rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-0.5">
                <button
                  type="button"
                  onClick={() => setSpoofTab('applicants')}
                  className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium cursor-pointer ${
                    spoofTab === 'applicants'
                      ? 'bg-amber-500/20 text-amber-200'
                      : 'text-[color:var(--wm-ink-muted)] hover:text-[color:var(--wm-ink)]'
                  }`}
                >
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Applicants ({applications.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSpoofTab('audit');
                    void loadSpoofMeta();
                  }}
                  className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium cursor-pointer ${
                    spoofTab === 'audit'
                      ? 'bg-amber-500/20 text-amber-200'
                      : 'text-[color:var(--wm-ink-muted)] hover:text-[color:var(--wm-ink)]'
                  }`}
                >
                  <History className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Private Audit Log</span>
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                void load();
                if (spoofMode && canOverride) void loadSpoofMeta();
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Refresh
            </button>
          </div>
        </div>

        {(!spoofMode || spoofTab === 'applicants') && (
          <>
            {spoofMode && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {SPOOF_STATUS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatus(tab.id)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      status === tab.id
                        ? 'border-amber-400/50 bg-amber-500/15 text-amber-100'
                        : 'border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                    }`}
                  >
                    {tab.label} ({statusCounts[tab.id] ?? 0})
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <label className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, email, school, Admin…"
                  className="h-10 w-full rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)]"
                />
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                aria-label="Filter by application track"
                className="h-10 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
              >
                <option value="all">All application tracks</option>
                <option value="media">Media</option>
                <option value="press">Press</option>
                <option value="volunteer">Volunteers</option>
                <option value="security">Security</option>
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Filter by status"
                className="h-10 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="waitlisted">Waitlisted</option>
              </select>
            </div>
          </>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200"
        >
          {error}
        </p>
      )}

      {spoofMode && spoofTab === 'audit' ? (
        <div className="wm-surface-panel overflow-hidden">
          <div className="border-b border-[color:var(--wm-hairline)] px-4 py-3">
            <h3 className="text-xs font-semibold text-[color:var(--wm-ink)]">
              Private Super Admin Spoof Audit Log
            </h3>
            <p className="mt-0.5 text-[11px] text-[color:var(--wm-ink-muted)]">
              Visible exclusively to Super Admin accounts. Records who performed each spoof and which Admin attribution is shown publicly.
            </p>
          </div>
          {auditError && (
            <p role="alert" className="p-4 text-xs text-rose-300">
              {auditError}
            </p>
          )}
          {loadingAudit ? (
            <div className="p-4">
              <WmSkeleton variant="table" rows={4} />
            </div>
          ) : auditEntries.length === 0 ? (
            <p className="p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">
              No spoof actions have been recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
                  <tr>
                    <th className="px-4 py-2.5">Applicant</th>
                    <th className="px-4 py-2.5">Change</th>
                    <th className="px-4 py-2.5">Shown Attribution</th>
                    <th className="px-4 py-2.5">Actual Super Admin</th>
                    <th className="px-4 py-2.5">Note</th>
                    <th className="px-4 py-2.5 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--wm-hairline)]">
                  {auditEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[color:var(--wm-inset)]/50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[color:var(--wm-ink)]">
                          {entry.applicant_name}
                        </p>
                        {entry.application_code && (
                          <p className="font-mono text-[10px] text-[color:var(--wm-ink-muted)]">
                            {entry.application_code}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize text-[color:var(--wm-ink-secondary)]">
                        {entry.previous_status} →{' '}
                        <strong className="text-[color:var(--wm-ink)]">{entry.new_status}</strong>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--wm-ink)]">
                        {entry.spoofed_decision_by_name || 'Cleared (Pending)'}
                      </td>
                      <td className="px-4 py-3 text-amber-200">
                        {entry.actor_name || 'Super Admin'}
                      </td>
                      <td className="px-4 py-3 text-[color:var(--wm-ink-secondary)]">
                        {entry.reason}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[11px] text-[color:var(--wm-ink-muted)] whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : loading ? (
        <WmSkeleton variant="table" rows={5} />
      ) : filtered.length === 0 ? (
        <div className="wm-surface-panel p-10 text-center text-sm text-[color:var(--wm-ink-muted)]">
          No applications found.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => {
            const trackKey = (app.applicationType || app.category || '').toLowerCase();
            const isExpanded = Boolean(expandedIds[app.id]);
            const decisionLabel = formatDecisionByLabel(app.status, app.finalDecisionBy);
            return (
              <article key={app.id} className="wm-surface-panel p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-2 py-1 text-[10px] uppercase tracking-wide text-[color:var(--wm-accent)]">
                        {labels[trackKey] || app.category}
                      </span>
                      {app.gender && (
                        <span className="rounded border border-[color:var(--wm-hairline)] px-2 py-1 text-[10px] capitalize text-[color:var(--wm-ink-secondary)]">
                          {app.gender}
                        </span>
                      )}
                      {app.documents.length > 0 && (
                        <span className="rounded border border-[color:var(--wm-hairline)] px-2 py-1 text-[10px] font-mono text-[color:var(--wm-ink-muted)]">
                          {app.documents.length} file{app.documents.length === 1 ? '' : 's'}
                        </span>
                      )}
                      <StatusBadge status={app.status} />
                      {decisionLabel && (
                        <span className="inline-flex items-center gap-1 rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-2 py-0.5 text-[11px] text-[color:var(--wm-ink-secondary)]">
                          <UserCheck className="h-3 w-3 text-[color:var(--wm-accent)]" aria-hidden="true" />
                          <span>{decisionLabel}</span>
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-[color:var(--wm-ink)]">
                      {app.applicantName}
                    </h3>
                    <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                      {app.email} · {app.phone}
                      {app.guardianPhone ? ` · Guardian: ${app.guardianPhone}` : ''}
                      {app.schoolOrUniversity ? ` · ${app.schoolOrUniversity}` : ''}
                      {app.gradeOrYear ? ` (${app.gradeOrYear})` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-[color:var(--wm-ink-muted)]">
                      {new Date(app.submittedAt).toLocaleString()}
                    </span>
                    {spoofMode && canOverride && (
                      <button
                        type="button"
                        data-testid={`spoof-btn-${app.id}`}
                        onClick={() => setSpoofTarget(app)}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded border border-amber-400/45 bg-amber-500/15 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Spoof</span>
                      </button>
                    )}
                    {effectiveActor?.role === 'super_admin' && (
                      <button
                        type="button"
                        disabled={busyId === app.id || deletingId === app.id}
                        onClick={() => void deleteApplication(app)}
                        aria-label="Delete applicant"
                        title="Permanently delete applicant"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-400/35 text-rose-200 hover:bg-rose-500/15 disabled:opacity-40 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                {app.experienceLevel && (
                  <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-[color:var(--wm-ink-secondary)]">
                    {app.experienceLevel}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpanded(app.id)}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
                    <span>{isExpanded ? 'Hide dossier' : 'Open'}</span>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
                    )}
                  </button>

                  {!spoofMode && canOverride && (
                    <button
                      type="button"
                      data-testid={`override-btn-${app.id}`}
                      onClick={() => setOverrideTarget(app)}
                      className="inline-flex min-h-[34px] items-center gap-1.5 rounded border border-amber-400/45 bg-amber-500/15 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Override</span>
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <LiveApplicationDossierCard
                    app={app}
                    actor={effectiveActor}
                    busy={busyId === app.id}
                    notes={notes[app.id] ?? app.adminDecisionNotes ?? ''}
                    setNotes={(v) => setNotes((n) => ({ ...n, [app.id]: v }))}
                    onStatus={(v) => void updateStatus(app, v)}
                  />
                )}
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

      {spoofMode && canOverride && (
        <SpoofDecisionModal
          application={spoofTarget}
          assignableAdmins={assignableAdmins}
          loadingAdmins={loadingAdmins}
          saving={spoofSaving}
          onClose={() => setSpoofTarget(null)}
          onConfirm={handleConfirmSpoof}
        />
      )}
    </div>
  );
}

export function LiveApplicationDossierCard({
  app,
  actor,
  busy,
  notes,
  setNotes,
  onStatus,
}: {
  app: Application;
  actor: AdminUser | null | undefined;
  busy: boolean;
  notes: string;
  setNotes: (value: string) => void;
  onStatus: (status: 'accepted' | 'rejected' | 'waitlisted' | 'pending') => void;
}) {
  const decisionLabel = formatDecisionByLabel(app.status, app.finalDecisionBy);
  return (
    <div className="mt-4 space-y-4 text-xs text-[color:var(--wm-ink-secondary)]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 wm-surface-inset p-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
            School &amp; Grade
          </span>
          <p className="mt-0.5 text-[color:var(--wm-ink)]">
            {app.schoolOrUniversity || '—'}
            {app.gradeOrYear ? ` · ${app.gradeOrYear}` : ''}
            {app.age ? ` (Age ${app.age})` : ''}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
            Phone &amp; Guardian
          </span>
          <p className="mt-0.5 font-mono text-[11px] text-[color:var(--wm-ink)]">
            {app.phone || '—'}
            {app.guardianPhone ? ` / Guardian: ${app.guardianPhone}` : ''}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
            Conference Attendance (Mar 18–20)
          </span>
          <p className="mt-0.5 text-[color:var(--wm-ink)]">
            {app.attendsAllDays === true
              ? 'Yes — all 3 days (March 18, 19 & 20, 2027)'
              : app.attendsAllDays === false
                ? `Conflict: ${app.absenceReason || 'See notes'}`
                : 'See responses'}
          </p>
        </div>
      </div>

      {/* Role Responses */}
      {app.answers.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
            Submitted Responses
          </p>
          {app.answers.map((ans) => (
            <div key={ans.questionId} className="wm-surface-inset p-3.5">
              <p className="text-[11px] font-semibold text-[color:var(--wm-focal)]">{ans.label}</p>
              {/^https?:\/\//i.test(ans.answer) ? (
                <a
                  href={ans.answer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 text-xs text-[color:var(--wm-accent)] underline"
                >
                  {ans.answer}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              ) : (
                <p className="mt-1 whitespace-pre-wrap leading-relaxed text-[color:var(--wm-ink-secondary)]">
                  {ans.answer}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] p-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
          Department Head Recommendation
        </p>
        <p className="mt-2 font-semibold text-[color:var(--wm-ink)]">
          {app.headRecommendation === 'recommend_accept'
            ? 'Recommend acceptance'
            : app.headRecommendation === 'recommend_reject'
              ? 'Recommend rejection'
              : 'No recommendation submitted'}
        </p>
        <p className="mt-1 text-[11px] text-[color:var(--wm-ink-muted)]">
          {app.recommendedByName || 'No recommending Head recorded'}
          {app.recommendedAt ? ' · ' + new Date(app.recommendedAt).toLocaleString() : ''}
        </p>
        {app.headNotes && (
          <p className="mt-3 whitespace-pre-wrap leading-relaxed text-[color:var(--wm-ink-secondary)]">
            {app.headNotes}
          </p>
        )}
      </div>

      {decisionLabel && (
        <div className="rounded-lg border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] p-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
            Final Administrative Decision
          </p>
          <p className="mt-1.5 font-semibold text-[color:var(--wm-ink)]">{decisionLabel}</p>
          {app.finalDecisionAt && (
            <p className="mt-1 text-[11px] text-[color:var(--wm-ink-muted)]">
              {new Date(app.finalDecisionAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Attachments, Photography Lightbox, & Restricted Medical Disclosure */}
      <ApplicationAttachmentsViewer application={app} actor={actor} />

      <div>
        <strong>Admin final-decision notes</strong>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] p-3 text-xs text-[color:var(--wm-ink)]"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {(['accepted', 'rejected', 'waitlisted', 'pending'] as const).map((next) => (
          <button
            type="button"
            key={next}
            disabled={busy}
            onClick={() => onStatus(next)}
            className={`rounded-md px-3 py-2 text-xs capitalize cursor-pointer ${
              next === 'accepted'
                ? 'bg-[color:var(--wm-emerald)] text-[#eef4ef]'
                : next === 'rejected'
                  ? 'border border-rose-400/35 bg-rose-500/15 text-rose-200'
                  : 'border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] text-[color:var(--wm-ink)]'
            } disabled:opacity-50`}
          >
            {busy ? 'Saving…' : next}
          </button>
        ))}
      </div>
    </div>
  );
}
