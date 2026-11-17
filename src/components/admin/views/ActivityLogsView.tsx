import { useMemo, useState } from 'react';
import { Activity, Download, Search } from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type { ActivityCategory } from '../../../types/admin';
import { RoleBadge } from '../StatusBadge';

interface ActivityLogsViewProps {
  lockedDepartmentId?: string | null;
}

export function ActivityLogsView({ lockedDepartmentId = null }: ActivityLogsViewProps) {
  const { data } = useAdminStore();
  const [category, setCategory] = useState<ActivityCategory | 'all'>('all');
  const [search, setSearch] = useState('');

  const logs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.logs.filter((entry) => {
      if (lockedDepartmentId && entry.departmentId !== lockedDepartmentId) {
        return false;
      }
      if (category !== 'all' && entry.category !== category) return false;
      if (
        q &&
        !`${entry.actorName} ${entry.action} ${entry.targetLabel} ${entry.details}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [category, data.logs, lockedDepartmentId, search]);

  const exportLogsCsv = () => {
    const header = ['Timestamp', 'Actor', 'Role', 'Category', 'Action', 'Target', 'Details'];
    const rows = logs.map((l) => [
      l.timestamp,
      l.actorName,
      l.actorRole,
      l.category,
      l.action,
      l.targetLabel,
      l.details,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'willow-mun-2026-audit-logs.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="wm-surface-panel px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
          <span className="text-sm font-semibold text-[color:var(--wm-ink)]">
            Administrative & Security Audit Trail ({logs.length})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter logs by category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ActivityCategory | 'all')}
            className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-xs text-[color:var(--wm-ink)]"
          >
            <option value="all">All Categories</option>
            <option value="application">Applications</option>
            <option value="account">Accounts</option>
            <option value="role">Roles & Permissions</option>
            <option value="department">Departments</option>
            <option value="registration">Registration</option>
            <option value="committee">Committees</option>
            <option value="secretariat">Secretariat</option>
            <option value="operations">Operations</option>
            <option value="qr">QR & Attendance</option>
            <option value="email">Emails</option>
            <option value="website">Website CMS</option>
            <option value="system">System</option>
            <option value="security">Security Violations</option>
          </select>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actor, action, details..."
              aria-label="Search activity logs"
              className="h-9 w-56 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] pl-8 pr-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
            />
          </div>

          <button
            type="button"
            onClick={exportLogsCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <section className="wm-surface-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wm-ink-muted)]">
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Performed By</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--wm-hairline)]">
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-xs text-[color:var(--wm-ink-muted)]"
                  >
                    No administrative logs match the active filter.
                  </td>
                </tr>
              ) : (
                logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#ede6ca]/[0.03] align-top">
                    <td className="px-4 py-3 font-mono text-[11px] text-[color:var(--wm-ink-muted)] tabular-nums whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[color:var(--wm-ink)] whitespace-nowrap">
                          {entry.actorName}
                        </span>
                        <RoleBadge role={entry.actorRole} />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-[color:var(--wm-accent)] whitespace-nowrap">
                      {entry.action}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--wm-ink)]">{entry.targetLabel}</td>
                    <td className="px-4 py-3 text-[color:var(--wm-ink-secondary)] max-w-md">
                      {entry.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
