import { useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, Lock, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function ExecutiveBoardSignupView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) { setError('Enter your registered EB email address.'); return; }
    if (password.length < 10) { setError('Use a password with at least 10 characters.'); return; }
    if (password !== confirmPassword) { setError('The passwords do not match.'); return; }

    setBusy(true);
    const { data, error: invokeError } = await supabase.functions.invoke('willow-eb-signup', {
      body: { email: normalizedEmail, password },
    });
    if (invokeError || data?.error || !data?.success) {
      setBusy(false);
      setError(data?.error || invokeError?.message || 'We could not create your EB account. Check that you used your registered EB email.');
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (signInError) {
      setBusy(false);
      setError('Your account was created, but automatic sign-in failed. Return to EB login and sign in with the password you just created.');
      return;
    }
    setComplete(true);
    window.location.assign('/head');
  };

  return (
    <div className="wm-admin flex min-h-[100dvh] flex-col bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)]">
      <header className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)]"><div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6"><button type="button" onClick={() => onNavigate('/eb-login')} className="inline-flex min-h-10 items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]"><ArrowLeft className="h-4 w-4" /> Back to EB login</button><span className="font-serif text-base tracking-wide">Willow MUN 2027</span></div></header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-10 sm:px-6"><div className="mx-auto grid w-full max-w-4xl gap-8 lg:grid-cols-2">
        <section className="wm-surface-panel p-6 sm:p-8"><p className="wm-section-kicker text-[color:var(--wm-accent)]">Executive Board access</p><h1 className="mt-2 font-serif text-3xl">Create your EB account</h1>
          {complete ? <div className="mt-7 rounded-lg border border-emerald-300/25 bg-emerald-400/[0.07] p-4"><CheckCircle2 className="h-6 w-6 text-emerald-200" /><p className="mt-3 text-sm">Your EB account is ready. Opening your portal…</p></div> :
          <><p className="mt-3 text-sm leading-6 text-[color:var(--wm-ink-secondary)]">Use your registered EB email and choose a password. Only addresses already in the Willow Executive Board roster can be connected. No email confirmation is needed.</p><form onSubmit={submit} className="mt-7 space-y-4">
            <div><label htmlFor="eb-signup-email" className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Registered EB email</label><input id="eb-signup-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1.5 h-11 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm" /></div>
            <div><label htmlFor="eb-signup-password" className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Create password</label><input id="eb-signup-password" type="password" autoComplete="new-password" minLength={10} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 10 characters" className="mt-1.5 h-11 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm" /></div>
            <div><label htmlFor="eb-signup-confirm" className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Confirm password</label><input id="eb-signup-confirm" type="password" autoComplete="new-password" minLength={10} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter it again" className="mt-1.5 h-11 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm" /></div>
            {error && <p role="alert" className="rounded border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
            <button disabled={busy} type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-sm font-semibold text-[#eef4ef] transition hover:bg-[#357a5b] disabled:opacity-60"><UserPlus className="h-4 w-4" /> {busy ? 'Creating account…' : 'Create EB account'}</button>
          </form></>}
        </section>
        <aside className="flex flex-col justify-center"><div className="flex h-11 w-11 items-center justify-center rounded bg-[color:var(--wm-inset)] text-[color:var(--wm-accent)]"><Lock className="h-5 w-5" /></div><h2 className="mt-5 font-serif text-2xl">One link. Every EB member.</h2><p className="mt-3 text-sm leading-6 text-[color:var(--wm-ink-secondary)]">Your existing roster entry supplies your name, role, department, rank, permissions and profile photo. After account creation, Willow signs you in automatically.</p><p className="mt-4 text-xs leading-5 text-[color:var(--wm-ink-muted)]">Only email addresses already listed in the private EB roster can create an account. Do not share your password.</p></aside>
      </div></main>
    </div>
  );
}
