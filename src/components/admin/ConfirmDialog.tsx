import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="wm-admin fixed inset-0 z-[120] flex items-center justify-center bg-black/75 px-4 py-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 text-[color:var(--wm-ink)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {tone === 'danger' && (
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded border border-rose-400/35 bg-rose-500/10 text-rose-200">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              </div>
            )}
            <div>
              <h2 id="confirm-dialog-title" className="text-base font-semibold text-[color:var(--wm-ink)]">
                {title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--wm-ink-secondary)]">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/10 hover:text-[color:var(--wm-ink)] cursor-pointer transition-colors duration-150"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[color:var(--wm-hairline)] pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] rounded border border-[color:var(--wm-hairline-strong)] bg-transparent px-4 text-sm font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer whitespace-nowrap transition-colors duration-150"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[40px] rounded px-4 text-sm font-semibold cursor-pointer whitespace-nowrap transition-colors duration-150 ${
              tone === 'danger'
                ? 'bg-rose-600 text-white hover:bg-rose-500'
                : 'bg-[color:var(--wm-focal)] text-[#12170c] hover:bg-[#dad3b4]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
