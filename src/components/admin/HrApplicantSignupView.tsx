import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { claimHrApplicantSignup } from '../../services/liveBackendService';

export function HrApplicantSignupView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!token) return setError('Signup link is missing. Please ask HR for a new link.');
    if (password.length < 10) return setError('Password must be at least 10 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    const result = await claimHrApplicantSignup(token, password);
    if (!result.success || !result.email) {
      setError(result.error || 'Could not complete signup. Contact HR.');
      setBusy(false);
      return;
    }
    const signedIn = await supabase.auth.signInWithPassword({ email: result.email, password });
    setBusy(false);
    if (signedIn.error) {
      setDone(true);
      setError('Account created, but automatic sign-in did not complete. Please go to Head Login and sign in with your email and password.');
      return;
    }
    setDone(true);
    onNavigate('/head');
  };

  return (
    <div className="wm-admin min-h-[100dvh] grid place-items-center bg-[color:var(--wm-canvas)] p-5 text-[color:var(--wm-ink)]">
      <section className="wm-surface-panel w-full max-w-md p-6 sm:p-8">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)]">
          {done ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <ShieldCheck className="h-5 w-5 text-[color:var(--wm-accent)]" />}
        </div>
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">Willow MUN · Staff onboarding</p>
        <h1 className="wm-serif mt-2 text-2xl font-semibold">{done ? 'Account created' : 'Set up your account'}</h1>
        <p className="mt-2 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
          {done ? 'Your account has been created from your accepted application.' : 'Create a password to claim your accepted application and access your assigned staff portal.'}
        </p>
        {error && <div role="alert" className="mt-4 rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-200">{error}</div>}
        {!done && (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <label className="block text-xs font-medium">
              Password
              <div className="mt-1.5 flex items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3">
                <LockKeyhole className="h-4 w-4 text-[color:var(--wm-ink-muted)]" />
                <input type="password" autoComplete="new-password" required minLength={10} value={password} onChange={e => setPassword(e.target.value)} className="h-11 w-full bg-transparent text-sm outline-none" placeholder="At least 10 characters" />
              </div>
            </label>
            <label className="block text-xs font-medium">
              Confirm password
              <input type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1.5 h-11 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-sm outline-none" placeholder="Enter password again" />
            </label>
            <button type="submit" disabled={busy} className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}
        {done && <button type="button" onClick={() => onNavigate('/head-login')} className="mt-5 h-10 w-full rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-white">Go to Head Login</button>}
      </section>
    </div>
  );
}
