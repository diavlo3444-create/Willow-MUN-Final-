import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, UserCheck, X } from 'lucide-react';
import type { Application, ApplicationStatus } from '../../types/admin';
import {
  formatDecisionSummary,
  validateSpoofRequest,
  type AssignableAdminOption,
} from '../../utils/decisionAttribution';

interface SpoofDecisionModalProps {
  application: Pick<
    Application,
    'id' | 'applicantName' | 'applicationCode' | 'status' | 'finalDecisionBy'
  > | null;
  assignableAdmins: AssignableAdminOption[];
  loadingAdmins?: boolean;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (input: {
    applicationId: string;
    status: ApplicationStatus;
    attributedAdminId: string;
    reason: string;
  }) => Promise<boolean>;
}

export function SpoofDecisionModal({
  application,
  assignableAdmins,
  loadingAdmins = false,
  saving = false,
  onClose,
  onConfirm,
}: SpoofDecisionModalProps) {
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>('rejected');
  const [attributedAdminId, setAttributedAdminId] = useState('');
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');

  const defaultAdminId = useMemo(() => {
    if (!assignableAdmins.length) return '';
    const matchedCurrent = application?.finalDecisionBy
      ? assignableAdmins.find(
          (admin) =>
            admin.fullName.toLowerCase() === String(application.finalDecisionBy).trim().toLowerCase(),
        )
      : undefined;
    if (matchedCurrent) return matchedCurrent.userId;
    const firstRegularAdmin = assignableAdmins.find((admin) => admin.role === 'admin');
    return (firstRegularAdmin ?? assignableAdmins[0]).userId;
  }, [application?.finalDecisionBy, assignableAdmins]);

  useEffect(() => {
    if (!application) return;
    setNextStatus(application.status);
    setAttributedAdminId(defaultAdminId);
    setReason('');
    setValidationError('');
  }, [application?.id, application?.status, defaultAdminId]);

  useEffect(() => {
    if (!application || attributedAdminId || !defaultAdminId) return;
    setAttributedAdminId(defaultAdminId);
  }, [application, attributedAdminId, defaultAdminId]);

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

  const requiresAttribution = nextStatus !== 'pending';
  const validation = validateSpoofRequest({
    applicationId: application.id,
    nextStatus,
    attributedAdminId,
    assignableAdmins,
  });

  const handleSubmit = async () => {
    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }
    setValidationError('');
    const ok = await onConfirm({
      applicationId: application.id,
      status: nextStatus,
      attributedAdminId: requiresAttribution ? attributedAdminId : '',
      reason: reason.trim(),
    });
    if (ok) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="spoof-decision-title"
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
              <h2
                id="spoof-decision-title"
                className="text-lg font-semibold text-[color:var(--wm-ink)]"
              >
                Spoof Decision
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
              aria-label="Close spoof dialog"
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-[color:var(--wm-hairline)] text-[color:var(--wm-ink-muted)] hover:text-[color:var(--wm-ink)] disabled:opacity-40 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] p-3 text-xs text-[color:var(--wm-ink-secondary)]">
          Current status:{' '}
          <strong className="text-[color:var(--wm-ink)]">
            {formatDecisionSummary(application.status, application.finalDecisionBy)}
          </strong>
        </div>

        <label
          htmlFor="spoof-status-select"
          className="mt-4 block text-xs font-medium text-[color:var(--wm-ink-secondary)]"
        >
          New decision
        </label>
        <select
          id="spoof-status-select"
          value={nextStatus}
          onChange={(e) => {
            setNextStatus(e.target.value as ApplicationStatus);
            setValidationError('');
          }}
          className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-sm text-[color:var(--wm-ink)]"
        >
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="waitlisted">Waitlisted</option>
          <option value="pending">Pending</option>
        </select>

        {requiresAttribution ? (
          <div className="mt-4">
            <label
              htmlFor="spoof-admin-select"
              className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--wm-ink-secondary)]"
            >
              <UserCheck className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
              <span>Show decision as Admin</span>
            </label>
            <select
              id="spoof-admin-select"
              value={attributedAdminId}
              disabled={loadingAdmins || assignableAdmins.length === 0}
              onChange={(e) => {
                setAttributedAdminId(e.target.value);
                setValidationError('');
              }}
              className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-sm text-[color:var(--wm-ink)] disabled:opacity-60"
            >
              {loadingAdmins ? (
                <option value="">Loading Admin accounts…</option>
              ) : assignableAdmins.length === 0 ? (
                <option value="">No active Admin accounts found</option>
              ) : (
                assignableAdmins.map((adminOption) => (
                  <option key={adminOption.userId} value={adminOption.userId}>
                    {adminOption.fullName}
                    {adminOption.role === 'super_admin' ? ' (Super Admin)' : ' (Admin)'}
                    {adminOption.title ? ` · ${adminOption.title}` : ''}
                  </option>
                ))
              )}
            </select>
          </div>
        ) : (
          <p className="mt-3 rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-3 py-2 text-xs text-[color:var(--wm-ink-muted)]">
            Reverting this applicant to Pending clears the previous decision attribution.
          </p>
        )}

        <label
          htmlFor="spoof-reason-textarea"
          className="mt-4 block text-xs font-medium text-[color:var(--wm-ink-secondary)]"
        >
          Private Super Admin note (optional)
        </label>
        <textarea
          id="spoof-reason-textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Stored strictly in the private Super Admin audit log..."
          className="mt-1 w-full resize-y rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-sm text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
        />

        <p className="mt-2.5 text-[11px] leading-relaxed text-[color:var(--wm-ink-muted)]">
          Displays the selected Admin across staff portals without sending any automated decision email. Your Super Admin identity stays recorded privately.
        </p>

        {validationError && (
          <p
            role="alert"
            className="mt-3 rounded border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
          >
            {validationError}
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
            disabled={saving || (requiresAttribution && (loadingAdmins || assignableAdmins.length === 0))}
            onClick={() => void handleSubmit()}
            className="min-h-[38px] rounded border border-amber-400/40 bg-amber-500/15 px-3.5 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40 cursor-pointer"
          >
            {saving ? 'Saving…' : 'Apply Spoof'}
          </button>
        </div>
      </div>
    </div>
  );
}
