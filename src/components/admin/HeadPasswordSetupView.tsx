import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function HeadPasswordSetupView({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) { setHasSession(Boolean(data.session)); setChecking(false); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setHasSession(Boolean(session));
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 10) { setError('Use at least 10 characters.'); return; }
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    setSuccess(true);
    window.setTimeout(onComplete, 900);
  };

  return (
    <main className="wm-admin min-h-[100dvh] grid place-items-center bg-[color:var(--wm-canvas)] px-4 py-10 text-[color:var(--wm-ink)]">
      <section className="wm-surface-panel w-full max-w-md p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md border border-[color:var(--wm-hairline-strong)] bg-[#2d6a4f]/25">
            <KeyRound className="h-5 w-5 text-[color:var(--wm-accent)]" />
          </span>
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[color:var(--wm-accent)]">
              WILLOW MUN · ACCOUNT SECURITY
            </p>
            <h1 className="mt-1 text-lg font-semibold text-[color:var(--wm-ink)]">Set your password</h1>
          </div>
        </div>
        {checking ? (
          <div className="mt-6 space-y-3">
            <div className="wm-skeleton h-4 w-48 rounded" />
            <div className="wm-skeleton h-10 w-full rounded" />
          </div>
        ) : !hasSession ? (
          <div className="mt-6 space-y-3">
            <p className="text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
              This setup link is invalid, expired, or has already been used. Ask the Super Admin to generate a new one.
            </p>
            <a
              href="/head-login"
              className="inline-flex h-9 items-center rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
            >
              Go to Head login
            </a>
          </div>
        ) : success ? (
          <div className="mt-6 rounded-md border border-emerald-400/25 bg-emerald-500/[0.08] p-4">
            <ShieldCheck className="h-6 w-6 text-emerald-300" />
            <p className="mt-2 text-sm font-semibold text-emerald-200">Password saved</p>
            <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">Opening your Department Head portal…</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <p className="text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
              Choose your own password. The Super Admin can manage your account but cannot view your password.
            </p>
            <label className="block text-xs text-[color:var(--wm-ink-secondary)]">
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-sm text-[color:var(--wm-ink)]"
              />
            </label>
            <label className="block text-xs text-[color:var(--wm-ink-secondary)]">
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-sm text-[color:var(--wm-ink)]"
              />
            </label>
            {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
            <button
              disabled={saving}
              className="h-10 w-full rounded-md bg-[color:var(--wm-emerald)] text-xs font-semibold text-[#eef4ef] transition hover:bg-[#357a5b] disabled:opacity-50"
            >
              {saving ? 'Saving password…' : 'Save password & continue'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
