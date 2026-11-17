import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Building2, Lock, Shield, UserCheck } from 'lucide-react';
import { useAdminStore } from '../../context/AdminStoreContext';
import type { PortalKey } from '../../types/admin';
import {
  getPortalBasePath,
  getPortalHomeRoute,
  getRoleLabel,
} from '../../utils/adminPermissions';
import { RoleBadge } from './StatusBadge';

interface PortalAuthViewProps {
  portal?: PortalKey;
  onNavigate: (path: string) => void;
}

const PORTAL_META: Record<
  PortalKey,
  { title: string; subtitle: string; icon: typeof Shield; path: string; shortLabel: string }
> = {
  super_admin: {
    title: 'Super Admin Environment',
    subtitle:
      'Highest platform authority. Manage accounts, roles, permissions, Website CMS, conference content, and Department Access Testing.',
    icon: Shield,
    path: '/super-admin',
    shortLabel: 'Super Admin',
  },
  admin: {
    title: 'Admin Dashboard',
    subtitle:
      'Conference operations, final Stage 2 decisions, committees, Secretariat, registration, communications, and Website CMS (accounts read-only).',
    icon: UserCheck,
    path: '/admin',
    shortLabel: 'Admin',
  },
  department_head: {
    title: 'Department Head Portal',
    subtitle:
      'Department-isolated environment (/head). Manage department workspace, teams, shifts, and Stage 1 recommendations.',
    icon: Building2,
    path: '/head',
    shortLabel: 'Dept Head (/head)',
  },
};

export function PortalAuthView({ portal, onNavigate }: PortalAuthViewProps) {
  const { data, currentUser, signInWithCredentials, signInAsDemoUser, signOut } = useAdminStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const meta = portal ? PORTAL_META[portal] : null;
  const Icon = meta?.icon ?? Shield;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = signInWithCredentials(email, password, portal);
    if (!res.ok || !res.data) {
      setErrorMsg(res.error ?? 'Authentication failed.');
      return;
    }
    if (!portal) {
      onNavigate(getPortalHomeRoute(res.data.role));
    }
  };

  const relevantDemoUsers = data.users.filter((u) => {
    if (!u.isActive || u.status !== 'active') return false;
    if (!portal) return true;
    if (portal === 'super_admin') return u.role === 'super_admin';
    if (portal === 'admin') return u.role === 'admin' || u.role === 'super_admin';
    return u.role === 'department_head';
  });

  const wrongRoleSignedIn =
    portal &&
    currentUser &&
    ((portal === 'department_head' && currentUser.role !== 'department_head') ||
      (portal === 'super_admin' && currentUser.role !== 'super_admin') ||
      (portal === 'admin' && currentUser.role !== 'admin' && currentUser.role !== 'super_admin'));

  return (
    <div className="wm-admin min-h-[100dvh] bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)] flex flex-col">
      <header className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex min-h-[40px] items-center gap-2 text-xs font-medium text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] cursor-pointer transition-colors duration-150"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Willow MUN Public Site</span>
          </button>

          <div className="flex items-center gap-2">
            <img
              src="/assets/logo-transparent.png"
              alt=""
              width={22}
              height={22}
              className="h-5 w-5 object-contain"
            />
            <span className="font-serif text-base font-medium tracking-wide text-[color:var(--wm-ink)]">
              Willow MUN 2026
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[color:var(--wm-hairline)] pb-6">
          <div>
            <p className="wm-section-kicker text-[color:var(--wm-accent)]">
              Conference Administration Platform
            </p>
            <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl font-medium tracking-tight text-[color:var(--wm-ink)]">
              {meta ? meta.title : 'Select Administrative Portal'}
            </h1>
            <p className="mt-2 text-sm text-[color:var(--wm-ink-secondary)] max-w-2xl">
              {meta
                ? meta.subtitle
                : 'Authenticate into Super Admin, Admin, or Department Head environments.'}
            </p>
          </div>

          <div
            role="navigation"
            aria-label="Portal environment switcher"
            className="inline-flex flex-wrap gap-1 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)] p-1 self-start lg:self-end"
          >
            {(Object.keys(PORTAL_META) as PortalKey[]).map((key) => {
              const p = PORTAL_META[key];
              const active = portal === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onNavigate(p.path)}
                  className={`min-h-[34px] rounded px-3 text-xs font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[color:var(--wm-focal)] text-[#12170c]'
                      : 'text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                  }`}
                >
                  {p.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {wrongRoleSignedIn && currentUser && (
          <div className="mb-8 rounded-md border border-amber-400/35 bg-amber-500/[0.08] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-200">
                  Signed in as {currentUser.fullName} ({getRoleLabel(currentUser.role)})
                </p>
                <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                  Your current session does not have access to {meta?.title}. Open your assigned
                  portal or sign out to switch accounts.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigate(getPortalHomeRoute(currentUser.role))}
                  className="min-h-[38px] rounded bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer whitespace-nowrap"
                >
                  Open My Portal
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="min-h-[38px] rounded border border-[color:var(--wm-hairline-strong)] px-4 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer whitespace-nowrap"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <section className="lg:col-span-5 wm-surface-panel p-6 sm:p-7">
            <div className="flex items-center gap-3 pb-4 border-b border-[color:var(--wm-hairline)]">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-[color:var(--wm-inset)] text-[color:var(--wm-accent)]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
                  {portal === 'department_head'
                    ? 'Department Head Sign In'
                    : meta
                      ? `${meta.title} Sign In`
                      : 'Staff Authentication'}
                </h2>
                <p className="text-xs text-[color:var(--wm-ink-muted)]">
                  Enter your Willow MUN credentials
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="portal-email"
                  className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]"
                >
                  Staff Email
                </label>
                <input
                  id="portal-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@willowmun.org"
                  className="mt-1.5 h-10 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]/60 focus:border-[color:var(--wm-focal)] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="portal-password"
                  className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]"
                >
                  Password
                </label>
                <input
                  id="portal-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="mt-1.5 h-10 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]/60 focus:border-[color:var(--wm-focal)] focus:outline-none"
                />
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded border border-rose-400/40 bg-rose-500/12 px-3 py-2 text-xs text-rose-200"
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-[color:var(--wm-focal)] px-4 text-sm font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer transition-colors duration-150"
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                <span>Sign In</span>
              </button>
            </form>
          </section>

          <section className="lg:col-span-7 wm-surface-panel overflow-hidden">
            <div className="px-6 py-5 border-b border-[color:var(--wm-hairline)]">
              <h2 className="text-base font-semibold text-[color:var(--wm-ink)]">
                {portal === 'department_head'
                  ? 'Active Department Head Accounts'
                  : 'Configured Staff Accounts (Quick Access)'}
              </h2>
              <p className="mt-1 text-xs text-[color:var(--wm-ink-muted)]">
                {portal === 'department_head'
                  ? 'Signing in automatically scopes /head strictly to that head’s assigned department.'
                  : 'Select an account to preview its exact permissions across the three-tier RBAC hierarchy.'}
              </p>
            </div>

            <div className="divide-y divide-[color:var(--wm-hairline)]">
              {relevantDemoUsers.map((user) => {
                const dept = user.departmentId
                  ? data.departments.find((d) => d.id === user.departmentId)
                  : null;
                const enabledCount = Object.values(user.permissions).filter(Boolean).length;

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      const res = signInAsDemoUser(user.id);
                      if (res.ok && res.data) {
                        const targetPath = portal
                          ? getPortalBasePath(portal)
                          : getPortalHomeRoute(res.data.role);
                        onNavigate(targetPath);
                      }
                    }}
                    className="group flex w-full flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3.5 text-left hover:bg-[#ede6ca]/[0.04] transition-colors duration-150 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-sm font-semibold text-[color:var(--wm-ink)] group-hover:text-[color:var(--wm-focal)]">
                          {user.fullName}
                        </span>
                        <span className="font-mono text-[11px] text-[color:var(--wm-ink-muted)] truncate">
                          {user.email}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[color:var(--wm-accent)]">
                        {dept ? dept.name : user.title}
                        <span className="text-[color:var(--wm-ink-muted)]">
                          {' '}
                          · {enabledCount} permissions
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                      <RoleBadge role={user.role} />
                      <ArrowRight
                        className="h-4 w-4 text-[color:var(--wm-ink-muted)] group-hover:text-[color:var(--wm-ink)] transition-colors duration-150"
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
