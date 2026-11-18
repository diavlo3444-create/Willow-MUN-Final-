import { useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  Lock,
  RefreshCw,
  RotateCcw,
  Server,
  Settings,
  Unlock,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type { ApplicationCategory } from '../../../types/admin';
import { hasPermission } from '../../../utils/adminPermissions';
import {
  computeApplicationStats,
  computeDepartmentBreakdown,
  exportApplicationsToCsv,
} from '../../../utils/applicationFilters';
import { ConfirmDialog } from '../ConfirmDialog';
import { DepartmentDistributionChart } from '../SimpleCharts';
import { HealthBadge, StatusBadge } from '../StatusBadge';

function downloadCsvFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// =====================================================================
// 1. STATISTICS & REPORTS VIEW (with 4 CSV Exports)
// =====================================================================

export function ReportsStatisticsView() {
  const { data, currentUser } = useAdminStore();
  const canExport = hasPermission(currentUser, 'reports.export');

  const [deptFilter, setDeptFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<ApplicationCategory | 'all'>('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const filteredApps = useMemo(() => {
    return data.applications.filter((a) => {
      if (deptFilter !== 'all' && a.departmentId !== deptFilter) return false;
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
      const day = a.submittedAt.slice(0, 10);
      if (dateStart && day < dateStart) return false;
      if (dateEnd && day > dateEnd) return false;
      return true;
    });
  }, [categoryFilter, data.applications, dateEnd, dateStart, deptFilter]);

  const stats = useMemo(() => computeApplicationStats(filteredApps), [filteredApps]);
  const breakdown = useMemo(
    () => computeDepartmentBreakdown(filteredApps, data.departments),
    [data.departments, filteredApps],
  );

  const exportSummaryCsv = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Filtered Applications', String(stats.total)],
      ['Accepted', String(stats.accepted)],
      ['Pending Review', String(stats.pending)],
      ['Rejected', String(stats.rejected)],
      ['Waitlisted', String(stats.waitlisted)],
      ['Withdrawn', String(stats.withdrawn)],
      ['Head Recommended (Stage 1)', String(stats.recommended)],
      ['Acceptance Rate (%)', `${stats.acceptanceRate}%`],
    ];
    downloadCsvFile(
      'willow-mun-2027-summary-report.csv',
      rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n'),
    );
  };

  const exportDepartmentBreakdownCsv = () => {
    const header = [
      'Department',
      'Cluster',
      'Total',
      'Pending',
      'Recommended',
      'Accepted',
      'Rejected',
      'Capacity',
      'Registration Open',
    ];
    const rows = breakdown.map((b) => [
      b.departmentName,
      b.cluster,
      String(b.total),
      String(b.pending),
      String(b.recommended),
      String(b.accepted),
      String(b.rejected),
      String(b.capacity),
      b.registrationOpen ? 'Open' : 'Closed',
    ]);
    downloadCsvFile(
      'willow-mun-2027-department-breakdown.csv',
      [header, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n'),
    );
  };

  const exportRegistrationSnapshotCsv = () => {
    const header = ['Parameter', 'Current Value'];
    const rows = [
      ['Global Registration', data.settings.globalRegistrationOpen ? 'OPEN' : 'CLOSED'],
      ['Window Start', data.settings.registrationWindowStart],
      ['Deadline', data.settings.registrationDeadline],
      ['Max Apps Per Applicant', String(data.settings.maxApplicationsPerApplicant)],
      ['Open Departments', `${data.departments.filter((d) => d.registrationOpen).length}/${data.departments.length}`],
      ['Open Application Forms', String(data.applicationForms.filter((f) => f.isOpen).length)],
    ];
    downloadCsvFile(
      'willow-mun-2027-registration-snapshot.csv',
      [header, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n'),
    );
  };

  const categoryCounts = useMemo(() => {
    const cats: ApplicationCategory[] = ['delegate', 'staff', 'security', 'media', 'volunteer'];
    return cats.map((cat) => {
      const subset = filteredApps.filter((a) => a.category === cat);
      return {
        category: cat,
        total: subset.length,
        accepted: subset.filter((a) => a.status === 'accepted').length,
        pending: subset.filter((a) => a.status === 'pending').length,
      };
    });
  }, [filteredApps]);

  return (
    <div className="space-y-6">
      <div className="wm-surface-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] pb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
              Conference Statistics & Data Exports
            </h2>
          </div>

          {canExport && (
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={exportSummaryCsv}
                className="inline-flex h-8 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3 font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Summary CSV</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadCsvFile(
                    'willow-mun-2027-applicants.csv',
                    exportApplicationsToCsv(filteredApps, data.departments),
                  )
                }
                className="inline-flex h-8 items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Applicants CSV</span>
              </button>
              <button
                type="button"
                onClick={exportDepartmentBreakdownCsv}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Departments CSV</span>
              </button>
              <button
                type="button"
                onClick={exportRegistrationSnapshotCsv}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Registration CSV</span>
              </button>
            </div>
          )}
        </div>

        {/* Report Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-[color:var(--wm-ink-secondary)]">Department</label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-[color:var(--wm-ink)]"
            >
              <option value="all">All Departments</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[color:var(--wm-ink-secondary)]">Application Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as ApplicationCategory | 'all')}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-[color:var(--wm-ink)]"
            >
              <option value="all">All Categories</option>
              <option value="delegate">Delegate</option>
              <option value="staff">Staff</option>
              <option value="security">Security</option>
              <option value="media">Media</option>
              <option value="volunteer">Volunteer</option>
            </select>
          </div>
          <div>
            <label className="text-[color:var(--wm-ink-secondary)]">Submitted From</label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
            />
          </div>
          <div>
            <label className="text-[color:var(--wm-ink-secondary)]">Submitted Through</label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
            />
          </div>
        </div>
      </div>

      {/* Unified Architectural Metric Ledger Strip */}
      <section aria-label="Filtered statistics summary" className="wm-surface-panel overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-[color:var(--wm-hairline)]">
          {[
            { label: 'Total Filtered', value: stats.total, accent: 'text-[color:var(--wm-ink)]' },
            { label: 'Accepted', value: stats.accepted, accent: 'text-emerald-200' },
            { label: 'Pending Review', value: stats.pending, accent: 'text-amber-200' },
            { label: 'Rejected', value: stats.rejected, accent: 'text-rose-200' },
            { label: 'Acceptance Rate', value: `${stats.acceptanceRate}%`, accent: 'text-[color:var(--wm-accent)]' },
          ].map((k) => (
            <div key={k.label} className="px-5 py-4">
              <p className="wm-section-kicker">{k.label}</p>
              <p className={`mt-1.5 font-serif text-3xl font-medium tabular-nums ${k.accent}`}>
                {k.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Category & Department Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-5 wm-surface-panel overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)]">
            <h3 className="text-sm font-semibold text-[color:var(--wm-ink)]">
              Category Distribution
            </h3>
          </div>
          <div className="divide-y divide-[color:var(--wm-hairline)] text-xs">
            {categoryCounts.map((c) => (
              <div key={c.category} className="px-5 py-3 flex items-center justify-between gap-3">
                <span className="font-medium capitalize text-[color:var(--wm-ink)]">
                  {c.category}
                </span>
                <div className="flex items-center gap-4 tabular-nums font-mono text-[11px]">
                  <span className="text-[color:var(--wm-ink-secondary)]">{c.total} total</span>
                  <span className="text-emerald-200">{c.accepted} accepted</span>
                  <span className="text-amber-200">{c.pending} pending</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-7 wm-surface-panel overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)]">
            <h3 className="text-sm font-semibold text-[color:var(--wm-ink)]">
              Department Acceptance & Volume
            </h3>
          </div>
          <div className="p-5 max-h-80 overflow-y-auto">
            <DepartmentDistributionChart items={breakdown} />
          </div>
        </section>
      </div>
    </div>
  );
}

// =====================================================================
// 2. REGISTRATION CONTROLS VIEW
// =====================================================================

export function RegistrationControlsView() {
  const { currentUser, data, updateSettings, updateDepartment } = useAdminStore();

  const [windowStart, setWindowStart] = useState(data.settings.registrationWindowStart);
  const [deadline, setDeadline] = useState(data.settings.registrationDeadline);
  const [maxApps, setMaxApps] = useState(data.settings.maxApplicationsPerApplicant);

  const canManageReg = hasPermission(currentUser, 'registration.manage');
  const canToggleDept = hasPermission(currentUser, 'departments.toggle_registration');

  const stats = computeApplicationStats(data.applications);
  const breakdown = computeDepartmentBreakdown(data.applications, data.departments);
  const openDeptsCount = data.departments.filter((d) => d.registrationOpen).length;
  const recentIncoming = [...data.applications]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 6);

  const handleGlobalSave = (e: FormEvent) => {
    e.preventDefault();
    updateSettings({
      registrationWindowStart: windowStart,
      registrationDeadline: deadline,
      maxApplicationsPerApplicant: Math.max(1, maxApps),
    });
  };

  return (
    <div className="space-y-6">
      <section className="wm-surface-panel p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[color:var(--wm-hairline)] pb-5">
          <div className="flex items-start gap-3">
            <ClipboardList
              className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--wm-accent)]"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
                Conference Registration Gate
              </h2>
              <p className="mt-0.5 text-xs text-[color:var(--wm-ink-secondary)]">
                Global registration is currently{' '}
                <span
                  className={
                    data.settings.globalRegistrationOpen
                      ? 'font-semibold text-emerald-300'
                      : 'font-semibold text-rose-300'
                  }
                >
                  {data.settings.globalRegistrationOpen ? 'OPEN' : 'CLOSED'}
                </span>{' '}
                · {openDeptsCount} of {data.departments.length} departments accepting submissions.
              </p>
            </div>
          </div>

          {canManageReg && (
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  globalRegistrationOpen: !data.settings.globalRegistrationOpen,
                })
              }
              className={`inline-flex min-h-[40px] items-center gap-2 rounded px-4 py-2 text-xs font-medium cursor-pointer whitespace-nowrap ${
                data.settings.globalRegistrationOpen
                  ? 'border border-rose-400/45 bg-rose-500/[0.12] text-rose-200 hover:bg-rose-500/20'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {data.settings.globalRegistrationOpen ? (
                <>
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Close Global Registration</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Open Global Registration</span>
                </>
              )}
            </button>
          )}
        </div>

        <form
          onSubmit={handleGlobalSave}
          className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end text-xs"
        >
          <div>
            <label htmlFor="reg-start" className="block text-[color:var(--wm-ink-secondary)]">
              Intake Open Date
            </label>
            <input
              id="reg-start"
              type="date"
              disabled={!canManageReg}
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)] tabular-nums disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="reg-deadline" className="block text-[color:var(--wm-ink-secondary)]">
              Final Deadline
            </label>
            <input
              id="reg-deadline"
              type="date"
              disabled={!canManageReg}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)] tabular-nums disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="reg-max-apps" className="block text-[color:var(--wm-ink-secondary)]">
              Max Apps Per Applicant
            </label>
            <input
              id="reg-max-apps"
              type="number"
              min={1}
              max={5}
              disabled={!canManageReg}
              value={maxApps}
              onChange={(e) => setMaxApps(Number(e.target.value) || 1)}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)] tabular-nums disabled:opacity-60"
            />
          </div>
          <div>
            {canManageReg && (
              <button
                type="submit"
                className="h-9 w-full sm:w-auto rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
              >
                Save Policy
              </button>
            )}
          </div>
        </form>
      </section>

      <section aria-label="Registration snapshot" className="wm-surface-panel overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[color:var(--wm-hairline)]">
          {[
            { label: 'Total Submissions', value: stats.total },
            { label: 'Pending Final Review', value: stats.pending },
            { label: 'Accepted Placements', value: stats.accepted },
            { label: 'Open Departments', value: `${openDeptsCount}/${data.departments.length}` },
          ].map((kpi) => (
            <div key={kpi.label} className="px-5 py-4">
              <p className="wm-section-kicker">{kpi.label}</p>
              <p className="mt-1.5 font-serif text-3xl font-medium text-[color:var(--wm-ink)] tabular-nums">
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 wm-surface-panel overflow-hidden">
          <div className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-5 py-3.5">
            <h3 className="text-sm font-semibold text-[color:var(--wm-ink)]">
              Department Registration Availability
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[color:var(--wm-hairline)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wm-ink-muted)]">
                  <th className="px-4 py-2.5">Department</th>
                  <th className="px-4 py-2.5 text-right">Apps</th>
                  <th className="px-4 py-2.5 text-right">Accepted</th>
                  <th className="px-4 py-2.5 text-right">Capacity</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--wm-hairline)]">
                {breakdown.map((row) => (
                  <tr key={row.departmentId} className="hover:bg-[#ede6ca]/[0.03]">
                    <td className="px-4 py-3 font-medium text-[color:var(--wm-ink)]">
                      {row.departmentName}
                    </td>
                    <td className="px-4 py-3 text-right text-[color:var(--wm-ink-secondary)] tabular-nums">
                      {row.total}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-200 tabular-nums">
                      {row.accepted}
                    </td>
                    <td className="px-4 py-3 text-right text-[color:var(--wm-ink-secondary)] tabular-nums">
                      {row.capacity}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
                          row.registrationOpen
                            ? 'border-emerald-400/35 bg-emerald-500/[0.1] text-emerald-200'
                            : 'border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink-muted)]'
                        }`}
                      >
                        {row.registrationOpen ? 'Open' : 'Closed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canToggleDept ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateDepartment(row.departmentId, {
                              registrationOpen: !row.registrationOpen,
                            })
                          }
                          className="h-7 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-[11px] text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                        >
                          {row.registrationOpen ? 'Close' : 'Open'}
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] text-[color:var(--wm-ink-muted)]">
                          Locked
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-5 wm-surface-panel overflow-hidden">
          <div className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-5 py-3.5">
            <h3 className="text-sm font-semibold text-[color:var(--wm-ink)]">
              Recent Incoming Applications
            </h3>
          </div>
          <div className="divide-y divide-[color:var(--wm-hairline)]">
            {recentIncoming.map((app) => {
              const dept = data.departments.find((d) => d.id === app.departmentId);
              return (
                <div key={app.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[color:var(--wm-ink)] truncate">
                      {app.applicantName}
                    </p>
                    <p className="text-[11px] text-[color:var(--wm-ink-muted)] truncate">
                      {dept?.name ?? app.departmentId} · {app.position}
                    </p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

// =====================================================================
// 3. CONFERENCE SETTINGS VIEW
// =====================================================================

export function ConferenceSettingsView() {
  const { data, updateSettings, resetDemoData } = useAdminStore();
  const [form, setForm] = useState(data.settings);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    updateSettings(form);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="wm-surface-panel p-6 space-y-5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] pb-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
              Conference-Wide Identity, Venue & Legal Settings
            </h2>
          </div>
          <button
            type="submit"
            className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
          >
            Save Conference Settings
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-[color:var(--wm-ink-secondary)]">Conference Name</label>
            <input
              required
              value={form.conferenceName}
              onChange={(e) => setForm({ ...form, conferenceName: e.target.value })}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
            />
          </div>
          <div>
            <label className="text-[color:var(--wm-ink-secondary)]">Edition Year</label>
            <input
              required
              value={form.editionYear}
              onChange={(e) => setForm({ ...form, editionYear: e.target.value })}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
            />
          </div>
          <div>
            <label className="text-[color:var(--wm-ink-secondary)]">Conference Dates Label</label>
            <input
              value={form.datesText}
              onChange={(e) => setForm({ ...form, datesText: e.target.value })}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
            />
          </div>
          <div>
            <label className="text-[color:var(--wm-ink-secondary)]">Venue</label>
            <input
              value={form.venueText}
              onChange={(e) => setForm({ ...form, venueText: e.target.value })}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
            />
          </div>
          <div>
            <label className="text-[color:var(--wm-ink-secondary)]">Organizer</label>
            <input
              value={form.organizerName}
              onChange={(e) => setForm({ ...form, organizerName: e.target.value })}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
            />
          </div>
          <div>
            <label className="text-[color:var(--wm-ink-secondary)]">Delegate Fee Label</label>
            <input
              value={form.delegateFeeText}
              onChange={(e) => setForm({ ...form, delegateFeeText: e.target.value })}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
            />
          </div>
          <div>
            <label className="text-[color:var(--wm-ink-secondary)]">Official Contact Email</label>
            <input
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
            />
          </div>
          <div>
            <label className="text-[color:var(--wm-ink-secondary)]">Secretariat Contact Phone</label>
            <input
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="inline-flex items-center gap-2 text-[color:var(--wm-ink)] cursor-pointer">
              <input
                type="checkbox"
                checked={form.maintenanceMode}
                onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })}
                className="h-4 w-4 accent-[#a9b47e]"
              />
              <span>Maintenance Mode (Display Banner)</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[color:var(--wm-hairline)]">
          <div>
            <label className="text-[color:var(--wm-ink-secondary)]">Terms of Participation</label>
            <textarea
              rows={3}
              value={form.termsText}
              onChange={(e) => setForm({ ...form, termsText: e.target.value })}
              className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] p-3 text-[color:var(--wm-ink)]"
            />
          </div>
          <div>
            <label className="text-[color:var(--wm-ink-secondary)]">Data Privacy Policy</label>
            <textarea
              rows={3}
              value={form.privacyPolicyText}
              onChange={(e) => setForm({ ...form, privacyPolicyText: e.target.value })}
              className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] p-3 text-[color:var(--wm-ink)]"
            />
          </div>
        </div>
      </form>

      <div className="rounded-md border border-rose-400/30 bg-rose-500/[0.06] p-5 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div>
          <p className="font-semibold text-rose-200">Restore Seeded Demo Environment</p>
          <p className="mt-0.5 text-[color:var(--wm-ink-secondary)]">
            Reset all local changes in browser storage back to the initial Willow MUN 2027 seed
            dataset.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded border border-rose-400/40 px-3.5 text-rose-200 hover:bg-rose-500/15 cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Reset Demo Dataset</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Restore Initial Conference Dataset?"
        description="All local application edits, Website CMS drafts, accounts, and logs created in this browser will be reset to the Willow MUN 2027 seed."
        confirmLabel="Restore Seed Data"
        tone="danger"
        onConfirm={() => {
          resetDemoData();
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}

// =====================================================================
// 4. SYSTEM MONITORING VIEW (Unified Admin & Super Admin Governance)
// =====================================================================

export function SystemMonitoringView() {
  const { data, resolveErrorLog, updateTechnicalConfig, runHealthChecks } = useAdminStore();
  const [tech, setTech] = useState(data.technicalConfig);

  const handleSaveTech = (e: FormEvent) => {
    e.preventDefault();
    updateTechnicalConfig(tech);
  };

  return (
    <div className="space-y-6">
      <div className="wm-surface-panel px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Server className="h-4 w-4 text-[color:var(--wm-accent)] mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
              Platform Infrastructure & Service Health
            </h2>
            <p className="text-xs text-[color:var(--wm-ink-secondary)]">
              Real-time repository readiness, error triage, and security runtime parameters.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={runHealthChecks}
          className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Run Diagnostic Probe</span>
        </button>
      </div>

      {/* Unified Service Checks Table */}
      <section className="wm-surface-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wm-ink-muted)]">
                <th className="py-3 px-4">Service Module</th>
                <th className="py-3 px-4">Endpoint</th>
                <th className="py-3 px-4 text-right">Latency</th>
                <th className="py-3 px-4 text-right">Uptime</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--wm-hairline)]">
              {data.serviceChecks.map((svc) => (
                <tr key={svc.id} className="hover:bg-[#ede6ca]/[0.03]">
                  <td className="py-3 px-4 font-semibold text-[color:var(--wm-ink)]">{svc.name}</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-[color:var(--wm-ink-secondary)]">
                    {svc.endpoint}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[11px] text-[color:var(--wm-ink)] tabular-nums">
                    {svc.latencyMs}ms
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[11px] text-[color:var(--wm-ink-secondary)] tabular-nums">
                    {svc.uptimePercent}%
                  </td>
                  <td className="py-3 px-4 text-right">
                    <HealthBadge status={svc.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Error Logs */}
        <section className="lg:col-span-7 wm-surface-panel overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] flex items-center gap-2">
            <Activity className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-[color:var(--wm-ink)]">
              Error Alerts & Anomaly Feed ({data.errorLogs.length})
            </h3>
          </div>
          <div className="divide-y divide-[color:var(--wm-hairline)] text-xs">
            {data.errorLogs.map((err) => (
              <div key={err.id} className="px-5 py-3.5 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-[color:var(--wm-ink)]">
                      {err.code}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] uppercase font-medium ${
                        err.resolved
                          ? 'border-emerald-400/30 bg-emerald-500/[0.1] text-emerald-200'
                          : err.severity === 'critical'
                            ? 'border-rose-400/35 bg-rose-500/[0.1] text-rose-200'
                            : 'border-amber-400/35 bg-amber-500/[0.1] text-amber-200'
                      }`}
                    >
                      {err.resolved ? 'Resolved' : err.severity}
                    </span>
                    <span className="text-[11px] text-[color:var(--wm-ink-muted)]">
                      {err.source}
                    </span>
                  </div>
                  <p className="text-[color:var(--wm-ink-secondary)]">{err.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => resolveErrorLog(err.id)}
                  className="shrink-0 inline-flex h-8 items-center gap-1 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-[11px] text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                >
                  {err.resolved ? (
                    <>
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      <span>Reopen</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-emerald-300" aria-hidden="true" />
                      <span>Resolve</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Technical Config */}
        <form onSubmit={handleSaveTech} className="lg:col-span-5 wm-surface-panel p-5 space-y-3.5 text-xs">
          <h3 className="text-sm font-semibold text-[color:var(--wm-ink)] border-b border-[color:var(--wm-hairline)] pb-3">
            Runtime Security & Repository Config
          </h3>
          <div>
            <label className="text-[color:var(--wm-ink-secondary)]">Environment Mode</label>
            <input
              value={tech.environmentLabel}
              onChange={(e) => setTech({ ...tech, environmentLabel: e.target.value })}
              className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[color:var(--wm-ink-secondary)]">Rate Limit (/min)</label>
              <input
                type="number"
                value={tech.rateLimitPerMinute}
                onChange={(e) =>
                  setTech({ ...tech, rateLimitPerMinute: Number(e.target.value) || 60 })
                }
                className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)] tabular-nums"
              />
            </div>
            <div>
              <label className="text-[color:var(--wm-ink-secondary)]">Max Upload (MB)</label>
              <input
                type="number"
                value={tech.maxUploadSizeMb}
                onChange={(e) => setTech({ ...tech, maxUploadSizeMb: Number(e.target.value) || 10 })}
                className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)] tabular-nums"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[color:var(--wm-ink)] cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={tech.strictDepartmentIsolation}
              onChange={(e) =>
                setTech({ ...tech, strictDepartmentIsolation: e.target.checked })
              }
              className="h-4 w-4 accent-[#a9b47e]"
            />
            <span>Enforce Strict Department Head Scope Isolation</span>
          </label>
          <label className="flex items-center gap-2 text-[color:var(--wm-ink)] cursor-pointer">
            <input
              type="checkbox"
              checked={tech.auditLoggingEnabled}
              onChange={(e) => setTech({ ...tech, auditLoggingEnabled: e.target.checked })}
              className="h-4 w-4 accent-[#a9b47e]"
            />
            <span>Record Immutable Security & Administrative Audit Logs</span>
          </label>
          <button
            type="submit"
            className="h-9 w-full rounded bg-[color:var(--wm-focal)] font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer mt-2"
          >
            Save Runtime Configuration
          </button>
        </form>
      </div>
    </div>
  );
}
