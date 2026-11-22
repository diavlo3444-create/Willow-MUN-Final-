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
  idleSubtitle?: string;
}

export function QrValidationResultCard({
  validation,
  requestError = '',
  onDismiss,
  idleSubtitle = 'Point the camera at a Willow MUN QR code to verify validity, department, and check-in status.',
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
          {idleSubtitle}
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

  const checkInTimestamp = isDuplicate
    ? formatAttendanceDateTime(feedback.originalCheckedInAt)
    : feedback.checkedInAt
      ? formatAttendanceDateTime(feedback.checkedInAt)
      : null;

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

      <div className="mt-4 grid gap-2.5 border-t border-white/10 pt-3.5 sm:grid-cols-2">
        <div className="rounded-md border border-white/10 bg-black/25 px-3.5 py-2.5 sm:col-span-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
            Member Name
          </p>
          <p className="wm-serif mt-0.5 text-xl font-semibold text-[color:var(--wm-ink)]">
            {feedback.fullName || 'Unrecognized QR Pass'}
          </p>
        </div>

        <div className="rounded-md border border-white/10 bg-black/25 px-3.5 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
            Assigned Department
          </p>
          <p className="mt-0.5 text-xs font-semibold text-[color:var(--wm-ink)]">
            {feedback.departmentName || (feedback.fullName ? 'Unassigned' : '—')}
          </p>
        </div>

        <div className="rounded-md border border-white/10 bg-black/25 px-3.5 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
            QR Code Validity
          </p>
          <p
            className={`mt-0.5 text-xs font-semibold ${
              feedback.isValid === true
                ? 'text-emerald-200'
                : feedback.isValid === false
                  ? 'text-rose-200'
                  : 'text-[color:var(--wm-ink)]'
            }`}
          >
            {feedback.validityLabel || 'Verification Error'}
          </p>
        </div>

        <div className="rounded-md border border-white/10 bg-black/25 px-3.5 py-2.5 sm:col-span-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
            {isCheckout ? 'Check-Out Status' : 'Check-In Status'}
          </p>
          <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-2">
            <span
              className={`text-xs font-semibold ${
                isDuplicate
                  ? 'text-amber-200'
                  : isSuccess
                    ? 'text-emerald-200'
                    : 'text-rose-200'
              }`}
            >
              {feedback.alreadyCheckedIn
                ? 'Already Checked In'
                : feedback.checkInStatusLabel || 'Not Checked In'}
            </span>
            {checkInTimestamp && (
              <span className="font-mono text-[11px] tabular-nums text-[color:var(--wm-ink-secondary)]">
                {checkInTimestamp}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
