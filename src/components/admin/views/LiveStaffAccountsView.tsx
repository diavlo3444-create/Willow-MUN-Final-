import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { WmSkeleton } from '../WmSkeleton';

type Account = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  title: string;
  department_id: string | null;
  is_active: boolean;
  signup_status?: string;
};

export function LiveStaffAccountsView() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('willow-staff-admin', {
      body: { action: 'list' },
    });
    if (invokeError || data?.error) {
      setError(data?.error || invokeError?.message || 'Could not load administrator accounts.');
    } else {
      setAccounts(((data?.accounts || []) as Account[]).filter((account) => account.role === 'admin'));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      accounts.filter((a) => {
        const q = search.trim().toLowerCase();
        return !q || [a.full_name, a.email, a.title].join(' ').toLowerCase().includes(q);
      }),
    [accounts, search],
  );

  return (
    <div className="space-y-4">
      <section className="wm-surface-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">Administrator Accounts</h2>
            </div>
            <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
              {accounts.length} administrator account{accounts.length === 1 ? '' : 's'} created for Willow MUN. Department Heads and Executive Board accounts are listed separately.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
        <label className="relative mt-4 block sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search administrator name or email…"
            className="h-10 w-full rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)]"
          />
        </label>
      </section>

      {error && (
        <p role="alert" className="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      {loading ? (
        <WmSkeleton variant="table" rows={4} />
      ) : filtered.length === 0 ? (
        <div className="wm-surface-panel p-10 text-center text-sm text-[color:var(--wm-ink-muted)]">
          {accounts.length === 0
            ? 'No administrator accounts have been added yet.'
            : 'No administrators match this search.'}
        </div>
      ) : (
        <section className="wm-surface-panel divide-y divide-[color:var(--wm-hairline)]">
          {filtered.map((a) => (
            <article key={a.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[color:var(--wm-ink)]">{a.full_name}</p>
                <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                  {a.email || 'Email pending'} · {a.title || 'Administrator'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-2 py-1 text-[10px] text-[color:var(--wm-accent)]">
                  Admin
                </span>
                <span
                  className={`rounded-md border px-2 py-1 text-[10px] ${
                    a.is_active === false
                      ? 'border-rose-400/30 text-rose-300'
                      : 'border-emerald-400/30 text-emerald-300'
                  }`}
                >
                  {a.is_active === false ? 'Suspended' : a.signup_status === 'awaiting_signup' ? 'Awaiting signup' : 'Active'}
                </span>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
