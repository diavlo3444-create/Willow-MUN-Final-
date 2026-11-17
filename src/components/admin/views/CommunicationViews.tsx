import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Bell,
  CheckCircle2,
  Inbox,
  Mail,
  Save,
  Send,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type { EmailTemplate } from '../../../types/admin';
import { hasPermission } from '../../../utils/adminPermissions';
import { renderEmailTemplateText } from '../../../utils/emailTemplates';
import { StatusBadge } from '../StatusBadge';

export function EmailManagementView({
  preselectedApplicationIds = [],
}: {
  preselectedApplicationIds?: string[];
}) {
  const { data, currentUser, saveEmailTemplate, sendEmails } = useAdminStore();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    data.emailTemplates[0]?.id ?? 'tpl-acceptance',
  );
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>(preselectedApplicationIds);
  const [statusFilter, setStatusFilter] = useState<string>('accepted');

  useEffect(() => {
    if (preselectedApplicationIds.length > 0) {
      setSelectedAppIds(preselectedApplicationIds);
    }
  }, [preselectedApplicationIds]);

  const activeTemplate = useMemo(
    () =>
      data.emailTemplates.find((t) => t.id === selectedTemplateId) ?? data.emailTemplates[0],
    [data.emailTemplates, selectedTemplateId],
  );

  const [subject, setSubject] = useState(activeTemplate?.subject ?? '');
  const [body, setBody] = useState(activeTemplate?.body ?? '');

  useEffect(() => {
    if (activeTemplate) {
      setSubject(activeTemplate.subject);
      setBody(activeTemplate.body);
    }
  }, [activeTemplate]);

  const canSend = hasPermission(currentUser, 'email.send');
  const canBulk = hasPermission(currentUser, 'email.bulk_send');
  const deptNameById = useMemo(
    () => new Map(data.departments.map((d) => [d.id, d.name])),
    [data.departments],
  );

  const filteredRecipients = useMemo(
    () =>
      data.applications.filter(
        (a) => statusFilter === 'all' || a.status === statusFilter,
      ),
    [data.applications, statusFilter],
  );

  const previewApp =
    data.applications.find((a) => a.id === selectedAppIds[0]) ??
    filteredRecipients[0] ??
    data.applications[0];

  const handleSaveTemplate = () => {
    if (!activeTemplate) return;
    const updated: EmailTemplate = {
      ...activeTemplate,
      subject,
      body,
      updatedAt: new Date().toISOString(),
    };
    saveEmailTemplate(updated);
  };

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    const ok = sendEmails({
      templateId: activeTemplate?.id ?? null,
      applicationIds: selectedAppIds,
      subject,
      body,
    });
    if (ok) setSelectedAppIds([]);
  };

  return (
    <div className="space-y-6">
      {/* Relay Connection Strip */}
      <div className="wm-surface-panel px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <Mail className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
          <span>
            <strong className="text-[color:var(--wm-ink)]">{data.emailConnection.provider}</strong>{' '}
            <span className="text-[color:var(--wm-ink-muted)]">· Sender:</span>{' '}
            <span className="font-mono text-[color:var(--wm-accent)]">
              {data.emailConnection.senderAddress}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded border border-emerald-400/35 bg-emerald-500/[0.1] px-2 py-0.5 text-[11px] font-medium text-emerald-200">
            Connected
          </span>
          <span className="font-mono text-[11px] text-[color:var(--wm-ink-secondary)] tabular-nums">
            Daily Quota: {data.emailConnection.dailyQuotaUsed}/
            {data.emailConnection.dailyQuotaLimit}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Recipient Roster Panel */}
        <section className="xl:col-span-5 wm-surface-panel overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">Select Recipients</h2>
            <select
              aria-label="Filter recipients by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-xs text-[color:var(--wm-ink)]"
            >
              <option value="all">All Statuses</option>
              <option value="accepted">Accepted Only</option>
              <option value="rejected">Rejected Only</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="px-5 py-2.5 border-b border-[color:var(--wm-hairline)] flex items-center justify-between text-xs text-[color:var(--wm-ink-secondary)]">
            <span className="tabular-nums">{selectedAppIds.length} recipient(s) selected</span>
            <div className="flex gap-3">
              {canBulk && (
                <button
                  type="button"
                  onClick={() => setSelectedAppIds(filteredRecipients.map((a) => a.id))}
                  className="text-[color:var(--wm-accent)] hover:underline cursor-pointer"
                >
                  Select All Visible
                </button>
              )}
              {selectedAppIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedAppIds([])}
                  className="text-[color:var(--wm-ink-muted)] hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[color:var(--wm-hairline)]">
            {filteredRecipients.map((app) => {
              const checked = selectedAppIds.includes(app.id);
              return (
                <label
                  key={app.id}
                  className="flex items-center justify-between gap-2.5 px-5 py-3 text-xs hover:bg-[#ede6ca]/[0.03] cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (!canBulk && !checked && selectedAppIds.length >= 1) {
                          setSelectedAppIds([app.id]);
                          return;
                        }
                        setSelectedAppIds((prev) =>
                          prev.includes(app.id)
                            ? prev.filter((id) => id !== app.id)
                            : [...prev, app.id],
                        );
                      }}
                      className="h-4 w-4 accent-[#a9b47e]"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-[color:var(--wm-ink)] truncate">
                        {app.applicantName}
                      </p>
                      <p className="text-[11px] text-[color:var(--wm-ink-muted)] truncate">
                        {app.email}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={app.status} />
                </label>
              );
            })}
          </div>
        </section>

        {/* Template & Composer */}
        <section className="xl:col-span-7 wm-surface-panel p-5 space-y-4">
          <form onSubmit={handleSend} className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] pb-3.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {data.emailTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`h-8 rounded px-3 font-medium cursor-pointer transition-colors ${
                      tpl.id === activeTemplate?.id
                        ? 'bg-[color:var(--wm-focal)] text-[#12170c]'
                        : 'text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/8 hover:text-[color:var(--wm-ink)]'
                    }`}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Save Template</span>
              </button>
            </div>

            <div>
              <label className="block font-medium text-[color:var(--wm-ink-secondary)]">
                Subject Line
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1.5 h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="font-medium text-[color:var(--wm-ink-secondary)]">
                  Email Body
                </label>
                <span className="text-[11px] font-mono text-[color:var(--wm-accent)]">
                  {'{{applicant_name}}'} · {'{{department_name}}'} · {'{{position}}'} ·{' '}
                  {'{{application_id}}'} · {'{{conference_year}}'}
                </span>
              </div>
              <textarea
                rows={6}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="mt-1.5 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] p-3 text-[color:var(--wm-ink)] leading-relaxed"
              />
            </div>

            {previewApp && (
              <div className="wm-surface-inset p-4 space-y-2">
                <p className="wm-section-kicker text-[color:var(--wm-accent)]">
                  Live Interpolated Preview ({previewApp.applicantName})
                </p>
                <p className="font-semibold text-[color:var(--wm-ink)]">
                  {renderEmailTemplateText(
                    subject,
                    previewApp,
                    deptNameById.get(previewApp.departmentId) ?? previewApp.departmentId,
                    data.settings.editionYear,
                  )}
                </p>
                <pre className="whitespace-pre-wrap font-sans text-[color:var(--wm-ink-secondary)] leading-relaxed">
                  {renderEmailTemplateText(
                    body,
                    previewApp,
                    deptNameById.get(previewApp.departmentId) ?? previewApp.departmentId,
                    data.settings.editionYear,
                  )}
                </pre>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!canSend || selectedAppIds.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded bg-[color:var(--wm-focal)] px-5 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] disabled:opacity-40 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Send to {selectedAppIds.length} Applicant(s)</span>
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Dispatch History */}
      <section className="wm-surface-panel overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)]">
          <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">Sent Dispatch Log</h2>
        </div>
        <div className="divide-y divide-[color:var(--wm-hairline)] text-xs">
          {data.sentEmails.map((m) => (
            <div key={m.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-[color:var(--wm-ink)]">
                  {m.recipientName}{' '}
                  <span className="font-normal text-[color:var(--wm-ink-muted)]">
                    &lt;{m.recipientEmail}&gt;
                  </span>
                </p>
                <p className="mt-0.5 text-[color:var(--wm-accent)]">{m.subject}</p>
              </div>
              <span className="text-[color:var(--wm-ink-muted)] tabular-nums">
                By {m.sentBy} · {new Date(m.sentAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function MessagesInquiriesView() {
  const { data, updateInquiry } = useAdminStore();
  const [filter, setFilter] = useState<'all' | 'new' | 'in_review' | 'resolved'>('all');

  const items = data.inquiries.filter((i) => filter === 'all' || i.status === filter);

  return (
    <div className="space-y-5">
      <div className="wm-surface-panel px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)]">
          <Inbox className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
          <span>
            Incoming submissions from the public Suggestions & Accessibility Requirements form.
          </span>
        </div>
        <select
          aria-label="Filter inquiries by status"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-xs text-[color:var(--wm-ink)]"
        >
          <option value="all">All Inquiries ({data.inquiries.length})</option>
          <option value="new">New</option>
          <option value="in_review">In Review</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div className="wm-surface-panel divide-y divide-[color:var(--wm-hairline)]">
        {items.length === 0 ? (
          <div className="p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">
            No inquiries match the selected filter.
          </div>
        ) : (
          items.map((inq) => (
            <article key={inq.id} className="p-5 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--wm-accent)]">
                    {inq.type}
                  </span>
                  <h3 className="mt-0.5 text-sm font-semibold text-[color:var(--wm-ink)]">
                    {inq.name} ·{' '}
                    <span className="font-normal text-[color:var(--wm-ink-secondary)]">
                      {inq.email}
                    </span>
                  </h3>
                </div>
                <select
                  aria-label={`Status for ${inq.name}`}
                  value={inq.status}
                  onChange={(e) =>
                    updateInquiry(inq.id, { status: e.target.value as typeof inq.status })
                  }
                  className="h-8 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-xs text-[color:var(--wm-ink)]"
                >
                  <option value="new">New</option>
                  <option value="in_review">In Review</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <p className="text-sm text-[color:var(--wm-ink-secondary)] leading-relaxed">
                {inq.message}
              </p>
              <div className="pt-1">
                <input
                  type="text"
                  defaultValue={inq.internalNotes}
                  onBlur={(e) => updateInquiry(inq.id, { internalNotes: e.target.value })}
                  placeholder="Add internal triage note (saves on blur)..."
                  aria-label={`Internal triage note for ${inq.name}`}
                  className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-xs text-[color:var(--wm-ink)]"
                />
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export function NotificationsCenterView() {
  const { notifications, markNotificationsRead } = useAdminStore();

  return (
    <div className="space-y-4">
      <div className="wm-surface-panel px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[color:var(--wm-ink-secondary)]">
          <Bell className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
          <span>Real-time conference alerts and intake notices scoped to your role.</span>
        </div>
        <button
          type="button"
          onClick={markNotificationsRead}
          className="inline-flex h-8 items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-3 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Mark All Read</span>
        </button>
      </div>

      <div className="wm-surface-panel divide-y divide-[color:var(--wm-hairline)]">
        {notifications.map((n) => (
          <div key={n.id} className="px-5 py-3.5 flex items-center justify-between gap-4 text-xs">
            <div>
              <p className="font-semibold text-[color:var(--wm-ink)]">{n.title}</p>
              <p className="mt-0.5 text-[color:var(--wm-ink-secondary)]">{n.message}</p>
            </div>
            <span className="text-[color:var(--wm-ink-muted)] tabular-nums shrink-0">
              {new Date(n.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
