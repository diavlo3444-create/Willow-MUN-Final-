import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  RefreshCw,
  Search,
} from 'lucide-react';
import { hasValidRecipientEmail } from '../../../../utils/failedEmails';
import type { EmailDecisionType, FailedEmailRecord } from './types';

interface FailedToSendTabProps {
  failedRecords: FailedEmailRecord[];
  canDispatch: boolean;
  retryingKey: string | null;
  openingGmailKey: string | null;
  markingSentKey: string | null;
  onOpenInGmail: (record: FailedEmailRecord) => void;
  onRequestMarkAsSent: (record: FailedEmailRecord) => void;
  onRetryFailedEmail: (record: FailedEmailRecord) => void;
}

export function FailedToSendTab({
  failedRecords,
  canDispatch,
  retryingKey,
  openingGmailKey,
  markingSentKey,
  onOpenInGmail,
  onRequestMarkAsSent,
  onRetryFailedEmail,
}: FailedToSendTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | EmailDecisionType>('all');
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const counts = useMemo(
    () => ({
      all: failedRecords.length,
      accepted: failedRecords.filter((r) => r.emailType === 'accepted').length,
      rejected: failedRecords.filter((r) => r.emailType === 'rejected').length,
    }),
    [failedRecords],
  );

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return failedRecords.filter((item) => {
      if (typeFilter !== 'all' && item.emailType !== typeFilter) return false;
      if (!q) return true;
      return (
        item.recipientName.toLowerCase().includes(q) ||
        item.recipientEmail.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q) ||
        item.department.toLowerCase().includes(q) ||
        item.errorDetails.toLowerCase().includes(q)
      );
    });
  }, [failedRecords, searchQuery, typeFilter]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4">
      {/* Filter & Search Bar */}
      <section className="wm-surface-panel flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
        <div
          role="tablist"
          aria-label="Filter failed emails by message type"
          className="flex flex-wrap items-center gap-1.5"
        >
          {(
            [
              { key: 'all', label: 'All Failed', count: counts.all },
              { key: 'accepted', label: 'Acceptance', count: counts.accepted },
              { key: 'rejected', label: 'Rejection', count: counts.rejected },
            ] as const
          ).map((btn) => {
            const active = typeFilter === btn.key;
            return (
              <button
                key={btn.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTypeFilter(btn.key)}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                  active
                    ? 'border border-rose-400/30 bg-rose-500/[0.18] font-semibold text-rose-100'
                    : 'border border-transparent text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                }`}
              >
                {btn.label} ({btn.count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-80">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipient, subject, or error..."
            aria-label="Search failed emails"
            className="h-10 w-full rounded-lg border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
          />
        </div>
      </section>

      {/* Failed Records List */}
      <section className="wm-surface-panel rounded-xl p-4">
        {visible.length === 0 ? (
          <div className="py-10 px-4 text-center text-xs space-y-2">
            <Mail className="mx-auto h-7 w-7 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
            <p className="font-medium text-[color:var(--wm-ink)]">
              {failedRecords.length === 0
                ? 'No failed emails right now'
                : 'No failed emails match your filter'}
            </p>
            <p className="text-[color:var(--wm-ink-muted)]">
              {failedRecords.length === 0
                ? 'Any delivery that fails or returns an unconfirmed response will appear here so you can open it in Gmail, retry, or confirm manual delivery.'
                : 'Clear the search query or switch message type to see all failed deliveries.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((record) => {
              const isExpanded = Boolean(expandedKeys[record.key]);
              const isRetrying = retryingKey === record.key;
              const isOpeningGmail = openingGmailKey === record.key;
              const isMarkingSent = markingSentKey === record.key;
              const hasEmail = hasValidRecipientEmail(record.recipientEmail);
              const missingEmailReason =
                'Recipient email address is missing on this application — Open in Gmail is disabled until an email address is provided.';
              const formattedDate = record.lastAttemptAt
                ? new Date(record.lastAttemptAt).toLocaleString()
                : 'Recent attempt';

              return (
                <article
                  key={record.key}
                  aria-label={`Failed email for ${record.recipientName}`}
                  className="rounded-xl border border-rose-500/25 bg-rose-950/[0.22] px-5 py-4 transition-colors hover:border-rose-400/35"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Recipient Name */}
                      <h3 className="text-base font-semibold text-[color:var(--wm-ink)] leading-snug">
                        {record.recipientName}
                      </h3>

                      {/* Email · Original Subject */}
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                        {hasEmail ? (
                          <span className="font-mono text-[color:var(--wm-ink-secondary)] break-all">
                            {record.recipientEmail}
                          </span>
                        ) : (
                          <span className="font-mono font-medium text-rose-300">
                            Missing email address
                          </span>
                        )}
                        <span aria-hidden="true" className="text-[color:var(--wm-ink-muted)]">
                          ·
                        </span>
                        <span className="font-mono text-[color:var(--wm-ink-secondary)] break-words">
                          {record.subject}
                        </span>
                      </div>

                      {/* Failure Error Summary */}
                      <p className="text-xs text-rose-300/90 leading-relaxed break-words">
                        {record.errorDetails}
                      </p>

                      {!hasEmail && (
                        <p className="flex items-start gap-1.5 text-[11px] text-rose-200/90">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" aria-hidden="true" />
                          <span>{missingEmailReason}</span>
                        </p>
                      )}

                      {/* Quiet Metadata + Body Preview Toggle */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-[11px] text-[color:var(--wm-ink-muted)] tabular-nums">
                        <span>{record.department}</span>
                        <span aria-hidden="true">·</span>
                        <span>{record.emailType === 'accepted' ? 'Acceptance' : 'Rejection'}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {record.attemptCount} attempt{record.attemptCount === 1 ? '' : 's'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formattedDate}</span>
                        {record.manualDraftOpenedAt && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-200">
                              Opened in Gmail at{' '}
                              {new Date(record.manualDraftOpenedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() => toggleExpand(record.key)}
                          className="inline-flex items-center gap-1 font-medium text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] cursor-pointer"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3" aria-hidden="true" />
                              <span>Hide email body</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" aria-hidden="true" />
                              <span>Preview email body</span>
                            </>
                          )}
                        </button>
                      </div>

                      {isExpanded && (
                        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)]/90 p-3.5 font-sans text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
                          {record.bodyText}
                        </pre>
                      )}
                    </div>

                    {/* Right Cluster: Failed to Send tag + Open in Gmail + Mark as Sent + Retry */}
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <span className="inline-flex items-center rounded-full border border-rose-400/25 bg-rose-500/[0.15] px-3 py-1 text-xs font-medium text-rose-200 whitespace-nowrap">
                        Failed to Send
                      </span>

                      <button
                        type="button"
                        disabled={!hasEmail || isOpeningGmail || isMarkingSent}
                        title={
                          !hasEmail
                            ? missingEmailReason
                            : 'Open prefilled email in Gmail (new tab)'
                        }
                        onClick={() => onOpenInGmail(record)}
                        className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-emerald-400/35 bg-[#102b21] px-4 py-2 text-xs font-semibold text-[#edf5f0] hover:bg-[#163a2c] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap"
                      >
                        {isOpeningGmail ? (
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
                        ) : (
                          <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                        )}
                        <span>{isOpeningGmail ? 'Preparing Gmail…' : 'Open in Gmail'}</span>
                      </button>

                      {canDispatch && (
                        <>
                          <button
                            type="button"
                            disabled={!hasEmail || isMarkingSent || isOpeningGmail || isRetrying}
                            title={
                              !hasEmail
                                ? missingEmailReason
                                : 'Confirm you sent this email manually via Gmail'
                            }
                            onClick={() => onRequestMarkAsSent(record)}
                            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3.5 py-2 text-xs font-semibold text-[color:var(--wm-ink)] hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-emerald-100 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap"
                          >
                            {isMarkingSent ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
                            )}
                            <span>{isMarkingSent ? 'Saving…' : 'Mark as Sent'}</span>
                          </button>

                          <button
                            type="button"
                            disabled={!hasEmail || isRetrying || isOpeningGmail || isMarkingSent}
                            title={
                              !hasEmail
                                ? missingEmailReason
                                : 'Retry automated email delivery'
                            }
                            onClick={() => onRetryFailedEmail(record)}
                            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-[color:var(--wm-hairline-strong)] bg-transparent px-3 py-2 text-xs font-medium text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-overlay)] hover:text-[color:var(--wm-ink)] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <RefreshCw
                              className={`h-3.5 w-3.5 shrink-0 ${isRetrying ? 'animate-spin' : ''}`}
                              aria-hidden="true"
                            />
                            <span>{isRetrying ? 'Retrying…' : 'Retry'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
