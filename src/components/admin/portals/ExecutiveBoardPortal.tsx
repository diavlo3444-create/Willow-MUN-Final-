import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  LogOut,
  MapPin,
  Megaphone,
  Plus,
  QrCode,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { isDccActor, isHrActor } from '../../../utils/adminPermissions';
import { MyQrModal } from '../MyQrModal';
import { WmSkeleton } from '../WmSkeleton';
import { CommitteesManagementView } from '../views/CommitteesManagementView';
import { HrAcceptedApplicantsView } from '../views/HrAcceptedApplicantsView';

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

type Tab =
  | 'overview'
  | 'tasks'
  | 'schedule'
  | 'stations'
  | 'announcements'
  | 'incidents'
  | 'team'
  | 'hr-accepted'
  | 'committees';

const BASE_TABS: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
  { id: 'overview', label: 'Overview', icon: ClipboardList },
  { id: 'tasks', label: 'My Tasks', icon: CheckSquare },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'stations', label: 'Stations', icon: MapPin },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'incidents', label: 'Incident Reports', icon: ShieldAlert },
  { id: 'team', label: 'Team Structure', icon: Users },
];

export function ExecutiveBoardPortal({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: (path: string) => void;
}) {
  void pathname;
  void onNavigate;
  const { currentUser, signOut, pushToast, testModeExecutiveBoardUser, openMyQrModal } = useAdminStore();
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
  const [swapTargetShift, setSwapTargetShift] = useState<EbRecord | null>(null);
  const [swapReason, setSwapReason] = useState('');
  const [busy, setBusy] = useState(false);

  const permissions = currentUser?.ebPermissions ?? {};
  const rank = currentUser?.ebRank ?? 'member';
  const canManage = permissions.manage_department === true;
  const canManageShifts = canManage || permissions.manage_shifts === true;
  const canPublish = canManage || permissions.publish_announcements === true;
  const departmentId = currentUser?.departmentId;

  const isHrEb = isHrActor(currentUser);
  const isDccEb = isDccActor(currentUser);

  const tabs = useMemo(() => {
    const list = [...BASE_TABS];
    if (isHrEb) list.push({ id: 'hr-accepted', label: 'Accepted Applicants', icon: UserCheck });
    if (isDccEb) list.push({ id: 'committees', label: 'Committees', icon: BookOpen });
    return list;
  }, [isHrEb, isDccEb]);

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

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const createRecord = async (recordType: RecordType, title: string, payload: Record<string, any>) => {
    if (!currentUser || !departmentId) return;
    setBusy(true);
    const { data, error: insertError } = await supabase
      .from('wm_eb_records')
      .insert({
        department_id: departmentId,
        record_type: recordType,
        title,
        payload,
        created_by: currentUser.id,
        updated_by: currentUser.id,
      })
      .select('id, department_id, record_type, title, payload, created_by, created_at, updated_at')
      .single();
    setBusy(false);
    if (insertError) {
      pushToast({ tone: 'error', title: 'Could not save', description: insertError.message });
      return;
    }
    setRecords((old) => [data as EbRecord, ...old]);
    pushToast({ tone: 'success', title: 'Saved', description: title });
  };

  const updateRecord = async (record: EbRecord, payload: Record<string, any>) => {
    if (!currentUser) return;
    const { data, error: updateError } = await supabase
      .from('wm_eb_records')
      .update({ payload, updated_by: currentUser.id, updated_at: new Date().toISOString() })
      .eq('id', record.id)
      .select('id, department_id, record_type, title, payload, created_by, created_at, updated_at')
      .single();
    if (updateError) {
      pushToast({ tone: 'error', title: 'Update blocked', description: updateError.message });
      return;
    }
    setRecords((old) => old.map((item) => (item.id === record.id ? (data as EbRecord) : item)));
  };

  const scopedTasks = useMemo(
    () =>
      records.filter(
        (r) =>
          r.record_type === 'task' &&
          (canManage || r.created_by === currentUser?.id || r.payload.assigned_to_user_id === currentUser?.id),
      ),
    [records, canManage, currentUser?.id],
  );
  const shifts = records.filter((r) => r.record_type === 'shift');
  const swaps = records.filter((r) => r.record_type === 'shift_swap');
  const stations = records.filter((r) => r.record_type === 'station');
  const announcements = records.filter((r) => r.record_type === 'announcement');
  const incidents = records.filter((r) => r.record_type === 'incident');
  const hierarchy = records.filter((r) => r.record_type === 'hierarchy');
  const openTasks = scopedTasks.filter((r) => r.payload.status !== 'completed');

  const acknowledgeAnnouncement = async (record: EbRecord) => {
    if (!currentUser || acknowledgedIds.includes(record.id)) return;
    const { error: ackError } = await supabase
      .from('wm_eb_record_acks')
      .insert({ record_id: record.id, user_id: currentUser.id });
    if (ackError && ackError.code !== '23505') {
      pushToast({ tone: 'error', title: 'Acknowledgement failed', description: ackError.message });
      return;
    }
    setAcknowledgedIds((old) => [...old, record.id]);
  };

  const submitTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    await createRecord('task', taskTitle.trim(), {
      status: 'not_started',
      priority: 'normal',
      deadline: taskDeadline || null,
      assigned_to_user_id: currentUser?.id,
      assigned_to_name: currentUser?.fullName,
      checklist: [],
      completion_note: '',
    });
    setTaskTitle('');
    setTaskDeadline('');
  };

  const submitIncident = async (event: FormEvent) => {
    event.preventDefault();
    if (!incidentTitle.trim() || !incidentDetails.trim()) return;
    await createRecord('incident', incidentTitle.trim(), {
      description: incidentDetails.trim(),
      status: 'open',
      reporter_user_id: currentUser?.id,
      reporter_name: currentUser?.fullName,
      reported_at: new Date().toISOString(),
    });
    setIncidentTitle('');
    setIncidentDetails('');
  };

  const submitShift = async (event: FormEvent) => {
    event.preventDefault();
    if (!shiftTitle.trim() || !shiftDate) return;
    await createRecord('shift', shiftTitle.trim(), {
      date: shiftDate,
      status: 'scheduled',
      assigned_user_id: currentUser?.id,
      assigned_user_name: currentUser?.fullName,
    });
    setShiftTitle('');
    setShiftDate('');
  };

  const submitAnnouncement = async (event: FormEvent) => {
    event.preventDefault();
    if (!announcementTitle.trim() || !announcementBody.trim()) return;
    await createRecord('announcement', announcementTitle.trim(), {
      body: announcementBody.trim(),
      priority: 'normal',
      acknowledged_by: [],
      published_by: currentUser?.fullName,
    });
    setAnnouncementTitle('');
    setAnnouncementBody('');
  };

  const submitShiftSwap = async (event: FormEvent) => {
    event.preventDefault();
    if (!swapTargetShift || !swapReason.trim() || !currentUser) return;
    await createRecord('shift_swap', `Swap request: ${swapTargetShift.title}`, {
      shift_record_id: swapTargetShift.id,
      requester_user_id: currentUser.id,
      reason: swapReason.trim(),
      status: 'pending',
    });
    setSwapTargetShift(null);
    setSwapReason('');
  };

  if (!currentUser || currentUser.role !== 'executive_board') return null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="wm-admin min-h-screen bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)]">
        {testModeExecutiveBoardUser && (
          <div className="border-b border-amber-400/30 bg-amber-950/35 px-4 py-3 text-xs text-amber-100">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
              <span>
                <strong>Super Admin preview:</strong> viewing the EB portal as{' '}
                {testModeExecutiveBoardUser.fullName}.
              </span>
              <button
                type="button"
                onClick={signOut}
                className="rounded border border-amber-200/30 px-3 py-1.5 hover:bg-amber-400/10"
              >
                Exit preview
              </button>
            </div>
          </div>
        )}

        <header className="sticky top-0 z-30 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)]/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">
                Willow MUN · Executive Board
              </p>
              <h1 className="wm-serif mt-1 text-2xl font-semibold text-[color:var(--wm-ink)]">
                {currentUser.title || 'Executive Board Workspace'}
              </h1>
              <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                {currentUser.fullName} · {rank.replaceAll('_', ' ')} ·{' '}
                {currentUser.departmentId ? 'Assigned department' : 'No department assigned'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={openMyQrModal}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[#2d6a4f]/28 px-3.5 text-xs font-semibold text-[color:var(--wm-focal)] transition-colors hover:bg-[#2d6a4f]/45 hover:text-[color:var(--wm-ink)]"
              >
                <QrCode size={14} aria-hidden="true" />
                My QR
              </motion.button>
              <button
                type="button"
                onClick={() => void loadRecords()}
                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)]"
              >
                <RefreshCw size={14} aria-hidden="true" />
                Refresh
              </button>
              <button
                type="button"
                onClick={signOut}
                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[color:var(--wm-hairline)] px-3 text-xs text-[color:var(--wm-ink-secondary)] hover:border-rose-400/35 hover:text-rose-200"
              >
                <LogOut size={14} aria-hidden="true" />
                {testModeExecutiveBoardUser ? 'Exit preview' : 'Sign out'}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <nav className="mb-6 flex flex-wrap gap-2 border-b border-[color:var(--wm-hairline)] pb-4" aria-label="Executive Board tabs">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={[
                    'inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition-colors',
                    active
                      ? 'bg-[color:var(--wm-emerald)] text-[#eef4ef] shadow-sm'
                      : 'border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]',
                  ].join(' ')}
                >
                  <Icon size={14} aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {error && (
            <div role="alert" className="mb-5 rounded-md border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          )}

          {loading && tab !== 'hr-accepted' && tab !== 'committees' ? (
            <WmSkeleton variant="cards" rows={4} />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                {tab === 'overview' && (
                  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Open tasks', openTasks.length],
                      ['Upcoming shifts', shifts.filter((s) => s.payload.status !== 'completed').length],
                      ['Announcements', announcements.length],
                      ['Open incidents', incidents.filter((i) => i.payload.status !== 'resolved').length],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="wm-surface-panel p-5">
                        <p className="text-xs text-[color:var(--wm-ink-muted)]">{label}</p>
                        <p className="wm-serif mt-2 text-3xl text-[color:var(--wm-ink)]">{value}</p>
                      </div>
                    ))}
                    <div className="wm-surface-panel p-5 sm:col-span-2 xl:col-span-4">
                      <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">Your department</h2>
                      <p className="mt-2 text-sm text-[color:var(--wm-ink-secondary)]">
                        {currentUser.division || currentUser.title} · Access is scoped to records belonging to your assigned department
                        {isHrEb ? ', plus cross-department HR Accepted Applicants' : ''}
                        {isDccEb ? ', plus DCC Committee Management' : ''}.
                      </p>
                    </div>
                  </section>
                )}

                {tab === 'tasks' && (
                  <section className="space-y-4">
                    <div className="wm-surface-panel p-5">
                      <h2 className="text-sm font-semibold">Tasks assigned to you</h2>
                      <p className="mt-1 text-xs text-[color:var(--wm-ink-muted)]">
                        Update your progress and track department deadlines.
                      </p>
                      <form onSubmit={submitTask} className="mt-4 grid gap-3 sm:grid-cols-[1fr_190px_auto]">
                        <input
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          required
                          placeholder="Add a personal task"
                          className="h-10 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
                        />
                        <input
                          type="datetime-local"
                          value={taskDeadline}
                          onChange={(e) => setTaskDeadline(e.target.value)}
                          className="h-10 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
                        />
                        <button
                          disabled={busy}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
                        >
                          <Plus size={14} aria-hidden="true" /> Add task
                        </button>
                      </form>
                    </div>
                    <div className="space-y-2">
                      {scopedTasks.map((task) => (
                        <article key={task.id} className="wm-surface-panel flex flex-wrap items-center justify-between gap-3 p-4">
                          <div>
                            <h3 className="text-sm font-semibold">{task.title}</h3>
                            <p className="mt-1 text-xs text-[color:var(--wm-ink-muted)]">
                              {task.payload.deadline ? new Date(task.payload.deadline).toLocaleString() : 'No deadline'} ·{' '}
                              {task.payload.priority || 'normal'}
                            </p>
                          </div>
                          <select
                            value={task.payload.status || 'not_started'}
                            onChange={(e) => void updateRecord(task, { ...task.payload, status: e.target.value })}
                            className="h-9 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2.5 text-xs text-[color:var(--wm-ink)]"
                          >
                            <option value="not_started">Not started</option>
                            <option value="in_progress">In progress</option>
                            <option value="blocked">Blocked</option>
                            <option value="completed">Completed</option>
                          </select>
                        </article>
                      ))}
                      {!scopedTasks.length && (
                        <p className="rounded-md border border-dashed border-[color:var(--wm-hairline-strong)] p-8 text-center text-sm text-[color:var(--wm-ink-muted)]">
                          No tasks assigned to you yet.
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {tab === 'schedule' && (
                  <section className="space-y-4">
                    {canManageShifts && (
                      <form onSubmit={submitShift} className="wm-surface-panel grid gap-3 p-5 sm:grid-cols-[1fr_220px_auto]">
                        <input
                          value={shiftTitle}
                          onChange={(e) => setShiftTitle(e.target.value)}
                          placeholder="Shift / duty title"
                          required
                          className="h-10 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
                        />
                        <input
                          type="date"
                          value={shiftDate}
                          onChange={(e) => setShiftDate(e.target.value)}
                          required
                          className="h-10 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
                        />
                        <button
                          disabled={busy}
                          className="h-10 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
                        >
                          Create shift
                        </button>
                      </form>
                    )}

                    <div className="grid gap-3 md:grid-cols-2">
                      {shifts.map((s) => (
                        <article key={s.id} className="wm-surface-panel p-5">
                          <h3 className="text-sm font-semibold">{s.title}</h3>
                          <p className="mt-2 text-xs text-[color:var(--wm-ink-secondary)]">
                            {s.payload.date || 'Date not set'} · {s.payload.status || 'scheduled'}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setSwapTargetShift(s);
                              setSwapReason('');
                            }}
                            className="mt-3 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-xs hover:bg-[color:var(--wm-overlay)]"
                          >
                            Request shift swap
                          </button>
                        </article>
                      ))}
                      {!shifts.length && (
                        <p className="text-sm text-[color:var(--wm-ink-muted)]">
                          No shifts have been published for this department.
                        </p>
                      )}
                    </div>

                    {canManageShifts && swaps.length > 0 && (
                      <div className="wm-surface-panel p-5">
                        <h3 className="text-sm font-semibold">Shift swap requests</h3>
                        <div className="mt-3 space-y-2">
                          {swaps.map((sw) => (
                            <div
                              key={sw.id}
                              className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--wm-hairline)] pt-3"
                            >
                              <div>
                                <p className="text-xs font-semibold">{sw.title}</p>
                                <p className="text-xs text-[color:var(--wm-ink-muted)]">
                                  {sw.payload.reason} · {sw.payload.status}
                                </p>
                              </div>
                              {sw.payload.status === 'pending' && (
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void updateRecord(sw, {
                                        ...sw.payload,
                                        status: 'approved',
                                        reviewed_by: currentUser.fullName,
                                      })
                                    }
                                    className="rounded-md bg-[color:var(--wm-emerald)] px-3 py-1.5 text-xs font-medium text-[#eef4ef]"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void updateRecord(sw, {
                                        ...sw.payload,
                                        status: 'rejected',
                                        reviewed_by: currentUser.fullName,
                                      })
                                    }
                                    className="rounded-md border border-rose-400/35 px-3 py-1.5 text-xs text-rose-200"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {tab === 'stations' && (
                  <section className="grid gap-3 md:grid-cols-2">
                    {stations.map((s) => (
                      <article key={s.id} className="wm-surface-panel p-5">
                        <h3 className="text-sm font-semibold">{s.title}</h3>
                        <p className="mt-2 text-xs text-[color:var(--wm-ink-secondary)]">
                          {s.payload.location || 'Location to be confirmed'}
                        </p>
                        <p className="mt-2 text-sm">{s.payload.purpose || ''}</p>
                      </article>
                    ))}
                    {!stations.length && (
                      <p className="text-sm text-[color:var(--wm-ink-muted)]">
                        No station information has been published yet.
                      </p>
                    )}
                  </section>
                )}

                {tab === 'announcements' && (
                  <section className="space-y-3">
                    {canPublish && (
                      <form onSubmit={submitAnnouncement} className="wm-surface-panel space-y-3 p-5">
                        <input
                          value={announcementTitle}
                          onChange={(e) => setAnnouncementTitle(e.target.value)}
                          required
                          placeholder="Announcement title"
                          className="h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
                        />
                        <textarea
                          value={announcementBody}
                          onChange={(e) => setAnnouncementBody(e.target.value)}
                          required
                          placeholder="Announcement details"
                          rows={3}
                          className="w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-3 text-sm text-[color:var(--wm-ink)]"
                        />
                        <button
                          disabled={busy}
                          className="h-10 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
                        >
                          Publish to department
                        </button>
                      </form>
                    )}
                    {announcements.map((a) => (
                      <article key={a.id} className="wm-surface-panel p-5">
                        <h3 className="text-sm font-semibold">{a.title}</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--wm-ink-secondary)]">
                          {a.payload.body}
                        </p>
                        <button
                          type="button"
                          disabled={acknowledgedIds.includes(a.id)}
                          onClick={() => void acknowledgeAnnouncement(a)}
                          className="mt-3 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-xs disabled:opacity-50"
                        >
                          {acknowledgedIds.includes(a.id) ? 'Acknowledged' : 'Acknowledge'}
                        </button>
                      </article>
                    ))}
                    {!announcements.length && (
                      <p className="text-sm text-[color:var(--wm-ink-muted)]">No department announcements yet.</p>
                    )}
                  </section>
                )}

                {tab === 'incidents' && (
                  <section className="space-y-4">
                    <form onSubmit={submitIncident} className="wm-surface-panel space-y-3 p-5">
                      <h2 className="text-sm font-semibold">Report an incident</h2>
                      <input
                        value={incidentTitle}
                        onChange={(e) => setIncidentTitle(e.target.value)}
                        required
                        placeholder="Short incident title"
                        className="h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-sm text-[color:var(--wm-ink)]"
                      />
                      <textarea
                        value={incidentDetails}
                        onChange={(e) => setIncidentDetails(e.target.value)}
                        required
                        rows={3}
                        placeholder="Describe what happened and where"
                        className="w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-3 text-sm text-[color:var(--wm-ink)]"
                      />
                      <button
                        disabled={busy}
                        className="h-10 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
                      >
                        Submit report
                      </button>
                    </form>
                    {incidents.map((i) => (
                      <article key={i.id} className="wm-surface-panel p-4">
                        <div className="flex justify-between gap-3">
                          <h3 className="text-sm font-semibold">{i.title}</h3>
                          <span className="text-xs font-mono uppercase text-[color:var(--wm-accent)]">
                            {i.payload.status || 'open'}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[color:var(--wm-ink-secondary)]">{i.payload.description}</p>
                        {(permissions.review_incidents || canManage) && i.payload.status !== 'resolved' && (
                          <button
                            type="button"
                            onClick={() =>
                              void updateRecord(i, {
                                ...i.payload,
                                status: 'resolved',
                                resolved_by: currentUser.fullName,
                              })
                            }
                            className="mt-3 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-xs hover:bg-[color:var(--wm-overlay)]"
                          >
                            Mark resolved
                          </button>
                        )}
                      </article>
                    ))}
                  </section>
                )}

                {tab === 'team' && (
                  <section className="space-y-3">
                    {hierarchy.map((h) => (
                      <article key={h.id} className="wm-surface-panel p-4">
                        <h3 className="text-sm font-semibold">{h.title}</h3>
                        <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                          {h.payload.assigned_name || h.payload.role_title || ''}
                        </p>
                        <p className="mt-2 text-sm">{h.payload.responsibilities || ''}</p>
                      </article>
                    ))}
                    {!hierarchy.length && (
                      <p className="text-sm text-[color:var(--wm-ink-muted)]">
                        The department structure has not been published yet.
                      </p>
                    )}
                  </section>
                )}

                {tab === 'hr-accepted' && isHrEb && (
                  <HrAcceptedApplicantsView actingUserOverride={currentUser} />
                )}

                {tab === 'committees' && isDccEb && (
                  <CommitteesManagementView actingUserOverride={currentUser} />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        {/* Inline Shift Swap Reason Dialog (no window.prompt) */}
        <AnimatePresence>
          {swapTargetShift && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-label="Request shift swap"
              className="fixed inset-0 z-[120] flex items-center justify-center bg-[#030906]/82 p-4 backdrop-blur-sm"
              onClick={() => setSwapTargetShift(null)}
            >
              <motion.form
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 6 }}
                onClick={(e) => e.stopPropagation()}
                onSubmit={(e) => void submitShiftSwap(e)}
                className="w-full max-w-md rounded-xl border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] p-6 shadow-2xl"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[color:var(--wm-hairline)] pb-3">
                  <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                    Request Shift Swap · {swapTargetShift.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSwapTargetShift(null)}
                    aria-label="Cancel swap request"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--wm-ink-muted)] hover:bg-[color:var(--wm-inset)]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <label className="mt-4 block text-xs text-[color:var(--wm-ink-secondary)]">
                  Reason for swap request
                  <textarea
                    required
                    rows={3}
                    value={swapReason}
                    onChange={(e) => setSwapReason(e.target.value)}
                    placeholder="Explain your scheduling conflict…"
                    className="mt-1.5 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-3 text-xs text-[color:var(--wm-ink)]"
                  />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSwapTargetShift(null)}
                    className="h-9 rounded-md border border-[color:var(--wm-hairline-strong)] px-4 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-inset)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !swapReason.trim()}
                    className="h-9 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] disabled:opacity-50"
                  >
                    Submit Swap Request
                  </button>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>

        <MyQrModal />
      </div>
    </MotionConfig>
  );
}
