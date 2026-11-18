import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { navigateTo } from '../../../utils/router';
import { ConfirmDialog } from '../ConfirmDialog';
import { WmSkeleton } from '../WmSkeleton';

type EbPermissions = {
  manage_department?: boolean;
  manage_tasks?: boolean;
  manage_shifts?: boolean;
  manage_stations?: boolean;
  publish_announcements?: boolean;
  review_incidents?: boolean;
};

type Account = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  department_id: string | null;
  division?: string | null;
  is_active: boolean;
  title: string;
  avatar_url?: string | null;
  phone_number?: string;
  eb_rank: string;
  eb_permissions: EbPermissions;
  permissions?: Record<string, boolean>;
  created_at: string | null;
  signup_status?: 'claimed' | 'awaiting_signup';
  member_key?: string | null;
  email_aliases?: string[];
};

type Department = { id: string; name: string; slug: string; cluster: string };

const EMPTY_PERMISSIONS: EbPermissions = {
  manage_department: false,
  manage_tasks: false,
  manage_shifts: false,
  manage_stations: false,
  publish_announcements: false,
  review_incidents: false,
};

export function ExecutiveBoardAccountsView() {
  const { pushToast, enterDepartmentTestMode } = useAdminStore();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [division, setDivision] = useState('');
  const [rank, setRank] = useState('member');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<EbPermissions>(EMPTY_PERMISSIONS);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<Account | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [accountResult, deptResult] = await Promise.all([
      supabase.functions.invoke('willow-staff-admin', { body: { action: 'list' } }),
      supabase.from('wm_departments').select('id,name,slug,cluster').order('name'),
    ]);
    if (accountResult.error) setError(accountResult.error.message);
    else setAccounts((accountResult.data?.accounts ?? []).filter((a: Account) => a.role === 'executive_board'));
    if (deptResult.error) setError((old) => (old ? old + ' ' + deptResult.error.message : deptResult.error.message));
    else setDepartments((deptResult.data ?? []) as Department[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = accounts.filter((account) => account.signup_status === 'awaiting_signup').length;
  const claimedCount = accounts.filter((account) => account.signup_status !== 'awaiting_signup').length;

  const resetForm = () => {
    setEditing(null);
    setFullName('');
    setEmail('');
    setTitle('');
    setDepartmentId('');
    setDivision('');
    setRank('member');
    setPassword('');
    setPermissions(EMPTY_PERMISSIONS);
  };

  const applyRankDefaults = (value: string) => {
    setRank(value);
    if (value === 'head' || value === 'co_head') {
      setPermissions({
        manage_department: true,
        manage_tasks: true,
        manage_shifts: true,
        manage_stations: true,
        publish_announcements: true,
        review_incidents: true,
      });
    } else if (value === 'supervisor') {
      setPermissions({
        manage_department: false,
        manage_tasks: true,
        manage_shifts: true,
        manage_stations: true,
        publish_announcements: true,
        review_incidents: true,
      });
    } else {
      setPermissions(EMPTY_PERMISSIONS);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!fullName.trim() || !email.trim() || !departmentId) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      action: editing ? 'update' : 'create',
      full_name: fullName.trim(),
      email: email.trim(),
      title: title.trim() || rank.replace('_', ' '),
      department_id: departmentId,
      division: division || null,
      role: 'executive_board',
      eb_rank: rank,
      eb_permissions: permissions,
    };
    if (password.trim()) body.password = password;
    if (editing) body.user_id = editing;
    const { data, error: invokeError } = await supabase.functions.invoke('willow-staff-admin', { body });
    setSaving(false);
    if (invokeError || data?.error) {
      pushToast({
        tone: 'error',
        title: 'Account could not be saved',
        description: data?.error || invokeError?.message,
      });
      return;
    }
    pushToast({
      tone: 'success',
      title: editing ? 'EB account updated' : 'EB account created',
      description: password ? 'The account is ready for password sign-in.' : 'An account invitation was requested.',
    });
    resetForm();
    await load();
  };

  const edit = (account: Account) => {
    setEditing(account.user_id);
    setFullName(account.full_name);
    setEmail(account.email);
    setTitle(account.title || '');
    setDepartmentId(account.department_id || '');
    setDivision(account.division || '');
    setRank(account.eb_rank || 'member');
    setPermissions({ ...EMPTY_PERMISSIONS, ...(account.eb_permissions || {}) });
    setPassword('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleActive = async (account: Account) => {
    const action = account.is_active ? 'suspend' : 'reactivate';
    const { data, error: invokeError } = await supabase.functions.invoke('willow-staff-admin', {
      body: { action, user_id: account.user_id },
    });
    if (invokeError || data?.error) {
      pushToast({
        tone: 'error',
        title: 'Account action failed',
        description: data?.error || invokeError?.message,
      });
      return;
    }
    await load();
  };

  const remove = async (account: Account) => {
    const { data, error: invokeError } = await supabase.functions.invoke('willow-staff-admin', {
      body: { action: 'delete', user_id: account.user_id },
    });
    if (invokeError || data?.error) {
      pushToast({
        tone: 'error',
        title: 'Account could not be deleted',
        description: data?.error || invokeError?.message,
      });
      return;
    }
    pushToast({ tone: 'success', title: 'EB account removed', description: account.full_name });
    await load();
  };

  const openTestPortal = (account: Account) => {
    if (!account.department_id) {
      pushToast({
        tone: 'error',
        title: 'Department required',
        description: 'Assign a department before testing this Executive Board Head portal.',
      });
      return;
    }
    const dept = departments.find((d) => d.id === account.department_id || d.slug === account.department_id);
    const ok = enterDepartmentTestMode({
      id: account.user_id,
      role: 'executive_board',
      fullName: account.full_name,
      email: account.email,
      title: account.title,
      departmentId: dept?.id ?? account.department_id,
      departmentSlug: dept?.slug ?? null,
      division: account.division ?? null,
      ebRank: account.eb_rank || 'member',
      ebPermissions: account.eb_permissions || {},
      permissions: account.permissions ?? null,
      avatarUrl: account.avatar_url || null,
    });
    if (ok) navigateTo('/head');
  };

  const permissionLabels: [keyof EbPermissions, string][] = [
    ['manage_department', 'Department-wide control'],
    ['manage_tasks', 'Assign and manage team tasks'],
    ['manage_shifts', 'Create and manage shifts'],
    ['manage_stations', 'Manage station information'],
    ['publish_announcements', 'Publish department announcements'],
    ['review_incidents', 'Review and resolve incident reports'],
  ];

  return (
    <div className="space-y-5">
      <section className="wm-surface-panel p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
              {editing ? 'Edit Executive Board Account' : 'Create Executive Board Account'}
            </h2>
            <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
              Set the member&apos;s department, reporting level, and portal permissions.
            </p>
          </div>
          {editing && (
            <button type="button" onClick={resetForm} className="text-xs text-[color:var(--wm-accent)] underline">
              Cancel edit
            </button>
          )}
        </div>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <label className="text-xs text-[color:var(--wm-ink-secondary)]">
            Full name
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
            />
          </label>
          <label className="text-xs text-[color:var(--wm-ink-secondary)]">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
            />
          </label>
          <label className="text-xs text-[color:var(--wm-ink-secondary)]">
            Department
            <select
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
            >
              <option value="">Choose department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[color:var(--wm-ink-secondary)]">
            Position / title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Head of Media"
              className="mt-1 block h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
            />
          </label>
          <label className="text-xs text-[color:var(--wm-ink-secondary)]">
            Gender division
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
            >
              <option value="">Not division-restricted</option>
              <option value="female">Female Division</option>
              <option value="male">Male Division</option>
            </select>
          </label>
          <label className="text-xs text-[color:var(--wm-ink-secondary)]">
            Reporting level
            <select
              value={rank}
              onChange={(e) => applyRankDefaults(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
            >
              <option value="member">EB Member</option>
              <option value="supervisor">Supervisor</option>
              <option value="co_head">Co-Head</option>
              <option value="head">Department Head</option>
            </select>
          </label>
          <label className="text-xs text-[color:var(--wm-ink-secondary)]">
            {editing ? 'Set a new password (optional)' : 'Initial password (optional)'}
            <input
              type="password"
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editing ? 'Leave blank to keep current password' : 'Leave blank to send invitation'}
              className="mt-1 block h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
            />
          </label>
          <div className="md:col-span-2">
            <p className="mb-2 text-xs font-semibold text-[color:var(--wm-ink)]">Portal permissions</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {permissionLabels.map(([key, label]) => (
                <label
                  key={key}
                  className="wm-surface-inset flex items-center gap-2 p-3 text-xs text-[color:var(--wm-ink)]"
                >
                  <input
                    type="checkbox"
                    checked={permissions[key] === true}
                    onChange={(e) => setPermissions((old) => ({ ...old, [key]: e.target.checked }))}
                    className="accent-[#2d6a4f]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:col-span-2">
            <button
              disabled={saving || !departments.length}
              className="h-10 rounded-md bg-[color:var(--wm-emerald)] px-5 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] disabled:opacity-50"
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create EB account'}
            </button>
            <span className="text-[11px] text-[color:var(--wm-ink-muted)]">
              Only Super Admin can create, edit, suspend, or delete staff accounts.
            </span>
          </div>
        </form>
      </section>

      <section className="wm-surface-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">Executive Board Directory</h2>
            <p className="mt-1 text-xs text-[color:var(--wm-ink-muted)]">
              {accounts.length} EB members · {claimedCount} claimed · {pendingCount} awaiting signup
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs text-[color:var(--wm-accent)] underline hover:text-[color:var(--wm-focal)]"
          >
            Refresh
          </button>
        </div>
        {error && (
          <p role="alert" className="p-4 text-xs text-rose-200">
            {error}
          </p>
        )}
        {loading ? (
          <div className="p-5">
            <WmSkeleton variant="table" rows={5} />
          </div>
        ) : !accounts.length ? (
          <p className="p-8 text-center text-sm text-[color:var(--wm-ink-muted)]">
            No Executive Board accounts have been created yet.
          </p>
        ) : (
          <div className="divide-y divide-[color:var(--wm-hairline)]">
            {accounts.map((account) => (
              <article key={account.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)]">
                    {account.avatar_url ? (
                      <img src={account.avatar_url} alt={account.full_name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-xs font-semibold text-[color:var(--wm-focal)]">
                        {account.full_name
                          .split(/\s+/)
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[color:var(--wm-ink)]">{account.full_name}</p>
                    <p className="text-xs text-[color:var(--wm-ink-secondary)]">
                      {account.email} · {departments.find((d) => d.id === account.department_id)?.name || 'Department not assigned'}
                    </p>
                    <p className="mt-1 text-[11px] text-[color:var(--wm-ink-muted)]">
                      {account.title} · {account.eb_rank} ·{' '}
                      {account.signup_status === 'awaiting_signup'
                        ? 'Signup not completed'
                        : account.is_active
                          ? 'Active account'
                          : 'Suspended'}
                      {account.phone_number ? ` · ${account.phone_number}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {account.signup_status === 'awaiting_signup' ? (
                    <>
                      <span className="rounded-md border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-[11px] text-amber-200">
                        Awaiting signup
                      </span>
                      <span className="rounded-md border border-[color:var(--wm-hairline)] px-3 py-2 text-[11px] text-[color:var(--wm-ink-muted)]">
                        Use the shared EB signup link
                      </span>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => edit(account)}
                        className="rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-xs text-[color:var(--wm-ink)]"
                      >
                        Edit access
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(account)}
                        className="rounded-md border border-[color:var(--wm-hairline-strong)] px-3 py-2 text-xs text-[color:var(--wm-ink-secondary)]"
                      >
                        {account.is_active ? 'Suspend' : 'Reactivate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteTarget(account)}
                        className="rounded-md border border-rose-400/30 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/15"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => openTestPortal(account)}
                    disabled={!account.department_id}
                    className="rounded-md border border-[color:var(--wm-accent)]/40 bg-[#2d6a4f]/20 px-3 py-2 text-xs text-[color:var(--wm-focal)] hover:bg-[#2d6a4f]/35 disabled:opacity-40"
                  >
                    Test portal
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(confirmDeleteTarget)}
        tone="danger"
        title="Delete Executive Board Account?"
        description={
          confirmDeleteTarget
            ? `Permanently delete the EB account for ${confirmDeleteTarget.full_name}? This also removes their authentication account.`
            : ''
        }
        confirmLabel="Delete Account"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (confirmDeleteTarget) void remove(confirmDeleteTarget);
          setConfirmDeleteTarget(null);
        }}
        onCancel={() => setConfirmDeleteTarget(null)}
      />


    </div>
  );
}
