import { useState } from 'react';
import { Check, Copy, ExternalLink, Link2, ShieldCheck, Users } from 'lucide-react';

const EB_DIRECTORY_ROUTE = '/super-admin/accounts/eb';

export function EbSignupLinkView() {
  const [copied, setCopied] = useState(false);
  const route = `${window.location.origin}${EB_DIRECTORY_ROUTE}`;
  const copyRoute = async () => {
    try {
      await navigator.clipboard.writeText(route);
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
            <h2 className="mt-1 font-serif text-2xl text-[color:var(--wm-ink)]">EB sign up links</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--wm-ink-secondary)]">Every EB member must receive their own private setup link. A shared generic signup URL will not work because it does not contain that member’s invitation token.</p>
          </div>
        </div>
        <div className="mt-7 rounded-lg border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] p-4">
          <p className="text-xs font-semibold text-[color:var(--wm-ink)]">Generate a personal link</p>
          <ol className="mt-3 space-y-2 text-xs leading-5 text-[color:var(--wm-ink-secondary)]">
            <li>1. Open the Executive Board Directory.</li>
            <li>2. Find the member marked “Awaiting signup”.</li>
            <li>3. Click “Copy setup link” beside their name.</li>
            <li>4. Send that link privately to that member. It is single-use and tied to their roster email.</li>
          </ol>
          <button type="button" onClick={copyRoute} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-white"><Copy className="h-4 w-4" />{copied ? 'Directory link copied' : 'Copy directory link'}</button>
          <a href={EB_DIRECTORY_ROUTE} className="ml-3 inline-flex min-h-10 items-center gap-2 text-xs text-[color:var(--wm-focal)] underline"><ExternalLink className="h-3.5 w-3.5" />Open directory</a>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="wm-surface-panel p-5"><div className="flex items-center gap-2 text-[color:var(--wm-focal)]"><Users className="h-4 w-4" /><h3 className="text-sm font-semibold">What the EB member does</h3></div><p className="mt-3 text-xs leading-5 text-[color:var(--wm-ink-secondary)]">They open their personal link, confirm their roster email, choose a password, and are signed into their EB portal. No public self-registration is available.</p></section>
        <section className="wm-surface-panel p-5"><div className="flex items-center gap-2 text-[color:var(--wm-focal)]"><ShieldCheck className="h-4 w-4" /><h3 className="text-sm font-semibold">Identity and permissions</h3></div><p className="mt-3 text-xs leading-5 text-[color:var(--wm-ink-secondary)]">Willow takes the member’s name, role, department, rank, permissions and photo from the existing roster. The invitation can only be claimed once and cannot change another Willow account’s password.</p></section>
      </div>
    </div>
  );
}
