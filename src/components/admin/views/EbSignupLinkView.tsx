import { useState } from 'react';
import { Check, Copy, Link2, ShieldCheck, Users } from 'lucide-react';

export function EbSignupLinkView() {
  const [copied, setCopied] = useState(false);
  const sharedLink = `${window.location.origin}/eb-signup`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(sharedLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      const field = document.getElementById('willow-shared-eb-link') as HTMLInputElement | null;
      field?.focus();
      field?.select();
    }
  };

  return (
    <div className="space-y-6">
      <section className="wm-surface-panel overflow-hidden p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-400/10 text-emerald-200"><Link2 className="h-5 w-5" /></div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">Executive Board onboarding</p>
            <h2 className="mt-1 font-serif text-2xl text-[color:var(--wm-ink)]">EB sign up link</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--wm-ink-secondary)]">One shared signup link for the entire Executive Board. Send the same URL to every member.</p>
          </div>
        </div>
        <div className="mt-7 rounded-lg border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] p-4">
          <p className="text-sm font-semibold text-[color:var(--wm-ink)]">Shared EB signup link</p>
          <p className="mt-2 text-xs leading-5 text-[color:var(--wm-ink-secondary)]">Every member uses this same page, enters the email address recorded in the approved EB roster, and creates an account immediately with a password. No OTP or email verification is used.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input id="willow-shared-eb-link" readOnly value={sharedLink} onFocus={(event) => event.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]" />
            <button type="button" onClick={() => void copyLink()} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef]">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy shared link'}
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-[color:var(--wm-ink-muted)]">The link itself does not grant access. Only unclaimed email addresses already on the EB roster can complete signup.</p>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="wm-surface-panel p-5"><div className="flex items-center gap-2 text-[color:var(--wm-focal)]"><Users className="h-4 w-4" /><h3 className="text-sm font-semibold">What EB members do</h3></div><p className="mt-3 text-xs leading-5 text-[color:var(--wm-ink-secondary)]">Open the shared link, enter their registered EB email, and create a password. Their roster profile is connected automatically.</p></section>
        <section className="wm-surface-panel p-5"><div className="flex items-center gap-2 text-[color:var(--wm-focal)]"><ShieldCheck className="h-4 w-4" /><h3 className="text-sm font-semibold">Roster-based access</h3></div><p className="mt-3 text-xs leading-5 text-[color:var(--wm-ink-secondary)]">Name, role, department, rank, permissions and photo come from the Super Admin&apos;s roster. Each roster entry can only be claimed once, and no email verification is required.</p></section>
      </div>
    </div>
  );
}
