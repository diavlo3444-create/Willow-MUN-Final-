import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { supabase } from '../../../lib/supabase';
import {
  WEBSITE_APPLICATION_FORMS,
  computeFormSubmissionCounts,
  findDepartmentForForm,
  type WebsiteApplicationFormDefinition,
} from '../../../services/applicationAvailabilityService';
import {
  mapLiveRowToApplication,
  type LiveApplicationRow,
} from '../../../services/liveBackendService';
import type { Application } from '../../../types/admin';
import { hasPermission } from '../../../utils/adminPermissions';

interface ApplicationManagementViewProps {
  onOpenApplications?: () => void;
}

export function ApplicationManagementView({
  onOpenApplications,
}: ApplicationManagementViewProps) {
  const { data, currentUser, testModeHeadUser, updateDepartment } = useAdminStore();
  const effectiveActor = testModeHeadUser ?? currentUser;
  const canToggle = hasPermission(
    effectiveActor,
    'departments.toggle_registration',
    data.departments,
  );

  const [liveApplications, setLiveApplications] = useState<Application[] | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null);
  const [liveDepartmentMeta, setLiveDepartmentMeta] = useState<
    Record<string, { id: string; registrationOpen: boolean; updatedAt?: string }>
  >({});

  const syncLiveState = useCallback(async () => {
    setRefreshing(true);
    setSyncError(null);

    try {
      const [{ data: deptRows, error: deptError }, appsResult] = await Promise.all([
        supabase
          .from('wm_departments')
          .select('id,slug,registration_open,updated_at')
          .in(
            'slug',
            WEBSITE_APPLICATION_FORMS.map((f) => f.departmentSlug),
          ),
        supabase.functions.invoke('willow-applications', {
          body: { action: 'list' },
        }),
      ]);

      if (deptError) {
        setSyncError(deptError.message);
      } else if (deptRows) {
        const nextMeta: Record<
          string,
          { id: string; registrationOpen: boolean; updatedAt?: string }
        > = {};
        for (const row of deptRows) {
          const slug = String(row.slug || '').trim().toLowerCase();
          if (!slug) continue;
          nextMeta[slug] = {
            id: String(row.id),
            registrationOpen: row.registration_open === true,
            updatedAt: row.updated_at ? String(row.updated_at) : undefined,
          };
        }
        setLiveDepartmentMeta(nextMeta);
      }

      if (!appsResult.error && !appsResult.data?.error && Array.isArray(appsResult.data?.applications)) {
        const mapped = (appsResult.data.applications as LiveApplicationRow[]).map((row) =>
          mapLiveRowToApplication(row, effectiveActor, data.departments),
        );
        setLiveApplications(mapped);
      }
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'Unable to refresh application availability.',
      );
    } finally {
      setCountsLoading(false);
      setRefreshing(false);
    }
  }, [effectiveActor, data.departments]);

  useEffect(() => {
    void syncLiveState();
  }, [syncLiveState]);

  const formRows = useMemo(() => {
    const applicationSource = liveApplications ?? data.applications;

    return WEBSITE_APPLICATION_FORMS.map((form) => {
      const storeDept = findDepartmentForForm(form, data.departments);
      const liveMeta = liveDepartmentMeta[form.departmentSlug];
      const departmentId = storeDept?.id ?? liveMeta?.id ?? null;
      const isOpen = storeDept
        ? storeDept.registrationOpen
        : liveMeta
          ? liveMeta.registrationOpen
          : false;
      const updatedAt = storeDept?.updatedAt ?? liveMeta?.updatedAt;
      const counts = computeFormSubmissionCounts(
        form,
        applicationSource,
        departmentId ?? undefined,
      );

      return {
        form,
        departmentId,
        isConnected: Boolean(departmentId),
        isOpen,
        updatedAt,
        counts,
      };
    });
  }, [data.applications, data.departments, liveApplications, liveDepartmentMeta]);

  const openCount = formRows.filter((r) => r.isOpen).length;
  const closedCount = formRows.length - openCount;

  const handleToggleForm = async (
    form: WebsiteApplicationFormDefinition,
    departmentId: string | null,
    currentOpen: boolean,
  ) => {
    if (!canToggle || !departmentId || togglingSlug) return;
    const nextOpen = !currentOpen;
    setTogglingSlug(form.departmentSlug);
    setSyncError(null);

    const storeDept = data.departments.find((d) => d.id === departmentId);
    if (storeDept) {
      const accepted = updateDepartment(departmentId, { registrationOpen: nextOpen });
      if (accepted) {
        setLiveDepartmentMeta((prev) => ({
          ...prev,
          [form.departmentSlug]: {
            id: departmentId,
            registrationOpen: nextOpen,
            updatedAt: new Date().toISOString(),
          },
        }));
      }
      window.setTimeout(() => {
        setTogglingSlug((current) => (current === form.departmentSlug ? null : current));
      }, 280);
      return;
    }

    const { data: updatedRow, error } = await supabase
      .from('wm_departments')
      .update({ registration_open: nextOpen, updated_at: new Date().toISOString() })
      .eq('id', departmentId)
      .select('id,registration_open,updated_at')
      .maybeSingle();

    if (error || !updatedRow) {
      setSyncError(
        error?.message || `Could not update ${form.title} availability in Supabase.`,
      );
    } else {
      setLiveDepartmentMeta((prev) => ({
        ...prev,
        [form.departmentSlug]: {
          id: String(updatedRow.id),
          registrationOpen: updatedRow.registration_open === true,
          updatedAt: updatedRow.updated_at ? String(updatedRow.updated_at) : undefined,
        },
      }));
    }
    setTogglingSlug(null);
  };

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <section className="flex flex-col gap-4 border-b border-[color:var(--wm-hairline)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[color:var(--wm-accent)]">
            Conference intake controls
          </p>
          <h1 className="wm-serif mt-2 text-3xl text-[color:var(--wm-ink)]">
            Application Management
          </h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
            Turn individual website application forms on or off. When an application is turned off,
            its public form immediately displays that applications are currently closed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href="/#apply"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3.5 text-xs font-medium text-[color:var(--wm-ink-secondary)] transition-colors hover:bg-[color:var(--wm-overlay)] hover:text-[color:var(--wm-ink)] whitespace-nowrap"
          >
            <span>View Public Page</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>

          <button
            type="button"
            onClick={() => void syncLiveState()}
            disabled={refreshing}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3.5 text-xs font-medium text-[color:var(--wm-focal)] transition-colors hover:bg-[color:var(--wm-overlay)] disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh Status</span>
          </button>
        </div>
      </section>

      {/* Summary Strip */}
      <section
        aria-label="Website application availability summary"
        className="wm-surface-panel overflow-hidden"
      >
        <div className="grid grid-cols-1 divide-y divide-[color:var(--wm-hairline)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-4">
            <p className="wm-section-kicker">Website Application Forms</p>
            <p className="wm-serif mt-2 text-3xl tabular-nums text-[color:var(--wm-ink)]">
              {formRows.length}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--wm-ink-muted)]">
              Media, Press, Volunteers &amp; Security
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="wm-section-kicker">Currently Open</p>
            <p className="wm-serif mt-2 text-3xl tabular-nums text-emerald-200">{openCount}</p>
            <p className="mt-1 text-[11px] text-[color:var(--wm-ink-muted)]">
              Accepting public submissions
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="wm-section-kicker">Currently Closed</p>
            <p className="wm-serif mt-2 text-3xl tabular-nums text-rose-200">{closedCount}</p>
            <p className="mt-1 text-[11px] text-[color:var(--wm-ink-muted)]">
              Public form displays closed notice
            </p>
          </div>
        </div>
      </section>

      {syncError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-rose-400/35 bg-rose-500/[0.08] px-4 py-3 text-xs text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{syncError}</span>
        </div>
      )}

      {/* Application Forms Grid */}
      <section aria-label="Manage application availability" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {formRows.map(({ form, departmentId, isConnected, isOpen, updatedAt, counts }) => {
          const isSaving = togglingSlug === form.departmentSlug;
          const toggleDisabled = !canToggle || !isConnected || isSaving;

          return (
            <article
              key={form.id}
              data-testid={`application-card-${form.id}`}
              className="wm-surface-panel flex flex-col justify-between overflow-hidden"
            >
              <div>
                <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 pb-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--wm-accent)] tabular-nums">
                      TRACK {form.index} · {form.wing}
                    </p>
                    <h2 className="wm-serif mt-1.5 text-2xl font-medium text-[color:var(--wm-ink)]">
                      {form.title}
                    </h2>
                  </div>

                  {/* ON / OFF Toggle + Status */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      data-testid={`application-status-${form.id}`}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${
                        isOpen
                          ? 'border-emerald-400/35 bg-emerald-500/[0.12] text-emerald-200'
                          : 'border-rose-400/35 bg-rose-500/[0.12] text-rose-200'
                      }`}
                    >
                      {isOpen ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>{isOpen ? 'Open' : 'Closed'}</span>
                    </span>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isOpen}
                      aria-label={`Toggle ${form.title} ${isOpen ? 'off' : 'on'}`}
                      data-testid={`application-toggle-${form.id}`}
                      disabled={toggleDisabled}
                      onClick={() => void handleToggleForm(form, departmentId, isOpen)}
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wm-focal)] ${
                        toggleDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                      } ${
                        isOpen
                          ? 'border-emerald-400/50 bg-[#2d6a4f]'
                          : 'border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)]'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-[#eef4ef] shadow-sm transition-transform duration-200 ${
                          isOpen ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="px-5 pb-4 space-y-2">
                  <p className="text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
                    {form.description}
                  </p>
                  <p className="text-[11px] text-[color:var(--wm-ink-muted)]">
                    Form structure: {form.requirementsSummary}
                  </p>
                </div>

                {/* Live Submission Counts Strip */}
                <div className="grid grid-cols-4 divide-x divide-[color:var(--wm-hairline)] border-y border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)]/60 text-center tabular-nums">
                  <div className="px-2 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
                      Submitted
                    </p>
                    <p className="mt-0.5 font-mono text-xs font-semibold text-[color:var(--wm-ink)]">
                      {countsLoading && liveApplications === null ? '—' : counts.total}
                    </p>
                  </div>
                  <div className="px-2 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
                      Pending
                    </p>
                    <p className="mt-0.5 font-mono text-xs font-semibold text-amber-200">
                      {countsLoading && liveApplications === null ? '—' : counts.pending}
                    </p>
                  </div>
                  <div className="px-2 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
                      Accepted
                    </p>
                    <p className="mt-0.5 font-mono text-xs font-semibold text-emerald-200">
                      {countsLoading && liveApplications === null ? '—' : counts.accepted}
                    </p>
                  </div>
                  <div className="px-2 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
                      Rejected
                    </p>
                    <p className="mt-0.5 font-mono text-xs font-semibold text-rose-200">
                      {countsLoading && liveApplications === null ? '—' : counts.rejected}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs">
                <div className="min-w-0 text-[11px] text-[color:var(--wm-ink-muted)]">
                  {!isConnected ? (
                    <span className="text-amber-200">
                      Department record not loaded from Supabase yet.
                    </span>
                  ) : isOpen ? (
                    <span>
                      Public website form is <strong className="text-emerald-200 font-medium">ON</strong> — accepting submissions.
                    </span>
                  ) : (
                    <span>
                      Public website form is <strong className="text-rose-200 font-medium">OFF</strong> — showing closed notice.
                    </span>
                  )}
                  {updatedAt && (
                    <span className="ml-2 font-mono text-[10px] text-[color:var(--wm-ink-muted)]/80 tabular-nums">
                      · Updated {new Date(updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {onOpenApplications && (
                  <button
                    type="button"
                    onClick={onOpenApplications}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] px-3 text-[11px] font-medium text-[color:var(--wm-ink)] transition-colors hover:bg-[color:var(--wm-overlay)] cursor-pointer whitespace-nowrap"
                  >
                    <FileText className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
                    <span>Review Submissions</span>
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
