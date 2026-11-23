import { useEffect, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import type { Application, ApplicationStatus } from '../../types/admin';

const MIN_OVERRIDE_REASON_LENGTH = 8;

interface OverrideDecisionModalProps {
  application: Pick<Application, 'id' | 'applicantName' | 'applicationCode' | 'status'> | null;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (applicationId: string, nextStatus: ApplicationStatus, reason: string) => Promise<boolean>;
}

export function OverrideDecisionModal({
  application,
  saving = false,
  onClose,
  onConfirm,
}: OverrideDecisionModalProps) {
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>('pending');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!application) return;
    setNextStatus(application.status);
    setReason('');
  }, [application?.id, application?.status]);

  useEffect(() => {
    if (!application || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [application, onClose, saving]);

  if (!application) return null;

  const trimmedReason = reason.trim();
  const reasonValid = trimmedReason.length >= MIN_OVERRIDE_REASON_LENGTH;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-decision-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-amber-400/35 bg-[color:var(--wm-surface)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-300" aria-hidden="true" />
              <h2 id="override-decision-title" className="text-lg font-semibold text-[color:var(--wm-ink)]">
                Override Decision
              </h2>
            </div>
            <p className="mt-1 text-sm text-[color:var(--wm-ink-muted)]">
              {application.applicantName} · {application.applicationCode}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
              Super Admin
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              aria-label="Close override dialog"
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-[color:var(--wm-hairline)] text-[color:var(--wm-ink-muted)] hover:text-[color:var(--wm-ink)] disabled:opacity-40 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] p-3 text-sm text-[color:var(--wm-ink-secondary)]">
          Current decision:{' '}
          <strong className="capitalize text-[color:var(--wm-ink)]">{application.status}</strong>
        </div>

        <label
          htmlFor="override-status-select"
          className="mt-4 block text-xs font-medium text-[color:var(--wm-ink-secondary)]"
        >
          New decision
        </label>
        <select
          id="override-status-select"
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value as ApplicationStatus)}
          className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-sm text-[color:var(--wm-ink)]"
        >
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="waitlisted">Waitlisted</option>
        </select>

        <label
          htmlFor="override-reason-textarea"
          className="mt-4 block text-xs font-medium text-[color:var(--wm-ink-secondary)]"
        >
          Override reason (required)
        </label>
        <textarea
          id="override-reason-textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Explain why the original decision is being overridden..."
          className="mt-1 w-full resize-y rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-sm text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
        />
        {trimmedReason.length > 0 && !reasonValid ? (
          <p className="mt-1 text-xs text-amber-300">
            Minimum {MIN_OVERRIDE_REASON_LENGTH} characters required ({trimmedReason.length}/
            {MIN_OVERRIDE_REASON_LENGTH}).
          </p>
        ) : (
          <p className="mt-2 text-xs text-[color:var(--wm-ink-muted)]">
            Previous status, new decision, override reason, Super Admin identity, and timestamp are recorded in the override audit log.
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="min-h-[38px] rounded border border-[color:var(--wm-hairline-strong)] px-3.5 py-2 text-sm text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !reasonValid}
            onClick={async () => {
              const ok = await onConfirm(application.id, nextStatus, trimmedReason);
              if (ok) onClose();
            }}
            className="min-h-[38px] rounded border border-amber-400/40 bg-amber-500/15 px-3.5 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40 cursor-pointer"
          >
            {saving ? 'Saving…' : 'Confirm Override'}
          </button>
        </div>
      </div>
    </div>
  );
}
