import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, Lock, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function ExecutiveBoardSignupView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const finished = useRef(false);

  const finishSignup = async () => {
    if (finished.current || finishing) return;
    finished.current = true;
    setFinishing(true);
    setError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.access_token || !session.user.email) {
      finished.current = false;
      setFinishing(false);
      setError('Your email is not verified yet. Open the confirmation email on this device, then return here.');
      return;
    }
    const { data, error: finishError } = await supabase.functions.invoke('willow-eb-signup', { body: {} });
    if (finishError || data?.error) {
      await supabase.auth.signOut();
      finished.current = false;
      setFinishing(false);
      setError(data?.error || finishError?.message || 'We could not connect your EB profile.');
      return;
    }
    await supabase.auth.refreshSession();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('finish') !== '1') return;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) window.setTimeout(() => void finishSignup(), 0);
    });
    void finishSignup();
    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) { setError('Enter your registered EB email address.'); return; }
    if (password.length < 10) { setError('Use a password with at least 10 characters.'); return; }
    if (password !== confirmPassword) { setError('The passwords do not match.'); return; }
    setBusy(true);
    const { data, error: signupError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: `${window.location.origin}/eb-signup?finish=1` },
    });
    setBusy(false);
    if (signupError) {
      setError(/already registered|already exists/i.test(signupError.message)
        ? 'An account already exists for this email. Use EB login or contact the Super Admin.'
        : signupError.message);
      return;
    }
    if (data.user?.identities?.length === 0) {
      setError('An account already exists for this email. Use EB login or contact the Super Admin.');
      return;
    }
    if (data.session) { await finishSignup(); return; }
    setVerificationSent(true);
  };

  return (
    <div className="wm-admin flex min-h-[100dvh] flex-col bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)]">
      <header className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)]"><div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6"><button type="button" onClick={() => onNavigate('/eb-login')} className="inline-flex min-h-10 items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]"><ArrowLeft className="h-4 w-4" /> Back to EB login</button><span className="font-serif text-base tracking-wide">Willow MUN 2027</span></div></header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-10 sm:px-6"><div className="mx-auto grid w-full max-w-4xl gap-8 lg:grid-cols-2">
        <section className="wm-surface-panel p-6 sm:p-8"><p className="wm-section-kicker text-[color:var(--wm-accent)]">Executive Board access</p><h1 className="mt-2 font-serif text-3xl">Create your EB account</h1>
          {verificationSent ? <div className="mt-7 rounded-lg border border-emerald-300/25 bg-emerald-400/[0.07] p-4"><CheckCircle2 className="h-6 w-6 text-emerald-200" /><h2 className="mt-3 text-sm font-semibold">Check your email</h2><p className="mt-2 text-xs leading-5 text-[color:var(--wm-ink-secondary)]">We sent a confirmation link to <strong className="text-[color:var(--wm-ink)]">{email.trim()}</strong>. Open it to verify that you own this email. Willow will then match it to your EB roster entry and finish setting up your account.</p><button type="button" onClick={() => setVerificationSent(false)} className="mt-4 text-xs text-[color:var(--wm-focal)] underline underline-offset-4">Use a different email</button></div> :
          <><p className="mt-3 text-sm leading-6 text-[color:var(--wm-ink-secondary)]">Enter the email address already registered for you by Willow MUN, then choose your password. Your EB identity and permissions will be loaded automatically.</p><form onSubmit={submit} className="mt-7 space-y-4">
            <div><label htmlFor="eb-signup-email" className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Registered EB email</label><input id="eb-signup-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1.5 h-11 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm" /></div>
            <div><label htmlFor="eb-signup-password" className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Create password</label><input id="eb-signup-password" type="password" autoComplete="new-password" minLength={10} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 10 characters" className="mt-1.5 h-11 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm" /></div>
            <div><label htmlFor="eb-signup-confirm" className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Confirm password</label><input id="eb-signup-confirm" type="password" autoComplete="new-password" minLength={10} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter it again" className="mt-1.5 h-11 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm" /></div>
            {error && <p role="alert" className="rounded border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
            <button disabled={busy} type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-sm font-semibold text-[#eef4ef] transition hover:bg-[#357a5b] disabled:opacity-60"><UserPlus className="h-4 w-4" /> {busy ? 'Setting up…' : 'Create EB account'}</button>
          </form></>}
        </section>
        <aside className="flex flex-col justify-center"><div className="flex h-11 w-11 items-center justify-center rounded bg-[color:var(--wm-inset)] text-[color:var(--wm-accent)]"><Lock className="h-5 w-5" /></div><h2 className="mt-5 font-serif text-2xl">Your existing EB profile, connected automatically.</h2><p className="mt-3 text-sm leading-6 text-[color:var(--wm-ink-secondary)]">Only email addresses already listed in the private Executive Board roster can register. Your name, role, department, rank and permissions come from that roster. If your tree profile has a photo, it will be used automatically.</p><p className="mt-4 text-xs leading-5 text-[color:var(--wm-ink-muted)]">Email verification is required. Each EB roster entry can only be claimed once.</p></aside>
      </div></main>
      {finishing && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70"><div className="rounded-lg border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-6 py-5 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--wm-hairline-strong)] border-t-[color:var(--wm-accent)]" /><p className="mt-3 text-xs text-[color:var(--wm-ink-secondary)]">Connecting your EB profile…</p></div></div>}
    </div>
  );
}
