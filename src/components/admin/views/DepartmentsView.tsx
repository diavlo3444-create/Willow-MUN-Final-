import { useMemo, useState, type FormEvent } from 'react';
import { Building2, Edit2, Plus, UserPlus, X } from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type { Department } from '../../../types/admin';
import { canManageAccountsOrRoles, hasPermission } from '../../../utils/adminPermissions';
import { computeDepartmentBreakdown } from '../../../utils/applicationFilters';

interface DepartmentsViewProps {
  lockedDepartmentId?: string | null;
  onInspectDepartmentApps?: (departmentId: string) => void;
  actingUserOverride?: ReturnType<typeof useAdminStore>['testModeHeadUser'];
}

export function DepartmentsView({
  lockedDepartmentId = null,
  onInspectDepartmentApps,
  actingUserOverride = null,
}: DepartmentsViewProps) {
  const {
    data,
    currentUser,
    createDepartment,
    updateDepartment,
    assignDepartmentHead,
  } = useAdminStore();

  const effectiveActor = actingUserOverride ?? currentUser;
  const [editing, setEditing] = useState<Department | null>(null);
  const [creating, setCreating] = useState(false);
  const [newDept, setNewDept] = useState({
    slug: '',
    name: '',
    cluster: 'Delegate Affairs & Operations' as Department['cluster'],
    description: '',
    capacity: 15,
    positionsCsv: 'Coordinator, Officer',
    instructions: '',
  });

  const canManageDepts = hasPermission(effectiveActor, 'departments.manage');
  const canToggleReg = hasPermission(effectiveActor, 'departments.toggle_registration');
  const canAssignHead = canManageAccountsOrRoles(effectiveActor);

  const visibleDepartments = useMemo(() => {
    if (lockedDepartmentId) {
      return data.departments.filter((d) => d.id === lockedDepartmentId);
    }
    return data.departments;
  }, [data.departments, lockedDepartmentId]);

  const breakdownMap = useMemo(() => {
    const b = computeDepartmentBreakdown(data.applications, data.departments);
    return new Map(b.map((item) => [item.departmentId, item]));
  }, [data.applications, data.departments]);

  const headUsers = useMemo(
    () => data.users.filter((u) => u.role === 'department_head'),
    [data.users],
  );

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    const ok = createDepartment({
      slug: newDept.slug || newDept.name,
      name: newDept.name,
      cluster: newDept.cluster,
      description: newDept.description,
      capacity: newDept.capacity,
      positions: newDept.positionsCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      registrationOpen: true,
      instructions: newDept.instructions,
    });
    if (ok) {
      setCreating(false);
      setNewDept({
        slug: '',
        name: '',
        cluster: 'Delegate Affairs & Operations',
        description: '',
        capacity: 15,
        positionsCsv: 'Coordinator, Officer',
        instructions: '',
      });
    }
  };

  return (
    <div className="space-y-4">
      {!lockedDepartmentId && canManageDepts && (
        <div className="wm-surface-panel px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)]">
            <Building2 className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <span>
              Configure organizing departments, capacities, intake toggles, and Department Head linkages.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Create Department</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {visibleDepartments.map((dept) => {
          const stats = breakdownMap.get(dept.id);
          const assignedHeads = headUsers.filter(
            (h) => dept.headUserIds.includes(h.id) || h.departmentId === dept.id,
          );

          return (
            <article
              key={dept.id}
              className="wm-surface-panel overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="wm-section-kicker text-[color:var(--wm-accent)]">
                      {dept.cluster}
                    </p>
                    <h3 className="mt-1 font-serif text-xl font-medium text-[color:var(--wm-ink)]">
                      {dept.name}
                    </h3>
                  </div>

                  {canToggleReg ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateDepartment(dept.id, { registrationOpen: !dept.registrationOpen })
                      }
                      className={`h-7 rounded border px-2.5 text-[11px] font-medium cursor-pointer whitespace-nowrap ${
                        dept.registrationOpen
                          ? 'border-emerald-400/30 bg-emerald-500/[0.09] text-emerald-200'
                          : 'border-rose-400/30 bg-rose-500/[0.09] text-rose-200'
                      }`}
                    >
                      {dept.registrationOpen ? 'Registration Open' : 'Registration Closed'}
                    </button>
                  ) : (
                    <span className="font-mono text-[11px] text-[color:var(--wm-ink-muted)]">
                      {dept.registrationOpen ? 'Open' : 'Closed'}
                    </span>
                  )}
                </div>

                <p className="px-5 pb-4 text-xs text-[color:var(--wm-ink-secondary)] leading-relaxed">
                  {dept.description}
                </p>

                {/* Flush Rule-Divided Metric Band (No nested bordered box) */}
                <div className="grid grid-cols-4 border-y border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)]/60 divide-x divide-[color:var(--wm-hairline)] text-center text-xs tabular-nums">
                  <div className="py-2.5 px-2">
                    <p className="text-[10px] uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
                      Total
                    </p>
                    <p className="mt-0.5 font-mono font-semibold text-[color:var(--wm-ink)]">
                      {stats?.total ?? 0}
                    </p>
                  </div>
                  <div className="py-2.5 px-2">
                    <p className="text-[10px] uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
                      Pending
                    </p>
                    <p className="mt-0.5 font-mono font-semibold text-amber-200">
                      {stats?.pending ?? 0}
                    </p>
                  </div>
                  <div className="py-2.5 px-2">
                    <p className="text-[10px] uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
                      Accepted
                    </p>
                    <p className="mt-0.5 font-mono font-semibold text-emerald-200">
                      {stats?.accepted ?? 0}
                    </p>
                  </div>
                  <div className="py-2.5 px-2">
                    <p className="text-[10px] uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
                      Target
                    </p>
                    <p className="mt-0.5 font-mono font-semibold text-[color:var(--wm-accent)]">
                      {dept.capacity}
                    </p>
                  </div>
                </div>

                <div className="px-5 py-3.5 text-xs space-y-1.5">
                  <p className="text-[color:var(--wm-ink-muted)]">
                    Positions:{' '}
                    <span className="text-[color:var(--wm-ink)]">
                      {dept.positions.join(' · ') || 'None'}
                    </span>
                  </p>
                  <p className="text-[color:var(--wm-ink-muted)]">
                    Assigned Head(s):{' '}
                    <span className="text-[color:var(--wm-accent)] font-medium">
                      {assignedHeads.map((h) => h.fullName).join(', ') || 'Unassigned'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--wm-hairline)] px-5 py-3">
                {onInspectDepartmentApps ? (
                  <button
                    type="button"
                    onClick={() => onInspectDepartmentApps(dept.id)}
                    className="h-8 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
                  >
                    Open Dept Queue ({stats?.total ?? 0})
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  {(canManageDepts || lockedDepartmentId === dept.id) && (
                    <button
                      type="button"
                      onClick={() => setEditing(structuredClone(dept))}
                      className="inline-flex h-8 items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Configure</span>
                    </button>
                  )}

                  {canAssignHead && (
                    <select
                      aria-label={`Assign head for ${dept.name}`}
                      value=""
                      onChange={(e) => {
                        if (e.target.value) assignDepartmentHead(dept.id, e.target.value, true);
                      }}
                      className="h-8 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2.5 text-[11px] text-[color:var(--wm-ink)]"
                    >
                      <option value="">+ Assign Dept Head</option>
                      {headUsers.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.fullName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Edit Department Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              updateDepartment(editing.id, {
                name: editing.name,
                description: editing.description,
                capacity: editing.capacity,
                positions: editing.positions,
                instructions: editing.instructions,
              });
              setEditing(null);
            }}
            className="w-full max-w-lg rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-4 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
              <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
                Configure {editing.name}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close configuration dialog"
                className="inline-flex h-8 w-8 items-center justify-center rounded text-[color:var(--wm-ink-muted)] hover:text-[color:var(--wm-ink)] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div>
              <label className="text-[color:var(--wm-ink-secondary)]">Description</label>
              <textarea
                rows={2}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-2.5 text-[color:var(--wm-ink)]"
              />
            </div>
            <div>
              <label className="text-[color:var(--wm-ink-secondary)]">
                Reviewer Screening Instructions
              </label>
              <textarea
                rows={2}
                value={editing.instructions}
                onChange={(e) => setEditing({ ...editing, instructions: e.target.value })}
                className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-2.5 text-[color:var(--wm-ink)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Target Capacity</label>
                <input
                  type="number"
                  min={1}
                  disabled={Boolean(lockedDepartmentId)}
                  value={editing.capacity}
                  onChange={(e) =>
                    setEditing({ ...editing, capacity: Number(e.target.value) || 1 })
                  }
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)] disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">
                  Positions (comma-separated)
                </label>
                <input
                  type="text"
                  value={editing.positions.join(', ')}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      positions: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--wm-hairline)]">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Department Modal */}
      {creating && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreate}
            className="w-full max-w-lg rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-3 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
              <h2 className="text-base font-semibold text-[color:var(--wm-ink)] inline-flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
                <span>Create Conference Department</span>
              </h2>
              <button
                type="button"
                onClick={() => setCreating(false)}
                aria-label="Close create dialog"
                className="inline-flex h-8 w-8 items-center justify-center rounded text-[color:var(--wm-ink-muted)] hover:text-[color:var(--wm-ink)] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Department Name</label>
                <input
                  required
                  type="text"
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Slug ID</label>
                <input
                  required
                  type="text"
                  value={newDept.slug}
                  onChange={(e) => setNewDept({ ...newDept, slug: e.target.value })}
                  placeholder="e.g. hospitality"
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
            </div>
            <div>
              <label className="text-[color:var(--wm-ink-secondary)]">Cluster</label>
              <select
                value={newDept.cluster}
                onChange={(e) =>
                  setNewDept({ ...newDept, cluster: e.target.value as Department['cluster'] })
                }
                className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-[color:var(--wm-ink)]"
              >
                <option value="Delegate Affairs & Operations">Delegate Affairs & Operations</option>
                <option value="Communications & Creative">Communications & Creative</option>
                <option value="Logistics & Administration">Logistics & Administration</option>
              </select>
            </div>
            <div>
              <label className="text-[color:var(--wm-ink-secondary)]">Description</label>
              <textarea
                rows={2}
                value={newDept.description}
                onChange={(e) => setNewDept({ ...newDept, description: e.target.value })}
                className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-2.5 text-[color:var(--wm-ink)]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--wm-hairline)]">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] cursor-pointer"
              >
                Create Department
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
