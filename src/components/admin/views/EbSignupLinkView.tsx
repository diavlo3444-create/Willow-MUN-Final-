import { useState } from 'react';
import { Check, Copy, ExternalLink, Link2, ShieldCheck, Users } from 'lucide-react';

const SIGNUP_URL = 'https://willow-mun.vercel.app/eb-signup';

export function EbSignupLinkView() {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(SIGNUP_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="wm-surface-panel overflow-hidden p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
            <Link2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">Executive Board onboarding</p>
            <h2 className="mt-1 font-serif text-2xl text-[color:var(--wm-ink)]">EB sign up link</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--wm-ink-secondary)]">
              Share this same link with every Executive Board member. They enter the email address registered for them, choose a password, verify their email, and their existing Willow EB profile is connected automatically.
            </p>
          </div>
        </div>

        <div className="mt-7 rounded-lg border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] p-4">
          <label className="block text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)]">Permanent shared signup URL</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <div className="flex min-h-11 min-w-0 flex-1 items-center rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]">
              <span className="truncate">{SIGNUP_URL}</span>
            </div>
            <button type="button" onClick={copyLink} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-white transition hover:bg-[#357a5b]">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <a href={SIGNUP_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] px-4 text-xs font-medium text-[color:var(--wm-ink-secondary)] transition hover:bg-[color:var(--wm-overlay)]">
              <ExternalLink className="h-3.5 w-3.5" /> Open page
            </a>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="wm-surface-panel p-5">
          <div className="flex items-center gap-2 text-[color:var(--wm-focal)]"><Users className="h-4 w-4" /><h3 className="text-sm font-semibold">How EB members use it</h3></div>
          <ol className="mt-4 space-y-3 text-xs leading-5 text-[color:var(--wm-ink-secondary)]">
            <li className="flex gap-3"><span className="font-mono text-[color:var(--wm-accent)]">01</span><span>Open the shared link and enter the email address already assigned to them in the EB roster.</span></li>
            <li className="flex gap-3"><span className="font-mono text-[color:var(--wm-accent)]">02</span><span>Choose and confirm their own password.</span></li>
            <li className="flex gap-3"><span className="font-mono text-[color:var(--wm-accent)]">03</span><span>Verify their email using the confirmation message. Willow then connects their existing EB profile and signs them into the EB portal.</span></li>
          </ol>
        </section>
        <section className="wm-surface-panel p-5">
          <div className="flex items-center gap-2 text-[color:var(--wm-focal)]"><ShieldCheck className="h-4 w-4" /><h3 className="text-sm font-semibold">Roster matching & security</h3></div>
          <ul className="mt-4 space-y-2.5 text-xs leading-5 text-[color:var(--wm-ink-secondary)]">
            <li>Only emails already listed in the private EB roster can register.</li>
            <li>Name, department, title, rank and permissions are assigned from the existing roster—not typed in by the member.</li>
            <li>Each roster entry can be claimed once. Email verification helps prevent someone else from claiming another member’s identity.</li>
            <li>Where the EB tree has a photo, it is attached to the account. Missing photos are left blank.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
