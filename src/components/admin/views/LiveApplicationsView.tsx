import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Search } from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { supabase } from '../../../lib/supabase';
import {
  mapLiveRowToApplication,
  type LiveApplicationRow,
} from '../../../services/liveBackendService';
import type { AdminUser, Application } from '../../../types/admin';
import { ApplicationAttachmentsViewer } from '../ApplicationAttachmentsViewer';
import { WmSkeleton } from '../WmSkeleton';

const labels: Record<string, string> = {
  volunteer: 'Volunteers',
  media: 'Media',
  press: 'Press',
  security: 'Security',
  delegate: 'Delegate',
  staff: 'Staff',
};

export function LiveApplicationsView({
  selectedId,
  onClose,
}: {
  selectedId?: string | null;
  onClose?: () => void;
}) {
  const { currentUser, testModeHeadUser, data: storeData } = useAdminStore();
  const effectiveActor = testModeHeadUser ?? currentUser;

  const [rawRows, setRawRows] = useState<LiveApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [busyId, setBusyId] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('willow-applications', {
      body: { action: 'list' },
    });
    if (invokeError || data?.error) {
      setError(data?.error || invokeError?.message || 'Could not load applications.');
    } else {
      setRawRows((data?.applications || []) as LiveApplicationRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applications = useMemo(
    () =>
      rawRows.map((row) =>
        mapLiveRowToApplication(row, effectiveActor, storeData.departments),
      ),
    [rawRows, effectiveActor, storeData.departments],
  );

  const filtered = useMemo(
    () =>
      applications.filter((app) => {
        const q = query.trim().toLowerCase();
        const appType = (app.applicationType || app.category || '').toLowerCase();
        return (
          (type === 'all' || appType === type) &&
          (status === 'all' || app.status === status) &&
          (!q ||
            [
              app.applicantName,
              app.email,
              app.phone,
              app.guardianPhone || '',
              app.schoolOrUniversity,
              app.gradeOrYear,
              app.cameraModel || '',
            ]
              .join(' ')
              .toLowerCase()
              .includes(q))
        );
      }),
    [applications, query, type, status],
  );

  const updateStatus = async (
    app: Application,
    next: 'accepted' | 'rejected' | 'waitlisted' | 'pending',
  ) => {
    setBusyId(app.id);
    setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('willow-applications', {
      body: {
        action: 'update',
        id: app.id,
        status: next,
        review_notes: notes[app.id] ?? app.adminDecisionNotes ?? '',
      },
    });
    if (invokeError || data?.error) {
      setError(data?.error || invokeError?.message || 'Could not update application.');
    } else if (data?.application) {
      setRawRows((current) =>
        current.map((item) =>
          item.id === app.id ? (data.application as LiveApplicationRow) : item,
        ),
      );
    }
    setBusyId('');
  };

  const active = selectedId ? applications.find((app) => app.id === selectedId) : null;
  if (selectedId) {
    return (
      <div className="wm-surface-panel p-5 sm:p-7">
        <button
          type="button"
          onClick={onClose}
          className="mb-5 text-xs text-[color:var(--wm-accent)] underline cursor-pointer"
        >
          ← Back to applications
        </button>
        {loading ? (
          <WmSkeleton variant="dossier" />
        ) : !active ? (
          <p className="text-sm text-[color:var(--wm-ink-secondary)]">Application not found.</p>
        ) : (
          <ApplicationCard
            app={active}
            actor={effectiveActor}
            busy={busyId === active.id}
            notes={notes[active.id] ?? active.adminDecisionNotes ?? ''}
            setNotes={(v) => setNotes((n) => ({ ...n, [active.id]: v }))}
            onStatus={(v) => void updateStatus(active, v)}
          />
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-300">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="wm-surface-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
              Staff &amp; Organizing Team Applications
            </h2>
            <p className="mt-1 text-xs text-[color:var(--wm-ink-muted)]">
              {applications.length} submissions · Media, Press, Volunteers, Security
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <label className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, phone, school…"
              className="h-10 w-full rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)]"
            />
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Filter by application track"
            className="h-10 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
          >
            <option value="all">All application tracks</option>
            <option value="media">Media</option>
            <option value="press">Press</option>
            <option value="volunteer">Volunteers</option>
            <option value="security">Security</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
            className="h-10 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="waitlisted">Waitlisted</option>
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      {loading ? (
        <WmSkeleton variant="table" rows={5} />
      ) : filtered.length === 0 ? (
        <div className="wm-surface-panel p-10 text-center text-sm text-[color:var(--wm-ink-muted)]">
          No applications found.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => {
            const trackKey = (app.applicationType || app.category || '').toLowerCase();
            return (
              <article key={app.id} className="wm-surface-panel p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-2 py-1 text-[10px] uppercase tracking-wide text-[color:var(--wm-accent)]">
                        {labels[trackKey] || app.category}
                      </span>
                      {app.gender && (
                        <span className="rounded border border-[color:var(--wm-hairline)] px-2 py-1 text-[10px] capitalize text-[color:var(--wm-ink-secondary)]">
                          {app.gender}
                        </span>
                      )}
                      {app.documents.length > 0 && (
                        <span className="rounded border border-[color:var(--wm-hairline)] px-2 py-1 text-[10px] font-mono text-[color:var(--wm-ink-muted)]">
                          {app.documents.length} file{app.documents.length === 1 ? '' : 's'}
                        </span>
                      )}
                      <span className="text-[10px] uppercase tracking-wide text-[color:var(--wm-ink-muted)]">
                        {app.status}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-[color:var(--wm-ink)]">
                      {app.applicantName}
                    </h3>
                    <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                      {app.email} · {app.phone}
                      {app.guardianPhone ? ` · Guardian: ${app.guardianPhone}` : ''}
                      {app.schoolOrUniversity ? ` · ${app.schoolOrUniversity}` : ''}
                      {app.gradeOrYear ? ` (${app.gradeOrYear})` : ''}
                    </p>
                  </div>
                  <span className="text-[10px] text-[color:var(--wm-ink-muted)]">
                    {new Date(app.submittedAt).toLocaleString()}
                  </span>
                </div>
                {app.experienceLevel && (
                  <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-[color:var(--wm-ink-secondary)]">
                    {app.experienceLevel}
                  </p>
                )}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-[color:var(--wm-accent)]">
                    View full dossier, attachments &amp; review
                  </summary>
                  <ApplicationCard
                    app={app}
                    actor={effectiveActor}
                    busy={busyId === app.id}
                    notes={notes[app.id] ?? app.adminDecisionNotes ?? ''}
                    setNotes={(v) => setNotes((n) => ({ ...n, [app.id]: v }))}
                    onStatus={(v) => void updateStatus(app, v)}
                  />
                </details>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ApplicationCard({
  app,
  actor,
  busy,
  notes,
  setNotes,
  onStatus,
}: {
  app: Application;
  actor: AdminUser | null | undefined;
  busy: boolean;
  notes: string;
  setNotes: (value: string) => void;
  onStatus: (status: 'accepted' | 'rejected' | 'waitlisted' | 'pending') => void;
}) {
  return (
    <div className="mt-4 space-y-4 text-xs text-[color:var(--wm-ink-secondary)]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 wm-surface-inset p-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
            School &amp; Grade
          </span>
          <p className="mt-0.5 text-[color:var(--wm-ink)]">
            {app.schoolOrUniversity || '—'}
            {app.gradeOrYear ? ` · ${app.gradeOrYear}` : ''}
            {app.age ? ` (Age ${app.age})` : ''}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
            Phone &amp; Guardian
          </span>
          <p className="mt-0.5 font-mono text-[11px] text-[color:var(--wm-ink)]">
            {app.phone || '—'}
            {app.guardianPhone ? ` / Guardian: ${app.guardianPhone}` : ''}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--wm-ink-muted)]">
            Conference &amp; Rehearsal
          </span>
          <p className="mt-0.5 text-[color:var(--wm-ink)]">
            {app.attendsAllDays === true
              ? 'Yes — available all days'
              : app.attendsAllDays === false
                ? `Conflict: ${app.absenceReason || 'See notes'}`
                : 'See responses'}
          </p>
        </div>
      </div>

      {/* Role Responses */}
      {app.answers.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
            Submitted Responses
          </p>
          {app.answers.map((ans) => (
            <div key={ans.questionId} className="wm-surface-inset p-3.5">
              <p className="text-[11px] font-semibold text-[color:var(--wm-focal)]">{ans.label}</p>
              {/^https?:\/\//i.test(ans.answer) ? (
                <a
                  href={ans.answer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 text-xs text-[color:var(--wm-accent)] underline"
                >
                  {ans.answer}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              ) : (
                <p className="mt-1 whitespace-pre-wrap leading-relaxed text-[color:var(--wm-ink-secondary)]">
                  {ans.answer}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Attachments, Photography Lightbox, & Restricted Medical Disclosure */}
      <ApplicationAttachmentsViewer application={app} actor={actor} />

      <div>
        <strong>Review notes</strong>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] p-3 text-xs text-[color:var(--wm-ink)]"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {(['accepted', 'rejected', 'waitlisted', 'pending'] as const).map((next) => (
          <button
            type="button"
            key={next}
            disabled={busy}
            onClick={() => onStatus(next)}
            className={`rounded-md px-3 py-2 text-xs capitalize cursor-pointer ${
              next === 'accepted'
                ? 'bg-[color:var(--wm-emerald)] text-[#eef4ef]'
                : next === 'rejected'
                  ? 'border border-rose-400/35 bg-rose-500/15 text-rose-200'
                  : 'border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] text-[color:var(--wm-ink)]'
            } disabled:opacity-50`}
          >
            {busy ? 'Saving…' : next}
          </button>
        ))}
      </div>
    </div>
  );
}
