import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Building2, Eye, EyeOff, Loader2, LockKeyhole, QrCode, ShieldCheck, UserCheck } from 'lucide-react';
import { useAdminStore } from '../../context/AdminStoreContext';
import type { PortalKey } from '../../types/admin';
import { getPortalHomeRouteForUser, getRoleLabel, isSecurityAccount } from '../../utils/adminPermissions';

interface PortalAuthViewProps {
  portal?: PortalKey;
  onNavigate: (path: string) => void;
}

const META: Record<
  PortalKey,
  {
    title: string;
    eyebrow: string;
    heading: string;
    description: string;
    icon: typeof ShieldCheck;
    features: Array<{ title: string; copy: string }>;
  }
> = {
  super_admin: {
    title: 'Super Admin',
    eyebrow: 'Governance access',
    heading: 'The command room for Willow MUN.',
    description: 'A verified workspace for platform governance, account control, conference oversight and system configuration.',
    icon: ShieldCheck,
    features: [
      { title: 'Platform governance', copy: 'Control accounts, roles and permissions.' },
      { title: 'Conference oversight', copy: 'Manage operations and the public experience.' },
      { title: 'Security controls', copy: 'Review access and protect sensitive records.' },
    ],
  },
  admin: {
    title: 'Admin',
    eyebrow: 'Conference operations',
    heading: 'Run the conference from one place.',
    description: 'Your workspace for applications, committees, Secretariat, communications and day-to-day conference operations.',
    icon: UserCheck,
    features: [
      { title: 'Application review', copy: 'Review submissions and oversee conference decisions.' },
      { title: 'Conference operations', copy: 'Coordinate departments, schedules and attendance.' },
      { title: 'Live conference content', copy: 'Keep committees and public updates current.' },
    ],
  },
  department_head: {
    title: 'Department Head',
    eyebrow: 'Department review',
    heading: 'Focused application review for your division.',
    description: 'Review applicants assigned strictly to your department and gender division, accept or decline submissions, and access your personal QR.',
    icon: Building2,
    features: [
      { title: 'Department & gender isolation', copy: 'Access only applicants assigned to your division.' },
      { title: 'Direct decisions', copy: 'Open applicant dossiers to accept or decline.' },
      { title: 'Personal My QR', copy: 'View, enlarge, and download your permanent conference QR.' },
    ],
  },
  executive_board: {
    title: 'Executive Board & Head Portal',
    eyebrow: 'Executive Board access',
    heading: 'Your assigned department head workspace.',
    description: 'Sign in with your Executive Board account to access your assigned department review queue, division controls, and personal QR credential.',
    icon: Building2,
    features: [
      { title: 'Scoped department access', copy: 'View applicants and tools assigned strictly to your department and division.' },
      { title: 'Unified Head experience', copy: 'Identical layout and permissions to your assigned department head workspace.' },
      { title: 'Personal My QR', copy: 'Access and download your permanent conference entrance QR.' },
    ],
  },
  staff: {
    title: 'Department Staff',
    eyebrow: 'Department workspace',
    heading: 'Your team. Your department. One workspace.',
    description: 'Access the tasks, team roster, shifts and conference resources assigned to your department.',
    icon: Building2,
    features: [
      { title: 'Department-only access', copy: 'Your account is limited to its assigned department.' },
      { title: 'Team coordination', copy: 'View your department roster and assigned shifts.' },
      { title: 'Personal QR', copy: 'Access your own conference credential.' },
    ],
  },
  security: {
    title: 'Security Entrance Scanner',
    eyebrow: 'Security operations',
    heading: 'Fast, verified entrance pass control.',
    description: 'Sign in with an authorized Security account to scan conference QR passes, confirm attendee eligibility, and log gate entry.',
    icon: QrCode,
    features: [
      { title: 'Live camera QR scanning', copy: 'Supports mobile rear cameras, webcams, and manual token verification.' },
      { title: 'Strict pass verification', copy: 'Detects valid, already checked-in, revoked, ineligible, and invalid passes.' },
      { title: 'Privacy-preserving view', copy: 'Shows only attendee verification details needed at the conference gate.' },
    ],
  },
};

export function PortalAuthView({ portal, onNavigate }: PortalAuthViewProps) {
  const { currentUser, data, signInWithCredentials, signOut } = useAdminStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const meta = portal ? META[portal] : null;
  const Icon = meta?.icon ?? ShieldCheck;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const result = await signInWithCredentials(email.trim().toLowerCase(), password, portal);
      if (!result.ok || !result.data) {
        setErrorMsg(result.error ?? 'Authentication failed. Check your details and try again.');
        return;
      }
      if (!portal || portal === 'staff') {
        onNavigate(getPortalHomeRouteForUser(result.data, data.departments));
      } else if (portal === 'security') {
        onNavigate('/security');
      } else {
        onNavigate(getPortalHomeRouteForUser(result.data, data.departments));
      }
    } catch {
      setErrorMsg('Sign-in failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const hasAccess = (role: string) => {
    if (!portal || portal === 'staff') return true;
    if (role === 'super_admin') return true;
    if (portal === 'admin') return role === 'admin';
    if (portal === 'department_head') return role === 'department_head' || role === 'executive_board';
    if (portal === 'security') return isSecurityAccount(currentUser, data.departments);
    return role === portal;
  };
  const wrongRole = Boolean(portal && currentUser && !hasAccess(currentUser.role));

  return (
    <div className="wm-admin wm-auth-page min-h-[100dvh] lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden min-h-[100dvh] flex-col justify-between overflow-hidden border-r border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)] px-10 py-10 lg:flex xl:px-14 xl:py-12">

        <div className="relative flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-[8px] border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)]">
            <img src="/assets/logo-transparent.png" alt="" className="h-full w-full object-contain p-1" />
          </span>
          <div>
            <p className="font-serif text-[14px] tracking-[0.14em] text-[color:var(--wm-ink)]">
              WILLOW MUN <span className="text-[color:var(--wm-accent)]">2027</span>
            </p>
            <p className="mt-1 text-[8.5px] font-mono uppercase tracking-[0.24em] text-[color:var(--wm-ink-muted)]">
              Conference management
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative max-w-lg"
        >
          <span className="mb-5 inline-flex items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-2.5 py-1 text-[9.5px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-focal)]">
            <LockKeyhole className="h-3 w-3 text-[color:var(--wm-accent)]" aria-hidden="true" />
            {meta?.eyebrow ?? 'Authorised staff only'}
          </span>
          <h1 className="font-serif text-[40px] leading-[1.06] text-[color:var(--wm-ink)] xl:text-[46px]">
            {meta?.heading ?? 'One secure workspace for Willow MUN.'}
          </h1>
          <p className="mt-5 max-w-md text-[13px] leading-relaxed text-[color:var(--wm-ink-secondary)]">
            {meta?.description ?? 'Choose your assigned portal and continue with your Willow MUN account.'}
          </p>

          <div className="mt-9 grid max-w-md gap-3">
            {(meta?.features ?? [
              { title: 'Role-based access', copy: 'Each account sees only its assigned workspace.' },
              { title: 'Conference operations', copy: 'Keep teams and conference activity coordinated.' },
              { title: 'Secure records', copy: 'Your permissions determine what you can manage.' },
            ]).map((item) => (
              <div key={item.title} className="flex items-start gap-3 border-t border-[color:var(--wm-hairline)] pt-3">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--wm-accent)]" aria-hidden="true" />
                <div>
                  <p className="text-[11.5px] font-medium text-[color:var(--wm-ink)]">{item.title}</p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-[color:var(--wm-ink-muted)]">{item.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <p className="relative text-[9px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-ink-muted)]">
          Willow MUN · Authorised accounts only
        </p>
      </section>

      <section className="relative flex min-h-[100dvh] flex-col justify-center px-5 py-10 sm:px-8 lg:px-10 xl:px-14">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[410px]"
        >
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-[8px] border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)]">
              <img src="/assets/logo-transparent.png" alt="" className="h-full w-full object-contain p-1" />
            </span>
            <div>
              <p className="font-serif text-[13px] tracking-[0.14em] text-[color:var(--wm-ink)]">
                WILLOW MUN <span className="text-[color:var(--wm-accent)]">2027</span>
              </p>
              <p className="mt-0.5 text-[8.5px] font-mono uppercase tracking-[0.2em] text-[color:var(--wm-ink-muted)]">
                Conference management
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="mb-8 inline-flex items-center gap-2 text-[11px] text-[color:var(--wm-ink-muted)] transition-colors hover:text-[color:var(--wm-ink)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to Willow MUN
          </button>

          <p className="text-[9.5px] font-mono uppercase tracking-[0.22em] text-[color:var(--wm-accent)]">
            {meta?.eyebrow ?? 'Staff access'}
          </p>
          <h2 className="mt-2 font-serif text-[32px] leading-tight text-[color:var(--wm-ink)]">
            {meta ? 'Sign in to ' + meta.title : 'Sign in to your portal'}
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--wm-ink-secondary)]">
            Use the email and password assigned to your Willow MUN account.
          </p>

          {wrongRole && currentUser && (
            <div className="mt-6 rounded-lg border border-amber-400/30 bg-amber-500/[0.08] p-4">
              <p className="text-[12px] font-semibold text-amber-100">You are signed in as {currentUser.fullName}.</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--wm-ink-secondary)]">
                This account is assigned to {getRoleLabel(currentUser.role)}, not {meta?.title}. Open your assigned portal or sign out first.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate(getPortalHomeRouteForUser(currentUser, data.departments))}
                  className="rounded-md bg-[color:var(--wm-emerald)] px-3 py-2 text-[11px] font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
                >
                  Open my portal <ArrowRight className="ml-1 inline h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="rounded-md border border-[color:var(--wm-hairline-strong)] px-3 py-2 text-[11px] text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-inset)]"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="mt-5 rounded-md border border-rose-500/35 bg-rose-950/35 px-3 py-2.5 text-[11px] leading-relaxed text-rose-200"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label htmlFor="portal-email" className="mb-2 block text-[11px] font-medium text-[color:var(--wm-ink-secondary)]">
                Email address
              </label>
              <input
                id="portal-email"
                type="email"
                autoComplete="username"
                required
                disabled={busy}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your assigned email"
                className="h-11 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] px-3.5 text-[13px] text-[color:var(--wm-ink)] outline-none transition-colors placeholder:text-[color:var(--wm-ink-muted)]/60 focus:border-[color:var(--wm-accent)] disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="portal-password" className="mb-2 block text-[11px] font-medium text-[color:var(--wm-ink-secondary)]">
                Password
              </label>
              <div className="relative">
                <input
                  id="portal-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={busy}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="h-11 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] px-3.5 pr-11 text-[13px] text-[color:var(--wm-ink)] outline-none transition-colors placeholder:text-[color:var(--wm-ink-muted)]/60 focus:border-[color:var(--wm-accent)] disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-[color:var(--wm-ink-muted)] transition-colors hover:text-[color:var(--wm-ink)]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#eef4ef] transition hover:bg-[#357a5b] disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-3.5 w-3.5" />}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {portal === 'executive_board' && (
            <p className="mt-6 border-t border-[color:var(--wm-hairline)] pt-5 text-center text-[11px] text-[color:var(--wm-ink-muted)]">
              First time here?{' '}
              <button
                type="button"
                onClick={() => onNavigate('/eb-signup')}
                className="font-semibold text-[color:var(--wm-accent)] underline underline-offset-4 hover:text-[color:var(--wm-focal)]"
              >
                Create your EB account
              </button>
            </p>
          )}
          <p className="mt-8 text-center text-[9px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)]">
            Willow MUN 2027 · Secure portal
          </p>
        </motion.div>
      </section>
    </div>
  );
}

