import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Users } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

type Account = {
  user_id: string; full_name: string; email: string; role: string; title: string;
  department_id: string | null; is_active: boolean; signup_status?: string;
  eb_rank?: string; created_at?: string | null;
};
const roleLabels: Record<string,string> = { super_admin:'Super Admin', admin:'Admin', department_head:'Department Head', executive_board:'Executive Board' };

export function LiveStaffAccountsView() {
  const [accounts,setAccounts] = useState<Account[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [search,setSearch] = useState('');
  const [role,setRole] = useState('all');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('willow-staff-admin',{body:{action:'list'}});
    if(invokeError || data?.error) setError(data?.error || invokeError?.message || 'Could not load staff accounts.');
    else setAccounts((data?.accounts || []) as Account[]);
    setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);
  const filtered=useMemo(()=>accounts.filter(a=>{
    const q=search.trim().toLowerCase();
    return (role==='all'||a.role===role) && (!q||[a.full_name,a.email,a.title,a.role].join(' ').toLowerCase().includes(q));
  }),[accounts,role,search]);
  return <div className="space-y-4">
    <section className="wm-surface-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="flex items-center gap-2"><Users className="h-4 w-4 text-[color:var(--wm-accent)]"/><h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">Live Staff Account Directory</h2></div><p className="mt-1 text-xs text-[color:var(--wm-ink-muted)]">{accounts.length} accounts and approved EB signup slots from Supabase</p></div>
        <button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded border border-[color:var(--wm-hairline-strong)] px-3 py-2 text-xs text-[color:var(--wm-ink)]"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email, title…" className="h-10 w-full rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)]"/></label>
        <select value={role} onChange={e=>setRole(e.target.value)} className="h-10 rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"><option value="all">All roles</option>{Object.entries(roleLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
      </div>
    </section>
    {error&&<p role="alert" className="rounded border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    {loading?<p className="p-8 text-center text-sm text-[color:var(--wm-ink-muted)]">Loading accounts from Supabase…</p>:filtered.length===0?<div className="wm-surface-panel p-10 text-center text-sm text-[color:var(--wm-ink-muted)]">No accounts match this filter.</div>:<section className="wm-surface-panel divide-y divide-[color:var(--wm-hairline)]">{filtered.map(a=><article key={a.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="text-sm font-semibold text-[color:var(--wm-ink)]">{a.full_name}</p><p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">{a.email || 'Email pending'} · {a.title || roleLabels[a.role] || a.role}</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded border border-[color:var(--wm-hairline-strong)] px-2 py-1 text-[10px] text-[color:var(--wm-accent)]">{roleLabels[a.role] || a.role}</span><span className={`rounded border px-2 py-1 text-[10px] ${a.is_active===false?'border-rose-400/30 text-rose-300':'border-emerald-400/30 text-emerald-300'}`}>{a.is_active===false?'Suspended':a.signup_status==='awaiting_signup'?'Awaiting signup':'Active'}</span></div></article>)}</section>}
  </div>;
}
