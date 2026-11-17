import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  Edit3,
  KeyRound,
  Link2,
  Lock,
  MailCheck,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type {
  AccountStatus,
  AdminUser,
  PermissionKey,
  PermissionMap,
  RoleType,
} from '../../../types/admin';
import {
  buildPermissionMap,
  canManageAccountsOrRoles,
  getRoleLabel,
  PERMISSION_DEFINITIONS,
  ROLE_DEFAULT_PERMISSIONS,
} from '../../../utils/adminPermissions';
import { ConfirmDialog } from '../ConfirmDialog';
import { RoleBadge } from '../StatusBadge';

interface AccountsViewProps {
  mode: 'admins' | 'heads';
}

export function AccountsView({ mode }: AccountsViewProps) {
  const {
    currentUser,
    data,
    createAccount,
    updateAccount,
    suspendAccount,
    reactivateAccount,
    resetAccountPassword,
    manageAccountInvitation,
    deleteAccount,
    retryDepartmentAssignment,
  } = useAdminStore();

  const isSuperAdmin = canManageAccountsOrRoles(currentUser);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [editorState, setEditorState] = useState<{
    mode: 'create' | 'edit';
    user?: AdminUser;
  } | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [tempPassword, setTempPassword] = useState('willow-reset-2026');
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AdminUser | null>(null);
  const [retryUser, setRetryUser] = useState<AdminUser | null>(null);
  const [retryDeptId, setRetryDeptId] = useState<string>(data.departments[0]?.id ?? 'hr');

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.users.filter((u) => {
      if (mode === 'admins') {
        if (u.role !== 'admin' && u.role !== 'super_admin') return false;
      } else {
        if (u.role !== 'department_head') return false;
      }
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (mode === 'heads' && deptFilter !== 'all' && u.departmentId !== deptFilter) {
        return false;
      }
      if (q) {
        const deptName = data.departments.find((d) => d.id === u.departmentId)?.name ?? '';
        if (
          !`${u.fullName} ${u.email} ${u.title} ${u.division ?? ''} ${deptName}`
            .toLowerCase()
            .includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [data.departments, data.users, deptFilter, mode, search, statusFilter]);

  const deptById = useMemo(
    () => new Map(data.departments.map((d) => [d.id, d])),
    [data.departments],
  );

  return (
    <div className="space-y-5">
      {/* Admin Read-Only Security Notice */}
      {!isSuperAdmin && (
        <div
          role="status"
          className="rounded-md border border-amber-400/35 bg-amber-500/[0.08] p-4 flex items-start gap-3"
        >
          <Lock className="h-5 w-5 shrink-0 text-amber-200 mt-0.5" aria-hidden="true" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-100">
              Read-Only Directory: Account Governance Reserved for Super Admin
            </p>
            <p className="text-[color:var(--wm-ink-secondary)]">
              Administrators can view {mode === 'admins' ? 'administrator' : 'department head'}{' '}
              rosters, assigned divisions, and current status. Creating, editing, changing emails,
              suspending, reactivating, resetting passwords, sending invitations, or deleting
              accounts is strictly locked for Admin users.
            </p>
          </div>
        </div>
      )}

      {/* Workbench Header + Filters */}
      <div className="wm-surface-panel overflow-hidden">
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--wm-hairline)]">
          <div>
            <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
              {mode === 'admins'
                ? 'Executive & Administrator Accounts'
                : 'Department Head Accounts'}
            </h2>
            <p className="text-xs text-[color:var(--wm-ink-secondary)]">
              {mode === 'admins'
                ? 'Conference executives with cross-departmental oversight and system governance.'
                : 'Leaders scoped exclusively to an assigned Willow MUN department.'}
            </p>
          </div>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setEditorState({ mode: 'create' })}
              className="inline-flex min-h-[38px] items-center gap-2 rounded bg-[color:var(--wm-focal)] px-4 py-2 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>
                {mode === 'heads' ? 'Create Department Head' : 'Create Administrator'}
              </span>
            </button>
          )}
        </div>

        <div className="px-5 py-3 bg-[color:var(--wm-inset)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'active', 'suspended', 'invited'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded px-3 py-1.5 font-medium capitalize transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[color:var(--wm-focal)] text-[#12170c]'
                    : 'text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/8 hover:text-[color:var(--wm-ink)]'
                }`}
              >
                {st === 'all' ? `All (${filteredUsers.length})` : st}
              </button>
            ))}

            {mode === 'heads' && (
              <select
                aria-label="Filter by department"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="ml-1 h-8 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-xs text-[color:var(--wm-ink)]"
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

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, division..."
            aria-label="Search accounts"
            className="h-9 w-full sm:w-64 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
          />
        </div>
      </div>

      {/* Directory Table */}
      <section className="wm-surface-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wm-ink-muted)]">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role Definition</th>
                <th className="px-4 py-3">
                  {mode === 'heads' ? 'Assigned Department' : 'Division / Scope'}
                </th>
                <th className="px-4 py-3">Invitation</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Active</th>
                {isSuperAdmin && <th className="px-4 py-3 text-right">Super Admin Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--wm-hairline)]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={isSuperAdmin ? 7 : 6}
                    className="px-6 py-10 text-center text-xs text-[color:var(--wm-ink-muted)]"
                  >
                    No accounts match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const dept = user.departmentId ? deptById.get(user.departmentId) ?? null : null;
                  const roleDef = data.roleDefinitions.find((r) => r.id === user.roleDefinitionId);
                  const enabledPerms = Object.values(user.permissions).filter(Boolean).length;
                  const needsDeptRetry = user.role === 'department_head' && !dept;
                  const isSelf = currentUser?.id === user.id;

                  return (
                    <tr key={user.id} className="hover:bg-[#ede6ca]/[0.03] align-top">
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium text-[color:var(--wm-ink)]">
                          {user.fullName}
                        </p>
                        <p className="text-xs text-[color:var(--wm-ink-secondary)]">{user.email}</p>
                        <p className="text-[11px] text-[color:var(--wm-ink-muted)]">{user.title}</p>
                      </td>

                      <td className="px-4 py-3.5 space-y-1">
                        <RoleBadge role={user.role} />
                        <p className="font-mono text-[11px] text-[color:var(--wm-ink-muted)] tabular-nums">
                          {roleDef?.name ?? getRoleLabel(user.role)} ·{' '}
                          {user.role === 'super_admin' ? 'All perms' : `${enabledPerms} perms`}
                        </p>
                      </td>

                      <td className="px-4 py-3.5">
                        {mode === 'heads' ? (
                          dept ? (
                            <div>
                              <p className="font-medium text-[color:var(--wm-accent)]">
                                {dept.name}
                              </p>
                              <p className="text-[11px] text-[color:var(--wm-ink-muted)]">
                                {dept.cluster}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 rounded border border-rose-400/35 bg-rose-500/[0.1] px-2 py-0.5 text-[11px] text-rose-200">
                                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                Unlinked Department
                              </span>
                              {isSuperAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRetryUser(user);
                                    setRetryDeptId(data.departments[0]?.id ?? 'hr');
                                  }}
                                  className="block text-[11px] text-[color:var(--wm-accent)] hover:underline cursor-pointer"
                                >
                                  Retry Department Assignment
                                </button>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-[color:var(--wm-ink)]">
                            {user.division ?? 'Conference Executive Board'}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block rounded border px-2 py-0.5 text-[11px] capitalize ${
                            user.invitationStatus === 'accepted'
                              ? 'border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-200'
                              : user.invitationStatus === 'pending'
                                ? 'border-amber-400/35 bg-amber-500/[0.08] text-amber-200'
                                : 'border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink-muted)]'
                          }`}
                        >
                          {user.invitationStatus}
                        </span>
                        {user.invitationToken && (
                          <p className="mt-1 font-mono text-[10px] text-[color:var(--wm-accent)] select-all">
                            {user.invitationToken}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium capitalize ${
                            user.status === 'active'
                              ? 'border-emerald-400/35 bg-emerald-500/[0.1] text-emerald-200'
                              : user.status === 'invited'
                                ? 'border-amber-400/35 bg-amber-500/[0.1] text-amber-200'
                                : 'border-rose-400/35 bg-rose-500/[0.1] text-rose-200'
                          }`}
                        >
                          {user.status === 'active' ? (
                            <UserCheck className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <UserX className="h-3 w-3" aria-hidden="true" />
                          )}
                          <span>{user.status}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-mono text-[11px] text-[color:var(--wm-ink-muted)] tabular-nums whitespace-nowrap">
                        {new Date(user.lastActiveAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      {isSuperAdmin && (
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditorState({ mode: 'edit', user })}
                              aria-label={`Edit ${user.fullName}`}
                              className="inline-flex h-8 items-center gap-1 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-[11px] font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3" aria-hidden="true" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setResetTarget(user);
                                setTempPassword('willow-temp-2026');
                              }}
                              aria-label={`Reset password for ${user.fullName}`}
                              className="inline-flex h-8 items-center gap-1 rounded border border-[color:var(--wm-hairline)] px-2.5 text-[11px] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                              title="Reset Password"
                            >
                              <KeyRound className="h-3 w-3" aria-hidden="true" />
                              <span>Reset PW</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                manageAccountInvitation(
                                  user.id,
                                  user.invitationStatus === 'pending' ? 'revoke' : 'generate',
                                )
                              }
                              className="inline-flex h-8 items-center gap-1 rounded border border-[color:var(--wm-hairline)] px-2.5 text-[11px] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                              title={
                                user.invitationStatus === 'pending'
                                  ? 'Revoke Invitation'
                                  : 'Generate Invitation'
                              }
                            >
                              {user.invitationStatus === 'pending' ? (
                                <>
                                  <Link2 className="h-3 w-3" aria-hidden="true" />
                                  <span>Revoke Invite</span>
                                </>
                              ) : (
                                <>
                                  <MailCheck className="h-3 w-3" aria-hidden="true" />
                                  <span>Invite</span>
                                </>
                              )}
                            </button>

                            {!isSelf && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    user.status === 'suspended'
                                      ? reactivateAccount(user.id)
                                      : suspendAccount(user.id)
                                  }
                                  className={`h-8 rounded border px-2.5 text-[11px] font-medium cursor-pointer ${
                                    user.status === 'suspended'
                                      ? 'border-emerald-400/35 text-emerald-200 hover:bg-emerald-500/15'
                                      : 'border-amber-400/35 text-amber-200 hover:bg-amber-500/15'
                                  }`}
                                >
                                  {user.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                                </button>

                                {needsDeptRetry && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRetryUser(user);
                                      setRetryDeptId(data.departments[0]?.id ?? 'hr');
                                    }}
                                    className="inline-flex h-8 items-center gap-1 rounded border border-[color:var(--wm-accent)]/40 px-2.5 text-[11px] text-[color:var(--wm-accent)] cursor-pointer"
                                  >
                                    <RefreshCw className="h-3 w-3" aria-hidden="true" />
                                    <span>Link Dept</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteUser(user)}
                                  aria-label={`Delete ${user.fullName}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-400/30 text-rose-200 hover:bg-rose-500/15 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Account Create / Edit Modal */}
      {isSuperAdmin && editorState && (
        <AccountEditorModal
          mode={editorState.mode}
          portalSection={mode}
          existingUser={editorState.user}
          roleDefinitions={data.roleDefinitions}
          departments={data.departments}
          onClose={() => setEditorState(null)}
          onSaveCreate={(payload) => {
            const ok = createAccount(payload);
            if (ok) setEditorState(null);
          }}
          onSaveEdit={(userId, patch) => {
            const ok = updateAccount(userId, patch);
            if (ok) setEditorState(null);
          }}
        />
      )}

      {/* Password Reset Modal */}
      {isSuperAdmin && resetTarget && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Reset Password for ${resetTarget.fullName}`}
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (resetAccountPassword(resetTarget.id, tempPassword)) {
                setResetTarget(null);
              }
            }}
            className="w-full max-w-md rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-4 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
              <h3 className="font-serif text-xl font-medium text-[color:var(--wm-ink)]">
                Reset Password · {resetTarget.fullName}
              </h3>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                aria-label="Close reset password modal"
                className="inline-flex h-8 w-8 items-center justify-center rounded text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/10 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div>
              <label htmlFor="reset-pw-input" className="text-[color:var(--wm-ink-secondary)]">
                New Temporary Password (min 6 characters)
              </label>
              <input
                id="reset-pw-input"
                type="text"
                required
                minLength={6}
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                className="mt-1.5 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-[color:var(--wm-hairline)] pt-4">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
              >
                Apply Password Reset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Retry Department Assignment Modal */}
      {isSuperAdmin && retryUser && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Retry Department Assignment for ${retryUser.fullName}`}
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (retryDepartmentAssignment(retryUser.id, retryDeptId)) {
                setRetryUser(null);
              }
            }}
            className="w-full max-w-md rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 space-y-4 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
              <h3 className="font-serif text-xl font-medium text-[color:var(--wm-ink)]">
                Retry Department Assignment · {retryUser.fullName}
              </h3>
              <button
                type="button"
                onClick={() => setRetryUser(null)}
                aria-label="Close assignment modal"
                className="inline-flex h-8 w-8 items-center justify-center rounded text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/10 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div>
              <label htmlFor="retry-dept-select" className="text-[color:var(--wm-ink-secondary)]">
                Link Department
              </label>
              <select
                id="retry-dept-select"
                value={retryDeptId}
                onChange={(e) => setRetryDeptId(e.target.value)}
                className="mt-1.5 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
              >
                {data.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 border-t border-[color:var(--wm-hairline)] pt-4">
              <button
                type="button"
                onClick={() => setRetryUser(null)}
                className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
              >
                Complete Department Link
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteUser !== null}
        title="Delete Staff Account"
        description={
          confirmDeleteUser
            ? `Permanently delete ${confirmDeleteUser.fullName} (${confirmDeleteUser.email})? They will lose portal access and be unlinked from any assigned department.`
            : ''
        }
        confirmLabel="Delete Account"
        tone="danger"
        onConfirm={() => {
          if (confirmDeleteUser) {
            deleteAccount(confirmDeleteUser.id);
          }
          setConfirmDeleteUser(null);
        }}
        onCancel={() => setConfirmDeleteUser(null)}
      />
    </div>
  );
}

interface AccountEditorModalProps {
  mode: 'create' | 'edit';
  portalSection: 'admins' | 'heads';
  existingUser?: AdminUser;
  roleDefinitions: Array<{
    id: string;
    key: RoleType | string;
    name: string;
    defaultPermissions: PermissionMap;
  }>;
  departments: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaveCreate: (input: {
    fullName: string;
    email: string;
    password: string;
    role: RoleType;
    roleDefinitionId: string;
    title: string;
    departmentId: string | null;
    division: string | null;
    isActive: boolean;
    sendInvitation: boolean;
    permissions: PermissionMap;
  }) => void;
  onSaveEdit: (
    userId: string,
    patch: {
      fullName: string;
      email: string;
      role: RoleType;
      roleDefinitionId: string;
      title: string;
      departmentId: string | null;
      division: string | null;
      permissions: PermissionMap;
    },
  ) => void;
}

const PERMISSION_CATEGORIES = Array.from(
  new Set(PERMISSION_DEFINITIONS.map((p) => p.category)),
);

function AccountEditorModal({
  mode,
  portalSection,
  existingUser,
  roleDefinitions,
  departments,
  onClose,
  onSaveCreate,
  onSaveEdit,
}: AccountEditorModalProps) {
  const defaultRole: RoleType =
    existingUser?.role ?? (portalSection === 'heads' ? 'department_head' : 'admin');
  const defaultRoleDef =
    roleDefinitions.find((r) => r.id === existingUser?.roleDefinitionId) ??
    roleDefinitions.find((r) => r.key === defaultRole) ??
    roleDefinitions[0];

  const [fullName, setFullName] = useState(existingUser?.fullName ?? '');
  const [email, setEmail] = useState(existingUser?.email ?? '');
  const [password, setPassword] = useState('willow-staff-2026');
  const [sendInvitation, setSendInvitation] = useState(false);
  const [role, setRole] = useState<RoleType>(defaultRole);
  const [roleDefinitionId, setRoleDefinitionId] = useState(
    existingUser?.roleDefinitionId ?? defaultRoleDef?.id ?? 'role-admin',
  );
  const [title, setTitle] = useState(existingUser?.title ?? '');
  const [division, setDivision] = useState(
    existingUser?.division ?? (portalSection === 'admins' ? 'Executive Operations' : ''),
  );
  const [departmentId, setDepartmentId] = useState<string>(
    existingUser?.departmentId ?? departments[0]?.id ?? 'hr',
  );
  const [isActive, setIsActive] = useState<boolean>(existingUser?.isActive ?? true);
  const [permissions, setPermissions] = useState<PermissionMap>(
    existingUser?.permissions
      ? { ...existingUser.permissions }
      : { ...(defaultRoleDef?.defaultPermissions ?? ROLE_DEFAULT_PERMISSIONS[defaultRole]) },
  );

  const handleRoleDefChange = (nextDefId: string) => {
    setRoleDefinitionId(nextDefId);
    const chosen = roleDefinitions.find((r) => r.id === nextDefId);
    if (!chosen) return;
    const mappedRole: RoleType =
      chosen.key === 'super_admin' || chosen.key === 'department_head' ? chosen.key : 'admin';
    setRole(mappedRole);
    setPermissions(buildPermissionMap(chosen.defaultPermissions));
  };

  const togglePerm = (key: PermissionKey) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const resolvedDept = role === 'department_head' ? departmentId : null;
    if (mode === 'create') {
      onSaveCreate({
        fullName,
        email,
        password,
        role,
        roleDefinitionId,
        title,
        departmentId: resolvedDept,
        division: division.trim() || null,
        isActive,
        sendInvitation,
        permissions,
      });
    } else if (existingUser) {
      onSaveEdit(existingUser.id, {
        fullName,
        email,
        role,
        roleDefinitionId,
        title,
        departmentId: resolvedDept,
        division: division.trim() || null,
        permissions,
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'create' ? 'Create account' : `Edit ${existingUser?.fullName}`}
      className="fixed inset-0 z-[115] overflow-y-auto bg-black/75 px-3 sm:px-6 py-6"
      onClick={onClose}
    >
      <div
        className="mx-auto w-full max-w-3xl rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-5 sm:p-6 text-[color:var(--wm-ink)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <h2 className="font-serif text-xl font-medium">
              {mode === 'create'
                ? 'Create Administrative Account'
                : `Edit Account · ${existingUser?.fullName}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/10 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="acc-name" className="block text-[color:var(--wm-ink-secondary)]">
                Full Name
              </label>
              <input
                id="acc-name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
              />
            </div>

            <div>
              <label htmlFor="acc-email" className="block text-[color:var(--wm-ink-secondary)]">
                Email Address
              </label>
              <input
                id="acc-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
              />
            </div>

            {mode === 'create' && (
              <div>
                <label htmlFor="acc-pass" className="block text-[color:var(--wm-ink-secondary)]">
                  Initial Password
                </label>
                <input
                  id="acc-pass"
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
            )}

            <div>
              <label htmlFor="acc-title" className="block text-[color:var(--wm-ink-secondary)]">
                Position / Title
              </label>
              <input
                id="acc-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Deputy Director of Operations"
                className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
              />
            </div>

            <div>
              <label htmlFor="acc-roledef" className="block text-[color:var(--wm-ink-secondary)]">
                Assigned Role Definition
              </label>
              <select
                id="acc-roledef"
                value={roleDefinitionId}
                onChange={(e) => handleRoleDefChange(e.target.value)}
                className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-[color:var(--wm-ink)]"
              >
                {roleDefinitions.map((def) => (
                  <option key={def.id} value={def.id}>
                    {def.name}
                  </option>
                ))}
              </select>
            </div>

            {role === 'department_head' ? (
              <div>
                <label htmlFor="acc-dept" className="block text-[color:var(--wm-ink-secondary)]">
                  Assigned Department (Enforced Isolation)
                </label>
                <select
                  id="acc-dept"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-[color:var(--wm-ink)]"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="acc-division"
                  className="block text-[color:var(--wm-ink-secondary)]"
                >
                  Assigned Division / Scope
                </label>
                <input
                  id="acc-division"
                  type="text"
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  placeholder="e.g. Executive Operations"
                  className="mt-1 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                />
              </div>
            )}
          </div>

          {mode === 'create' && (
            <div className="flex flex-wrap gap-5">
              <label className="inline-flex items-center gap-2 text-xs text-[color:var(--wm-ink)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 accent-[#a9b47e]"
                />
                <span>Activate Account Immediately</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-[color:var(--wm-ink)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendInvitation}
                  onChange={(e) => setSendInvitation(e.target.checked)}
                  className="h-4 w-4 accent-[#a9b47e]"
                />
                <span>Send Invitation Token Instead of Immediate Activation</span>
              </label>
            </div>
          )}

          {/* Individual Permission Matrix */}
          <div className="border-t border-[color:var(--wm-hairline)] pt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="wm-section-kicker text-[color:var(--wm-accent)]">
                  Granular Permissions
                </h3>
                <p className="text-[11px] text-[color:var(--wm-ink-secondary)] mt-0.5">
                  {role === 'super_admin'
                    ? 'Super Admins possess unrestricted authority across every system domain.'
                    : 'Security note: Super Admin-only privileges remain locked for Admin & Department Head roles.'}
                </p>
              </div>
              {role !== 'super_admin' && (
                <button
                  type="button"
                  onClick={() => {
                    const chosen = roleDefinitions.find((r) => r.id === roleDefinitionId);
                    setPermissions(
                      buildPermissionMap(
                        chosen?.defaultPermissions ?? ROLE_DEFAULT_PERMISSIONS[role],
                      ),
                    );
                  }}
                  className="h-7 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-[11px] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] cursor-pointer"
                >
                  Reset to Role Defaults
                </button>
              )}
            </div>

            <div className="border border-[color:var(--wm-hairline)] rounded bg-[color:var(--wm-rail)] divide-y divide-[color:var(--wm-hairline)] max-h-72 overflow-y-auto">
              {PERMISSION_CATEGORIES.map((category) => {
                const items = PERMISSION_DEFINITIONS.filter((p) => p.category === category);
                return (
                  <div key={category} className="p-3.5 space-y-2.5">
                    <p className="wm-section-kicker text-[color:var(--wm-accent)]">{category}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {items.map((perm) => {
                        const lockedOut = perm.superAdminOnly && role !== 'super_admin';
                        const checked =
                          role === 'super_admin'
                            ? true
                            : lockedOut
                              ? false
                              : Boolean(permissions[perm.key]);
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-start gap-2.5 py-0.5 ${
                              lockedOut ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={checked}
                              disabled={role === 'super_admin' || Boolean(lockedOut)}
                              onClick={() => !lockedOut && togglePerm(perm.key)}
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                checked
                                  ? 'border-[#a9b47e] bg-[#a9b47e] text-[#14180a]'
                                  : 'border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)]'
                              }`}
                            >
                              {checked && <Check className="h-3 w-3" aria-hidden="true" />}
                            </button>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-[color:var(--wm-ink)]">
                                {perm.label}{' '}
                                {perm.superAdminOnly && (
                                  <span className="font-mono text-[10px] text-amber-300">
                                    (Super Admin)
                                  </span>
                                )}
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
          </div>

          <div className="flex justify-end gap-2.5 border-t border-[color:var(--wm-hairline)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded border border-[color:var(--wm-hairline-strong)] px-4 text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
            >
              {mode === 'create' ? 'Create Account' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
