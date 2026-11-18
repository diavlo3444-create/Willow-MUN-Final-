import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Lock, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function ExecutiveBoardSignupView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get('token') || '';
  const invitedEmail = (params.get('email') || '').trim().toLowerCase();
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!inviteToken) setError('This setup link is missing its personal invitation token. Ask the Super Admin to generate a new link.');
  }, [inviteToken]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!inviteToken) { setError('This setup link is invalid. Ask the Super Admin to generate a new one.'); return; }
    if (!normalizedEmail.includes('@')) { setError('Enter the email address registered for your EB position.'); return; }
    if (invitedEmail && normalizedEmail !== invitedEmail) { setError('Use the email address assigned to this personal setup link.'); return; }
    if (password.length < 10) { setError('Use a password with at least 10 characters.'); return; }
    if (password !== confirmPassword) { setError('The passwords do not match.'); return; }

    setBusy(true);
    try {
      const { data, error: setupError } = await supabase.functions.invoke('willow-eb-signup', {
        body: { action: 'claim', token: inviteToken, email: normalizedEmail, password },
      });
      if (setupError || data?.error) throw new Error(data?.error || setupError?.message || 'We could not set up your EB account.');
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (loginError) throw new Error('Your EB profile was created, but automatic sign-in failed. Return to EB login and use the password you just created.');
      window.history.replaceState({}, '', '/eb');
      onNavigate('/eb');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not set up your EB account. Ask the Super Admin for a new link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wm-admin flex min-h-[100dvh] flex-col bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)]">
      <header className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button type="button" onClick={() => onNavigate('/eb-login')} className="inline-flex min-h-10 items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]">
            <ArrowLeft className="h-4 w-4" /> Back to EB login
          </button>
          <span className="font-serif text-base tracking-wide">Willow MUN 2027</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-10 sm:px-6">
        <div className="mx-auto grid w-full max-w-4xl gap-8 lg:grid-cols-2">
          <section className="wm-surface-panel p-6 sm:p-8">
            <p className="wm-section-kicker text-[color:var(--wm-accent)]">Executive Board access</p>
            <h1 className="mt-2 font-serif text-3xl">Set up your EB account</h1>
            <p className="mt-3 text-sm leading-6 text-[color:var(--wm-ink-secondary)]">Use the email assigned to you by Willow MUN and choose a password. Your existing EB profile, position, permissions and QR pass will be connected automatically.</p>
            <form onSubmit={submit} className="mt-7 space-y-4">
              <div>
                <label htmlFor="eb-signup-email" className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Registered EB email</label>
                <input id="eb-signup-email" type="email" autoComplete="email" required readOnly={!!invitedEmail} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1.5 h-11 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm read-only:opacity-75" />
              </div>
              <div>
                <label htmlFor="eb-signup-password" className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Create password</label>
                <input id="eb-signup-password" type="password" autoComplete="new-password" minLength={10} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 10 characters" className="mt-1.5 h-11 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm" />
              </div>
              <div>
                <label htmlFor="eb-signup-confirm" className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Confirm password</label>
                <input id="eb-signup-confirm" type="password" autoComplete="new-password" minLength={10} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter it again" className="mt-1.5 h-11 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm" />
              </div>
              {error && <p role="alert" className="rounded border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
              <button disabled={busy || !inviteToken} type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-sm font-semibold text-[#eef4ef] transition hover:bg-[#357a5b] disabled:opacity-60">
                <UserPlus className="h-4 w-4" /> {busy ? 'Setting up your account…' : 'Create account and sign in'}
              </button>
            </form>
          </section>
          <aside className="flex flex-col justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded bg-[color:var(--wm-inset)] text-[color:var(--wm-accent)]"><Lock className="h-5 w-5" /></div>
            <h2 className="mt-5 font-serif text-2xl">Your EB profile is already prepared.</h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--wm-ink-secondary)]">This personal link connects your login to the correct Executive Board member. Your name, position, department, rank and permissions come from the Willow EB roster. If a photo is available in the EB tree, it will be used automatically.</p>
            <p className="mt-4 text-xs leading-5 text-[color:var(--wm-ink-muted)]">Each personal setup link can only be used once. If it has expired or was already used, ask the Super Admin to generate a fresh one.</p>
          </aside>
        </div>
      </main>
      {busy && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70"><div className="rounded-lg border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-6 py-5 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--wm-hairline-strong)] border-t-[color:var(--wm-accent)]" /><p className="mt-3 text-xs text-[color:var(--wm-ink-secondary)]">Connecting your EB profile…</p></div></div>}
    </div>
  );
}
