import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Check,
  Copy,
  Edit3,
  FlaskConical,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { supabase } from '../../../lib/supabase';
import type { PermissionKey, RoleType } from '../../../types/admin';
import {
  ADMIN_DEFAULT_PERMISSIONS,
  DEPARTMENT_HEAD_DEFAULT_PERMISSIONS,
  EXECUTIVE_BOARD_DEFAULT_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  SUPER_ADMIN_ONLY_KEYS,
  canManageAccountsOrRoles,
  normalizeDepartmentSlug,
  resolveUserPermissions,
} from '../../../utils/adminPermissions';
import { navigateTo } from '../../../utils/router';
import { ConfirmDialog } from '../ConfirmDialog';
import { WmSkeleton } from '../WmSkeleton';

type ServerStaffAccount = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  department_id: string | null;
  division?: string | null;
  is_active: boolean;
  title: string;
  avatar_url?: string | null;
  phone_number?: string | null;
  eb_rank?: string | null;
  eb_permissions?: Record<string, boolean> | null;
  permissions?: Partial<Record<string, boolean>> | null;
  signup_status?: 'claimed' | 'awaiting_signup';
  member_key?: string | null;
  created_at?: string | null;
};

type AccountTab = 'admins' | 'heads';

const ASSIGNABLE_PERMISSIONS = PERMISSION_DEFINITIONS.filter(
  (def) => !def.superAdminOnly && !SUPER_ADMIN_ONLY_KEYS.has(def.key),
);

const HEAD_RELEVANT_PERMISSION_KEYS = new Set<PermissionKey>([
  'applications.view',
  'applications.view_confidential',
  'applications.review',
  'committees.manage',
  'qr.view_pass',
  'qr.scan',
]);

export function AccountManagementView({
  initialTab = 'admins',
}: {
  initialTab?: AccountTab;
}) {
  const { currentUser, data, pushToast, enterDepartmentTestMode } = useAdminStore();
  const isSuperAdmin = canManageAccountsOrRoles(currentUser);

  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [accounts, setAccounts] = useState<ServerStaffAccount[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; slug: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ServerStaffAccount | null>(null);
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'department_head' | 'executive_board'>('admin');
  const [formDepartmentId, setFormDepartmentId] = useState('');
  const [formDivision, setFormDivision] = useState<'female' | 'male' | ''>('');
  const [formTitle, setFormTitle] = useState('');
  const [formEbRank, setFormEbRank] = useState('head');
  const [formPassword, setFormPassword] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPermissions, setFormPermissions] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Access reset / setup link / delete dialogs
  const [resetTarget, setResetTarget] = useState<ServerStaffAccount | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [setupLinkDialog, setSetupLinkDialog] = useState<{
    name: string;
    email: string;
    url: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServerStaffAccount | null>(null);

  const load = useCallback(async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    const [accRes, deptRes] = await Promise.all([
      supabase.functions.invoke('willow-staff-admin', { body: { action: 'list' } }),
      supabase.from('wm_departments').select('id,slug,name').order('name'),
    ]);
    if (accRes.error || accRes.data?.error) {
      setLoadError(accRes.data?.error || accRes.error?.message || 'Could not load staff accounts.');
    } else {
      setAccounts((accRes.data?.accounts ?? []) as ServerStaffAccount[]);
    }
    if (!deptRes.error && Array.isArray(deptRes.data)) {
      setDepartments(deptRes.data as Array<{ id: string; slug: string; name: string }>);
    }
    setLoading(false);
  }, [isSuperAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const effectiveDepartments = useMemo(() => {
    if (departments.length > 0) return departments;
    return data.departments.map((d) => ({ id: d.id, slug: d.slug, name: d.name }));
  }, [departments, data.departments]);

  const deptByIdOrSlug = useMemo(() => {
    const map = new Map<string, { id: string; slug: string; name: string }>();
    for (const d of effectiveDepartments) {
      map.set(d.id, d);
      map.set(d.slug, d);
      map.set(normalizeDepartmentSlug(d.slug), d);
    }
    return map;
  }, [effectiveDepartments]);

  const adminAccounts = useMemo(
    () => accounts.filter((a) => a.role === 'admin' || a.role === 'super_admin'),
    [accounts],
  );

  const headAndEbAccounts = useMemo(
    () => accounts.filter((a) => a.role === 'department_head' || a.role === 'executive_board'),
    [accounts],
  );

  const displayedAccounts = useMemo(() => {
    const source = activeTab === 'admins' ? adminAccounts : headAndEbAccounts;
    const q = search.trim().toLowerCase();
    return source
      .filter((acc) => {
        if (statusFilter === 'active' && (!acc.is_active || acc.signup_status === 'awaiting_signup')) {
          return false;
        }
        if (statusFilter === 'inactive' && acc.is_active) {
          return false;
        }
        if (statusFilter === 'pending' && acc.signup_status !== 'awaiting_signup') {
          return false;
        }
        if (!q) return true;
        const deptName = acc.department_id ? deptByIdOrSlug.get(acc.department_id)?.name || '' : '';
        return `${acc.full_name} ${acc.email} ${acc.title} ${acc.role} ${deptName}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [activeTab, adminAccounts, headAndEbAccounts, search, statusFilter, deptByIdOrSlug]);

  const defaultPermissionsForRole = (role: 'admin' | 'department_head' | 'executive_board', rank = 'head') => {
    const template =
      role === 'admin'
        ? ADMIN_DEFAULT_PERMISSIONS
        : role === 'department_head'
          ? DEPARTMENT_HEAD_DEFAULT_PERMISSIONS
          : rank === 'head' || rank === 'co_head'
            ? DEPARTMENT_HEAD_DEFAULT_PERMISSIONS
            : EXECUTIVE_BOARD_DEFAULT_PERMISSIONS;
    const clean: Record<string, boolean> = {};
    for (const def of ASSIGNABLE_PERMISSIONS) {
      clean[def.key] = Boolean(template[def.key]);
    }
    return clean;
  };

  const openCreateModal = (tab: AccountTab) => {
    const initialRole: 'admin' | 'department_head' = tab === 'admins' ? 'admin' : 'department_head';
    setEditingAccount(null);
    setFormFullName('');
    setFormEmail('');
    setFormRole(initialRole);
    setFormDepartmentId('');
    setFormDivision('');
    setFormTitle(initialRole === 'admin' ? 'Administrator' : 'Department Head');
    setFormEbRank('head');
    setFormPassword('');
    setFormIsActive(true);
    setFormPermissions(defaultPermissionsForRole(initialRole));
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (account: ServerStaffAccount) => {
    if (account.role === 'super_admin') {
      pushToast({
        tone: 'error',
        title: 'Protected account',
        description: 'Super Admin accounts cannot be edited or demoted here.',
      });
      return;
    }
    const role: 'admin' | 'department_head' | 'executive_board' =
      account.role === 'executive_board'
        ? 'executive_board'
        : account.role === 'department_head'
          ? 'department_head'
          : 'admin';

    const resolved = resolveUserPermissions(
      role as RoleType,
      account.permissions ?? null,
      account.eb_rank,
      account.eb_permissions,
      account.title,
    );
    const editablePerms: Record<string, boolean> = {};
    for (const def of ASSIGNABLE_PERMISSIONS) {
      editablePerms[def.key] = Boolean(resolved[def.key]);
    }

    setEditingAccount(account);
    setFormFullName(account.full_name || '');
    setFormEmail(account.email || '');
    setFormRole(role);
    setFormDepartmentId(account.department_id || '');
    setFormDivision(
      account.division === 'female' || account.division === 'male' ? account.division : '',
    );
    setFormTitle(account.title || '');
    setFormEbRank(account.eb_rank || (role === 'executive_board' ? 'head' : 'member'));
    setFormPassword('');
    setFormIsActive(account.is_active !== false);
    setFormPermissions(editablePerms);
    setFormError('');
    setModalOpen(true);
  };

  const handleRoleSwitchInForm = (nextRole: 'admin' | 'department_head' | 'executive_board') => {
    setFormRole(nextRole);
    if (!editingAccount) {
      setFormTitle(
        nextRole === 'admin'
          ? 'Administrator'
          : nextRole === 'executive_board'
            ? 'Executive Board Head'
            : 'Department Head',
      );
      setFormPermissions(defaultPermissionsForRole(nextRole, formEbRank));
    }
  };

  const handleSaveAccount = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = formFullName.trim();
    const cleanEmail = formEmail.trim().toLowerCase();
    if (!cleanName || !cleanEmail.includes('@')) {
      setFormError('Enter a valid full name and email address.');
      return;
    }
    if ((formRole === 'department_head' || formRole === 'executive_board') && !formDepartmentId) {
      setFormError('Assign a department for Head and Executive Board accounts.');
      return;
    }
    if (formPassword.trim() && formPassword.trim().length < 10) {
      setFormError('Password must be at least 10 characters.');
      return;
    }

    const isPendingRoster = Boolean(editingAccount?.user_id.startsWith('pending:'));
    const editingRealId = editingAccount && !isPendingRoster ? editingAccount.user_id : null;

    // Duplicate email pre-check (server also enforces atomically)
    const dup = accounts.find(
      (a) =>
        a.email.trim().toLowerCase() === cleanEmail &&
        (!editingAccount || a.user_id !== editingAccount.user_id),
    );
    if (dup) {
      setFormError(`An account already exists with email "${cleanEmail}". Edit that account instead.`);
      return;
    }

    const sanitizedPerms: Record<string, boolean> = {};
    for (const def of ASSIGNABLE_PERMISSIONS) {
      if (formRole !== 'admin' && !HEAD_RELEVANT_PERMISSION_KEYS.has(def.key)) continue;
      sanitizedPerms[def.key] = Boolean(formPermissions[def.key]);
    }

    const ebPerms =
      formRole === 'executive_board'
        ? {
            ...(editingAccount?.eb_permissions || {}),
            manage_department:
              formEbRank === 'head' || formEbRank === 'co_head' || Boolean(sanitizedPerms['applications.review']),
            manage_committees: Boolean(sanitizedPerms['committees.manage']),
            scan_qr: Boolean(sanitizedPerms['qr.scan']),
          }
        : undefined;

    setSaving(true);
    const body: Record<string, unknown> = {
      action: isPendingRoster && formRole === 'executive_board'
        ? 'update_eb_roster'
        : editingRealId
          ? 'update'
          : 'create',
      full_name: cleanName,
      // For existing accounts, omit email entirely unless it actually changed.
      // Role/permission updates should not invoke Supabase Auth email validation.
      ...(editingRealId && cleanEmail === (editingAccount?.email || '').trim().toLowerCase()
        ? {}
        : { email: cleanEmail }),
      role: formRole,
      department_id: formRole === 'admin' ? formDepartmentId || null : formDepartmentId,
      division: formDivision || null,
      title: formTitle.trim() || (formRole === 'admin' ? 'Administrator' : 'Department Head'),
      is_active: formIsActive,
      permissions: sanitizedPerms,
      redirect_origin: window.location.origin,
      ...(formRole === 'executive_board'
        ? { eb_rank: formEbRank, eb_permissions: ebPerms }
        : {}),
    };
    if (editingRealId) body.user_id = editingRealId;
    if (isPendingRoster && formRole === 'executive_board') {
      body.member_key = editingAccount?.member_key;
    }
    if (formPassword.trim()) body.password = formPassword.trim();

    const { data: res, error } = await supabase.functions.invoke('willow-staff-admin', { body });
    setSaving(false);

    if (error || res?.error) {
      let detailedError = res?.error || error?.message || 'Could not save account.';
      // Supabase FunctionsHttpError stores the actual HTTP response in error.context.
      // Read it safely so non-2xx responses (such as 409) show the server message.
      const errorContext = (error as any)?.context;
      if (!res?.error && errorContext && typeof errorContext.clone === 'function') {
        try {
          const responseBody = await errorContext.clone().json();
          if (typeof responseBody?.error === 'string' && responseBody.error.trim()) {
            detailedError = responseBody.error;
          } else if (typeof responseBody?.message === 'string' && responseBody.message.trim()) {
            detailedError = responseBody.message;
          }
        } catch {
          try {
            const responseText = await errorContext.clone().text();
            if (responseText.trim()) detailedError = responseText.trim();
          } catch {
            // Keep the safe fallback error.
          }
        }
      }
      setFormError(detailedError);
      return;
    }

    setModalOpen(false);
    if (res?.action_link) {
      setSetupLinkDialog({
        name: cleanName,
        email: cleanEmail,
        url: res.action_link,
      });
    }
    pushToast({
      tone: 'success',
      title: editingRealId ? 'Account updated' : 'Account created',
      description: res?.action_link
        ? 'Account provisioned. Copy the setup link to share privately.'
        : `${cleanName} saved successfully.`,
    });
    await load();
  };

  const handleToggleActive = async (account: ServerStaffAccount) => {
    if (account.role === 'super_admin') return;
    setBusyId(account.user_id);
    const action = account.is_active ? 'suspend' : 'reactivate';
    const { data: res, error } = await supabase.functions.invoke('willow-staff-admin', {
      body: { action, user_id: account.user_id },
    });
    setBusyId(null);
    if (error || res?.error) {
      pushToast({
        tone: 'error',
        title: 'Status update failed',
        description: res?.error || error?.message,
      });
      return;
    }
    pushToast({
      tone: 'success',
      title: account.is_active ? 'Account deactivated' : 'Account activated',
      description: `${account.full_name} has been ${account.is_active ? 'suspended' : 'reactivated'}.`,
    });
    await load();
  };

  const handleGenerateResetLink = async (account: ServerStaffAccount) => {
    setBusyId(account.user_id);
    const { data: res, error } = await supabase.functions.invoke('willow-staff-admin', {
      body: {
        action: 'send_setup_link',
        user_id: account.user_id,
        redirect_origin: window.location.origin,
      },
    });
    setBusyId(null);
    if (error || res?.error || !res?.action_link) {
      pushToast({
        tone: 'error',
        title: 'Could not generate reset link',
        description: res?.error || error?.message || 'No setup link returned.',
      });
      return;
    }
    setResetTarget(null);
    setSetupLinkDialog({
      name: account.full_name,
      email: account.email,
      url: res.action_link,
    });
  };

  const handleDirectPasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (resetPasswordInput.trim().length < 10) {
      pushToast({ tone: 'error', title: 'Password must be at least 10 characters' });
      return;
    }
    setResetBusy(true);
    const { data: res, error } = await supabase.functions.invoke('willow-staff-admin', {
      body: {
        action: 'reset_password',
        user_id: resetTarget.user_id,
        password: resetPasswordInput.trim(),
      },
    });
    setResetBusy(false);
    if (error || res?.error) {
      pushToast({
        tone: 'error',
        title: 'Password reset failed',
        description: res?.error || error?.message,
      });
      return;
    }
    pushToast({
      tone: 'success',
      title: 'Access password updated',
      description: `${resetTarget.full_name} can now sign in with the new password.`,
    });
    setResetTarget(null);
    setResetPasswordInput('');
  };

  const handleDeleteAccount = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setBusyId(target.user_id);
    const { data: res, error } = await supabase.functions.invoke('willow-staff-admin', {
      body: { action: 'delete', user_id: target.user_id },
    });
    setBusyId(null);
    if (error || res?.error) {
      pushToast({
        tone: 'error',
        title: 'Delete failed',
        description: res?.error || error?.message,
      });
      return;
    }
    pushToast({
      tone: 'success',
      title: 'Account deleted safely',
      description: `${target.full_name} was removed without deleting conference records.`,
    });
    await load();
  };

  const handleCreateEbRosterInvite = async (account: ServerStaffAccount) => {
    if (!account.member_key) return;
    setBusyId(account.user_id);
    const { data: res, error } = await supabase.functions.invoke('willow-staff-admin', {
      body: { action: 'create_eb_invite', member_key: account.member_key },
    });
    setBusyId(null);
    if (error || res?.error || !res?.url) {
      pushToast({
        tone: 'error',
        title: 'Invite generation failed',
        description: res?.error || error?.message,
      });
      return;
    }
    setSetupLinkDialog({
      name: account.full_name,
      email: account.email,
      url: res.url,
    });
  };

  const handleSignInAsHeadOrEb = (account: ServerStaffAccount) => {
    const dept = account.department_id ? deptByIdOrSlug.get(account.department_id) : undefined;
    if (!dept && !account.department_id) {
      pushToast({
        tone: 'error',
        title: 'Department required',
        description: 'Assign a department to this account before launching Sign In As.',
      });
      return;
    }
    const resolvedPerms = resolveUserPermissions(
      account.role === 'executive_board' ? 'executive_board' : 'department_head',
      account.permissions ?? null,
      account.eb_rank,
      account.eb_permissions,
      account.title,
    );
    const ok = enterDepartmentTestMode({
      id: account.user_id,
      fullName: account.full_name,
      email: account.email,
      title: account.title,
      role: account.role === 'executive_board' ? 'executive_board' : 'department_head',
      departmentId: dept?.id ?? account.department_id,
      departmentSlug: dept?.slug ?? null,
      division: account.division ?? null,
      ebRank: account.eb_rank ?? (account.role === 'executive_board' ? 'head' : null),
      ebPermissions: account.eb_permissions ?? {},
      permissions: resolvedPerms,
      avatarUrl: account.avatar_url ?? null,
    });
    if (ok) navigateTo('/head');
  };

  if (!isSuperAdmin) {
    return (
      <div
        role="alert"
        className="wm-surface-panel flex items-start gap-3 border-rose-400/35 bg-rose-500/[0.08] p-6"
      >
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" aria-hidden="true" />
        <div className="text-xs">
          <p className="font-semibold text-rose-100">Super IT Authorization Required</p>
          <p className="mt-1 text-[color:var(--wm-ink-secondary)]">
            Account creation, role assignment, permission editing, deactivation, and deletion are strictly restricted to Super IT / Super Admin accounts.
          </p>
        </div>
      </div>
    );
  }

  const visiblePermissionDefs =
    formRole === 'admin'
      ? ASSIGNABLE_PERMISSIONS
      : ASSIGNABLE_PERMISSIONS.filter((p) => HEAD_RELEVANT_PERMISSION_KEYS.has(p.key));

  return (
    <div className="space-y-5">
      {/* Header & Summary */}
      <section className="wm-surface-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">
              Super IT Governance · Live Account Control
            </p>
            <h1 className="wm-serif mt-1.5 text-2xl font-semibold text-[color:var(--wm-ink)]">
              Account Management
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-[color:var(--wm-ink-secondary)]">
              Create, configure, activate, deactivate, reset access, and safely remove Administrator, Department Head, and Executive Board accounts. Unrelated conference records remain intact.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void load()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => openCreateModal(activeTab)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {activeTab === 'admins' ? 'Create Admin Account' : 'Create Head / EB Account'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="wm-surface-inset px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
              Admin Accounts
            </p>
            <p className="wm-serif mt-1 text-xl font-semibold text-[color:var(--wm-ink)]">
              {adminAccounts.filter((a) => a.role === 'admin').length} Admins
              <span className="ml-2 text-xs font-normal text-[color:var(--wm-ink-muted)]">
                (+{adminAccounts.filter((a) => a.role === 'super_admin').length} Super IT)
              </span>
            </p>
          </div>
          <div className="wm-surface-inset px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
              Head & EB Accounts
            </p>
            <p className="wm-serif mt-1 text-xl font-semibold text-[color:var(--wm-ink)]">
              {headAndEbAccounts.length} Total
            </p>
          </div>
          <div className="wm-surface-inset px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
              Active / Inactive
            </p>
            <p className="wm-serif mt-1 text-xl font-semibold text-[color:var(--wm-ink)]">
              {accounts.filter((a) => a.is_active && a.signup_status !== 'awaiting_signup').length} Active ·{' '}
              {accounts.filter((a) => !a.is_active).length} Suspended
            </p>
          </div>
        </div>

        {/* Sub-tabs & Search */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--wm-hairline)] pt-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Account categories">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'admins'}
              onClick={() => setActiveTab('admins')}
              className={`inline-flex h-9 items-center gap-2 rounded-md border px-3.5 text-xs font-medium transition-colors ${
                activeTab === 'admins'
                  ? 'border-[color:var(--wm-accent)] bg-[#2d6a4f]/35 text-[color:var(--wm-ink)]'
                  : 'border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
              }`}
            >
              <Shield className="h-3.5 w-3.5" aria-hidden="true" />
              Admin Accounts ({adminAccounts.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'heads'}
              onClick={() => setActiveTab('heads')}
              className={`inline-flex h-9 items-center gap-2 rounded-md border px-3.5 text-xs font-medium transition-colors ${
                activeTab === 'heads'
                  ? 'border-[color:var(--wm-accent)] bg-[#2d6a4f]/35 text-[color:var(--wm-ink)]'
                  : 'border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
              }`}
            >
              <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
              Head & EB Accounts ({headAndEbAccounts.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, department…"
                className="h-9 w-56 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] pl-8 pr-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              aria-label="Filter account status"
              className="h-9 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Deactivated</option>
              <option value="pending">Awaiting signup</option>
            </select>
          </div>
        </div>
      </section>

      {loadError && (
        <div role="alert" className="rounded-md border border-rose-400/35 bg-rose-500/10 p-4 text-xs text-rose-200">
          {loadError}
        </div>
      )}

      {/* Account List */}
      <section className="wm-surface-panel overflow-hidden">
        {loading ? (
          <div className="p-5">
            <WmSkeleton variant="table" rows={6} />
          </div>
        ) : displayedAccounts.length === 0 ? (
          <div className="p-10 text-center text-xs text-[color:var(--wm-ink-muted)]">
            No {activeTab === 'admins' ? 'administrator' : 'head or Executive Board'} accounts match the current filter.
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--wm-hairline)]">
            {displayedAccounts.map((acc) => {
              const isSuperTarget = acc.role === 'super_admin';
              const isPendingEntry = acc.user_id.startsWith('pending:');
              const busy = busyId === acc.user_id;
              const dept = acc.department_id ? deptByIdOrSlug.get(acc.department_id) : undefined;
              const resolvedPerms = resolveUserPermissions(
                (acc.role as RoleType) || 'department_head',
                acc.permissions ?? null,
                acc.eb_rank,
                acc.eb_permissions,
                acc.title,
              );
              const enabledPermCount = Object.values(resolvedPerms).filter(Boolean).length;

              return (
                <article
                  key={acc.user_id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--wm-hairline-strong)] bg-[#2d6a4f]/25 text-xs font-semibold text-[color:var(--wm-focal)]">
                      {acc.avatar_url ? (
                        <img src={acc.avatar_url} alt={acc.full_name} className="h-full w-full object-cover" />
                      ) : (
                        acc.full_name
                          .split(/\s+/)
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[color:var(--wm-ink)]">
                          {acc.full_name}
                        </p>
                        <span
                          className={`rounded border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
                            isSuperTarget
                              ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                              : acc.role === 'admin'
                                ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
                                : 'border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] text-[color:var(--wm-focal)]'
                          }`}
                        >
                          {acc.role.replace('_', ' ')}
                        </span>
                        <span
                          className={`rounded border px-2 py-0.5 text-[10px] ${
                            !acc.is_active
                              ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
                              : acc.signup_status === 'awaiting_signup'
                                ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
                                : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                          }`}
                        >
                          {!acc.is_active
                            ? 'Deactivated'
                            : acc.signup_status === 'awaiting_signup'
                              ? 'Awaiting setup'
                              : 'Active'}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[color:var(--wm-ink-secondary)]">
                        {acc.email || 'No email recorded'}
                        {acc.title ? ` · ${acc.title}` : ''}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[color:var(--wm-ink-muted)]">
                        {dept ? `Department: ${dept.name}` : acc.role === 'admin' || isSuperTarget ? 'Cross-conference access' : 'No department linked'}
                        {acc.division ? ` · ${acc.division} division` : ''}
                        {acc.role === 'executive_board' && acc.eb_rank ? ` · Rank: ${acc.eb_rank}` : ''}
                        {!isSuperTarget ? ` · ${enabledPermCount} permissions enabled` : ' · Full Super IT governance'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isSuperTarget ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200">
                        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                        Protected Root Account
                      </span>
                    ) : isPendingEntry ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleCreateEbRosterInvite(acc)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-40"
                        >
                          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                          Invite Link
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(acc)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[color:var(--wm-emerald)] px-3 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
                        >
                          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                          Provision Now
                        </button>
                      </>
                    ) : (
                      <>
                        {activeTab === 'heads' && (
                          <button
                            type="button"
                            disabled={!dept && !acc.department_id}
                            onClick={() => handleSignInAsHeadOrEb(acc)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-accent)]/40 bg-[#2d6a4f]/22 px-3 text-xs font-medium text-[color:var(--wm-focal)] hover:bg-[#2d6a4f]/40 disabled:opacity-40"
                          >
                            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                            Sign In As
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openEditModal(acc)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-40"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit & Permissions
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setResetTarget(acc);
                            setResetPasswordInput('');
                          }}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-xs text-[color:var(--wm-focal)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-40"
                        >
                          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                          Reset Access
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleToggleActive(acc)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] px-3 text-xs text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] disabled:opacity-40"
                        >
                          {acc.is_active ? (
                            <>
                              <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                              Activate
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDeleteTarget(acc)}
                          aria-label={`Delete ${acc.full_name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-400/35 text-rose-200 hover:bg-rose-500/15 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[130] overflow-y-auto bg-[#030906]/82 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={editingAccount ? 'Edit staff account' : 'Create staff account'}
          onClick={() => setModalOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleSaveAccount(e)}
            className="mx-auto my-6 w-full max-w-3xl rounded-xl border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[color:var(--wm-hairline)] pb-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">
                  Super IT Account Control
                </p>
                <h2 className="wm-serif mt-1 text-xl font-semibold text-[color:var(--wm-ink)]">
                  {editingAccount && !editingAccount.user_id.startsWith('pending:')
                    ? `Edit ${editingAccount.full_name}`
                    : 'Create Staff Account'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--wm-ink-muted)] hover:bg-[color:var(--wm-inset)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-[color:var(--wm-ink-secondary)]">
                Full Name
                <input
                  required
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
                />
              </label>

              <label className="text-xs text-[color:var(--wm-ink-secondary)]">
                Email Address
                <input
                  required
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
                />
              </label>

              <label className="text-xs text-[color:var(--wm-ink-secondary)]">
                Account Role
                <select
                  value={formRole}
                  onChange={(e) =>
                    handleRoleSwitchInForm(e.target.value as 'admin' | 'department_head' | 'executive_board')
                  }
                  className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
                >
                  <option value="admin">Admin</option>
                  <option value="department_head">Department Head</option>
                  <option value="executive_board">Executive Board (Head Portal)</option>
                </select>
              </label>

              <label className="text-xs text-[color:var(--wm-ink-secondary)]">
                Title / Position
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Head of HR (Female)"
                  className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
                />
              </label>

              {(formRole === 'department_head' || formRole === 'executive_board') && (
                <>
                  <label className="text-xs text-[color:var(--wm-ink-secondary)]">
                    Assigned Department
                    <select
                      required
                      value={formDepartmentId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setFormDepartmentId(nextId);
                        const dept = deptByIdOrSlug.get(nextId);
                        if (!editingAccount && dept && normalizeDepartmentSlug(dept.slug) === 'security') {
                          setFormPermissions((prev) => ({ ...prev, 'qr.scan': true }));
                        }
                      }}
                      className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
                    >
                      <option value="">Select department…</option>
                      {effectiveDepartments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs text-[color:var(--wm-ink-secondary)]">
                    Gender Division
                    <select
                      value={formDivision}
                      onChange={(e) => setFormDivision(e.target.value as 'female' | 'male' | '')}
                      className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
                    >
                      <option value="">Not division-restricted</option>
                      <option value="female">Female Division</option>
                      <option value="male">Male Division</option>
                    </select>
                  </label>
                </>
              )}

              {formRole === 'executive_board' && (
                <label className="text-xs text-[color:var(--wm-ink-secondary)]">
                  EB Reporting Rank
                  <select
                    value={formEbRank}
                    onChange={(e) => {
                      const nextRank = e.target.value;
                      setFormEbRank(nextRank);
                      if (!editingAccount) {
                        setFormPermissions(defaultPermissionsForRole('executive_board', nextRank));
                      }
                    }}
                    className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
                  >
                    <option value="head">Department Head</option>
                    <option value="co_head">Co-Head</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="member">EB Member</option>
                  </select>
                </label>
              )}

              <label className="text-xs text-[color:var(--wm-ink-secondary)]">
                {editingAccount && !editingAccount.user_id.startsWith('pending:')
                  ? 'New Password (optional)'
                  : 'Initial Password (optional — leave blank for invite link)'}
                <input
                  type="password"
                  minLength={10}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="At least 10 characters"
                  className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
                />
              </label>

              <label className="flex items-center gap-2 pt-5 text-xs text-[color:var(--wm-ink)]">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 accent-[#2d6a4f]"
                />
                Account active (can sign in)
              </label>
            </div>

            {/* RBAC Permissions Checklist */}
            <div className="mt-5 border-t border-[color:var(--wm-hairline)] pt-4">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-[color:var(--wm-ink)]">
                    Assigned Permissions
                  </p>
                  <p className="text-[11px] text-[color:var(--wm-ink-muted)]">
                    Super IT governance permissions are permanently reserved and cannot be assigned to Admin or Head accounts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormPermissions(defaultPermissionsForRole(formRole, formEbRank))}
                  className="text-[11px] text-[color:var(--wm-accent)] underline hover:text-[color:var(--wm-focal)]"
                >
                  Reset to role defaults
                </button>
              </div>

              <div className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] p-3 sm:grid-cols-2">
                {visiblePermissionDefs.map((perm) => {
                  const checked = Boolean(formPermissions[perm.key]);
                  return (
                    <button
                      key={perm.key}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() =>
                        setFormPermissions((prev) => ({
                          ...prev,
                          [perm.key]: !checked,
                        }))
                      }
                      className="flex items-start gap-2.5 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-surface)] p-2.5 text-left transition-colors hover:border-[color:var(--wm-hairline-strong)]"
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? 'border-[color:var(--wm-accent)] bg-[color:var(--wm-emerald)] text-[#eef4ef]'
                            : 'border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)]'
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" aria-hidden="true" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-[color:var(--wm-ink)]">
                          {perm.label}
                        </span>
                        <span className="block text-[10px] text-[color:var(--wm-ink-muted)]">
                          {perm.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {formError && (
              <p
                role="alert"
                className="mt-4 rounded-md border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
              >
                {formError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2 border-t border-[color:var(--wm-hairline)] pt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-9 rounded-md border border-[color:var(--wm-hairline-strong)] px-4 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-inset)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 rounded-md bg-[color:var(--wm-emerald)] px-5 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] disabled:opacity-50"
              >
                {saving
                  ? 'Saving…'
                  : editingAccount && !editingAccount.user_id.startsWith('pending:')
                    ? 'Save Account Changes'
                    : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reset Access Modal */}
      {resetTarget && (
        <div
          className="fixed inset-0 z-[130] grid place-items-center bg-[#030906]/82 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Reset access for ${resetTarget.full_name}`}
          onClick={() => setResetTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[color:var(--wm-hairline)] pb-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">
                  Reset Account Access
                </p>
                <h3 className="mt-1 text-base font-semibold text-[color:var(--wm-ink)]">
                  {resetTarget.full_name}
                </h3>
                <p className="text-xs text-[color:var(--wm-ink-secondary)]">{resetTarget.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                aria-label="Close reset dialog"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--wm-ink-muted)] hover:bg-[color:var(--wm-inset)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={(e) => void handleDirectPasswordReset(e)} className="mt-4 space-y-3">
              <label className="block text-xs text-[color:var(--wm-ink-secondary)]">
                Set a new temporary password directly
                <input
                  type="password"
                  minLength={10}
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  placeholder="At least 10 characters"
                  className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
                />
              </label>
              <button
                type="submit"
                disabled={resetBusy || resetPasswordInput.trim().length < 10}
                className="inline-flex h-9 w-full items-center justify-center rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] disabled:opacity-45"
              >
                {resetBusy ? 'Updating password…' : 'Set New Password'}
              </button>
            </form>

            <div className="mt-4 border-t border-[color:var(--wm-hairline)] pt-4">
              <p className="text-[11px] text-[color:var(--wm-ink-muted)]">
                Or generate a private one-time recovery link so the user can choose their own password:
              </p>
              <button
                type="button"
                disabled={busyId === resetTarget.user_id}
                onClick={() => void handleGenerateResetLink(resetTarget)}
                className="mt-2.5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-4 text-xs font-medium text-[color:var(--wm-focal)] hover:bg-[color:var(--wm-overlay)]"
              >
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                Generate One-Time Setup Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Private Setup / Invite Link Dialog */}
      {setupLinkDialog && (
        <div
          className="fixed inset-0 z-[135] grid place-items-center bg-[#030906]/82 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Private account setup link"
          onClick={() => setSetupLinkDialog(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-xl border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[color:var(--wm-hairline)] pb-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">
                  Private Credential Link
                </p>
                <h3 className="mt-1 text-base font-semibold text-[color:var(--wm-ink)]">
                  {setupLinkDialog.name}
                </h3>
                <p className="text-xs text-[color:var(--wm-ink-secondary)]">{setupLinkDialog.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSetupLinkDialog(null)}
                aria-label="Close setup link dialog"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--wm-ink-muted)] hover:bg-[color:var(--wm-inset)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 break-all rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] p-3 font-mono text-[11px] text-[color:var(--wm-ink)]">
              {setupLinkDialog.url}
            </div>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(setupLinkDialog.url);
                pushToast({ tone: 'success', title: 'Setup link copied privately' });
              }}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copy Setup Link
            </button>
          </div>
        </div>
      )}

      {/* Safe Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        tone="danger"
        title="Delete Staff Account?"
        description={
          deleteTarget
            ? `Permanently delete ${deleteTarget.full_name} (${deleteTarget.email})? Applications, committee updates, and attendance logs remain preserved.`
            : ''
        }
        confirmLabel="Delete Account"
        cancelLabel="Cancel"
        onConfirm={() => void handleDeleteAccount()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
