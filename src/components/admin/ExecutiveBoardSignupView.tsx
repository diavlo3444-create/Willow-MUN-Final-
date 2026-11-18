import { useState, type FormEvent } from 'react';
import { ArrowLeft, Lock, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../context/AdminStoreContext';

export function ExecutiveBoardSignupView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { signInWithCredentials } = useAdminStore();
  const [inviteToken] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('token') || '';
  });
  const [email, setEmail] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('email')?.trim().toLowerCase() || '';
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!inviteToken) { setError('Open the personal setup link sent by the Super Admin.'); return; }
    if (password.length < 10) { setError('Use a password with at least 10 characters.'); return; }
    if (password !== confirmPassword) { setError('The passwords do not match.'); return; }
    setBusy(true);
    const { data: signupData, error: signupError } = await supabase.functions.invoke('willow-eb-signup', {
      body: { email: normalizedEmail, password, token: inviteToken },
    });
    if (signupError) {
      setBusy(false);
      setError(signupData?.error || signupError.message || 'Signup could not be completed.');
      return;
    }
    const login = await signInWithCredentials(normalizedEmail, password, 'executive_board');
    setBusy(false);
    if (!login.ok) {
      setError(login.error || 'Your account was created. Please sign in from the EB login page.');
      onNavigate('/eb-login');
      return;
    }
    onNavigate('/eb');
  };

  return (
    <div className="wm-admin min-h-[100dvh] bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)] flex flex-col">
      <header className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button type="button" onClick={() => onNavigate('/eb-login')} className="inline-flex min-h-10 items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]">
            <ArrowLeft className="h-4 w-4" /> Back to EB login
          </button>
          <span className="font-serif text-base tracking-wide">Willow MUN 2026</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-10 sm:px-6">
        <div className="mx-auto grid w-full max-w-4xl gap-8 lg:grid-cols-2">
          <section className="wm-surface-panel p-6 sm:p-8">
            <p className="wm-section-kicker text-[color:var(--wm-accent)]">Executive Board access</p>
            <h1 className="mt-2 font-serif text-3xl">Create your account</h1>
            <p className="mt-3 text-sm leading-6 text-[color:var(--wm-ink-secondary)]">Use the email address registered for you by Willow MUN. Your name, department, role, permissions and profile picture will be assigned automatically.</p>
            <form onSubmit={submit} className="mt-7 space-y-4">
              <div>
                <label htmlFor="eb-signup-email" className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Approved EB email</label>
                <input id="eb-signup-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your registered email" className="mt-1.5 h-11 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm" />
              </div>
              <div>
                <label htmlFor="eb-signup-password" className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Create password</label>
                <input id="eb-signup-password" type="password" autoComplete="new-password" minLength={10} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 10 characters" className="mt-1.5 h-11 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm" />
              </div>
              <div>
                <label htmlFor="eb-signup-confirm" className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Confirm password</label>
                <input id="eb-signup-confirm" type="password" autoComplete="new-password" minLength={10} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Enter the same password again" className="mt-1.5 h-11 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm" />
              </div>
              {error && <p role="alert" className="rounded border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
              <button disabled={busy} type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-sm font-semibold text-[#eef4ef] transition hover:bg-[#357a5b] disabled:opacity-60">
                <UserPlus className="h-4 w-4" /> {busy ? 'Creating account…' : 'Create EB account'}
              </button>
            </form>
          </section>
          <aside className="flex flex-col justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded bg-[color:var(--wm-inset)] text-[color:var(--wm-accent)]"><Lock className="h-5 w-5" /></div>
            <h2 className="mt-5 font-serif text-2xl">One shared signup page. Approved emails only.</h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--wm-ink-secondary)]">The signup service checks your email against the private Executive Board roster. It will not create an account for an unlisted address, and each roster entry can be claimed only once.</p>
            <p className="mt-4 text-xs leading-5 text-[color:var(--wm-ink-muted)]">If your email is not accepted or you already registered, contact the Willow MUN Super Admin.</p>
          </aside>
        </div>
      </main>
    </div>
  );
}
