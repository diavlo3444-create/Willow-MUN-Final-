import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, Lock, MailCheck, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function ExecutiveBoardSignupView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [email, setEmail] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let mounted = true;
    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const sessionEmail = data.session?.user?.email?.trim().toLowerCase() || '';
      if (sessionEmail && data.session?.user?.email_confirmed_at) {
        setVerifiedEmail(sessionEmail);
        setEmail(sessionEmail);
        setNotice('Email verified. Create a password to finish connecting your EB account.');
      }
    };
    void syncSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionEmail = session?.user?.email?.trim().toLowerCase() || '';
      if (sessionEmail && session?.user?.email_confirmed_at) {
        setVerifiedEmail(sessionEmail);
        setEmail(sessionEmail);
        setError('');
        setNotice('Email verified. Create a password to finish connecting your EB account.');
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const sendVerification = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter the email address registered in the EB roster.');
      return;
    }
    setBusy(true);
    const { data, error: invokeError } = await supabase.functions.invoke('willow-eb-signup', {
      body: { action: 'send_link', email: normalizedEmail },
    });
    setBusy(false);
    if (invokeError || data?.error || !data?.success) {
      setError(data?.error || invokeError?.message || 'We could not send the verification email. Try again.');
      return;
    }
    setNotice('Verification email sent. Open the link in your inbox on this device. It will bring you back here to finish signup.');
  };

  const completeSignup = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!verifiedEmail || verifiedEmail !== email.trim().toLowerCase()) {
      setError('Verify the same registered EB email address before creating your account.');
      return;
    }
    if (password.length < 10 || password.length > 128) {
      setError('Use a password between 10 and 128 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    const { data, error: invokeError } = await supabase.functions.invoke('willow-eb-signup', {
      body: { action: 'complete', email: verifiedEmail, password },
    });
    setBusy(false);
    if (invokeError || data?.error || !data?.success) {
      setError(data?.error || invokeError?.message || 'We could not complete your EB account. Try again.');
      return;
    }
    setComplete(true);
    window.setTimeout(() => window.location.assign('/head'), 700);
  };

  return (
    <div className="wm-admin flex min-h-[100dvh] flex-col bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)]">
      <header className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)]"><div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6"><button type="button" onClick={() => onNavigate('/eb-login')} className="inline-flex min-h-10 items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]"><ArrowLeft className="h-4 w-4" /> Back to EB login</button><span className="font-serif text-base tracking-wide">Willow MUN 2027</span></div></header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-10 sm:px-6"><div className="mx-auto grid w-full max-w-4xl gap-8 lg:grid-cols-2">
        <section className="wm-surface-panel p-6 sm:p-8"><p className="wm-section-kicker text-[color:var(--wm-accent)]">Executive Board access</p><h1 className="mt-2 font-serif text-3xl">Create your EB account</h1>
          {complete ? <div className="mt-7 rounded-lg border border-emerald-300/25 bg-emerald-400/[0.07] p-4"><CheckCircle2 className="h-6 w-6 text-emerald-200" /><p className="mt-3 text-sm">Your EB account is ready. Opening your portal…</p></div> :
          verifiedEmail ? <><div className="mt-4 flex items-center gap-2 rounded border border-emerald-300/25 bg-emerald-400/[0.06] px-3 py-3 text-xs text-emerald-100"><MailCheck className="h-4 w-4 shrink-0" /> Verified: {verifiedEmail}</div><form onSubmit={completeSignup} className="mt-6 space-y-4">
            <div><label htmlFor="eb-signup-password" className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Create password</label><input id="eb-signup-password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 10 characters" className="mt-1.5 h-11 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm" /></div>
            <div><label htmlFor="eb-signup-confirm" className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Confirm password</label><input id="eb-signup-confirm" type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter it again" className="mt-1.5 h-11 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm" /></div>
            {error && <p role="alert" className="rounded border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
            <button disabled={busy} type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-sm font-semibold text-[#eef4ef] transition hover:bg-[#357a5b] disabled:opacity-60"><UserPlus className="h-4 w-4" /> {busy ? 'Creating account…' : 'Finish EB signup'}</button>
          </form></> :
          <><p className="mt-3 text-sm leading-6 text-[color:var(--wm-ink-secondary)]">Use the same shared link as every other EB member. Enter the email address registered by the Super Admin. We will verify that you own the email before connecting your roster profile.</p><form onSubmit={sendVerification} className="mt-7 space-y-4">
            <div><label htmlFor="eb-signup-email" className="block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Registered EB email</label><input id="eb-signup-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1.5 h-11 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm" /></div>
            {error && <p role="alert" className="rounded border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
            <button disabled={busy} type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-sm font-semibold text-[#eef4ef] transition hover:bg-[#357a5b] disabled:opacity-60"><MailCheck className="h-4 w-4" /> {busy ? 'Sending verification…' : 'Verify email'}</button>
          </form></>}
          {notice && !complete && <p role="status" className="mt-4 rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-3 py-3 text-xs leading-5 text-[color:var(--wm-ink-secondary)]">{notice}</p>}
        </section>
        <aside className="flex flex-col justify-center"><div className="flex h-11 w-11 items-center justify-center rounded bg-[color:var(--wm-inset)] text-[color:var(--wm-accent)]"><Lock className="h-5 w-5" /></div><h2 className="mt-5 font-serif text-2xl">One link. Every EB member.</h2><p className="mt-3 text-sm leading-6 text-[color:var(--wm-ink-secondary)]">Your approved roster entry supplies your name, role, department, rank, permissions and profile photo. Email verification ensures only the person who controls the registered address can claim it.</p><p className="mt-4 text-xs leading-5 text-[color:var(--wm-ink-muted)]">Only email addresses already listed in the private EB roster can create an account. Your role and permissions cannot be chosen or changed during signup.</p></aside>
      </div></main>
    </div>
  );
}
