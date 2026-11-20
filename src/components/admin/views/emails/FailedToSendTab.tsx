import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import type { EmailDecisionType, FailedEmailRecord } from './types';

interface FailedToSendTabProps {
  failedRecords: FailedEmailRecord[];
  canDispatch: boolean;
  retryingKey: string | null;
  openingGmailKey: string | null;
  onOpenInGmail: (record: FailedEmailRecord) => void;
  onRetryFailedEmail: (record: FailedEmailRecord) => void;
}

export function FailedToSendTab({
  failedRecords,
  canDispatch,
  retryingKey,
  openingGmailKey,
  onOpenInGmail,
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
      {/* Failed Summary Strip */}
      <section className="wm-surface-panel overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-[color:var(--wm-hairline)] tabular-nums">
          <div className="px-4 py-3.5 sm:px-5">
            <p className="wm-section-kicker text-[10px]">Failed to Send</p>
            <p className="wm-serif mt-1 text-2xl text-rose-200">{counts.all}</p>
          </div>
          <div className="px-4 py-3.5 sm:px-5">
            <p className="wm-section-kicker text-[10px]">Acceptance Failed</p>
            <p className="wm-serif mt-1 text-2xl text-[color:var(--wm-ink)]">
              {counts.accepted}
            </p>
          </div>
          <div className="px-4 py-3.5 sm:px-5">
            <p className="wm-section-kicker text-[10px]">Rejection Failed</p>
            <p className="wm-serif mt-1 text-2xl text-[color:var(--wm-ink)]">
              {counts.rejected}
            </p>
          </div>
        </div>
        <div className="border-t border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)]/60 px-4 py-2.5 text-[11px] text-[color:var(--wm-ink-secondary)] sm:px-5">
          Click any failed email or select <strong className="text-[color:var(--wm-ink)]">Open in Gmail &amp; Send Manually</strong> to compose in Gmail with the recipient, subject, and full body prefilled. Records remain <strong className="text-rose-200">Failed to Send</strong> until retried and confirmed sent.
        </div>
      </section>

      {/* Filter & Search Bar */}
      <section className="wm-surface-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div
          role="tablist"
          aria-label="Filter failed emails by message type"
          className="inline-flex flex-wrap items-center gap-1 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] p-1"
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
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                  active
                    ? 'bg-rose-500/20 text-rose-100 border border-rose-400/30'
                    : 'text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                }`}
              >
                {btn.label} ({btn.count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
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
            className="h-9 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
          />
        </div>
      </section>

      {/* Failed Records List */}
      <section className="wm-surface-panel overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-10 text-center text-xs space-y-2">
            <Mail className="mx-auto h-7 w-7 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
            <p className="font-medium text-[color:var(--wm-ink)]">
              {failedRecords.length === 0
                ? 'No failed emails right now'
                : 'No failed emails match your filter'}
            </p>
            <p className="text-[color:var(--wm-ink-muted)]">
              {failedRecords.length === 0
                ? 'Any delivery that fails or returns an unconfirmed response will automatically be captured here for Gmail fallback or retry.'
                : 'Clear the search query or switch message type to see all failed deliveries.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--wm-hairline)]">
            {visible.map((record) => {
              const isExpanded = Boolean(expandedKeys[record.key]);
              const isRetrying = retryingKey === record.key;
              const isOpeningGmail = openingGmailKey === record.key;
              const formattedDate = record.lastAttemptAt
                ? new Date(record.lastAttemptAt).toLocaleString()
                : 'Recent attempt';

              return (
                <article
                  key={record.key}
                  onClick={() => onOpenInGmail(record)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenInGmail(record);
                    }
                  }}
                  aria-label={`Open failed email to ${record.recipientEmail} in Gmail`}
                  className="group cursor-pointer p-4 sm:p-5 transition-colors hover:bg-[color:var(--wm-inset)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--wm-accent)]"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      {/* Header line: Recipient + Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded border border-rose-400/35 bg-rose-500/[0.12] px-2 py-0.5 text-[11px] font-semibold text-rose-200">
                          <XCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>Failed to Send</span>
                        </span>

                        <span className="rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--wm-ink-secondary)]">
                          {record.emailType === 'accepted' ? 'Acceptance Email' : 'Rejection Email'}
                        </span>

                        <span className="text-[11px] font-mono tabular-nums text-[color:var(--wm-ink-muted)]">
                          {record.attemptCount} attempt{record.attemptCount === 1 ? '' : 's'}
                        </span>

                        {record.manualDraftOpenedAt && (
                          <span className="rounded border border-amber-400/25 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] text-amber-200">
                            Opened in Gmail · {new Date(record.manualDraftOpenedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      {/* Recipient Name + Email + Department + Date */}
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <h3 className="text-sm font-semibold text-[color:var(--wm-ink)] group-hover:text-[color:var(--wm-accent)] transition-colors">
                          {record.recipientName}
                        </h3>
                        <span className="font-mono text-xs text-[color:var(--wm-accent)] break-all">
                          {record.recipientEmail}
                        </span>
                        <span className="text-[11px] text-[color:var(--wm-ink-muted)]">
                          · {record.department} · {formattedDate}
                        </span>
                      </div>

                      {/* Original Subject */}
                      <p className="text-xs font-medium text-[color:var(--wm-ink)] leading-snug">
                        <span className="text-[color:var(--wm-ink-muted)] font-normal">Subject: </span>
                        {record.subject}
                      </p>

                      {/* Failure Reason */}
                      <div className="flex items-start gap-2 rounded-md border border-rose-400/25 bg-rose-500/[0.07] px-3 py-2 text-[11px] text-rose-100">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" aria-hidden="true" />
                        <span className="break-words">{record.errorDetails}</span>
                      </div>

                      {/* Expandable Original Body Preview */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleExpand(record.key)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] cursor-pointer py-1"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Hide original message body</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Preview full message body</span>
                            </>
                          )}
                        </button>

                        {isExpanded && (
                          <pre className="mt-1.5 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)] p-3 font-sans text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
                            {record.bodyText}
                          </pre>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div
                      className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 pt-1 lg:pt-0 lg:w-52"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={isOpeningGmail}
                        onClick={() => onOpenInGmail(record)}
                        className="inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-md bg-[color:var(--wm-emerald)] px-3.5 py-2 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] disabled:opacity-50 cursor-pointer transition-colors"
                      >
                        {isOpeningGmail ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        )}
                        <span>
                          {isOpeningGmail ? 'Preparing Gmail…' : 'Open in Gmail & Send Manually'}
                        </span>
                      </button>

                      {canDispatch && (
                        <button
                          type="button"
                          disabled={isRetrying || isOpeningGmail}
                          onClick={() => onRetryFailedEmail(record)}
                          className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-1.5 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 shrink-0 ${isRetrying ? 'animate-spin' : ''}`}
                            aria-hidden="true"
                          />
                          <span>{isRetrying ? 'Retrying Send…' : 'Retry Send'}</span>
                        </button>
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
