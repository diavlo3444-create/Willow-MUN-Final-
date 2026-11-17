import { useMemo, useState, type FormEvent } from 'react';
import {
  Check,
  Copy,
  Edit3,
  FlaskConical,
  KeyRound,
  Lock,
  Plus,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type {
  PermissionDefinition,
  PermissionKey,
  PermissionMap,
  RoleDefinition,
} from '../../../types/admin';
import {
  ADMIN_DEFAULT_PERMISSIONS,
  buildPermissionMap,
  canManageAccountsOrRoles,
  PERMISSION_DEFINITIONS,
} from '../../../utils/adminPermissions';
import { ConfirmDialog } from '../ConfirmDialog';

interface RolesPermissionsViewProps {
  section: 'roles' | 'permission-defs';
}

const CATEGORIES = Array.from(new Set(PERMISSION_DEFINITIONS.map((p) => p.category)));

export function RolesPermissionsView({ section }: RolesPermissionsViewProps) {
  const {
    currentUser,
    data,
    saveRoleDefinition,
    deleteRoleDefinition,
    updatePermissionDefinition,
  } = useAdminStore();

  const isSuperAdmin = canManageAccountsOrRoles(currentUser);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [deletingRole, setDeletingRole] = useState<RoleDefinition | null>(null);
  const [editingPerm, setEditingPerm] = useState<PermissionDefinition | null>(null);

  const userCountsByRoleDef = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of data.users) {
      map.set(u.roleDefinitionId, (map.get(u.roleDefinitionId) ?? 0) + 1);
    }
    return map;
  }, [data.users]);

  const startCreateRole = (template?: RoleDefinition) => {
    const now = new Date().toISOString();
    setEditingRole({
      id: `role-${Date.now().toString(36)}`,
      key: 'admin',
      name: template ? `${template.name} (Copy)` : 'Custom Operations Role',
      description: template?.description ?? 'Custom Willow MUN permission profile.',
      isSystem: false,
      defaultPermissions: buildPermissionMap(
        template?.defaultPermissions ?? ADMIN_DEFAULT_PERMISSIONS,
      ),
      createdAt: now,
      updatedAt: now,
    });
  };

  if (section === 'permission-defs') {
    if (!isSuperAdmin) {
      return (
        <div className="rounded-md border border-rose-400/35 bg-rose-500/[0.08] p-6 flex items-start gap-3">
          <Lock className="h-5 w-5 text-rose-200 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="text-xs">
            <p className="font-semibold text-rose-100">Super Admin Authorization Required</p>
            <p className="mt-1 text-[color:var(--wm-ink-secondary)]">
              Global permission definitions are strictly protected for Super Admin accounts.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="wm-surface-panel px-5 py-4">
          <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
            Global Permission Definitions
          </h2>
          <p className="text-xs text-[color:var(--wm-ink-secondary)] mt-0.5">
            Inspect and refine capability descriptions across all {data.permissionDefinitions.length}{' '}
            RBAC keys. Keys marked Super Admin Only cannot be delegated to Admin or Department Head
            roles.
          </p>
        </div>

        <div className="space-y-5">
          {CATEGORIES.map((category) => {
            const defs = data.permissionDefinitions.filter((p) => p.category === category);
            return (
              <section key={category} className="wm-surface-panel overflow-hidden">
                <div className="px-5 py-3 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)]">
                  <h3 className="wm-section-kicker text-[color:var(--wm-accent)]">{category}</h3>
                </div>
                <div className="divide-y divide-[color:var(--wm-hairline)]">
                  {defs.map((perm) => (
                    <div
                      key={perm.key}
                      className="px-5 py-3.5 flex items-start justify-between gap-4 hover:bg-[#ede6ca]/[0.02]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-xs font-semibold text-[color:var(--wm-ink)]">
                            {perm.label}
                          </span>
                          <span className="font-mono text-[11px] text-[color:var(--wm-accent)]">
                            {perm.key}
                          </span>
                          {perm.superAdminOnly && (
                            <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-amber-200">
                              · Super Admin Only
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                          {perm.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPerm({ ...perm })}
                        aria-label={`Edit permission ${perm.label}`}
                        className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded border border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {editingPerm && (
          <div
            className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Edit Permission Rule ${editingPerm.key}`}
          >
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (
                  updatePermissionDefinition(editingPerm.key, {
                    label: editingPerm.label,
                    description: editingPerm.description,
                  })
                ) {
                  setEditingPerm(null);
                }
              }}
              className="w-full max-w-md rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-4 text-xs shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
                <h3 className="font-serif text-xl font-medium text-[color:var(--wm-ink)]">
                  Edit Permission Rule · {editingPerm.key}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingPerm(null)}
                  aria-label="Close modal"
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/10 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Label</label>
                <input
                  required
                  value={editingPerm.label}
                  onChange={(e) => setEditingPerm({ ...editingPerm, label: e.target.value })}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Description</label>
                <textarea
                  required
                  rows={3}
                  value={editingPerm.description}
                  onChange={(e) => setEditingPerm({ ...editingPerm, description: e.target.value })}
                  className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] p-2.5 text-[color:var(--wm-ink)]"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-[color:var(--wm-hairline)] pt-4">
                <button
                  type="button"
                  onClick={() => setEditingPerm(null)}
                  className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!isSuperAdmin && (
        <div
          role="status"
          className="rounded-md border border-amber-400/35 bg-amber-500/[0.08] p-4 flex items-start gap-3"
        >
          <Lock className="h-5 w-5 shrink-0 text-amber-200 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-[color:var(--wm-ink-secondary)]">
            <strong className="text-amber-100">Read-Only Role Directory:</strong> Creating,
            editing, cloning, or deleting role definitions is restricted exclusively to Super Admins.
          </p>
        </div>
      )}

      <div className="wm-surface-panel px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
            Conference Role Definitions
          </h2>
          <p className="text-xs text-[color:var(--wm-ink-secondary)]">
            Reusable permission templates assigned to Super Admin, Admin, and Department Head
            accounts.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => startCreateRole()}
            className="inline-flex h-9 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Create Role Definition</span>
          </button>
        )}
      </div>

      {/* Role Registry Directory */}
      <section className="wm-surface-panel divide-y divide-[color:var(--wm-hairline)]">
        {data.roleDefinitions.map((roleDef) => {
          const permCount = Object.values(roleDef.defaultPermissions).filter(Boolean).length;
          const userCount = userCountsByRoleDef.get(roleDef.id) ?? 0;

          return (
            <article
              key={roleDef.id}
              className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:bg-[#ede6ca]/[0.02]"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <KeyRound className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
                  <h3 className="font-serif text-xl font-medium text-[color:var(--wm-ink)]">
                    {roleDef.name}
                  </h3>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-medium ${
                      roleDef.isSystem
                        ? 'border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink)]'
                        : 'border-[color:var(--wm-accent)]/40 bg-[#6b7547]/20 text-[color:var(--wm-accent)]'
                    }`}
                  >
                    {roleDef.isSystem ? 'System Role' : 'Custom Role'}
                  </span>
                </div>
                <p className="text-xs text-[color:var(--wm-ink-secondary)]">{roleDef.description}</p>
                <div className="flex flex-wrap gap-3 pt-1 font-mono text-[11px] text-[color:var(--wm-ink-muted)] tabular-nums">
                  <span>
                    Key: <strong className="text-[color:var(--wm-ink)]">{roleDef.key}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Capabilities:{' '}
                    <strong className="text-[color:var(--wm-accent)]">
                      {roleDef.key === 'super_admin' ? 'All' : permCount}
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    Assigned Users: <strong className="text-[color:var(--wm-ink)]">{userCount}</strong>
                  </span>
                </div>
              </div>

              {isSuperAdmin && (
                <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => startCreateRole(roleDef)}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Clone</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRole(structuredClone(roleDef))}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Configure Permissions</span>
                  </button>
                  {!roleDef.isSystem && (
                    <button
                      type="button"
                      onClick={() => setDeletingRole(roleDef)}
                      aria-label={`Delete ${roleDef.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-400/35 text-rose-200 hover:bg-rose-500/15 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>

      {/* Role Definition Editor Modal */}
      {isSuperAdmin && editingRole && (
        <div
          className="fixed inset-0 z-[115] overflow-y-auto bg-black/75 px-3 sm:px-6 py-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Configure Role Definition ${editingRole.name}`}
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (saveRoleDefinition({ ...editingRole, updatedAt: new Date().toISOString() })) {
                setEditingRole(null);
              }
            }}
            className="mx-auto w-full max-w-3xl rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-4 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
              <h3 className="font-serif text-xl font-medium text-[color:var(--wm-ink)] inline-flex items-center gap-2">
                <Shield className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
                <span>Configure Role Definition · {editingRole.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingRole(null)}
                aria-label="Close modal"
                className="inline-flex h-8 w-8 items-center justify-center rounded text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/10 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Role Name</label>
                <input
                  required
                  value={editingRole.name}
                  onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
              <div>
                <label className="text-[color:var(--wm-ink-secondary)]">Base Access Level</label>
                <select
                  disabled={editingRole.isSystem}
                  value={editingRole.key}
                  onChange={(e) =>
                    setEditingRole({
                      ...editingRole,
                      key: e.target.value as RoleDefinition['key'],
                    })
                  }
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)] disabled:opacity-60"
                >
                  <option value="admin">Admin</option>
                  <option value="department_head">Department Head</option>
                  {editingRole.isSystem && <option value="super_admin">Super Admin</option>}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-[color:var(--wm-ink-secondary)]">Description</label>
                <input
                  required
                  value={editingRole.description}
                  onChange={(e) =>
                    setEditingRole({ ...editingRole, description: e.target.value })
                  }
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
            </div>

            <div className="border border-[color:var(--wm-hairline)] rounded bg-[color:var(--wm-rail)] divide-y divide-[color:var(--wm-hairline)] max-h-80 overflow-y-auto">
              {CATEGORIES.map((category) => {
                const items = PERMISSION_DEFINITIONS.filter((p) => p.category === category);
                return (
                  <div key={category} className="p-3.5 space-y-2.5">
                    <p className="wm-section-kicker text-[color:var(--wm-accent)]">{category}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {items.map((perm) => {
                        const locked =
                          perm.superAdminOnly && editingRole.key !== 'super_admin';
                        const checked =
                          editingRole.key === 'super_admin'
                            ? true
                            : locked
                              ? false
                              : Boolean(editingRole.defaultPermissions[perm.key as PermissionKey]);

                        return (
                          <label
                            key={perm.key}
                            className={`flex items-start gap-2.5 ${
                              locked ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={checked}
                              disabled={editingRole.key === 'super_admin' || Boolean(locked)}
                              onClick={() =>
                                setEditingRole({
                                  ...editingRole,
                                  defaultPermissions: {
                                    ...(editingRole.defaultPermissions as PermissionMap),
                                    [perm.key]: !checked,
                                  },
                                })
                              }
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                checked
                                  ? 'border-[#a9b47e] bg-[#a9b47e] text-[#14180a]'
                                  : 'border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)]'
                              }`}
                            >
                              {checked && <Check className="h-3 w-3" aria-hidden="true" />}
                            </button>
                            <div>
                              <p className="text-xs font-medium text-[color:var(--wm-ink)]">
                                {perm.label}
                              </p>
                              <p className="text-[11px] text-[color:var(--wm-ink-muted)]">
                                {perm.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 border-t border-[color:var(--wm-hairline)] pt-4">
              <button
                type="button"
                onClick={() => setEditingRole(null)}
                className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
              >
                Save Role Definition
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={deletingRole !== null}
        title="Delete Role Definition"
        description={
          deletingRole
            ? `Delete custom role "${deletingRole.name}"? Ensure no active accounts rely on it before removing.`
            : ''
        }
        confirmLabel="Delete Role"
        tone="danger"
        onConfirm={() => {
          if (deletingRole) deleteRoleDefinition(deletingRole.id);
          setDeletingRole(null);
        }}
        onCancel={() => setDeletingRole(null)}
      />
    </div>
  );
}

export function DepartmentTestingView({
  onEnterTestingMode,
}: {
  onEnterTestingMode: () => void;
}) {
  const { data, currentUser, enterDepartmentTestMode } = useAdminStore();
  const deptById = useMemo(
    () => new Map(data.departments.map((d) => [d.id, d])),
    [data.departments],
  );
  const headUsers = data.users.filter((u) => u.role === 'department_head');

  if (!canManageAccountsOrRoles(currentUser)) {
    return (
      <div className="rounded-md border border-rose-400/35 bg-rose-500/[0.08] p-6 flex items-start gap-3">
        <Lock className="h-5 w-5 text-rose-200 mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-xs text-[color:var(--wm-ink-secondary)]">
          Department Access Testing Mode is exclusively restricted to Super Admins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="wm-surface-panel p-5 flex items-start gap-3">
        <FlaskConical
          className="h-5 w-5 text-[color:var(--wm-accent)] mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <div className="text-xs space-y-1">
          <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
            Department Access Testing Mode
          </h2>
          <p className="text-[color:var(--wm-ink-secondary)]">
            Launch an isolated <code className="text-[color:var(--wm-ink)]">/head</code> preview
            session acting as any Department Head account to verify department-scoped applications,
            Stage 1 recommendation workflow, 13-module workspace isolation, and QR passes without
            signing out of your Super Admin session.
          </p>
        </div>
      </div>

      {/* Unified Head Preview Launcher Table */}
      <section className="wm-surface-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wm-ink-muted)]">
                <th className="py-3 px-4">Department Head</th>
                <th className="py-3 px-4">Assigned Department</th>
                <th className="py-3 px-4">Intake & Volume</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Preview Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--wm-hairline)]">
              {headUsers.map((head) => {
                const dept = head.departmentId ? deptById.get(head.departmentId) ?? null : null;
                const deptApps = data.applications.filter(
                  (a) => a.departmentId === head.departmentId,
                );

                return (
                  <tr key={head.id} className="hover:bg-[#ede6ca]/[0.03]">
                    <td className="py-3.5 px-4">
                      <p className="text-sm font-medium text-[color:var(--wm-ink)]">
                        {head.fullName}
                      </p>
                      <p className="text-[11px] text-[color:var(--wm-ink-secondary)]">
                        {head.email}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[color:var(--wm-accent)]">
                      {dept ? dept.name : 'Unassigned Department'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[color:var(--wm-ink-secondary)] tabular-nums">
                      {deptApps.length} app(s) ·{' '}
                      {dept?.registrationOpen ? 'Intake Open' : 'Intake Closed'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] capitalize font-medium ${
                          head.isActive
                            ? 'border-emerald-400/35 bg-emerald-500/[0.1] text-emerald-200'
                            : 'border-rose-400/35 bg-rose-500/[0.1] text-rose-200'
                        }`}
                      >
                        {head.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        disabled={!dept}
                        onClick={() => {
                          if (enterDepartmentTestMode(head.id)) {
                            onEnterTestingMode();
                          }
                        }}
                        className="inline-flex h-8 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] disabled:opacity-40 cursor-pointer"
                      >
                        <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Launch /head as {head.fullName.split(' ')[0]}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
