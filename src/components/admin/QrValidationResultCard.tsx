import {
  AlertOctagon,
  Ban,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  XCircle,
} from 'lucide-react';
import type { LiveQrValidationResponse } from '../../services/liveBackendService';

interface QrValidationResultCardProps {
  validation: LiveQrValidationResponse | null;
  busy?: boolean;
  variant?: 'security' | 'admin';
  onConfirmCheckin?: () => void;
  onResetResult?: () => void;
  onOpenCorrection?: (passId: string) => void;
}

export function QrValidationResultCard({
  validation,
  busy = false,
  variant = 'security',
  onConfirmCheckin,
  onResetResult,
  onOpenCorrection,
}: QrValidationResultCardProps) {
  if (!validation) {
    return (
      <div className="wm-surface-inset flex min-h-[260px] flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="h-9 w-9 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-[color:var(--wm-ink)]">
          Ready for Next Pass
        </p>
        <p className="mt-1 max-w-xs text-xs text-[color:var(--wm-ink-muted)]">
          Point the camera at a Willow MUN QR credential or enter the pass code to validate entry.
        </p>
      </div>
    );
  }

  const isValidConfirmed = validation.status === 'valid' && validation.committed;
  const isValidAwaitingConfirm = validation.status === 'valid' && !validation.committed;
  const isAlready = validation.status === 'already_checked_in';
  const isRevoked = validation.status === 'revoked';
  const isNotEligible = validation.status === 'not_eligible';

  const frameClass =
    isValidConfirmed || isValidAwaitingConfirm
      ? 'border-emerald-400/50 bg-emerald-950/35'
      : isAlready
        ? 'border-amber-400/55 bg-amber-950/35'
        : 'border-rose-400/55 bg-rose-950/40';

  const badgeClass =
    isValidConfirmed || isValidAwaitingConfirm
      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
      : isAlready
        ? 'border-amber-400/45 bg-amber-500/15 text-amber-200'
        : 'border-rose-400/45 bg-rose-500/15 text-rose-200';

  const headline = isValidConfirmed
    ? 'VALID · CHECKED IN'
    : isValidAwaitingConfirm
      ? 'VALID PASS · CONFIRM ENTRY'
      : isAlready
        ? 'ALREADY CHECKED IN'
        : isRevoked
          ? 'REVOKED PASS'
          : isNotEligible
            ? 'NOT ELIGIBLE'
            : 'INVALID QR PASS';

  const subHeadline =
    validation.message ||
    (isValidConfirmed
      ? 'Entry recorded in conference attendance.'
      : isValidAwaitingConfirm
        ? 'Verified against conference records. Confirm to complete check-in.'
        : isAlready
          ? 'This pass has already been used. Do not create another check-in.'
          : isRevoked
            ? 'This credential has been deactivated by an administrator.'
            : isNotEligible
              ? 'Applicant does not hold an accepted or active conference credential.'
              : 'Code does not match any issued Willow MUN pass.');

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-lg border p-5 transition-colors ${frameClass}`}
    >
      {/* Large, unmistakable banner */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          {isValidConfirmed || isValidAwaitingConfirm ? (
            <CheckCircle2 className="h-9 w-9 shrink-0 text-emerald-300" aria-hidden="true" />
          ) : isAlready ? (
            <Clock className="h-9 w-9 shrink-0 text-amber-300" aria-hidden="true" />
          ) : isRevoked ? (
            <Ban className="h-9 w-9 shrink-0 text-rose-300" aria-hidden="true" />
          ) : isNotEligible ? (
            <AlertOctagon className="h-9 w-9 shrink-0 text-rose-300" aria-hidden="true" />
          ) : (
            <XCircle className="h-9 w-9 shrink-0 text-rose-300" aria-hidden="true" />
          )}
          <div>
            <span
              className={`inline-block rounded border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.16em] ${badgeClass}`}
            >
              {headline}
            </span>
            <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
              {subHeadline}
            </p>
          </div>
        </div>

        {onResetResult && (
          <button
            type="button"
            onClick={onResetResult}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/15 bg-black/25 px-2.5 text-[11px] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Next Scan
          </button>
        )}
      </div>

      {/* Verification Fields */}
      {validation.status !== 'invalid' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-black/25 px-3.5 py-2.5 sm:col-span-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
              Attendee Name
            </p>
            <p className="wm-serif mt-0.5 text-xl font-semibold text-[color:var(--wm-ink)]">
              {validation.holder_name || 'Unlisted Holder'}
            </p>
          </div>

          <div className="rounded-md border border-white/10 bg-black/25 px-3.5 py-2.5">
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
              Registration / ID
            </p>
            <p className="mt-0.5 font-mono text-xs font-semibold text-[#ede6ca]">
              {validation.application_code || (validation.pass_id ? `PASS-${validation.pass_id.slice(0, 8).toUpperCase()}` : 'Staff Pass')}
            </p>
          </div>

          <div className="rounded-md border border-white/10 bg-black/25 px-3.5 py-2.5">
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
              Role & Category
            </p>
            <p className="mt-0.5 text-xs font-medium text-[color:var(--wm-ink)]">
              {validation.role_label || 'Participant'}
              {validation.category ? ` · ${validation.category}` : ''}
            </p>
          </div>

          {(validation.committee_name || validation.department_name) && (
            <div className="rounded-md border border-white/10 bg-black/25 px-3.5 py-2.5">
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
                {validation.committee_name ? 'Committee' : 'Department'}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[color:var(--wm-ink)]">
                {validation.committee_name || validation.department_name}
              </p>
            </div>
          )}

          <div className="rounded-md border border-white/10 bg-black/25 px-3.5 py-2.5">
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
              {isAlready ? 'Previous Check-In Time' : isValidConfirmed ? 'Checked In At' : 'Checkpoint'}
            </p>
            <p className="mt-0.5 text-xs font-medium text-[color:var(--wm-ink)]">
              {isAlready || isValidConfirmed
                ? `${formatDate(validation.checked_in_at)} · ${validation.checked_in_gate || validation.gate_location}`
                : validation.gate_location}
            </p>
          </div>

          {variant === 'admin' && validation.application_status && (
            <div className="rounded-md border border-white/10 bg-black/25 px-3.5 py-2.5">
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
                Application Status
              </p>
              <p className="mt-0.5 font-mono text-xs uppercase text-[color:var(--wm-focal)]">
                {validation.application_status}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Confirmation CTA when in verify-first mode */}
      {isValidAwaitingConfirm && onConfirmCheckin && (
        <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-white/10 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirmCheckin}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
          >
            <UserCheck className="h-4 w-4" aria-hidden="true" />
            {busy ? 'Recording Check-In…' : 'Confirm Entry & Check In'}
          </button>
        </div>
      )}

      {/* Admin quick correction action */}
      {variant === 'admin' && validation.pass_id && onOpenCorrection && (
        <div className="mt-4 flex flex-wrap justify-end border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => onOpenCorrection(validation.pass_id as string)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/20 bg-black/25 px-3 text-[11px] font-medium text-[#ede6ca] hover:bg-black/45"
          >
            Manage / Correct Check-In Record
          </button>
        </div>
      )}
    </div>
  );
}
