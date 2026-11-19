import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { EmailQueueItem, QueueItemStatus } from './types';

interface SendingQueueTabProps {
  queue: EmailQueueItem[];
  simulationRunning: boolean;
  onStartSimulation: () => void;
  onPauseSimulation: () => void;
  onRetryItem: (queueId: string) => void;
  onRemoveItem: (queueId: string) => void;
  onClearCompleted: () => void;
}

const QUEUE_STATUS_META: Record<
  QueueItemStatus,
  { label: string; classes: string; Icon: typeof Clock3 }
> = {
  waiting: {
    label: 'Waiting to send',
    classes: 'border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] text-[color:var(--wm-ink-secondary)]',
    Icon: Clock3,
  },
  processing: {
    label: 'Processing',
    classes: 'border-amber-400/35 bg-amber-500/[0.1] text-amber-200',
    Icon: Loader2,
  },
  sent: {
    label: 'Staged / Sent (Preview)',
    classes: 'border-emerald-400/30 bg-emerald-500/[0.1] text-emerald-200',
    Icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    classes: 'border-rose-400/30 bg-rose-500/[0.1] text-rose-200',
    Icon: XCircle,
  },
};

export function SendingQueueTab({
  queue,
  simulationRunning,
  onStartSimulation,
  onPauseSimulation,
  onRetryItem,
  onRemoveItem,
  onClearCompleted,
}: SendingQueueTabProps) {
  const waitingCount = queue.filter((q) => q.status === 'waiting').length;
  const processingCount = queue.filter((q) => q.status === 'processing').length;
  const sentCount = queue.filter((q) => q.status === 'sent').length;
  const failedCount = queue.filter((q) => q.status === 'failed').length;

  const totalCount = queue.length;
  const processedCount = sentCount + failedCount;
  const progressPct = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Queue Status Strip */}
      <section className="wm-surface-panel overflow-hidden">
        <div className="grid grid-cols-2 divide-y sm:grid-cols-4 sm:divide-x sm:divide-y-0 divide-[color:var(--wm-hairline)] tabular-nums">
          <div className="px-5 py-4">
            <p className="wm-section-kicker">Waiting to Send</p>
            <p className="wm-serif mt-1.5 text-2xl text-[color:var(--wm-ink)]">{waitingCount}</p>
          </div>
          <div className="px-5 py-4">
            <p className="wm-section-kicker">Currently Processing</p>
            <p className="wm-serif mt-1.5 text-2xl text-amber-200">{processingCount}</p>
          </div>
          <div className="px-5 py-4">
            <p className="wm-section-kicker">Completed (Preview)</p>
            <p className="wm-serif mt-1.5 text-2xl text-emerald-200">{sentCount}</p>
          </div>
          <div className="px-5 py-4">
            <p className="wm-section-kicker">Failed</p>
            <p className="wm-serif mt-1.5 text-2xl text-rose-200">{failedCount}</p>
          </div>
        </div>

        {/* Bulk Progress Indicator */}
        <div className="border-t border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)]/60 px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[color:var(--wm-ink)]">
                Bulk Queue Progress
              </p>
              <p className="text-[11px] text-[color:var(--wm-ink-muted)]">
                UI preview only — backend mail delivery is not connected, so no actual emails are sent.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {simulationRunning ? (
                <button
                  type="button"
                  onClick={onPauseSimulation}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-500/[0.12] px-3 text-[11px] font-medium text-amber-100 hover:bg-amber-500/[0.2] cursor-pointer"
                >
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Pause UI Preview</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={waitingCount === 0}
                  onClick={onStartSimulation}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[color:var(--wm-emerald)] px-3 text-[11px] font-semibold text-[#eef4ef] hover:bg-[#357a5b] disabled:opacity-40 cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Preview Queue Run ({waitingCount})</span>
                </button>
              )}

              <button
                type="button"
                disabled={sentCount === 0}
                onClick={onClearCompleted}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] px-3 text-[11px] text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-overlay)] hover:text-[color:var(--wm-ink)] disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear Completed</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--wm-canvas)]">
              <div
                className="h-full rounded-full bg-[color:var(--wm-accent)] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-[color:var(--wm-ink-muted)] tabular-nums">
              <span>
                {processedCount} of {totalCount} queued item{totalCount === 1 ? '' : 's'} processed
              </span>
              <span>{progressPct}%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Queue List */}
      <section className="wm-surface-panel overflow-hidden">
        <div className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-5 py-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold text-[color:var(--wm-ink)]">
            Staged Sending Queue
          </h2>
          <span className="font-mono text-[11px] text-[color:var(--wm-ink-muted)] tabular-nums">
            {totalCount} item{totalCount === 1 ? '' : 's'}
          </span>
        </div>

        {queue.length === 0 ? (
          <div className="p-10 text-center text-xs space-y-1.5">
            <p className="font-medium text-[color:var(--wm-ink)]">Queue is empty</p>
            <p className="text-[color:var(--wm-ink-muted)]">
              Use Send All Acceptance, Send All Rejection, or Send Selected from the Applicants tab to stage emails here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--wm-hairline)]">
            {queue.map((item) => {
              const meta = QUEUE_STATUS_META[item.status];
              const StatusIcon = meta.Icon;
              return (
                <article
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5 text-xs"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[color:var(--wm-ink)]">
                        {item.recipientName}
                      </span>
                      <span className="font-mono text-[11px] text-[color:var(--wm-ink-muted)]">
                        {item.recipientEmail}
                      </span>
                      <span className="text-[11px] text-[color:var(--wm-ink-secondary)]">
                        · {item.department}
                      </span>
                    </div>
                    <p className="text-[color:var(--wm-accent)]">
                      {item.subject} ·{' '}
                      <span className="capitalize">{item.emailType}</span>
                    </p>
                    {item.errorDetails && (
                      <p className="flex items-center gap-1.5 text-[11px] text-rose-200">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{item.errorDetails}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-medium ${meta.classes}`}
                    >
                      <StatusIcon
                        className={`h-3 w-3 ${item.status === 'processing' ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      <span>{meta.label}</span>
                    </span>

                    {item.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => onRetryItem(item.id)}
                        className="inline-flex h-7 items-center gap-1 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-[11px] text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                        <span>Re-queue</span>
                      </button>
                    )}

                    {item.status === 'waiting' && (
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        aria-label={`Remove ${item.recipientName} from queue`}
                        className="inline-flex h-7 items-center justify-center rounded border border-[color:var(--wm-hairline)] px-2 text-[11px] text-[color:var(--wm-ink-muted)] hover:border-rose-400/40 hover:text-rose-200 cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
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
