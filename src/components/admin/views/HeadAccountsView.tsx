import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, RefreshCw, ShieldCheck, UserPlus, UserRound, UserX } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAdminStore } from '../../../context/AdminStoreContext';

type ServerHead = {
  user_id: string; full_name: string; email: string; role: string;
  department_id: string | null; is_active: boolean; title: string;
  signup_status?: 'claimed' | 'awaiting_signup'; created_at?: string | null;
};
type HeadRow = {
  id: string; user_id?: string; fullName: string; email: string; title: string;
  departmentId: string | null; isActive: boolean; signupStatus: 'active' | 'awaiting_setup' | 'suspended';
  source: 'server' | 'roster'; 
};

export function HeadAccountsView() {
  const { data, pushToast } = useAdminStore();
  const [serverHeads, setServerHeads] = useState<ServerHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [setupLink, setSetupLink] = useState<{ name: string; email: string; url: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: response, error } = await supabase.functions.invoke('willow-staff-admin', { body: { action: 'list' } });
    if (error || response?.error) {
      pushToast({ tone: 'error', title: 'Head directory could not load', description: response?.error || error?.message });
    } else {
      setServerHeads((response?.accounts || []).filter((account: ServerHead) => account.role === 'department_head'));
    }
    setLoading(false);
  }, [pushToast]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const byEmail = new Map<string, HeadRow>();
    for (const account of serverHeads) {
      byEmail.set(account.email.toLowerCase(), {
        id: account.user_id, user_id: account.user_id, fullName: account.full_name,
        email: account.email, title: account.title || 'Department Head',
        departmentId: account.department_id, isActive: account.is_active,
        signupStatus: account.is_active ? (account.signup_status === 'awaiting_signup' ? 'awaiting_setup' : 'active') : 'suspended',
        source: 'server',
      });
    }
    for (const user of data.users.filter((candidate) => candidate.role === 'department_head')) {
      const email = user.email.toLowerCase();
      if (email && !byEmail.has(email)) {
        byEmail.set(email, {
          id: user.id, fullName: user.fullName, email, title: user.title || 'Department Head',
          departmentId: user.departmentId, isActive: user.isActive,
          signupStatus: 'awaiting_setup', source: 'roster',
        });
      }
    }
    return [...byEmail.values()].sort((a,b) => a.fullName.localeCompare(b.fullName));
  }, [serverHeads, data.users]);

  const filtered = rows.filter((row) => {
    const department = data.departments.find((d) => d.id === row.departmentId)?.name || '';
    return `${row.fullName} ${row.email} ${row.title} ${department}`.toLowerCase().includes(search.toLowerCase());
  });

  const createInvite = async (row: HeadRow) => {
    const department = data.departments.find((d) => d.id === row.departmentId || d.slug === row.departmentId);
    if (!row.email || !department) {
      pushToast({ tone: 'error', title: 'Cannot invite this head', description: 'The roster entry needs a valid email and department assignment.' });
      return;
    }
    setBusyId(row.id);
    const { data: result, error } = await supabase.functions.invoke('willow-staff-admin', {
      body: { action: 'create', full_name: row.fullName, email: row.email, role: 'department_head', department_id: department.id, title: row.title },
    });
    setBusyId(null);
    if (error || result?.error) {
      pushToast({ tone: 'error', title: 'Head account could not be created', description: result?.error || error?.message });
      return;
    }
    pushToast({ tone: 'success', title: 'Head account created', description: 'An account setup invitation has been sent to ' + row.email });
    await load();
  };

  const generateSetupLink = async (row: HeadRow) => {
    if (!row.user_id) return;
    setBusyId(row.id);
    const { data: result, error } = await supabase.functions.invoke('willow-staff-admin', { body: { action: 'send_setup_link', user_id: row.user_id } });
    setBusyId(null);
    if (error || result?.error || !result?.action_link) {
      pushToast({ tone: 'error', title: 'Setup link could not be generated', description: result?.error || error?.message || 'No link was returned.' });
      return;
    }
    setSetupLink({ name: row.fullName, email: row.email, url: result.action_link });
  };

  const toggleActive = async (row: HeadRow) => {
    if (!row.user_id) return;
    setBusyId(row.id);
    const { data: result, error } = await supabase.functions.invoke('willow-staff-admin', {
      body: { action: row.isActive ? 'suspend' : 'reactivate', user_id: row.user_id },
    });
    setBusyId(null);
    if (error || result?.error) {
      pushToast({ tone: 'error', title: 'Account status could not be changed', description: result?.error || error?.message });
      return;
    }
    await load();
  };

  const copyLink = async () => {
    if (!setupLink) return;
    await navigator.clipboard.writeText(setupLink.url);
    pushToast({ tone: 'success', title: 'Setup link copied', description: 'Share it privately with ' + setupLink.name });
  };

  const awaiting = rows.filter((row) => row.signupStatus === 'awaiting_setup').length;
  const active = rows.filter((row) => row.signupStatus === 'active').length;

  return <div className="space-y-5">
    <section className="grid grid-cols-3 gap-3">
      {[{label:'All department heads',value:rows.length},{label:'Awaiting password setup',value:awaiting},{label:'Active accounts',value:active}].map(item=><div key={item.label} className="rounded-md border border-white/[0.07] bg-[#0c0c0f] p-4"><p className="text-[10px] text-neutral-400">{item.label}</p><p className="mt-2 font-serif text-2xl text-neutral-100 tabular-nums">{item.value}</p></div>)}
    </section>
    <section className="overflow-hidden rounded-md border border-white/[0.07] bg-[#0c0c0f]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-4">
        <div><h2 className="text-sm font-semibold text-neutral-100">Department Head Accounts</h2><p className="mt-1 text-[10px] text-neutral-500">Includes every head in the roster, whether or not they have created a password.</p></div>
        <button type="button" onClick={()=>void load()} className="inline-flex items-center gap-1.5 rounded border border-white/[0.1] px-3 py-2 text-[10px] text-neutral-300 hover:bg-white/[0.04]"><RefreshCw className="h-3 w-3"/> Refresh</button>
      </div>
      <div className="border-b border-white/[0.06] p-3"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email or department..." className="h-9 w-full rounded border border-white/[0.1] bg-black/20 px-3 text-xs text-neutral-100 placeholder:text-neutral-500 sm:max-w-sm"/></div>
      {loading ? <p className="p-8 text-center text-xs text-neutral-400">Loading head accounts…</p> : filtered.length === 0 ? <p className="p-8 text-center text-xs text-neutral-400">No department heads found.</p> : <div className="divide-y divide-white/[0.05]">
        {filtered.map(row=>{
          const department=data.departments.find(d=>d.id===row.departmentId || d.slug===row.departmentId);
          const busy=busyId===row.id;
          return <article key={row.email || row.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d4af37]/20 bg-[#d4af37]/[0.07] text-[10px] font-semibold text-[#d4af37]">{row.fullName.split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase()}</span>
              <div className="min-w-0"><p className="truncate text-xs font-semibold text-neutral-100">{row.fullName}</p><p className="truncate text-[10px] text-neutral-400">{row.email}</p><p className="mt-1 text-[10px] text-neutral-500">{row.title} · {department?.name || 'Department not linked'}</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className={'rounded border px-2.5 py-1 text-[9px] uppercase tracking-wider '+(row.signupStatus==='active'?'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300':row.signupStatus==='suspended'?'border-rose-400/20 bg-rose-400/[0.06] text-rose-300':'border-amber-400/20 bg-amber-400/[0.06] text-amber-200')}>{row.signupStatus==='active'?'Active':row.signupStatus==='suspended'?'Suspended':'Awaiting password setup'}</span>
              {row.source==='roster' ? <button type="button" disabled={busy || !row.email || !department} onClick={()=>void createInvite(row)} className="inline-flex h-8 items-center gap-1.5 rounded bg-[#d4af37] px-3 text-[10px] font-semibold text-black disabled:opacity-40"><UserPlus className="h-3 w-3"/>{busy?'Creating…':'Create login & invite'}</button> : <>
                {row.signupStatus==='awaiting_setup' && <button type="button" disabled={busy} onClick={()=>void generateSetupLink(row)} className="inline-flex h-8 items-center gap-1.5 rounded border border-[#d4af37]/30 px-3 text-[10px] text-[#e5cb76] disabled:opacity-40"><KeyRound className="h-3 w-3"/>{busy?'Generating…':'Get password setup link'}</button>}
                <button type="button" disabled={busy} onClick={()=>void toggleActive(row)} className="inline-flex h-8 items-center gap-1.5 rounded border border-white/[0.1] px-3 text-[10px] text-neutral-300 disabled:opacity-40">{row.isActive?<><UserX className="h-3 w-3"/>Suspend</>:<><ShieldCheck className="h-3 w-3"/>Reactivate</>}</button>
              </>}
            </div>
          </article>;
        })}
      </div>}
    </section>
    {setupLink && <div className="fixed inset-0 z-[120] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Password setup link">
      <div className="w-full max-w-lg rounded-lg border border-[#d4af37]/25 bg-[#101012] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-mono uppercase tracking-[0.18em] text-[#d4af37]">Account setup</p><h3 className="mt-2 text-lg font-semibold text-neutral-100">{setupLink.name}</h3><p className="mt-1 text-xs text-neutral-400">{setupLink.email}</p></div><button onClick={()=>setSetupLink(null)} className="text-xs text-neutral-400 hover:text-white">Close</button></div>
        <p className="mt-4 text-xs leading-relaxed text-neutral-300">This one-time password recovery link lets the head set a password without you knowing or choosing their password. Share it privately.</p>
        <div className="mt-3 break-all rounded border border-white/[0.08] bg-black/30 p-3 font-mono text-[10px] text-neutral-300">{setupLink.url}</div>
        <button type="button" onClick={()=>void copyLink()} className="mt-4 inline-flex h-9 items-center gap-2 rounded bg-[#d4af37] px-4 text-xs font-semibold text-black"><Copy className="h-3.5 w-3.5"/> Copy setup link</button>
      </div>
    </div>}
  </div>;
}
