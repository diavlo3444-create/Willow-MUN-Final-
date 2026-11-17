import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Building2, Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck, UserCheck } from 'lucide-react';
import { useAdminStore } from '../../context/AdminStoreContext';
import type { PortalKey } from '../../types/admin';
import { getPortalHomeRoute, getRoleLabel } from '../../utils/adminPermissions';

interface PortalAuthViewProps {
  portal?: PortalKey;
  onNavigate: (path: string) => void;
}

const META: Record<PortalKey, { title: string; eyebrow: string; heading: string; description: string; icon: typeof ShieldCheck; features: Array<{ title: string; copy: string }> }> = {
  super_admin: { title: 'Super Admin', eyebrow: 'Governance access', heading: 'The command room for Willow MUN.', description: 'A verified workspace for platform governance, account control, conference oversight and system configuration.', icon: ShieldCheck, features: [{ title: 'Platform governance', copy: 'Control accounts, roles and permissions.' }, { title: 'Conference oversight', copy: 'Manage operations and the public experience.' }, { title: 'Security controls', copy: 'Review access and protect sensitive records.' }] },
  admin: { title: 'Admin', eyebrow: 'Conference operations', heading: 'Run the conference from one place.', description: 'Your workspace for applications, committees, Secretariat, communications and day-to-day conference operations.', icon: UserCheck, features: [{ title: 'Application review', copy: 'Review submissions and make conference decisions.' }, { title: 'Conference operations', copy: 'Coordinate departments, schedules and attendance.' }, { title: 'Live conference content', copy: 'Keep the public website and updates current.' }] },
  department_head: { title: 'Department Head', eyebrow: 'Department access', heading: 'Your department, clearly in view.', description: 'A focused workspace for your assigned team, applications, tasks, shifts and department operations.', icon: Building2, features: [{ title: 'Department workspace', copy: 'Work within your assigned department.' }, { title: 'Team coordination', copy: 'Organise members, tasks and shifts.' }, { title: 'Application recommendations', copy: 'Review and submit Stage 1 decisions.' }] },
  executive_board: { title: 'Executive Board', eyebrow: 'Executive Board access', heading: 'Everything your team needs to move.', description: 'Your assigned Willow MUN workspace for tasks, schedules, stations, announcements and team coordination.', icon: Building2, features: [{ title: 'Your responsibilities', copy: 'Keep track of tasks and deadlines.' }, { title: 'Conference schedule', copy: 'View shifts, stations and updates.' }, { title: 'Team coordination', copy: 'Stay aligned with your department.' }] },
};

export function PortalAuthView({ portal, onNavigate }: PortalAuthViewProps) {
  const { currentUser, signInWithCredentials, signOut } = useAdminStore();
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
      if (!portal) onNavigate(getPortalHomeRoute(result.data.role));
    } catch {
      setErrorMsg('Sign-in failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const hasAccess = (role: string) => {
    if (!portal) return true;
    if (portal === 'admin') return role === 'admin' || role === 'super_admin';
    return role === portal;
  };
  const wrongRole = Boolean(portal && currentUser && !hasAccess(currentUser.role));

  return (
    <div className="wm-admin wm-auth-page min-h-[100dvh] lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden min-h-[100dvh] flex-col justify-between overflow-hidden border-r border-white/[0.07] bg-[#09090b] px-10 py-10 lg:flex xl:px-14 xl:py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_420px_at_18%_8%,rgba(212,175,55,0.11),transparent_65%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-[radial-gradient(500px_260px_at_60%_100%,rgba(212,175,55,0.05),transparent_70%)]" />
        <div className="relative flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-[8px] border border-[#d4af37]/35 bg-[#121214]">
            <img src="/assets/logo-transparent.png" alt="" className="h-full w-full object-contain p-1" />
          </span>
          <div>
            <p className="font-serif text-[14px] tracking-[0.14em] text-[#f4f0e4]">WILLOW MUN <span className="text-[#d4af37]">2026</span></p>
            <p className="mt-1 text-[8.5px] font-mono uppercase tracking-[0.24em] text-neutral-500">Conference management</p>
          </div>
        </div>
        <div className="relative max-w-lg">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.025] px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.18em] text-neutral-400">
            <LockKeyhole className="h-3 w-3 text-[#d4af37]" aria-hidden="true" /> {meta?.eyebrow ?? 'Authorised staff only'}
          </span>
          <h1 className="font-serif text-[42px] leading-[1.04] text-[#f7f2e4] xl:text-[48px]">{meta?.heading ?? 'One secure workspace for Willow MUN.'}</h1>
          <p className="mt-5 max-w-md text-[13px] leading-relaxed text-neutral-400">{meta?.description ?? 'Choose your assigned portal and continue with your Willow MUN account.'}</p>
          <div className="mt-9 grid max-w-md gap-3">
            {(meta?.features ?? [{ title: 'Role-based access', copy: 'Each account sees only its assigned workspace.' }, { title: 'Conference operations', copy: 'Keep teams and conference activity coordinated.' }, { title: 'Secure records', copy: 'Your permissions determine what you can manage.' }]).map((item) => (
              <div key={item.title} className="flex items-start gap-3 border-t border-white/[0.06] pt-3">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d4af37]/80" aria-hidden="true" />
                <div><p className="text-[11.5px] font-medium text-neutral-200">{item.title}</p><p className="mt-0.5 text-[10.5px] leading-relaxed text-neutral-500">{item.copy}</p></div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-[9px] font-mono uppercase tracking-[0.18em] text-neutral-500">Willow MUN · Authorised accounts only</p>
      </section>

      <section className="relative flex min-h-[100dvh] flex-col justify-center px-5 py-10 sm:px-8 lg:px-10 xl:px-14">
        <div className="mx-auto w-full max-w-[410px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-[8px] border border-[#d4af37]/35 bg-[#121214]"><img src="/assets/logo-transparent.png" alt="" className="h-full w-full object-contain p-1" /></span>
            <div><p className="font-serif text-[13px] tracking-[0.14em] text-[#f4f0e4]">WILLOW MUN <span className="text-[#d4af37]">2026</span></p><p className="mt-0.5 text-[8.5px] font-mono uppercase tracking-[0.2em] text-neutral-500">Conference management</p></div>
          </div>
          <button type="button" onClick={() => onNavigate('/')} className="mb-8 inline-flex items-center gap-2 text-[11px] text-neutral-500 transition-colors hover:text-neutral-200"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to Willow MUN</button>
          <p className="text-[9.5px] font-mono uppercase tracking-[0.22em] text-[#d4af37]">{meta?.eyebrow ?? 'Staff access'}</p>
          <h2 className="mt-2 font-serif text-[32px] leading-tight text-white">{meta ? 'Sign in to ' + meta.title : 'Sign in to your portal'}</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">Use the email and password assigned to your Willow MUN account.</p>

          {wrongRole && currentUser && (
            <div className="mt-6 rounded-md border border-amber-400/30 bg-amber-500/[0.07] p-4">
              <p className="text-[12px] font-semibold text-amber-100">You are signed in as {currentUser.fullName}.</p>
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">This account is assigned to {getRoleLabel(currentUser.role)}, not {meta?.title}. Open your assigned portal or sign out first.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => onNavigate(getPortalHomeRoute(currentUser.role))} className="rounded bg-[#d4af37] px-3 py-2 text-[10px] font-semibold text-black hover:bg-[#f3e5ab]">Open my portal <ArrowRight className="ml-1 inline h-3 w-3" /></button>
                <button type="button" onClick={signOut} className="rounded border border-white/10 px-3 py-2 text-[10px] text-neutral-300 hover:bg-white/[0.05]">Sign out</button>
              </div>
            </div>
          )}

          {errorMsg && <div role="alert" className="mt-5 rounded-md border border-rose-500/30 bg-rose-950/25 px-3 py-2.5 text-[11px] leading-relaxed text-rose-200">{errorMsg}</div>}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div><label htmlFor="portal-email" className="mb-2 block text-[10px] font-medium text-neutral-300">Email address</label><input id="portal-email" type="email" autoComplete="username" required disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your assigned email" className="h-11 w-full rounded-md border border-white/[0.11] bg-[#0b0b0d] px-3.5 text-[12px] text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-[#d4af37]/70 disabled:opacity-50" /></div>
            <div><label htmlFor="portal-password" className="mb-2 block text-[10px] font-medium text-neutral-300">Password</label><div className="relative"><input id="portal-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-11 w-full rounded-md border border-white/[0.11] bg-[#0b0b0d] px-3.5 pr-11 text-[12px] text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-[#d4af37]/70 disabled:opacity-50" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
            <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#e5c158] via-[#d4af37] to-[#aa8232] px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-black transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-3.5 w-3.5" />}{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          {portal === 'executive_board' && <p className="mt-6 border-t border-white/[0.07] pt-5 text-center text-[11px] text-neutral-500">First time here? <button type="button" onClick={() => onNavigate('/eb-signup')} className="font-semibold text-[#d4af37] underline underline-offset-4 hover:text-[#f3e5ab]">Create your EB account</button></p>}
          <p className="mt-8 text-center text-[9px] font-mono uppercase tracking-[0.16em] text-neutral-600">Willow MUN 2026 · Secure portal</p>
        </div>
      </section>
    </div>
  );
}
