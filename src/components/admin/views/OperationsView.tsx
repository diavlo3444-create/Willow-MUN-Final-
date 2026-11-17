import { useMemo, useState, type FormEvent } from 'react';
import { Clock, MapPin, Plus, Trash2, Users, X } from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type { ShiftRecord, TeamGroupRecord } from '../../../types/admin';

interface OperationsViewProps {
  mode: 'teams' | 'shifts' | 'deployment' | 'rosters';
  lockedDepartmentId?: string | null;
}

export function OperationsView({ mode, lockedDepartmentId = null }: OperationsViewProps) {
  const { data, saveTeamGroup, deleteTeamGroup, saveShift, deleteShift } = useAdminStore();
  const [deptFilter, setDeptFilter] = useState<string>(lockedDepartmentId ?? 'all');
  const [editGroup, setEditGroup] = useState<TeamGroupRecord | null>(null);
  const [editShift, setEditShift] = useState<ShiftRecord | null>(null);
  const [assignApplicantId, setAssignApplicantId] = useState('');

  const effectiveDept = lockedDepartmentId ?? deptFilter;

  const deptNameById = useMemo(
    () => new Map(data.departments.map((d) => [d.id, d.name])),
    [data.departments],
  );

  const groups = useMemo(
    () =>
      data.teamGroups.filter(
        (g) => effectiveDept === 'all' || g.departmentId === effectiveDept,
      ),
    [data.teamGroups, effectiveDept],
  );

  const shifts = useMemo(
    () =>
      data.shifts.filter((s) => effectiveDept === 'all' || s.departmentId === effectiveDept),
    [data.shifts, effectiveDept],
  );

  const acceptedApplicants = useMemo(
    () =>
      data.applications.filter(
        (a) =>
          a.status === 'accepted' &&
          (effectiveDept === 'all' || a.departmentId === effectiveDept),
      ),
    [data.applications, effectiveDept],
  );

  if (mode === 'teams' || mode === 'rosters') {
    return (
      <div className="space-y-5">
        <div className="wm-surface-panel px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Users className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <span className="text-xs text-[color:var(--wm-ink-secondary)]">
              Organize department units, custom positions, supervisors, and assign accepted staff.
            </span>
            {!lockedDepartmentId && (
              <select
                aria-label="Filter team groups by department"
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
          <button
            type="button"
            onClick={() =>
              setEditGroup({
                id: '',
                departmentId:
                  lockedDepartmentId ??
                  (effectiveDept !== 'all' ? effectiveDept : 'hr'),
                name: 'New Operational Unit',
                supervisorName: '',
                responsibility: '',
                customPositions: ['Coordinator', 'Associate'],
                memberAssignments: [],
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Create Team Group</span>
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="wm-surface-panel p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">
            No operational units match the selected department.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {groups.map((grp) => (
              <article
                key={grp.id}
                className="wm-surface-panel overflow-hidden flex flex-col justify-between text-xs"
              >
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="wm-section-kicker text-[color:var(--wm-accent)]">
                        {deptNameById.get(grp.departmentId) ?? grp.departmentId}
                      </p>
                      <h3 className="mt-1 font-serif text-xl font-medium text-[color:var(--wm-ink)]">
                        {grp.name}
                      </h3>
                      <p className="mt-0.5 text-[color:var(--wm-ink-secondary)]">
                        Supervisor:{' '}
                        <span className="font-medium text-[color:var(--wm-ink)]">
                          {grp.supervisorName || 'TBA'}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditGroup(structuredClone(grp))}
                        className="h-8 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-[11px] font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                      >
                        Manage
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTeamGroup(grp.id)}
                        aria-label={`Delete ${grp.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-400/35 text-rose-200 hover:bg-rose-500/15 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {grp.responsibility && (
                    <p className="text-[color:var(--wm-ink-secondary)] leading-relaxed">
                      {grp.responsibility}
                    </p>
                  )}
                </div>

                <div className="border-t border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-5 py-3">
                  <p className="wm-section-kicker mb-2">
                    Assigned Roster ({grp.memberAssignments.length})
                  </p>
                  {grp.memberAssignments.length === 0 ? (
                    <p className="py-2 text-[11px] text-[color:var(--wm-ink-muted)]">
                      No accepted staff assigned to this unit yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[color:var(--wm-hairline)]">
                      {grp.memberAssignments.map((ma) => (
                        <li
                          key={ma.id}
                          className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0 truncate">
                            <span className="font-medium text-[color:var(--wm-ink)]">
                              {ma.memberName}
                            </span>{' '}
                            <span className="font-mono text-[11px] text-[color:var(--wm-accent)]">
                              · {ma.position}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              saveTeamGroup({
                                ...grp,
                                memberAssignments: grp.memberAssignments.filter(
                                  (x) => x.id !== ma.id,
                                ),
                              })
                            }
                            className="shrink-0 text-[11px] text-rose-200 hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {editGroup && (
          <div
            className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Team Group and Roster"
          >
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (saveTeamGroup(editGroup)) setEditGroup(null);
              }}
              className="w-full max-w-lg rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-4 text-xs shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
                <h2 className="font-serif text-xl font-medium text-[color:var(--wm-ink)]">
                  Team Group & Roster
                </h2>
                <button
                  type="button"
                  onClick={() => setEditGroup(null)}
                  aria-label="Close modal"
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/10 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[color:var(--wm-ink-secondary)]">Group Name</label>
                  <input
                    required
                    type="text"
                    value={editGroup.name}
                    onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })}
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                  />
                </div>
                <div>
                  <label className="text-[color:var(--wm-ink-secondary)]">Supervisor</label>
                  <input
                    type="text"
                    value={editGroup.supervisorName}
                    onChange={(e) =>
                      setEditGroup({ ...editGroup, supervisorName: e.target.value })
                    }
                    className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Responsibility</label>
                <input
                  type="text"
                  value={editGroup.responsibility}
                  onChange={(e) => setEditGroup({ ...editGroup, responsibility: e.target.value })}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
              <div className="border-t border-[color:var(--wm-hairline)] pt-3 space-y-2">
                <label className="text-[color:var(--wm-accent)] font-medium block">
                  Assign Accepted Applicant to Group
                </label>
                <div className="flex gap-2">
                  <select
                    value={assignApplicantId}
                    onChange={(e) => setAssignApplicantId(e.target.value)}
                    className="h-9 flex-1 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-[color:var(--wm-ink)]"
                  >
                    <option value="">Select accepted applicant...</option>
                    {acceptedApplicants.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.applicantName} ({a.position})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const app = data.applications.find((a) => a.id === assignApplicantId);
                      if (!app) return;
                      setEditGroup({
                        ...editGroup,
                        memberAssignments: [
                          ...editGroup.memberAssignments,
                          {
                            id: `ma-${Date.now().toString(36)}`,
                            memberName: app.applicantName,
                            email: app.email,
                            position: app.position,
                            applicationId: app.id,
                          },
                        ],
                      });
                      setAssignApplicantId('');
                    }}
                    className="h-9 rounded border border-[color:var(--wm-accent)]/50 px-3 font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                  >
                    Assign
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-[color:var(--wm-hairline)] pt-4">
                <button
                  type="button"
                  onClick={() => setEditGroup(null)}
                  className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
                >
                  Save Group
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Shifts & Deployment Planner
  return (
    <div className="space-y-5">
      <div className="wm-surface-panel px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {mode === 'deployment' ? (
            <MapPin className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
          ) : (
            <Clock className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
          )}
          <span className="text-xs text-[color:var(--wm-ink-secondary)]">
            Shift & Deployment Schedule: assign stations, locations, supervisors, and required
            headcount.
          </span>
          {!lockedDepartmentId && (
            <select
              aria-label="Filter shifts by department"
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
        <button
          type="button"
          onClick={() =>
            setEditShift({
              id: '',
              departmentId:
                lockedDepartmentId ?? (effectiveDept !== 'all' ? effectiveDept : 'security'),
              title: 'New Shift Block',
              dutyDescription: 'Station coverage and rapid escalation support.',
              location: 'Grand Auditorium',
              station: 'Station 01',
              sectionLabel: 'Zone A',
              supervisorName: 'Department Head',
              startTime: '2026-12-18 09:00',
              endTime: '2026-12-18 13:00',
              assignedPersonnel: [],
              requiredHeadcount: 3,
              status: 'scheduled',
            })
          }
          className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3.5 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Schedule Shift / Station</span>
        </button>
      </div>

      <section className="wm-surface-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wm-ink-muted)]">
                <th className="py-3 px-4">Shift Block & Duty</th>
                <th className="py-3 px-4">Location & Station</th>
                <th className="py-3 px-4">Window & Supervisor</th>
                <th className="py-3 px-4">Staffing & Roster</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--wm-hairline)]">
              {shifts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-xs text-[color:var(--wm-ink-muted)]"
                  >
                    No shifts or stations match the active department filter.
                  </td>
                </tr>
              ) : (
                shifts.map((sh) => {
                  const understaffed = sh.assignedPersonnel.length < sh.requiredHeadcount;
                  return (
                    <tr key={sh.id} className="hover:bg-[#ede6ca]/[0.03] align-top">
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-mono text-[11px] text-[color:var(--wm-accent)]">
                          {deptNameById.get(sh.departmentId) ?? sh.departmentId} ·{' '}
                          {sh.sectionLabel}
                        </p>
                        <p className="mt-0.5 font-medium text-sm text-[color:var(--wm-ink)]">
                          {sh.title}
                        </p>
                        <p className="mt-1 text-[color:var(--wm-ink-secondary)] leading-relaxed">
                          {sh.dutyDescription}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-medium text-[color:var(--wm-ink)]">{sh.location}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-[color:var(--wm-ink-muted)]">
                          {sh.station}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-mono text-[11px] text-[color:var(--wm-ink)] tabular-nums">
                          {sh.startTime} to {sh.endTime.slice(11)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[color:var(--wm-ink-secondary)]">
                          Sup: {sh.supervisorName}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium tabular-nums ${
                            understaffed
                              ? 'border-amber-400/35 bg-amber-500/[0.1] text-amber-200'
                              : 'border-emerald-400/35 bg-emerald-500/[0.1] text-emerald-200'
                          }`}
                        >
                          {sh.assignedPersonnel.length}/{sh.requiredHeadcount} Staffed
                        </span>
                        <p className="mt-1.5 text-[11px] text-[color:var(--wm-ink-secondary)]">
                          {sh.assignedPersonnel.join(', ') || 'No personnel assigned yet'}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditShift(structuredClone(sh))}
                            className="h-8 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-[11px] font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteShift(sh.id)}
                            aria-label={`Delete ${sh.title}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-400/35 text-rose-200 hover:bg-rose-500/15 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editShift && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Shift and Station Deployment"
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (saveShift(editShift)) setEditShift(null);
            }}
            className="w-full max-w-lg rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-4 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
              <h2 className="font-serif text-xl font-medium text-[color:var(--wm-ink)]">
                Shift & Station Deployment
              </h2>
              <button
                type="button"
                onClick={() => setEditShift(null)}
                aria-label="Close modal"
                className="inline-flex h-8 w-8 items-center justify-center rounded text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/10 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Title</label>
                <input
                  required
                  type="text"
                  value={editShift.title}
                  onChange={(e) => setEditShift({ ...editShift, title: e.target.value })}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Location</label>
                <input
                  required
                  type="text"
                  value={editShift.location}
                  onChange={(e) => setEditShift({ ...editShift, location: e.target.value })}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Station</label>
                <input
                  type="text"
                  value={editShift.station}
                  onChange={(e) => setEditShift({ ...editShift, station: e.target.value })}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Required Headcount</label>
                <input
                  type="number"
                  min={1}
                  value={editShift.requiredHeadcount}
                  onChange={(e) =>
                    setEditShift({ ...editShift, requiredHeadcount: Number(e.target.value) || 1 })
                  }
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
            </div>
            <div>
              <label className="text-[color:var(--wm-ink-secondary)]">
                Assigned Personnel (comma-separated)
              </label>
              <input
                type="text"
                value={editShift.assignedPersonnel.join(', ')}
                onChange={(e) =>
                  setEditShift({
                    ...editShift,
                    assignedPersonnel: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-[color:var(--wm-hairline)] pt-4">
              <button
                type="button"
                onClick={() => setEditShift(null)}
                className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
              >
                Save Shift
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
