import { useMemo, useState, type FormEvent } from 'react';
import { FolderKanban, Plus, Search, Trash2, X } from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type { WorkspaceModuleType, WorkspaceRecord } from '../../../types/admin';

const WORKSPACE_MODULES: Array<{ id: WorkspaceModuleType; label: string }> = [
  { id: 'tasks', label: 'Department Tasks' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'rosters', label: 'Rosters' },
  { id: 'shifts', label: 'Shift Briefs' },
  { id: 'sponsor_tasks', label: 'Sponsor Tasks' },
  { id: 'venue_planning', label: 'Venue Planning' },
  { id: 'run_of_show', label: 'Run of Show' },
  { id: 'directives', label: 'Directives' },
  { id: 'support_tickets', label: 'Support Tickets' },
  { id: 'announcements', label: 'Dept Announcements' },
  { id: 'internal_notes', label: 'Internal Notes' },
];

export function WorkspaceModulesView({
  lockedDepartmentId = null,
}: {
  lockedDepartmentId?: string | null;
}) {
  const { data, currentUser, saveWorkspaceRecord, deleteWorkspaceRecord } = useAdminStore();

  const [selectedModule, setSelectedModule] = useState<WorkspaceModuleType | 'all'>('all');
  const [deptFilter, setDeptFilter] = useState<string>(lockedDepartmentId ?? 'all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<WorkspaceRecord | null>(null);

  const effectiveDeptFilter = lockedDepartmentId ?? deptFilter;

  const deptScopedRecords = useMemo(() => {
    if (effectiveDeptFilter === 'all') return data.workspaceRecords;
    return data.workspaceRecords.filter((rec) => rec.departmentId === effectiveDeptFilter);
  }, [data.workspaceRecords, effectiveDeptFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deptScopedRecords.filter((rec) => {
      if (selectedModule !== 'all' && rec.module !== selectedModule) return false;
      if (q) {
        const hay = `${rec.title} ${rec.description} ${rec.assignedTo} ${rec.internalNotes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [deptScopedRecords, search, selectedModule]);

  const deptNameById = useMemo(
    () => new Map(data.departments.map((d) => [d.id, d.name])),
    [data.departments],
  );

  const openNew = () => {
    setEditing({
      id: '',
      departmentId:
        lockedDepartmentId ??
        (effectiveDeptFilter !== 'all' ? effectiveDeptFilter : data.departments[0]?.id ?? 'hr'),
      module: selectedModule === 'all' ? 'tasks' : selectedModule,
      title: '',
      description: '',
      status: 'open',
      priority: 'medium',
      deadline: '2026-12-01',
      assignedTo: currentUser?.fullName ?? 'Lead Organizer',
      internalNotes: '',
      createdBy: currentUser?.fullName ?? '',
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-5">
      {/* Module Switcher & Search Workbench */}
      <div className="wm-surface-panel overflow-hidden">
        <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)]">
          <div className="flex items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)]">
            <FolderKanban className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <span>
              Unified 13-Module Operations Workspace: create, assign, prioritize, and track
              departmental execution.
            </span>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>New Workspace Item</span>
          </button>
        </div>

        <div className="px-5 py-3 bg-[color:var(--wm-inset)] border-b border-[color:var(--wm-hairline)] flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedModule('all')}
            className={`rounded px-2.5 py-1.5 text-[11px] font-medium cursor-pointer transition-colors ${
              selectedModule === 'all'
                ? 'bg-[color:var(--wm-focal)] text-[#12170c]'
                : 'text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/8 hover:text-[color:var(--wm-ink)]'
            }`}
          >
            All Modules ({deptScopedRecords.length})
          </button>
          {WORKSPACE_MODULES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedModule(m.id)}
              className={`rounded px-2.5 py-1.5 text-[11px] font-medium cursor-pointer transition-colors ${
                selectedModule === m.id
                  ? 'bg-[color:var(--wm-focal)] text-[#12170c]'
                  : 'text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/8 hover:text-[color:var(--wm-ink)]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, assignee, notes..."
              aria-label="Search workspace records"
              className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
            />
          </div>
          {!lockedDepartmentId && (
            <select
              aria-label="Filter workspace records by department"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-xs text-[color:var(--wm-ink)]"
            >
              <option value="all">All Departments</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Unified Operations Ledger Table */}
      <section className="wm-surface-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wm-ink-muted)]">
                <th className="py-3 px-4">Module & Dept</th>
                <th className="py-3 px-4">Item & Notes</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Assignee & Due</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--wm-hairline)]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-xs text-[color:var(--wm-ink-muted)]"
                  >
                    No workspace items match the selected filter.
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#ede6ca]/[0.03] align-top">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="font-mono text-[11px] font-medium text-[color:var(--wm-accent)]">
                        {WORKSPACE_MODULES.find((m) => m.id === rec.module)?.label ?? rec.module}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[color:var(--wm-ink-muted)]">
                        {deptNameById.get(rec.departmentId) ?? rec.departmentId}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      <p className="font-medium text-sm text-[color:var(--wm-ink)]">{rec.title}</p>
                      {rec.description && (
                        <p className="mt-0.5 text-[color:var(--wm-ink-secondary)] leading-relaxed">
                          {rec.description}
                        </p>
                      )}
                      {rec.internalNotes && (
                        <p className="mt-1.5 border-l-2 border-[color:var(--wm-accent)]/50 pl-2.5 text-[11px] text-[color:var(--wm-ink-muted)]">
                          Note: {rec.internalNotes}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] uppercase font-medium ${
                          rec.priority === 'urgent'
                            ? 'border-rose-400/35 bg-rose-500/[0.1] text-rose-200'
                            : rec.priority === 'high'
                              ? 'border-amber-400/35 bg-amber-500/[0.1] text-amber-200'
                              : 'border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink-secondary)]'
                        }`}
                      >
                        {rec.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="font-medium text-[color:var(--wm-ink)]">{rec.assignedTo}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-[color:var(--wm-ink-muted)] tabular-nums">
                        Due {rec.deadline}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <select
                        aria-label={`Status for ${rec.title}`}
                        value={rec.status}
                        onChange={(e) =>
                          saveWorkspaceRecord({
                            ...rec,
                            status: e.target.value as WorkspaceRecord['status'],
                          })
                        }
                        className="h-8 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2 text-[11px] text-[color:var(--wm-ink)]"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing(structuredClone(rec))}
                          className="h-8 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-[11px] font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteWorkspaceRecord(rec.id)}
                          aria-label={`Delete ${rec.title}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-400/35 text-rose-200 hover:bg-rose-500/15 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace Record"
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (saveWorkspaceRecord(editing)) setEditing(null);
            }}
            className="w-full max-w-lg rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-4 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
              <h2 className="font-serif text-xl font-medium text-[color:var(--wm-ink)]">
                Workspace Record
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close modal"
                className="inline-flex h-8 w-8 items-center justify-center rounded text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/10 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Module</label>
                <select
                  value={editing.module}
                  onChange={(e) =>
                    setEditing({ ...editing, module: e.target.value as WorkspaceModuleType })
                  }
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                >
                  {WORKSPACE_MODULES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Department</label>
                <select
                  disabled={Boolean(lockedDepartmentId)}
                  value={editing.departmentId}
                  onChange={(e) => setEditing({ ...editing, departmentId: e.target.value })}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)] disabled:opacity-60"
                >
                  {data.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[color:var(--wm-ink-secondary)]">Title</label>
              <input
                required
                type="text"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
              />
            </div>
            <div>
              <label className="text-[color:var(--wm-ink-secondary)]">Description</label>
              <textarea
                rows={2}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] p-2.5 text-[color:var(--wm-ink)]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Priority</label>
                <select
                  value={editing.priority}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      priority: e.target.value as WorkspaceRecord['priority'],
                    })
                  }
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-[color:var(--wm-ink)]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Assigned To</label>
                <input
                  type="text"
                  value={editing.assignedTo}
                  onChange={(e) => setEditing({ ...editing, assignedTo: e.target.value })}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-[color:var(--wm-ink)]"
                />
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Deadline</label>
                <input
                  type="date"
                  value={editing.deadline}
                  onChange={(e) => setEditing({ ...editing, deadline: e.target.value })}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-[color:var(--wm-ink)]"
                />
              </div>
            </div>
            <div>
              <label className="text-[color:var(--wm-ink-secondary)]">Internal Notes</label>
              <input
                type="text"
                value={editing.internalNotes}
                onChange={(e) => setEditing({ ...editing, internalNotes: e.target.value })}
                className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-[color:var(--wm-hairline)] pt-4">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
              >
                Save Record
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
