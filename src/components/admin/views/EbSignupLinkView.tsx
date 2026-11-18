import { Link2, ShieldCheck, Users } from 'lucide-react';

export function EbSignupLinkView() {

  return (
    <div className="space-y-6">
      <section className="wm-surface-panel overflow-hidden p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-400/10 text-emerald-200"><Link2 className="h-5 w-5" /></div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">Executive Board onboarding</p>
            <h2 className="mt-1 font-serif text-2xl text-[color:var(--wm-ink)]">EB sign up link</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--wm-ink-secondary)]">Generate a separate secure invitation for each pending member from the EB Accounts directory.</p>
          </div>
        </div>
        <div className="mt-7 rounded-lg border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] p-4">
          <p className="text-sm font-semibold text-[color:var(--wm-ink)]">Personal invitation links</p>
          <p className="mt-2 text-xs leading-5 text-[color:var(--wm-ink-secondary)]">There is no universal signup URL. Each pending EB member must receive their own secure, email-bound invitation. Open the EB Accounts directory and use <strong>Generate invite link</strong> beside that member, then send them the copied link.</p>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="wm-surface-panel p-5"><div className="flex items-center gap-2 text-[color:var(--wm-focal)]"><Users className="h-4 w-4" /><h3 className="text-sm font-semibold">What EB members do</h3></div><p className="mt-3 text-xs leading-5 text-[color:var(--wm-ink-secondary)]">Open the personal invitation sent to your registered email, choose a password, and create your account. The invitation connects your existing roster profile.</p></section>
        <section className="wm-surface-panel p-5"><div className="flex items-center gap-2 text-[color:var(--wm-focal)]"><ShieldCheck className="h-4 w-4" /><h3 className="text-sm font-semibold">Roster-based access</h3></div><p className="mt-3 text-xs leading-5 text-[color:var(--wm-ink-secondary)]">Each invitation is bound to one roster email and can be used once. Role, department, rank, permissions and photo stay controlled by the Super Admin.</p></section>
      </div>
    </div>
  );
}
