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

  return <main className="wm-admin min-h-[100dvh] grid place-items-center bg-[#080809] px-4 py-10 text-neutral-100">
    <section className="w-full max-w-md rounded-lg border border-white/[0.08] bg-[#0e0e10] p-6 shadow-2xl sm:p-8">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-md border border-[#d4af37]/25 bg-[#d4af37]/[0.07]"><KeyRound className="h-5 w-5 text-[#d4af37]"/></span><div><p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#d4af37]">WILLOW MUN · ACCOUNT SECURITY</p><h1 className="mt-1 text-lg font-semibold">Set your password</h1></div></div>
      {checking ? <p className="mt-6 text-xs text-neutral-400">Verifying your setup link…</p> : !hasSession ? <div className="mt-6 space-y-3"><p className="text-xs leading-relaxed text-neutral-300">This setup link is invalid, expired, or has already been used. Ask the Super Admin to generate a new one.</p><a href="/head-login" className="inline-flex h-9 items-center rounded bg-[#d4af37] px-4 text-xs font-semibold text-black">Go to Head login</a></div> : success ? <div className="mt-6 rounded border border-emerald-400/20 bg-emerald-400/[0.06] p-4"><ShieldCheck className="h-6 w-6 text-emerald-300"/><p className="mt-2 text-sm font-semibold text-emerald-200">Password saved</p><p className="mt-1 text-xs text-neutral-400">Opening your Department Head portal…</p></div> : <form onSubmit={submit} className="mt-6 space-y-4">
        <p className="text-xs leading-relaxed text-neutral-400">Choose your own password. The Super Admin can manage your account but cannot view your password.</p>
        <label className="block text-xs text-neutral-300">New password<input type="password" autoComplete="new-password" minLength={10} required value={password} onChange={e=>setPassword(e.target.value)} className="mt-1.5 h-10 w-full rounded border border-white/[0.1] bg-black/20 px-3 text-sm text-white"/></label>
        <label className="block text-xs text-neutral-300">Confirm password<input type="password" autoComplete="new-password" minLength={10} required value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-1.5 h-10 w-full rounded border border-white/[0.1] bg-black/20 px-3 text-sm text-white"/></label>
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        <button disabled={saving} className="h-10 w-full rounded bg-[#d4af37] text-xs font-semibold text-black disabled:opacity-50">{saving?'Saving password…':'Save password & continue'}</button>
      </form>}
    </section>
  </main>;
}
