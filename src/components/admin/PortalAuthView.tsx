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
  executive_board: {
    title: 'Executive Board Portal',
    subtitle: 'Your assigned department workspace: tasks, shifts, stations, announcements, incident reports, and team structure.',
    icon: Building2,
    path: '/eb',
    shortLabel: 'Executive Board',
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
  const { currentUser, signInWithCredentials, signOut } = useAdminStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const meta = portal ? PORTAL_META[portal] : null;
  const Icon = meta?.icon ?? Shield;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = await signInWithCredentials(email, password, portal);
    if (!res.ok || !res.data) {
      setErrorMsg(res.error ?? 'Authentication failed.');
      return;
    }
    if (!portal) {
      onNavigate(getPortalHomeRoute(res.data.role));
    }
  };



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
                : 'Choose the correct staff portal and sign in with your assigned credentials.'}
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
            {portal === 'executive_board' && <div className="mt-5 border-t border-[color:var(--wm-hairline)] pt-4 text-center"><p className="text-xs text-[color:var(--wm-ink-muted)]">First time here?</p><button type="button" onClick={() => onNavigate('/eb-signup')} className="mt-1 text-sm font-semibold text-[color:var(--wm-accent)] underline underline-offset-4">Create your EB account</button></div>}
          </section>

          <section className="lg:col-span-7 wm-surface-panel p-6 sm:p-7">
            <p className="wm-section-kicker text-[color:var(--wm-accent)]">Secure staff access</p>
            <h2 className="mt-2 font-serif text-2xl text-[color:var(--wm-ink)]">Your account, your permissions.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[color:var(--wm-ink-secondary)]">
              Willow uses Supabase authentication. Demo-account shortcuts have been removed.
              Sign in with the email and password issued to your staff account. Your assigned role
              determines which portal and department data you can access.
            </p>
            <div className="mt-6 border-t border-[color:var(--wm-hairline)] pt-5 text-xs leading-5 text-[color:var(--wm-ink-muted)]">
              <p><strong className="text-[color:var(--wm-ink-secondary)]">Super Admin</strong> — full platform control, including account and role administration.</p>
              <p className="mt-2"><strong className="text-[color:var(--wm-ink-secondary)]">Admin</strong> — conference operations and content management; account administration remains restricted.</p>
              <p className="mt-2"><strong className="text-[color:var(--wm-ink-secondary)]">Department Head</strong> — access limited to the assigned department.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
