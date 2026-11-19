import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  FileCode2,
  History,
  Info,
  Mail,
  Send,
  Users,
  XCircle,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { ApplicantsBulkTab } from './emails/ApplicantsBulkTab';
import { BulkSendConfirmModal } from './emails/BulkSendConfirmModal';
import { EmailHistoryTab } from './emails/EmailHistoryTab';
import { EmailTemplatesTab } from './emails/EmailTemplatesTab';
import { SendingQueueTab } from './emails/SendingQueueTab';
import {
  DEFAULT_EMAIL_TEMPLATES,
  ESTIMATED_DAILY_CAPACITY,
  SAMPLE_EMAIL_APPLICANTS,
  SAMPLE_EMAIL_HISTORY,
  SAMPLE_INITIAL_QUEUE,
  renderEmailPreview,
} from './emails/sampleData';
import type {
  BulkSendConfirmState,
  EmailApplicantRecord,
  EmailDecisionType,
  EmailHistoryRecord,
  EmailQueueItem,
  EmailTemplateRecord,
} from './emails/types';

type DashboardTab = 'applicants' | 'queue' | 'history' | 'templates';

export function EmailsDashboardView() {
  const { pushToast } = useAdminStore();

  // Sample dataset (UI-only phase). Kept cleanly structured so real Supabase
  // queries and handlers can drop straight into these state hooks later.
  const [applicants] = useState<EmailApplicantRecord[]>(SAMPLE_EMAIL_APPLICANTS);
  const [history, setHistory] = useState<EmailHistoryRecord[]>(SAMPLE_EMAIL_HISTORY);
  const [queue, setQueue] = useState<EmailQueueItem[]>(SAMPLE_INITIAL_QUEUE);
  const [templates, setTemplates] = useState<Record<EmailDecisionType, EmailTemplateRecord>>(
    DEFAULT_EMAIL_TEMPLATES,
  );

  const [activeTab, setActiveTab] = useState<DashboardTab>('applicants');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmState, setConfirmState] = useState<BulkSendConfirmState | null>(null);
  const [simulationRunning, setSimulationRunning] = useState(false);

  // Derived overview metrics
  const totalApplications = applicants.length;
  const acceptedCount = applicants.filter((a) => a.applicationStatus === 'accepted').length;
  const rejectedCount = applicants.filter((a) => a.applicationStatus === 'rejected').length;
  const sentEmailsCount = history.filter((h) => h.status === 'sent').length;
  const failedEmailsCount = history.filter((h) => h.status === 'failed').length;
  const remainingCapacity = Math.max(0, ESTIMATED_DAILY_CAPACITY - sentEmailsCount);
  const capacityPct = Math.min(
    100,
    Math.round((sentEmailsCount / ESTIMATED_DAILY_CAPACITY) * 100),
  );

  // Ready-to-send batches for primary "Send All" buttons
  const pendingAcceptanceRecipients = useMemo(
    () =>
      applicants.filter(
        (a) => a.applicationStatus === 'accepted' && a.emailStatus !== 'sent',
      ),
    [applicants],
  );
  const alreadySentAcceptedCount = acceptedCount - pendingAcceptanceRecipients.length;

  const pendingRejectionRecipients = useMemo(
    () =>
      applicants.filter(
        (a) => a.applicationStatus === 'rejected' && a.emailStatus !== 'sent',
      ),
    [applicants],
  );
  const alreadySentRejectedCount = rejectedCount - pendingRejectionRecipients.length;

  const selectedApplicants = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return applicants.filter((a) => selectedSet.has(a.id));
  }, [applicants, selectedIds]);

  const queueActiveCount = queue.filter(
    (q) => q.status === 'waiting' || q.status === 'processing',
  ).length;

  // UI-only queue progression preview (stops automatically when queue drains)
  useEffect(() => {
    if (!simulationRunning) return;
    const timer = window.setInterval(() => {
      setQueue((prev) => {
        const processingIdx = prev.findIndex((q) => q.status === 'processing');
        if (processingIdx !== -1) {
          return prev.map((item, idx) =>
            idx === processingIdx ? { ...item, status: 'sent', errorDetails: null } : item,
          );
        }
        const nextWaitingIdx = prev.findIndex((q) => q.status === 'waiting');
        if (nextWaitingIdx !== -1) {
          return prev.map((item, idx) =>
            idx === nextWaitingIdx ? { ...item, status: 'processing' } : item,
          );
        }
        setSimulationRunning(false);
        return prev;
      });
    }, 650);
    return () => window.clearInterval(timer);
  }, [simulationRunning]);

  const openSendAllAcceptance = () => {
    setConfirmState({
      mode: 'all_accepted',
      emailType: 'accepted',
      recipients: pendingAcceptanceRecipients,
      skippedAlreadySentCount: alreadySentAcceptedCount,
      skippedIneligibleCount: totalApplications - acceptedCount,
    });
  };

  const openSendAllRejection = () => {
    setConfirmState({
      mode: 'all_rejected',
      emailType: 'rejected',
      recipients: pendingRejectionRecipients,
      skippedAlreadySentCount: alreadySentRejectedCount,
      skippedIneligibleCount: totalApplications - rejectedCount,
    });
  };

  const openSendSelected = (
    recipients: EmailApplicantRecord[],
    preferredType?: EmailDecisionType,
  ) => {
    if (recipients.length === 0) return;
    const inferredType: EmailDecisionType =
      preferredType ??
      (recipients.every((r) => r.applicationStatus === 'rejected') ? 'rejected' : 'accepted');
    setConfirmState({
      mode: 'selected',
      emailType: inferredType,
      recipients,
      skippedAlreadySentCount: 0,
      skippedIneligibleCount: 0,
    });
  };

  const handleConfirmQueue = (emailType: EmailDecisionType) => {
    if (!confirmState || confirmState.recipients.length === 0) return;
    const template = templates[emailType];
    const now = new Date().toISOString();

    const stagedItems: EmailQueueItem[] = confirmState.recipients.map((recipient, idx) => ({
      id: `q-staged-${Date.now()}-${idx}-${recipient.id}`,
      applicantId: recipient.id,
      recipientName: recipient.applicantName,
      recipientEmail: recipient.email,
      department: recipient.department,
      emailType,
      subject: renderEmailPreview(template.subject, recipient, emailType),
      status: 'waiting',
      queuedAt: now,
    }));

    setQueue((prev) => [...stagedItems, ...prev]);
    if (confirmState.mode === 'selected') {
      setSelectedIds([]);
    }
    const stagedCount = stagedItems.length;
    setConfirmState(null);
    setActiveTab('queue');

    pushToast({
      tone: 'info',
      title: `Staged ${stagedCount} email${stagedCount === 1 ? '' : 's'} in Sending Queue`,
      description: 'UI preview only — connect backend email dispatch to transmit messages.',
    });
  };

  const handleRetryHistoryItem = (historyId: string) => {
    const target = history.find((h) => h.id === historyId);
    if (!target) return;
    const staged: EmailQueueItem = {
      id: `q-retry-${Date.now()}-${target.id}`,
      applicantId: target.applicantId,
      recipientName: target.recipientName,
      recipientEmail: target.recipientEmail,
      department: target.department,
      emailType: target.emailType,
      subject: target.subject,
      status: 'waiting',
      queuedAt: new Date().toISOString(),
    };
    setQueue((prev) => [staged, ...prev]);
    setHistory((prev) =>
      prev.map((row) =>
        row.id === historyId ? { ...row, status: 'pending', errorDetails: null } : row,
      ),
    );
    setActiveTab('queue');
    pushToast({
      tone: 'info',
      title: `Re-queued email for ${target.recipientName}`,
      description: 'Staged in Sending Queue (UI preview).',
    });
  };

  const handleRetryQueueItem = (queueId: string) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === queueId ? { ...item, status: 'waiting', errorDetails: null } : item,
      ),
    );
  };

  const handleRemoveQueueItem = (queueId: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== queueId));
  };

  const handleSaveTemplate = (key: EmailDecisionType, subject: string, body: string) => {
    setTemplates((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        subject,
        body,
        updatedAt: new Date().toISOString(),
      },
    }));
    pushToast({
      tone: 'success',
      title: `${key === 'accepted' ? 'Acceptance' : 'Rejection'} template draft updated`,
      description: 'Saved in local UI state.',
    });
  };

  const handleResetTemplate = (key: EmailDecisionType) => {
    setTemplates((prev) => ({
      ...prev,
      [key]: DEFAULT_EMAIL_TEMPLATES[key],
    }));
    pushToast({
      tone: 'info',
      title: 'Template reset to default',
    });
  };

  const toggleOneSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const tabs: Array<{
    id: DashboardTab;
    label: string;
    Icon: typeof Users;
    badge?: number;
  }> = [
    { id: 'applicants', label: 'Applicants & Bulk Send', Icon: Users },
    { id: 'queue', label: 'Sending Queue', Icon: Clock3, badge: queueActiveCount || undefined },
    { id: 'history', label: 'Email History', Icon: History, badge: failedEmailsCount || undefined },
    { id: 'templates', label: 'Templates', Icon: FileCode2 },
  ];

  return (
    <div className="space-y-5">
      {/* Page Header & UI Preview Banner */}
      <section className="flex flex-col gap-3 border-b border-[color:var(--wm-hairline)] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[color:var(--wm-accent)]">
            Admin &amp; HR Communications
          </p>
          <h1 className="wm-serif mt-1.5 text-3xl text-[color:var(--wm-ink)]">
            Email Management Center
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
            Review applicants, dispatch bulk acceptance or rejection emails, track the sending queue,
            and manage official decision templates.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-[11px] text-[color:var(--wm-ink-secondary)] lg:self-auto">
          <Info className="h-3.5 w-3.5 shrink-0 text-[color:var(--wm-accent)]" aria-hidden="true" />
          <span>Sample UI Preview · Backend email dispatch not connected yet</span>
        </div>
      </section>

      {/* 1. Dashboard Overview — Clean 6-Metric Strip + Subtle Capacity Bar */}
      <section aria-label="Email dashboard overview" className="wm-surface-panel overflow-hidden">
        <div className="grid grid-cols-2 divide-y sm:grid-cols-3 lg:grid-cols-6 sm:divide-y-0 sm:divide-x divide-[color:var(--wm-hairline)] tabular-nums">
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between gap-2 text-[11px] text-[color:var(--wm-ink-muted)]">
              <span>Total Applications</span>
              <Users className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
            </div>
            <p className="mt-1.5 font-serif text-2xl font-medium text-[color:var(--wm-ink)]">
              {totalApplications}
            </p>
          </div>

          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between gap-2 text-[11px] text-[color:var(--wm-ink-muted)]">
              <span>Accepted Applicants</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
            </div>
            <p className="mt-1.5 font-serif text-2xl font-medium text-emerald-200">
              {acceptedCount}
            </p>
          </div>

          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between gap-2 text-[11px] text-[color:var(--wm-ink-muted)]">
              <span>Rejected Applicants</span>
              <XCircle className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />
            </div>
            <p className="mt-1.5 font-serif text-2xl font-medium text-rose-200">
              {rejectedCount}
            </p>
          </div>

          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between gap-2 text-[11px] text-[color:var(--wm-ink-muted)]">
              <span>Emails Sent</span>
              <Mail className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
            </div>
            <p className="mt-1.5 font-serif text-2xl font-medium text-[color:var(--wm-ink)]">
              {sentEmailsCount}
            </p>
          </div>

          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between gap-2 text-[11px] text-[color:var(--wm-ink-muted)]">
              <span>Daily Capacity Left</span>
              <Send className="h-3.5 w-3.5 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
            </div>
            <p className="mt-1.5 font-serif text-2xl font-medium text-[color:var(--wm-ink)]">
              {remainingCapacity}
            </p>
          </div>

          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between gap-2 text-[11px] text-[color:var(--wm-ink-muted)]">
              <span>Failed Emails</span>
              <XCircle className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />
            </div>
            <p className="mt-1.5 font-serif text-2xl font-medium text-rose-200">
              {failedEmailsCount}
            </p>
          </div>
        </div>

        {/* Subtle Capacity Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)]/60 px-4 py-2.5 text-[11px]">
          <span className="text-[color:var(--wm-ink-muted)]">
            Daily sending estimate ({sentEmailsCount} / {ESTIMATED_DAILY_CAPACITY} used · {capacityPct}%)
          </span>
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[color:var(--wm-canvas)]">
            <div
              className="h-full rounded-full bg-[color:var(--wm-accent)]"
              style={{ width: `${capacityPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* 3. Prominent "Send All Emails" Primary Action Bar */}
      <section
        aria-label="Bulk email dispatch actions"
        className="wm-surface-panel flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--wm-ink)]">
            Primary Bulk Dispatch
          </h2>
          <p className="mt-0.5 text-[11px] text-[color:var(--wm-ink-muted)]">
            Send decision emails in batch with pre-send recipient verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={openSendAllAcceptance}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] transition-colors hover:bg-[#357a5b] cursor-pointer whitespace-nowrap"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Send All Acceptance Emails ({pendingAcceptanceRecipients.length})</span>
          </button>

          <button
            type="button"
            onClick={openSendAllRejection}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-rose-400/40 bg-rose-500/[0.12] px-4 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-500/[0.2] cursor-pointer whitespace-nowrap"
          >
            <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Send All Rejection Emails ({pendingRejectionRecipients.length})</span>
          </button>

          <button
            type="button"
            disabled={selectedApplicants.length === 0}
            onClick={() => openSendSelected(selectedApplicants)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-4 text-xs font-semibold text-[color:var(--wm-ink)] transition-colors hover:bg-[color:var(--wm-overlay)] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            <Send className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Send Selected Emails ({selectedApplicants.length})</span>
          </button>
        </div>
      </section>

      {/* Navigation Tabs */}
      <nav
        aria-label="Email management sections"
        className="flex flex-wrap items-center gap-1.5 border-b border-[color:var(--wm-hairline)] pb-3"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[color:var(--wm-focal)] font-semibold text-[#12170c]'
                  : 'border border-[color:var(--wm-hairline)] bg-[color:var(--wm-surface)] text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-inset)] hover:text-[color:var(--wm-ink)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                    active
                      ? 'bg-[#12170c]/15 text-[#12170c]'
                      : 'bg-[color:var(--wm-inset)] text-[color:var(--wm-ink)]'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Active Workspace Tab */}
      {activeTab === 'applicants' && (
        <ApplicantsBulkTab
          applicants={applicants}
          selectedIds={selectedIds}
          onToggleOne={toggleOneSelection}
          onSelectMany={setSelectedIds}
          onClearSelection={() => setSelectedIds([])}
          onRequestSendSelected={openSendSelected}
        />
      )}

      {activeTab === 'queue' && (
        <SendingQueueTab
          queue={queue}
          simulationRunning={simulationRunning}
          onStartSimulation={() => setSimulationRunning(true)}
          onPauseSimulation={() => setSimulationRunning(false)}
          onRetryItem={handleRetryQueueItem}
          onRemoveItem={handleRemoveQueueItem}
          onClearCompleted={() =>
            setQueue((prev) => prev.filter((item) => item.status !== 'sent'))
          }
        />
      )}

      {activeTab === 'history' && (
        <EmailHistoryTab
          history={history}
          onRetryHistoryItem={handleRetryHistoryItem}
        />
      )}

      {activeTab === 'templates' && (
        <EmailTemplatesTab
          templates={templates}
          applicants={applicants}
          onSaveTemplate={handleSaveTemplate}
          onResetTemplate={handleResetTemplate}
        />
      )}

      {/* Confirmation Modal */}
      <BulkSendConfirmModal
        request={confirmState}
        templates={templates}
        onChangeType={(emailType) =>
          setConfirmState((prev) => (prev ? { ...prev, emailType } : null))
        }
        onConfirm={handleConfirmQueue}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
