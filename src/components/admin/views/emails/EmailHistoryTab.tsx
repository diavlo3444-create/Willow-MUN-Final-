import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Mail,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { hasValidRecipientEmail } from '../../../../utils/failedEmails';
import type { EmailHistoryRecord, HistoryDeliveryStatus } from './types';

interface EmailHistoryTabProps {
  history: EmailHistoryRecord[];
  onRetryHistoryItem: (historyId: string) => void;
  onOpenFailedInGmail?: (item: EmailHistoryRecord) => void;
}

const HISTORY_STATUS_META: Record<
  HistoryDeliveryStatus,
  { label: string; classes: string; Icon: typeof CheckCircle2 }
> = {
  sent: {
    label: 'Successfully Sent',
    classes: 'border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-200',
    Icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    classes: 'border-rose-400/25 bg-rose-500/[0.08] text-rose-200',
    Icon: XCircle,
  },
  pending: {
    label: 'Pending',
    classes: 'border-amber-400/25 bg-amber-500/[0.08] text-amber-200',
    Icon: Clock3,
  },
};

export function EmailHistoryTab({
  history,
  onRetryHistoryItem,
  onOpenFailedInGmail,
}: EmailHistoryTabProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | HistoryDeliveryStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBodyIds, setExpandedBodyIds] = useState<Record<string, boolean>>({});

  const counts = useMemo(
    () => ({
      all: history.length,
      sent: history.filter((h) => h.status === 'sent').length,
      failed: history.filter((h) => h.status === 'failed').length,
      pending: history.filter((h) => h.status === 'pending').length,
    }),
    [history],
  );

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return history.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.recipientName.toLowerCase().includes(q) ||
        row.recipientEmail.toLowerCase().includes(q) ||
        row.subject.toLowerCase().includes(q) ||
        (row.manuallyConfirmedByName || '').toLowerCase().includes(q)
      );
    });
  }, [history, statusFilter, searchQuery]);

  const filterButtons: Array<{ key: 'all' | HistoryDeliveryStatus; label: string; count: number }> = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'sent', label: 'Successfully Sent', count: counts.sent },
    { key: 'failed', label: 'Failed', count: counts.failed },
    { key: 'pending', label: 'Pending', count: counts.pending },
  ];

  const toggleBody = (id: string) => {
    setExpandedBodyIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <section className="wm-surface-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div
          role="tablist"
          aria-label="Filter email history by status"
          className="inline-flex flex-wrap items-center gap-1 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] p-1"
        >
          {filterButtons.map((btn) => {
            const active = statusFilter === btn.key;
            return (
              <button
                key={btn.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(btn.key)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                  active
                    ? 'bg-[#2d6a4f]/45 text-[color:var(--wm-ink)]'
                    : 'text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                }`}
              >
                {btn.label} ({btn.count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter recipient or subject..."
            aria-label="Filter email history"
            className="h-9 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
          />
        </div>
      </section>

      {/* History Table */}
      <section className="wm-surface-panel overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-10 text-center text-xs space-y-1.5">
            <p className="font-medium text-[color:var(--wm-ink)]">No email history entries match</p>
            <p className="text-[color:var(--wm-ink-muted)]">
              Try switching status filter or clearing the search query.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[10px] font-mono uppercase tracking-[0.12em] text-[color:var(--wm-ink-muted)]">
                    <th className="px-4 py-3 font-medium">Recipient</th>
                    <th className="px-3 py-3 font-medium">Type</th>
                    <th className="px-3 py-3 font-medium">Subject &amp; Details</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium text-right">Attempts</th>
                    <th className="px-3 py-3 font-medium text-right">Sent Date</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--wm-hairline)]">
                  {visible.map((row) => {
                    const meta = HISTORY_STATUS_META[row.status];
                    const StatusIcon = meta.Icon;
                    const isBodyOpen = Boolean(expandedBodyIds[row.id]);
                    const hasEmail = hasValidRecipientEmail(row.recipientEmail);

                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-[color:var(--wm-inset)]/60 transition-colors"
                      >
                        <td className="px-4 py-3.5 align-top">
                          <p className="font-medium text-[color:var(--wm-ink)]">
                            {row.recipientName}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-[color:var(--wm-ink-muted)]">
                            {row.recipientEmail || 'Missing email'}
                          </p>
                        </td>
                        <td className="px-3 py-3.5 align-top whitespace-nowrap">
                          <span className="capitalize text-[color:var(--wm-ink-secondary)]">
                            {row.emailType === 'accepted' ? 'Acceptance' : 'Rejection'}
                          </span>
                          <p className="mt-0.5 text-[10px] text-[color:var(--wm-ink-muted)]">
                            {row.department}
                          </p>
                        </td>
                        <td className="px-3 py-3.5 align-top max-w-md space-y-1.5">
                          <p className="text-[color:var(--wm-ink)] leading-snug">{row.subject}</p>
                          {row.deliveryMethod === 'manual_gmail' && (
                            <p className="text-[11px] text-emerald-200/85">
                              Manually marked successful via Gmail
                              {row.manuallyConfirmedByName
                                ? ` · Confirmed by ${row.manuallyConfirmedByName}`
                                : ''}
                            </p>
                          )}
                          {row.errorDetails && (
                            <p className="flex items-start gap-1.5 rounded border border-rose-400/20 bg-rose-500/[0.06] px-2.5 py-1.5 text-[11px] text-rose-200">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                              <span>{row.errorDetails}</span>
                            </p>
                          )}
                          {row.bodyText && row.bodyText.trim() && (
                            <div>
                              <button
                                type="button"
                                onClick={() => toggleBody(row.id)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] cursor-pointer"
                              >
                                {isBodyOpen ? (
                                  <>
                                    <ChevronUp className="h-3 w-3" aria-hidden="true" />
                                    <span>Hide original email</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                                    <span>View original email</span>
                                  </>
                                )}
                              </button>
                              {isBodyOpen && (
                                <pre className="mt-1.5 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] p-2.5 font-sans text-[11px] leading-relaxed text-[color:var(--wm-ink-secondary)]">
                                  {row.bodyText}
                                </pre>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3.5 align-top whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium ${meta.classes}`}
                          >
                            <StatusIcon className="h-3 w-3" aria-hidden="true" />
                            <span>{meta.label}</span>
                          </span>
                        </td>
                        <td className="px-3 py-3.5 align-top text-right font-mono tabular-nums text-[color:var(--wm-ink-secondary)]">
                          {row.attemptCount}
                        </td>
                        <td className="px-3 py-3.5 align-top text-right font-mono text-[11px] tabular-nums text-[color:var(--wm-ink-muted)] whitespace-nowrap">
                          {row.sentAt
                            ? new Date(row.sentAt).toLocaleString()
                            : 'Not sent'}
                        </td>
                        <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                          {row.status === 'failed' ? (
                            <div className="inline-flex items-center gap-1.5">
                              {onOpenFailedInGmail && (
                                <button
                                  type="button"
                                  disabled={!hasEmail}
                                  title={
                                    !hasEmail
                                      ? 'Disabled: recipient email address is missing'
                                      : 'Open prefilled email in Gmail'
                                  }
                                  onClick={() => onOpenFailedInGmail(row)}
                                  className="inline-flex h-7 items-center gap-1 rounded border border-emerald-400/30 bg-[#102b21] px-2.5 text-[11px] font-medium text-[#eef4ef] hover:bg-[#163a2c] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <Mail className="h-3 w-3" aria-hidden="true" />
                                  <span>Open in Gmail</span>
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={!hasEmail}
                                onClick={() => onRetryHistoryItem(row.id)}
                                className="inline-flex h-7 items-center gap-1 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-2.5 text-[11px] font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                              >
                                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                                <span>Retry</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[color:var(--wm-ink-muted)]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Card View */}
            <div className="divide-y divide-[color:var(--wm-hairline)] lg:hidden">
              {visible.map((row) => {
                const meta = HISTORY_STATUS_META[row.status];
                const StatusIcon = meta.Icon;
                const isBodyOpen = Boolean(expandedBodyIds[row.id]);
                const hasEmail = hasValidRecipientEmail(row.recipientEmail);

                return (
                  <article key={row.id} className="p-4 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-[color:var(--wm-ink)] truncate">
                          {row.recipientName}
                        </p>
                        <p className="font-mono text-[11px] text-[color:var(--wm-ink-muted)] truncate">
                          {row.recipientEmail || 'Missing email'}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium shrink-0 ${meta.classes}`}
                      >
                        <StatusIcon className="h-3 w-3" aria-hidden="true" />
                        <span>{meta.label}</span>
                      </span>
                    </div>
                    <p className="text-[color:var(--wm-ink)]">{row.subject}</p>
                    {row.deliveryMethod === 'manual_gmail' && (
                      <p className="text-[11px] text-emerald-200/85">
                        Manually marked successful via Gmail
                        {row.manuallyConfirmedByName
                          ? ` · Confirmed by ${row.manuallyConfirmedByName}`
                          : ''}
                      </p>
                    )}
                    <p className="text-[11px] text-[color:var(--wm-ink-muted)] tabular-nums">
                      {row.emailType === 'accepted' ? 'Acceptance' : 'Rejection'} · {row.department} ·
                      Attempts: {row.attemptCount} ·{' '}
                      {row.sentAt ? new Date(row.sentAt).toLocaleString() : 'Not sent'}
                    </p>
                    {row.errorDetails && (
                      <p className="rounded border border-rose-400/20 bg-rose-500/[0.06] px-2.5 py-1.5 text-[11px] text-rose-200">
                        {row.errorDetails}
                      </p>
                    )}
                    {row.bodyText && row.bodyText.trim() && (
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleBody(row.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] cursor-pointer"
                        >
                          {isBodyOpen ? (
                            <>
                              <ChevronUp className="h-3 w-3" aria-hidden="true" />
                              <span>Hide original email</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" aria-hidden="true" />
                              <span>View original email</span>
                            </>
                          )}
                        </button>
                        {isBodyOpen && (
                          <pre className="mt-1.5 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] p-2.5 font-sans text-[11px] leading-relaxed text-[color:var(--wm-ink-secondary)]">
                            {row.bodyText}
                          </pre>
                        )}
                      </div>
                    )}
                    {row.status === 'failed' && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {onOpenFailedInGmail && (
                          <button
                            type="button"
                            disabled={!hasEmail}
                            title={
                              !hasEmail
                                ? 'Disabled: recipient email address is missing'
                                : 'Open prefilled email in Gmail'
                            }
                            onClick={() => onOpenFailedInGmail(row)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-[#102b21] px-3 text-[11px] font-semibold text-[#eef4ef] hover:bg-[#163a2c] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Mail className="h-3 w-3" aria-hidden="true" />
                            <span>Open in Gmail</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={!hasEmail}
                          onClick={() => onRetryHistoryItem(row.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[color:var(--wm-hairline-strong)] px-3 text-[11px] font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <RefreshCw className="h-3 w-3" aria-hidden="true" />
                          <span>Retry Email</span>
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
