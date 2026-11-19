import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Mail, Send, X } from 'lucide-react';
import type {
  BulkSendConfirmState,
  EmailDecisionType,
  EmailTemplateRecord,
} from './types';
import { renderEmailPreview } from './sampleData';

interface BulkSendConfirmModalProps {
  request: BulkSendConfirmState | null;
  templates: Record<EmailDecisionType, EmailTemplateRecord>;
  onConfirm: (emailType: EmailDecisionType) => void;
  onChangeType?: (emailType: EmailDecisionType) => void;
  onCancel: () => void;
}

export function BulkSendConfirmModal({
  request,
  templates,
  onConfirm,
  onChangeType,
  onCancel,
}: BulkSendConfirmModalProps) {
  useEffect(() => {
    if (!request) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request, onCancel]);

  if (!request) return null;

  const template = templates[request.emailType];
  const sampleRecipient = request.recipients[0];
  const subjectPreview = sampleRecipient
    ? renderEmailPreview(template.subject, sampleRecipient, request.emailType)
    : template.subject;

  const audienceExplanation =
    request.mode === 'all_accepted'
      ? `Includes every applicant whose Application Status is Accepted and who has not yet been successfully sent an acceptance email (${request.recipients.length} recipient${request.recipients.length === 1 ? '' : 's'}).${
          request.skippedAlreadySentCount > 0
            ? ` ${request.skippedAlreadySentCount} already-sent accepted applicant${request.skippedAlreadySentCount === 1 ? ' is' : 's are'} excluded to prevent duplicate emails.`
            : ''
        }`
      : request.mode === 'all_rejected'
        ? `Includes every applicant whose Application Status is Rejected and who has not yet been successfully sent a rejection email (${request.recipients.length} recipient${request.recipients.length === 1 ? '' : 's'}).${
            request.skippedAlreadySentCount > 0
              ? ` ${request.skippedAlreadySentCount} already-sent rejected applicant${request.skippedAlreadySentCount === 1 ? ' is' : 's are'} excluded to prevent duplicate emails.`
              : ''
          }`
        : `Applies to the ${request.recipients.length} applicant${request.recipients.length === 1 ? '' : 's'} currently selected in the table.`;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-send-confirm-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xl rounded-lg border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] text-[color:var(--wm-ink)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-6 py-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-accent)]">
              Bulk Email Confirmation
            </p>
            <h2
              id="bulk-send-confirm-title"
              className="wm-serif mt-1 text-xl font-medium text-[color:var(--wm-ink)]"
            >
              {request.mode === 'all_accepted'
                ? 'Send All Acceptance Emails'
                : request.mode === 'all_rejected'
                  ? 'Send All Rejection Emails'
                  : 'Send Selected Emails'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--wm-hairline)] text-[color:var(--wm-ink-muted)] hover:bg-[color:var(--wm-overlay)] hover:text-[color:var(--wm-ink)] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5 text-xs">
          {/* Recipient & Type Summary */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-4 py-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
                Number of Recipients
              </p>
              <p className="mt-1 font-serif text-2xl font-medium tabular-nums text-[color:var(--wm-ink)]">
                {request.recipients.length}
              </p>
            </div>

            <div className="rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-4 py-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
                Email Type
              </p>
              {request.mode === 'selected' && onChangeType ? (
                <div className="mt-1.5 flex items-center gap-1.5">
                  {(['accepted', 'rejected'] as const).map((typeKey) => (
                    <button
                      key={typeKey}
                      type="button"
                      onClick={() => onChangeType(typeKey)}
                      className={`rounded border px-2.5 py-1 text-[11px] font-medium cursor-pointer transition-colors ${
                        request.emailType === typeKey
                          ? 'border-[color:var(--wm-accent)] bg-[#2d6a4f]/40 text-[color:var(--wm-ink)]'
                          : 'border-[color:var(--wm-hairline)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                      }`}
                    >
                      {typeKey === 'accepted' ? 'Acceptance' : 'Rejection'}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 inline-flex items-center gap-1.5 font-medium text-sm text-[color:var(--wm-ink)]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
                  <span>{request.emailType === 'accepted' ? 'Acceptance Email' : 'Rejection Email'}</span>
                </p>
              )}
            </div>
          </div>

          {/* Clear explanation of who receives the batch */}
          <div className="rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)]/70 px-4 py-3 space-y-2">
            <p className="font-medium text-[color:var(--wm-ink)]">Who will receive this batch</p>
            <p className="leading-relaxed text-[color:var(--wm-ink-secondary)]">
              {audienceExplanation}
            </p>
            {request.recipients.length > 0 && (
              <div className="max-h-28 overflow-y-auto border-t border-[color:var(--wm-hairline)] pt-2 space-y-1">
                {request.recipients.slice(0, 8).map((recipient) => (
                  <div
                    key={recipient.id}
                    className="flex items-center justify-between gap-3 text-[11px] text-[color:var(--wm-ink-secondary)]"
                  >
                    <span className="truncate font-medium text-[color:var(--wm-ink)]">
                      {recipient.applicantName}
                    </span>
                    <span className="truncate font-mono text-[10px] text-[color:var(--wm-ink-muted)]">
                      {recipient.email} · {recipient.department}
                    </span>
                  </div>
                ))}
                {request.recipients.length > 8 && (
                  <p className="text-[10px] font-mono text-[color:var(--wm-ink-muted)]">
                    + {request.recipients.length - 8} more recipient(s)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Subject Preview */}
          <div className="rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-4 py-3">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
              <Mail className="h-3 w-3" aria-hidden="true" />
              <span>Subject Preview{sampleRecipient ? ` (${sampleRecipient.applicantName})` : ''}</span>
            </div>
            <p className="mt-1.5 font-medium text-[color:var(--wm-ink)]">{subjectPreview}</p>
          </div>

          {/* Honest Warning & UI-Only Staging Notice */}
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-md border border-amber-400/35 bg-amber-500/[0.08] px-4 py-3 text-amber-100"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-semibold">
                Emails will be prepared for all {request.recipients.length} selected recipient
                {request.recipients.length === 1 ? '' : 's'}.
              </p>
              <p className="text-[11px] text-amber-200/85">
                UI Preview Mode: Backend mail dispatch is not connected yet. Confirming adds these
                items to the Sending Queue interface without transmitting actual emails.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center justify-center rounded-md border border-[color:var(--wm-hairline-strong)] px-4 text-xs font-medium text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-overlay)] hover:text-[color:var(--wm-ink)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={request.recipients.length === 0}
            onClick={() => onConfirm(request.emailType)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              Confirm Send ({request.recipients.length})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
