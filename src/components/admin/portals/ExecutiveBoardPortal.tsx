import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, CheckSquare, ClipboardList, Megaphone, MapPin, ShieldAlert, Users, RefreshCw, Plus, LogOut } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAdminStore } from '../../../context/AdminStoreContext';

type RecordType = 'task' | 'shift' | 'station' | 'announcement' | 'incident' | 'shift_swap' | 'hierarchy';
type EbRecord = {
  id: string;
  department_id: string;
  record_type: RecordType;
  title: string;
  payload: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type Tab = 'overview' | 'tasks' | 'schedule' | 'stations' | 'announcements' | 'incidents' | 'team';

const TABS: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
  { id: 'overview', label: 'Overview', icon: ClipboardList },
  { id: 'tasks', label: 'My Tasks', icon: CheckSquare },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'stations', label: 'Stations', icon: MapPin },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'incidents', label: 'Incident Reports', icon: ShieldAlert },
  { id: 'team', label: 'Team Structure', icon: Users },
];

export function ExecutiveBoardPortal({ pathname, onNavigate }: { pathname: string; onNavigate: (path: string) => void }) {
  void pathname;
  void onNavigate;
  const { currentUser, signOut, pushToast } = useAdminStore();
  const [records, setRecords] = useState<EbRecord[]>([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentDetails, setIncidentDetails] = useState('');
  const [shiftTitle, setShiftTitle] = useState('');
  const [shiftDate, setShiftDate] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [busy, setBusy] = useState(false);

  const permissions = currentUser?.ebPermissions ?? {};
  const rank = currentUser?.ebRank ?? 'member';
  const canManage = permissions.manage_department === true;
  const canManageShifts = canManage || permissions.manage_shifts === true;
  const canPublish = canManage || permissions.publish_announcements === true;
  const departmentId = currentUser?.departmentId;

  const loadRecords = useCallback(async () => {
    if (!currentUser || !departmentId) {
      setError('Your account has not been assigned to a department. Contact the conference administrator.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('wm_eb_records')
      .select('id, department_id, record_type, title, payload, created_by, created_at, updated_at')
      .eq('department_id', departmentId)
      .order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    else setRecords((data ?? []) as EbRecord[]);
    const { data: ackData } = await supabase.from('wm_eb_record_acks').select('record_id').eq('user_id', currentUser.id);
    setAcknowledgedIds((ackData ?? []).map((item: { record_id: string }) => item.record_id));
    setLoading(false);
  }, [currentUser, departmentId]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const createRecord = async (recordType: RecordType, title: string, payload: Record<string, any>) => {
    if (!currentUser || !departmentId) return;
    setBusy(true);
    const { data, error: insertError } = await supabase.from('wm_eb_records')
      .insert({ department_id: departmentId, record_type: recordType, title, payload, created_by: currentUser.id, updated_by: currentUser.id })
      .select('id, department_id, record_type, title, payload, created_by, created_at, updated_at')
      .single();
    setBusy(false);
    if (insertError) { pushToast({ tone: 'error', title: 'Could not save', description: insertError.message }); return; }
    setRecords((old) => [data as EbRecord, ...old]);
    pushToast({ tone: 'success', title: 'Saved', description: title });
  };

  const updateRecord = async (record: EbRecord, payload: Record<string, any>) => {
    if (!currentUser) return;
    const { data, error: updateError } = await supabase.from('wm_eb_records')
      .update({ payload, updated_by: currentUser.id, updated_at: new Date().toISOString() })
      .eq('id', record.id)
      .select('id, department_id, record_type, title, payload, created_by, created_at, updated_at')
      .single();
    if (updateError) { pushToast({ tone: 'error', title: 'Update blocked', description: updateError.message }); return; }
    setRecords((old) => old.map((item) => item.id === record.id ? data as EbRecord : item));
  };

  const scopedTasks = useMemo(() => records.filter((r) => r.record_type === 'task' && (canManage || r.created_by === currentUser?.id || r.payload.assigned_to_user_id === currentUser?.id)), [records, canManage, currentUser?.id]);
  const shifts = records.filter((r) => r.record_type === 'shift');
  const stations = records.filter((r) => r.record_type === 'station');
  const announcements = records.filter((r) => r.record_type === 'announcement');
  const incidents = records.filter((r) => r.record_type === 'incident');
  const hierarchy = records.filter((r) => r.record_type === 'hierarchy');
  const openTasks = scopedTasks.filter((r) => r.payload.status !== 'completed');

  const acknowledgeAnnouncement = async (record: EbRecord) => {
    if (!currentUser || acknowledgedIds.includes(record.id)) return;
    const { error: ackError } = await supabase.from('wm_eb_record_acks').insert({ record_id: record.id, user_id: currentUser.id });
    if (ackError && ackError.code !== '23505') { pushToast({ tone: 'error', title: 'Acknowledgement failed', description: ackError.message }); return; }
    setAcknowledgedIds((old) => [...old, record.id]);
  };

  const submitTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    await createRecord('task', taskTitle.trim(), { status: 'not_started', priority: 'normal', deadline: taskDeadline || null, assigned_to_user_id: currentUser?.id, assigned_to_name: currentUser?.fullName, checklist: [], completion_note: '' });
    setTaskTitle(''); setTaskDeadline('');
  };
  const submitIncident = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!incidentTitle.trim() || !incidentDetails.trim()) return;
    await createRecord('incident', incidentTitle.trim(), { description: incidentDetails.trim(), status: 'open', reporter_user_id: currentUser?.id, reporter_name: currentUser?.fullName, reported_at: new Date().toISOString() });
    setIncidentTitle(''); setIncidentDetails('');
  };
  const submitShift = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!shiftTitle.trim() || !shiftDate) return;
    await createRecord('shift', shiftTitle.trim(), { date: shiftDate, status: 'scheduled', assigned_user_id: currentUser?.id, assigned_user_name: currentUser?.fullName });
    setShiftTitle(''); setShiftDate('');
  };
  const submitAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!announcementTitle.trim() || !announcementBody.trim()) return;
    await createRecord('announcement', announcementTitle.trim(), { body: announcementBody.trim(), priority: 'normal', acknowledged_by: [], published_by: currentUser?.fullName });
    setAnnouncementTitle(''); setAnnouncementBody('');
  };

  if (!currentUser || currentUser.role !== 'executive_board') return null;

  return (
    <div className="wm-admin min-h-screen bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)]">
      <header className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">Willow MUN · Executive Board</p>
            <h1 className="mt-1 font-serif text-2xl">{currentUser.title || 'Executive Board Workspace'}</h1>
            <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">{currentUser.fullName} · {rank.replaceAll('_', ' ')} · {currentUser.departmentId ? 'Assigned department' : 'No department assigned'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadRecords()} className="inline-flex min-h-9 items-center gap-2 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-xs"><RefreshCw size={14}/> Refresh</button>
            <button onClick={signOut} className="inline-flex min-h-9 items-center gap-2 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-xs"><LogOut size={14}/> Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <nav className="mb-6 flex flex-wrap gap-2 border-b border-[color:var(--wm-hairline)] pb-4">
          {TABS.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`inline-flex items-center gap-2 rounded px-3 py-2 text-xs ${tab === item.id ? 'bg-[color:var(--wm-focal)] text-[#12170c]' : 'border border-[color:var(--wm-hairline)] text-[color:var(--wm-ink-secondary)]'}`}><Icon size={14}/>{item.label}</button>; })}
        </nav>
        {error && <div role="alert" className="mb-5 rounded border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}
        {loading ? <p className="py-12 text-center text-sm text-[color:var(--wm-ink-muted)]">Loading your department workspace…</p> : (
          <>
            {tab === 'overview' && <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[['Open tasks', openTasks.length], ['Upcoming shifts', shifts.filter(s => s.payload.status !== 'completed').length], ['Announcements', announcements.length], ['Open incidents', incidents.filter(i => i.payload.status !== 'resolved').length]].map(([label, value]) => <div key={String(label)} className="wm-surface-panel p-5"><p className="text-xs text-[color:var(--wm-ink-muted)]">{label}</p><p className="mt-2 font-serif text-3xl">{value}</p></div>)}
              <div className="wm-surface-panel p-5 sm:col-span-2 xl:col-span-4"><h2 className="text-sm font-semibold">Your department</h2><p className="mt-2 text-sm text-[color:var(--wm-ink-secondary)]">{currentUser.division || currentUser.title} · Access is limited to records belonging to your assigned department.</p></div>
            </section>}
            {tab === 'tasks' && <section className="space-y-4">
              <div className="wm-surface-panel p-5"><h2 className="text-sm font-semibold">Tasks assigned to you</h2><p className="mt-1 text-xs text-[color:var(--wm-ink-muted)]">Update your progress and leave a completion note.</p>
                <form onSubmit={submitTask} className="mt-4 grid gap-3 sm:grid-cols-[1fr_190px_auto]"><input value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} required placeholder="Add a personal task" className="h-10 rounded border border-[color:var(--wm-hairline-strong)] bg-transparent px-3 text-sm"/><input type="datetime-local" value={taskDeadline} onChange={e=>setTaskDeadline(e.target.value)} className="h-10 rounded border border-[color:var(--wm-hairline-strong)] bg-transparent px-3 text-sm"/><button disabled={busy} className="inline-flex h-10 items-center justify-center gap-2 rounded bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c]"><Plus size={14}/> Add task</button></form>
              </div>
              <div className="space-y-2">{scopedTasks.map(task=><article key={task.id} className="wm-surface-panel flex flex-wrap items-center justify-between gap-3 p-4"><div><h3 className="text-sm font-semibold">{task.title}</h3><p className="mt-1 text-xs text-[color:var(--wm-ink-muted)]">{task.payload.deadline ? new Date(task.payload.deadline).toLocaleString() : 'No deadline'} · {task.payload.priority || 'normal'}</p></div><select value={task.payload.status || 'not_started'} onChange={e=>void updateRecord(task,{...task.payload,status:e.target.value})} className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2 text-xs"><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option></select></article>)}{!scopedTasks.length && <p className="rounded border border-dashed border-[color:var(--wm-hairline-strong)] p-8 text-center text-sm text-[color:var(--wm-ink-muted)]">No tasks assigned to you yet.</p>}</div>
              {scopedTasks.some(t=>t.payload.status==='blocked') && <p className="text-xs text-amber-200">One or more tasks are blocked. Contact your supervisor and add context to the task record.</p>}
            </section>}
            {tab === 'schedule' && <section className="space-y-4">{canManageShifts && <form onSubmit={submitShift} className="wm-surface-panel grid gap-3 p-5 sm:grid-cols-[1fr_220px_auto]"><input value={shiftTitle} onChange={e=>setShiftTitle(e.target.value)} placeholder="Shift / duty title" required className="h-10 rounded border border-[color:var(--wm-hairline-strong)] bg-transparent px-3 text-sm"/><input type="date" value={shiftDate} onChange={e=>setShiftDate(e.target.value)} required className="h-10 rounded border border-[color:var(--wm-hairline-strong)] bg-transparent px-3 text-sm"/><button disabled={busy} className="h-10 rounded bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c]">Create shift</button></form>}<div className="grid gap-3 md:grid-cols-2">{shifts.map(s=><article key={s.id} className="wm-surface-panel p-5"><h3 className="text-sm font-semibold">{s.title}</h3><p className="mt-2 text-xs text-[color:var(--wm-ink-secondary)]">{s.payload.date || 'Date not set'} · {s.payload.status || 'scheduled'}</p><button onClick={()=>{setSwapReason('');void createRecord('shift_swap',`Swap request: ${s.title}`,{shift_record_id:s.id,requester_user_id:currentUser.id,reason:'Please contact me to arrange a shift swap.',status:'pending'});}} className="mt-3 rounded border border-[color:var(--wm-hairline-strong)] px-3 py-2 text-xs">Request shift swap</button></article>)}{!shifts.length && <p className="text-sm text-[color:var(--wm-ink-muted)]">No shifts have been published for this department.</p>}</div></section>}
            {tab === 'stations' && <section className="grid gap-3 md:grid-cols-2">{stations.map(s=><article key={s.id} className="wm-surface-panel p-5"><h3 className="text-sm font-semibold">{s.title}</h3><p className="mt-2 text-xs text-[color:var(--wm-ink-secondary)]">{s.payload.location || 'Location to be confirmed'}</p><p className="mt-2 text-sm">{s.payload.purpose || ''}</p></article>)}{!stations.length && <p className="text-sm text-[color:var(--wm-ink-muted)]">No station information has been published yet.</p>}</section>}
            {tab === 'announcements' && <section className="space-y-3">{canPublish && <form onSubmit={submitAnnouncement} className="wm-surface-panel space-y-3 p-5"><input value={announcementTitle} onChange={e=>setAnnouncementTitle(e.target.value)} required placeholder="Announcement title" className="h-10 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-transparent px-3 text-sm"/><textarea value={announcementBody} onChange={e=>setAnnouncementBody(e.target.value)} required placeholder="Announcement details" rows={3} className="w-full rounded border border-[color:var(--wm-hairline-strong)] bg-transparent p-3 text-sm"/><button disabled={busy} className="h-10 rounded bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c]">Publish to department</button></form>}{announcements.map(a=><article key={a.id} className="wm-surface-panel p-5"><h3 className="text-sm font-semibold">{a.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--wm-ink-secondary)]">{a.payload.body}</p><button disabled={acknowledgedIds.includes(a.id)} onClick={()=>void acknowledgeAnnouncement(a)} className="mt-3 rounded border border-[color:var(--wm-hairline-strong)] px-3 py-2 text-xs disabled:opacity-50">{acknowledgedIds.includes(a.id)?'Acknowledged':'Acknowledge'}</button></article>)}{!announcements.length && <p className="text-sm text-[color:var(--wm-ink-muted)]">No department announcements yet.</p>}</section>}
            {tab === 'incidents' && <section className="space-y-4"><form onSubmit={submitIncident} className="wm-surface-panel space-y-3 p-5"><h2 className="text-sm font-semibold">Report an incident</h2><input value={incidentTitle} onChange={e=>setIncidentTitle(e.target.value)} required placeholder="Short incident title" className="h-10 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-transparent px-3 text-sm"/><textarea value={incidentDetails} onChange={e=>setIncidentDetails(e.target.value)} required rows={3} placeholder="Describe what happened and where" className="w-full rounded border border-[color:var(--wm-hairline-strong)] bg-transparent p-3 text-sm"/><button disabled={busy} className="h-10 rounded bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c]">Submit report</button></form>{incidents.map(i=><article key={i.id} className="wm-surface-panel p-4"><div className="flex justify-between gap-3"><h3 className="text-sm font-semibold">{i.title}</h3><span className="text-xs">{i.payload.status || 'open'}</span></div><p className="mt-2 text-sm text-[color:var(--wm-ink-secondary)]">{i.payload.description}</p></article>)}</section>}
            {tab === 'team' && <section className="space-y-3">{hierarchy.map(h=><article key={h.id} className="wm-surface-panel p-4"><h3 className="text-sm font-semibold">{h.title}</h3><p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">{h.payload.assigned_name || h.payload.role_title || ''}</p><p className="mt-2 text-sm">{h.payload.responsibilities || ''}</p></article>)}{!hierarchy.length && <p className="text-sm text-[color:var(--wm-ink-muted)]">The department structure has not been published yet.</p>}</section>}
          </>
        )}
      </main>
    </div>
  );
}
