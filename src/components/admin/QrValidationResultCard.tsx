import {
  AlertTriangle,
  CheckCircle2,
  ScanLine,
  X,
  XCircle,
} from 'lucide-react';
import type { LiveQrValidationResponse } from '../../services/liveBackendService';
import {
  classifyQrScanOutcome,
  formatAttendanceDateTime,
} from '../../utils/qrAttendance';

interface QrValidationResultCardProps {
  validation: LiveQrValidationResponse | null;
  requestError?: string;
  onDismiss?: () => void;
}

export function QrValidationResultCard({
  validation,
  requestError = '',
  onDismiss,
}: QrValidationResultCardProps) {
  const feedback = classifyQrScanOutcome(validation, requestError);

  if (feedback.kind === 'idle') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[156px] flex-col items-center justify-center rounded-lg border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-5 py-6 text-center"
      >
        <ScanLine className="h-7 w-7 text-[color:var(--wm-accent)]" aria-hidden="true" />
        <p className="mt-2.5 text-sm font-semibold text-[color:var(--wm-ink)]">
          Ready to Scan
        </p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-[color:var(--wm-ink-muted)]">
          Scan a Willow MUN QR pass using the selected Check In or Check Out mode.
        </p>
      </div>
    );
  }

  const isSuccess = feedback.kind === 'checked_in' || feedback.kind === 'checked_out';
  const isCheckout = feedback.kind === 'checked_out';
  const isDuplicate = feedback.kind === 'already_checked_in';

  const containerStyle = isSuccess
    ? 'border-emerald-400/55 bg-emerald-950/45'
    : isDuplicate
      ? 'border-amber-400/75 bg-amber-950/55'
      : 'border-rose-400/60 bg-rose-950/45';

  const labelColor = isSuccess
    ? 'text-emerald-200'
    : isDuplicate
      ? 'text-amber-200'
      : 'text-rose-200';

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      aria-live={isDuplicate || !isSuccess ? 'assertive' : 'polite'}
      data-scan-outcome={feedback.kind}
      className={`rounded-lg border p-4 sm:p-5 transition-colors ${containerStyle}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {isSuccess ? (
            <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-300" aria-hidden="true" />
          ) : isDuplicate ? (
            <AlertTriangle className="mt-0.5 h-7 w-7 shrink-0 text-amber-300" aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 h-7 w-7 shrink-0 text-rose-300" aria-hidden="true" />
          )}

          <div>
            <p className={`font-mono text-xs font-bold uppercase tracking-[0.16em] ${labelColor}`}>
              {feedback.headline}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
              {feedback.message}
            </p>
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Clear scan result"
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md border border-white/15 bg-black/25 text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {feedback.fullName && (
        <div className="mt-4 grid gap-2.5 border-t border-white/10 pt-3.5 sm:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-black/25 px-3.5 py-2.5 sm:col-span-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
              Full Name
            </p>
            <p className="wm-serif mt-0.5 text-xl font-semibold text-[color:var(--wm-ink)]">
              {feedback.fullName}
            </p>
          </div>

          <div className="rounded-md border border-white/10 bg-black/25 px-3.5 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
              Role
            </p>
            <p className="mt-0.5 text-xs font-medium text-[color:var(--wm-ink)]">
              {feedback.roleLabel || 'Participant'}
              {feedback.departmentOrCommittee ? ` · ${feedback.departmentOrCommittee}` : ''}
            </p>
          </div>

          <div className="rounded-md border border-white/10 bg-black/25 px-3.5 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
              {isCheckout ? 'Checked Out At' : isDuplicate ? 'Original Check-In Time' : 'Checked In At'}
            </p>
            <p
              className={`mt-0.5 font-mono text-xs font-semibold tabular-nums ${
                isDuplicate ? 'text-amber-200' : 'text-[color:var(--wm-ink)]'
              }`}
            >
              {isDuplicate
                ? formatAttendanceDateTime(feedback.originalCheckedInAt)
                : formatAttendanceDateTime(feedback.checkedInAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
