import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

type ApplicationRow = {
  id: string; application_type: 'volunteer' | 'media' | 'press' | 'security';
  applicant_name: string; email: string; phone: string; school: string | null; age: number | null;
  availability: string | null; motivation: string; experience: string | null; portfolio_url: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'waitlisted'; review_notes: string | null; created_at: string;
};
const labels: Record<ApplicationRow['application_type'], string> = { volunteer: 'Volunteer', media: 'Media', press: 'Press', security: 'Security' };

export function LiveApplicationsView({ selectedId, onClose }: { selectedId?: string | null; onClose?: () => void }) {
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [busyId, setBusyId] = useState('');
  const [notes, setNotes] = useState<Record<string,string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('willow-applications', { body: { action: 'list' } });
    if (invokeError || data?.error) setError(data?.error || invokeError?.message || 'Could not load applications.');
    else setRows((data?.applications || []) as ApplicationRow[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => rows.filter((row) => {
    const q = query.trim().toLowerCase();
    return (type === 'all' || row.application_type === type) &&
      (status === 'all' || row.status === status) &&
      (!q || [row.applicant_name,row.email,row.phone,row.school || ''].join(' ').toLowerCase().includes(q));
  }), [rows, query, type, status]);

  const updateStatus = async (row: ApplicationRow, next: ApplicationRow['status']) => {
    setBusyId(row.id); setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('willow-applications', {
      body: { action: 'update', id: row.id, status: next, review_notes: notes[row.id] ?? row.review_notes ?? '' },
    });
    if (invokeError || data?.error) setError(data?.error || invokeError?.message || 'Could not update application.');
    else setRows((current) => current.map((item) => item.id === row.id ? data.application : item));
    setBusyId(''); 
  };

  const active = selectedId ? rows.find((row) => row.id === selectedId) : null;
  if (selectedId) {
    return <div className="wm-surface-panel p-5 sm:p-7">
      <button onClick={onClose} className="mb-5 text-xs text-[color:var(--wm-accent)] underline">← Back to applications</button>
      {!active ? <p className="text-sm text-[color:var(--wm-ink-secondary)]">{loading ? 'Loading application…' : 'Application not found.'}</p> : <ApplicationCard row={active} busy={busyId === active.id} notes={notes[active.id] ?? active.review_notes ?? ''} setNotes={(v) => setNotes((n) => ({...n,[active.id]:v}))} onStatus={(v) => void updateStatus(active,v)} />}
      {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
    </div>;
  }

  return <div className="space-y-4">
    <div className="wm-surface-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">Staff Applications</h2><p className="mt-1 text-xs text-[color:var(--wm-ink-muted)]">{rows.length} submissions · Volunteer, Media, Press, Security</p></div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded border border-[color:var(--wm-hairline-strong)] px-3 py-2 text-xs text-[color:var(--wm-ink)]"><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wm-ink-muted)]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, phone…" className="h-10 w-full rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)]" /></label>
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"><option value="all">All application types</option>{Object.entries(labels).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"><option value="all">All statuses</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="waitlisted">Waitlisted</option></select>
      </div>
    </div>
    {error && <p role="alert" className="rounded border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    {loading ? <p className="p-8 text-center text-sm text-[color:var(--wm-ink-muted)]">Loading submissions…</p> : filtered.length === 0 ? <div className="wm-surface-panel p-10 text-center text-sm text-[color:var(--wm-ink-muted)]">No applications found.</div> : <div className="space-y-3">{filtered.map((row) => <article key={row.id} className="wm-surface-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded border border-[color:var(--wm-hairline-strong)] px-2 py-1 text-[10px] uppercase tracking-wide text-[color:var(--wm-accent)]">{labels[row.application_type]}</span><span className="text-[10px] uppercase tracking-wide text-[color:var(--wm-ink-muted)]">{row.status}</span></div><h3 className="mt-2 text-sm font-semibold text-[color:var(--wm-ink)]">{row.applicant_name}</h3><p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">{row.email} · {row.phone}{row.school ? ' · '+row.school : ''}</p></div><span className="text-[10px] text-[color:var(--wm-ink-muted)]">{new Date(row.created_at).toLocaleString()}</span></div>
      <p className="mt-4 whitespace-pre-wrap text-xs leading-6 text-[color:var(--wm-ink-secondary)]">{row.motivation}</p>
      <details className="mt-3"><summary className="cursor-pointer text-xs text-[color:var(--wm-accent)]">View full application & review</summary><ApplicationCard row={row} busy={busyId === row.id} notes={notes[row.id] ?? row.review_notes ?? ''} setNotes={(v) => setNotes((n) => ({...n,[row.id]:v}))} onStatus={(v) => void updateStatus(row,v)} /></details>
    </article>)}</div>}
  </div>;
}

function ApplicationCard({ row, busy, notes, setNotes, onStatus }: { row: ApplicationRow; busy: boolean; notes: string; setNotes: (value:string)=>void; onStatus: (status:ApplicationRow['status'])=>void }) {
  return <div className="mt-4 space-y-4 text-xs text-[color:var(--wm-ink-secondary)]">
    <div className="grid gap-3 sm:grid-cols-2"><p><strong>Age:</strong> {row.age ?? '—'}</p><p><strong>Availability:</strong> {row.availability || '—'}</p><p><strong>Experience:</strong> {row.experience || '—'}</p><p><strong>Portfolio:</strong> {row.portfolio_url ? <a className="underline" href={row.portfolio_url} target="_blank" rel="noreferrer">Open link</a> : '—'}</p></div>
    <div><strong>Review notes</strong><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-2 w-full rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] p-3 text-xs text-[color:var(--wm-ink)]" /></div>
    <div className="flex flex-wrap gap-2">{(['accepted','rejected','waitlisted','pending'] as const).map((next) => <button key={next} disabled={busy} onClick={() => onStatus(next)} className={`rounded px-3 py-2 text-xs capitalize ${next === 'accepted' ? 'bg-emerald-700 text-white' : next === 'rejected' ? 'bg-rose-900 text-white' : 'border border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink)]'} disabled:opacity-50`}>{busy ? 'Saving…' : next}</button>)}</div>
  </div>;
}
