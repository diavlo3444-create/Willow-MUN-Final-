import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, RefreshCw, ShieldCheck, UserPlus, UserX, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { navigateTo } from '../../../utils/router';
import { WmSkeleton } from '../WmSkeleton';

type ServerHead = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  department_id: string | null;
  is_active: boolean;
  title: string;
  signup_status?: 'claimed' | 'awaiting_signup';
  created_at?: string | null;
};

type HeadRow = {
  id: string;
  user_id?: string;
  testUserId?: string;
  fullName: string;
  email: string;
  title: string;
  departmentId: string | null;
  isActive: boolean;
  signupStatus: 'active' | 'awaiting_setup' | 'suspended';
  source: 'server' | 'roster';
};

export function HeadAccountsView() {
  const { data, currentUser, pushToast, enterDepartmentTestMode, deleteAccount } = useAdminStore();
  const canManage = currentUser?.role === 'super_admin';
  const [serverHeads, setServerHeads] = useState<ServerHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [setupLink, setSetupLink] = useState<{ name: string; email: string; url: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: response, error } = await supabase.functions.invoke('willow-staff-admin', {
      body: { action: 'list' },
    });
    if (error || response?.error) {
      pushToast({
        tone: 'error',
        title: 'Head directory could not load',
        description: response?.error || error?.message,
      });
    } else {
      setServerHeads(
        (response?.accounts || []).filter((account: ServerHead) => account.role === 'department_head'),
      );
    }
    setLoading(false);
  }, [pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const byEmail = new Map<string, HeadRow>();
    for (const account of serverHeads) {
      const rosterUser = data.users.find(
        (u) => u.role === 'department_head' && u.email.toLowerCase() === account.email.toLowerCase(),
      );
      byEmail.set(account.email.toLowerCase(), {
        id: account.user_id,
        user_id: account.user_id,
        testUserId: rosterUser?.id,
        fullName: account.full_name,
        email: account.email,
        title: account.title || 'Department Head',
        departmentId: account.department_id,
        isActive: account.is_active,
        signupStatus: account.is_active
          ? account.signup_status === 'awaiting_signup'
            ? 'awaiting_setup'
            : 'active'
          : 'suspended',
        source: 'server',
      });
    }
    for (const user of data.users.filter((candidate) => candidate.role === 'department_head')) {
      const email = user.email.toLowerCase();
      if (email && !byEmail.has(email)) {
        byEmail.set(email, {
          id: user.id,
          testUserId: user.id,
          fullName: user.fullName,
          email,
          title: user.title || 'Department Head',
          departmentId: user.departmentId,
          isActive: user.isActive,
          signupStatus: 'awaiting_setup',
          source: 'roster',
        });
      }
    }
    return [...byEmail.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [serverHeads, data.users]);

  const filtered = rows.filter((row) => {
    const department = data.departments.find((d) => d.id === row.departmentId)?.name || '';
    return `${row.fullName} ${row.email} ${row.title} ${department}`.toLowerCase().includes(search.toLowerCase());
  });

  const createInvite = async (row: HeadRow) => {
    const department = data.departments.find((d) => d.id === row.departmentId || d.slug === row.departmentId);
    if (!row.email || !department) {
      pushToast({
        tone: 'error',
        title: 'Cannot invite this head',
        description: 'The roster entry needs a valid email and department assignment.',
      });
      return;
    }
    setBusyId(row.id);
    const { data: result, error } = await supabase.functions.invoke('willow-staff-admin', {
      body: {
        action: 'create',
        full_name: row.fullName,
        email: row.email,
        role: 'department_head',
        department_id: department.id,
        title: row.title,
      },
    });
    setBusyId(null);
    if (error || result?.error) {
      pushToast({
        tone: 'error',
        title: 'Head account could not be created',
        description: result?.error || error?.message,
      });
      return;
    }
    if (result?.action_link) setSetupLink({ name: row.fullName, email: row.email, url: result.action_link });
    pushToast({
      tone: 'success',
      title: 'Head account created',
      description: result?.action_link
        ? 'Copy the password setup link and share it privately.'
        : 'An account setup invitation has been sent to ' + row.email,
    });
    await load();
  };

  const generateSetupLink = async (row: HeadRow) => {
    if (!row.user_id) return;
    setBusyId(row.id);
    const { data: result, error } = await supabase.functions.invoke('willow-staff-admin', {
      body: { action: 'send_setup_link', user_id: row.user_id },
    });
    setBusyId(null);
    if (error || result?.error || !result?.action_link) {
      pushToast({
        tone: 'error',
        title: 'Setup link could not be generated',
        description: result?.error || error?.message || 'No link was returned.',
      });
      return;
    }
    setSetupLink({ name: row.fullName, email: row.email, url: result.action_link });
  };

  const toggleActive = async (row: HeadRow) => {
    if (!row.user_id) return;
    setBusyId(row.id);
    const { data: result, error } = await supabase.functions.invoke('willow-staff-admin', {
      body: { action: row.isActive ? 'suspend' : 'reactivate', user_id: row.user_id },
    });
    setBusyId(null);
    if (error || result?.error) {
      pushToast({
        tone: 'error',
        title: 'Account status could not be changed',
        description: result?.error || error?.message,
      });
      return;
    }
    await load();
  };

  const removeHead = async (row: HeadRow) => {
    if (!window.confirm(row.source === 'roster' ? 'Remove pending head entry for ' + row.fullName + ' (' + row.email + ')?' : 'Permanently delete account for ' + row.fullName + ' (' + row.email + ')?')) return;
    setBusyId(row.id);
    if (row.source === 'roster') {
      const success = deleteAccount(row.id);
      setBusyId(null);
      if (success) pushToast({ tone: 'success', title: 'Pending head removed', description: row.fullName + ' removed from roster.' });
      return;
    }
    const { data: result, error } = await supabase.functions.invoke('willow-staff-admin', { body: { action: 'delete', user_id: row.user_id } });
    setBusyId(null);
    if (error || result?.error) { pushToast({ tone: 'error', title: 'Delete failed', description: result?.error || error?.message }); return; }
    pushToast({ tone: 'success', title: 'Head account deleted', description: row.fullName + ' removed.' });
    await load();
  };

  const copyLink = async () => {
    if (!setupLink) return;
    try {
      await navigator.clipboard.writeText(setupLink.url);
      pushToast({ tone: 'success', title: 'Setup link copied', description: 'Share it privately with ' + setupLink.name });
    } catch {
      pushToast({ tone: 'info', title: 'Copy link manually from the dialog box below' });
    }
  };

  const awaiting = rows.filter((row) => row.signupStatus === 'awaiting_setup').length;
  const active = rows.filter((row) => row.signupStatus === 'active').length;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'All department heads', value: rows.length },
          { label: 'Awaiting password setup', value: awaiting },
          { label: 'Active accounts', value: active },
        ].map((item) => (
          <div key={item.label} className="wm-surface-panel p-4">
            <p className="text-[11px] text-[color:var(--wm-ink-secondary)]">{item.label}</p>
            <p className="wm-serif mt-2 text-2xl tabular-nums text-[color:var(--wm-ink)]">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="wm-surface-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] px-4 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">Department Head Accounts</h2>
            <p className="mt-1 text-[11px] text-[color:var(--wm-ink-muted)]">
              Includes every head in the roster, whether or not they have created a password.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-[11px] text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)]"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" /> Refresh
          </button>
        </div>

        <div className="border-b border-[color:var(--wm-hairline)] p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or department..."
            className="h-9 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)] sm:max-w-sm"
          />
        </div>

        {loading ? (
          <div className="p-4">
            <WmSkeleton variant="table" rows={5} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">No department heads found.</p>
        ) : (
          <div className="divide-y divide-[color:var(--wm-hairline)]">
            {filtered.map((row) => {
              const department = data.departments.find((d) => d.id === row.departmentId || d.slug === row.departmentId);
              const busy = busyId === row.id;
              return (
                <article
                  key={row.email || row.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--wm-hairline-strong)] bg-[#2d6a4f]/25 text-[10px] font-semibold text-[color:var(--wm-focal)]">
                      {row.fullName
                        .split(/\s+/)
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[color:var(--wm-ink)]">{row.fullName}</p>
                      <p className="truncate text-[10px] text-[color:var(--wm-ink-secondary)]">{row.email}</p>
                      <p className="mt-1 text-[10px] text-[color:var(--wm-ink-muted)]">
                        {row.title} · {department?.name || 'Department not linked'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span
                      className={
                        'rounded-md border px-2.5 py-1 text-[9px] uppercase tracking-wider ' +
                        (row.signupStatus === 'active'
                          ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
                          : row.signupStatus === 'suspended'
                            ? 'border-rose-400/25 bg-rose-500/10 text-rose-200'
                            : 'border-amber-400/25 bg-amber-500/10 text-amber-200')
                      }
                    >
                      {row.signupStatus === 'active'
                        ? 'Active'
                        : row.signupStatus === 'suspended'
                          ? 'Suspended'
                          : 'Awaiting password setup'}
                    </span>
                    {!canManage ? null : (
                      <>
                        {(row.testUserId || department) && (
                          <button
                            type="button"
                            onClick={() => {
                              const ok = enterDepartmentTestMode({
                                id: row.testUserId || row.id,
                                role: 'department_head',
                                fullName: row.fullName,
                                email: row.email,
                                title: row.title,
                                departmentId: department?.id ?? row.departmentId,
                                departmentSlug: department?.slug ?? null,
                              });
                              if (ok) navigateTo('/head');
                            }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-accent)]/35 bg-[#2d6a4f]/20 px-3 text-[10px] text-[color:var(--wm-focal)] hover:bg-[#2d6a4f]/35"
                          >
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                            Sign in as
                          </button>
                        )}
                        {row.source === 'roster' ? (
                          <>
                            <button type="button" disabled={busy} onClick={() => void removeHead(row)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-400/30 px-3 text-[10px] text-rose-200 hover:bg-rose-500/10 disabled:opacity-40"><UserX className="h-3 w-3" aria-hidden="true" />{busy ? 'Removing…' : 'Delete'}</button>
                          <button
                            type="button"
                            disabled={busy || !row.email || !department}
                            onClick={() => void createInvite(row)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[color:var(--wm-emerald)] px-3 text-[10px] font-semibold text-[#eef4ef] hover:bg-[#357a5b] disabled:opacity-40"
                          >
                            <UserPlus className="h-3 w-3" aria-hidden="true" />
                            {busy ? 'Creating…' : 'Create login & invite'}
                          </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void generateSetupLink(row)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-[10px] text-[color:var(--wm-focal)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-40"
                            >
                              <KeyRound className="h-3 w-3" aria-hidden="true" />
                              {busy ? 'Generating…' : 'Set / reset password'}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void toggleActive(row)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline)] px-3 text-[10px] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] disabled:opacity-40"
                            >
                              {row.isActive ? (
                                <>
                                  <UserX className="h-3 w-3" aria-hidden="true" />
                                  Suspend
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                                  Reactivate
                                </>
                              )}
                            </button>
                            <button type="button" disabled={busy} onClick={() => void removeHead(row)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-400/30 px-3 text-[10px] text-rose-200 hover:bg-rose-500/10 disabled:opacity-40"><UserX className="h-3 w-3" aria-hidden="true" />{busy ? 'Deleting…' : 'Delete'}</button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {canManage && setupLink && (
        <div
          className="fixed inset-0 z-[130] grid place-items-center bg-[#030906]/84 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Password setup link"
          onClick={() => setSetupLink(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-xl border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] p-5"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[color:var(--wm-hairline)] pb-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">
                  Account setup
                </p>
                <h3 className="mt-1.5 text-lg font-semibold text-[color:var(--wm-ink)]">{setupLink.name}</h3>
                <p className="mt-0.5 text-xs text-[color:var(--wm-ink-secondary)]">{setupLink.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSetupLink(null)}
                aria-label="Close setup link dialog"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--wm-ink-muted)] hover:bg-[color:var(--wm-inset)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
              This one-time password recovery link lets the head set their own password privately.
            </p>
            <div className="mt-3 break-all rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] p-3 font-mono text-[10px] text-[color:var(--wm-ink)]">
              {setupLink.url}
            </div>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy setup link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
