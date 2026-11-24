import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Mail,
  Phone,
  RefreshCw,
  School,
  Search,
  Users,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { fetchHrAcceptedApplications, createHrApplicantSignupInvite } from '../../../services/liveBackendService';
import type { AdminUser, Application } from '../../../types/admin';
import { isHrActor, normalizeDepartmentSlug } from '../../../utils/adminPermissions';
import { scopeAcceptedApplicationsForHr } from '../../../utils/applicationFilters';
import { formatDecisionByLabel } from '../../../utils/decisionAttribution';
import { ApplicationAttachmentsViewer } from '../ApplicationAttachmentsViewer';
import { StatusBadge } from '../StatusBadge';
import { WmSkeleton } from '../WmSkeleton';

export function HrAcceptedApplicantsView({
  actingUserOverride = null,
}: {
  actingUserOverride?: AdminUser | null;
}) {
  const { currentUser, testModeHeadUser, data, pushToast } = useAdminStore();
  const actor = actingUserOverride ?? testModeHeadUser ?? currentUser;

  const [liveAccepted, setLiveAccepted] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [draftingInviteFor, setDraftingInviteFor] = useState<string | null>(null);

  const hrAuthorized = isHrActor(actor, data.departments);

  const draftAcceptanceEmail = useCallback(async (app: Application) => {
    if (!app.email) {
      pushToast({ tone: 'error', title: 'Applicant email missing', description: 'This application does not contain an email address.' });
      return;
    }
    const popup = window.open('', '_blank');
    if (!popup) {
      pushToast({ tone: 'warning', title: 'Popup blocked', description: 'Allow popups to open Gmail with the acceptance draft.' });
      return;
    }
    setDraftingInviteFor(app.id);
    const invite = await createHrApplicantSignupInvite(app.id);
    setDraftingInviteFor(null);
    if (!invite.url) {
      popup.close();
      pushToast({ tone: 'error', title: 'Signup link failed', description: invite.error || 'Could not generate a permanent signup link.' });
      return;
    }
    const subject = 'Willow MUN — Application Accepted';
    const body = `Hello ${app.applicantName},

Congratulations! Your application to Willow MUN has been accepted for ${app.position || 'your assigned team'}.

Create your account using your personal signup link:
${invite.url}

This link does not expire, but it can only be used once. After creating your account, sign in to your assigned Willow MUN dashboard.

Welcome to Willow MUN.

Human Resources
Willow MUN`;
    const composeUrl = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(app.email) + '&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    popup.location.href = composeUrl;
  }, [pushToast]);

  const load = useCallback(async () => {
    if (!hrAuthorized) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetchHrAcceptedApplications(actor, data.departments);
    setLiveAccepted(res.applications);
    if (res.error && res.applications.length === 0) {
      pushToast({ tone: 'error', title: 'Could not load HR accepted roster', description: res.error });
    }
    setLoading(false);
  }, [actor, data.departments, hrAuthorized, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const combinedAccepted = useMemo(() => {
    const map = new Map<string, Application>();
    for (const app of data.applications) {
      if (app.status === 'accepted') map.set(app.id, app);
    }
    for (const app of liveAccepted) {
      map.set(app.id, app);
    }
    return Array.from(map.values());
  }, [data.applications, liveAccepted]);

  const filtered = useMemo(
    () =>
      scopeAcceptedApplicationsForHr(
        combinedAccepted,
        actor,
        {
          search,
          departmentId: departmentFilter,
          gender: genderFilter,
        },
        data.departments,
      ),
    [combinedAccepted, actor, search, departmentFilter, genderFilter, data.departments],
  );

  const deptNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of data.departments) {
      map.set(d.id, d.name);
      map.set(d.slug, d.name);
      map.set(normalizeDepartmentSlug(d.slug), d.name);
    }
    return map;
  }, [data.departments]);

  const stats = useMemo(() => {
    const all = scopeAcceptedApplicationsForHr(combinedAccepted, actor, undefined, data.departments);
    const female = all.filter((a) => (a.gender || '').toLowerCase() === 'female').length;
    const male = all.filter((a) => (a.gender || '').toLowerCase() === 'male').length;
    const departmentsCount = new Set(all.map((a) => normalizeDepartmentSlug(a.departmentId) || a.departmentId)).size;
    return { total: all.length, female, male, departmentsCount };
  }, [combinedAccepted, actor, data.departments]);

  if (!hrAuthorized) {
    return (
      <div className="wm-surface-panel p-8 text-center">
        <p className="text-sm font-semibold text-rose-200">HR Access Required</p>
        <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
          This directory is restricted to Human Resources and Administration.
        </p>
      </div>
    );
  }

  if (selectedApp) {
    const deptLabel = deptNameById.get(selectedApp.departmentId) || selectedApp.departmentId;
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedApp(null)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] px-3.5 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-inset)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Accepted Applicants
          </button>
          <StatusBadge status={selectedApp.status} />
        </div>

        <section className="wm-surface-panel p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--wm-hairline)] pb-5">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">
                {selectedApp.applicationCode} · {deptLabel}
                {selectedApp.gender ? ` · ${selectedApp.gender}` : ''}
              </p>
              <h2 className="wm-serif mt-2 text-2xl font-semibold text-[color:var(--wm-ink)]">
                {selectedApp.applicantName}
              </h2>
              <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                {selectedApp.position} · Accepted{' '}
                {selectedApp.finalDecisionAt
                  ? new Date(selectedApp.finalDecisionAt).toLocaleString()
                  : new Date(selectedApp.submittedAt).toLocaleString()}
                {selectedApp.finalDecisionBy ? ` by ${selectedApp.finalDecisionBy}` : ''}
              </p>
            </div>
            <StatusBadge status="accepted" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="wm-surface-inset flex items-start gap-2.5 p-3.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">Email</p>
                {selectedApp.email ? (
                  <button type="button" onClick={() => void draftAcceptanceEmail(selectedApp)} disabled={draftingInviteFor === selectedApp.id}
                    className="mt-0.5 truncate text-left text-xs text-[color:var(--wm-accent)] underline disabled:opacity-60">
                    {draftingInviteFor === selectedApp.id ? 'Generating permanent signup link…' : selectedApp.email}
                  </button>
                ) : <p className="mt-0.5 text-xs text-[color:var(--wm-ink)]">—</p>}
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
              Submitted Application Record
            </h3>
            {selectedApp.answers.length === 0 ? (
              <p className="text-xs text-[color:var(--wm-ink-muted)]">No written responses attached.</p>
            ) : (
              selectedApp.answers.map((ans) => (
                <div key={ans.questionId} className="wm-surface-inset p-4">
                  <p className="text-[11px] font-semibold text-[color:var(--wm-focal)]">{ans.label}</p>
                  {/^https?:\/\//i.test(ans.answer) ? (
                    <a
                      href={ans.answer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[color:var(--wm-accent)] underline"
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
              Attachments &amp; Privacy Notice
            </h3>
            <ApplicationAttachmentsViewer
              application={selectedApp}
              actor={actor}
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
              Human Resources · Cross-Department Roster
            </p>
            <h1 className="wm-serif mt-1.5 text-2xl font-semibold text-[color:var(--wm-ink)]">
              Accepted Applicants
            </h1>
            <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
              Live directory of every applicant accepted by any Department Head across all departments and gender divisions.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3.5 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            ['Total Accepted', stats.total],
            ['Female Division', stats.female],
            ['Male Division', stats.male],
            ['Departments', stats.departmentsCount],
          ].map(([label, val]) => (
            <div key={String(label)} className="wm-surface-inset px-4 py-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">{label}</p>
              <p className="wm-serif mt-1 text-xl font-semibold text-[color:var(--wm-ink)]">{val}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <label className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accepted applicant name…"
              className="h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
            />
          </label>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            aria-label="Filter by department"
            className="h-10 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
          >
            <option value="all">All Departments</option>
            {data.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value as 'all' | 'female' | 'male')}
            aria-label="Filter by gender"
            className="h-10 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
          >
            <option value="all">All Genders</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </div>
      </section>

      {loading ? (
        <WmSkeleton variant="table" rows={5} />
      ) : filtered.length === 0 ? (
        <div className="wm-surface-panel p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-[color:var(--wm-ink)]">No accepted applicants found</p>
          <p className="mt-1 text-xs text-[color:var(--wm-ink-muted)]">
            Accepted applicants appear here automatically as Department Heads approve submissions.
          </p>
        </div>
      ) : (
        <div className="wm-surface-panel overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Division</th>
                <th className="px-4 py-3">Institution</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--wm-hairline)]">
              {filtered.map((app) => (
                <tr key={app.id} className="transition-colors hover:bg-[color:var(--wm-inset)]/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[color:var(--wm-ink)]">{app.applicantName}</p>
                    <button type="button" onClick={() => void draftAcceptanceEmail(app)} disabled={draftingInviteFor === app.id}
                      className="mt-0.5 block max-w-full truncate text-left text-[11px] text-[color:var(--wm-accent)] underline disabled:opacity-60">
                      {draftingInviteFor === app.id ? 'Generating signup link…' : app.email}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--wm-ink-secondary)]">
                    {deptNameById.get(app.departmentId) || app.departmentId}
                  </td>
                  <td className="px-4 py-3 capitalize text-[color:var(--wm-ink-secondary)]">
                    {app.gender || '—'}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--wm-ink-secondary)]">
                    {app.schoolOrUniversity || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Accepted
                    </span>
                    {formatDecisionByLabel(app.status, app.finalDecisionBy) && (
                      <p className="mt-1 text-[11px] text-[color:var(--wm-ink-muted)]">
                        {formatDecisionByLabel(app.status, app.finalDecisionBy)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedApp(app)}
                      className="rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-1.5 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)]"
                    >
                      View Record
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
