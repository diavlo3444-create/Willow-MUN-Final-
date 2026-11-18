import { useState } from 'react';
import { Check, Copy, ExternalLink, Link2, ShieldCheck, Users } from 'lucide-react';

const SHARED_EB_SIGNUP_PATH = '/eb-signup';

export function EbSignupLinkView() {
  const [copied, setCopied] = useState(false);
  const signupUrl = `${window.location.origin}${SHARED_EB_SIGNUP_PATH}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(signupUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch { setCopied(false); }
  };

  return (
    <div className="space-y-6">
      <section className="wm-surface-panel overflow-hidden p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-400/10 text-emerald-200"><Link2 className="h-5 w-5" /></div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">Executive Board onboarding</p>
            <h2 className="mt-1 font-serif text-2xl text-[color:var(--wm-ink)]">EB sign up link</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--wm-ink-secondary)]">This is the single shared signup link for the entire Executive Board. Send the same link to every EB member.</p>
          </div>
        </div>
        <div className="mt-7 rounded-lg border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] p-4">
          <p className="text-xs font-semibold text-[color:var(--wm-ink)]">Shared signup URL</p>
          <p className="mt-2 break-all rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] p-3 font-mono text-xs text-[color:var(--wm-ink)]">{signupUrl}</p>
          <button type="button" onClick={copyLink} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-white"><Copy className="h-4 w-4" />{copied ? 'Link copied' : 'Copy shared link'}</button>
          <a href={SHARED_EB_SIGNUP_PATH} target="_blank" rel="noreferrer" className="ml-3 inline-flex min-h-10 items-center gap-2 text-xs text-[color:var(--wm-focal)] underline"><ExternalLink className="h-3.5 w-3.5" />Preview signup page</a>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="wm-surface-panel p-5"><div className="flex items-center gap-2 text-[color:var(--wm-focal)]"><Users className="h-4 w-4" /><h3 className="text-sm font-semibold">What EB members do</h3></div><p className="mt-3 text-xs leading-5 text-[color:var(--wm-ink-secondary)]">Open the shared link, enter the email already assigned to them in the EB roster, choose a password, and verify their email. Willow then connects their existing roster profile and signs them into the EB portal.</p></section>
        <section className="wm-surface-panel p-5"><div className="flex items-center gap-2 text-[color:var(--wm-focal)]"><ShieldCheck className="h-4 w-4" /><h3 className="text-sm font-semibold">Roster-based access</h3></div><p className="mt-3 text-xs leading-5 text-[color:var(--wm-ink-secondary)]">Only verified email addresses listed in the private EB roster can claim an account. Role, department, rank, permissions and photo stay controlled by the Super Admin.</p></section>
      </div>
    </div>
  );
}
