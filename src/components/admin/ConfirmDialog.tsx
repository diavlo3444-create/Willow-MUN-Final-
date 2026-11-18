import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="wm-admin fixed inset-0 z-[120] flex items-center justify-center bg-[#030906]/80 px-4 py-6 backdrop-blur-xs"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md rounded-lg border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-6 text-[color:var(--wm-ink)] shadow-2xl"
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
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-[color:var(--wm-ink-secondary)] transition-colors duration-150 hover:bg-[color:var(--wm-inset)] hover:text-[color:var(--wm-ink)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[color:var(--wm-hairline)] pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="min-h-[40px] rounded-md border border-[color:var(--wm-hairline-strong)] bg-transparent px-4 text-sm font-medium text-[color:var(--wm-ink)] transition-colors duration-150 hover:bg-[color:var(--wm-inset)] whitespace-nowrap"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`min-h-[40px] rounded-md px-4 text-sm font-semibold transition-colors duration-150 whitespace-nowrap ${
                  tone === 'danger'
                    ? 'bg-rose-700 text-white hover:bg-rose-600'
                    : 'bg-[color:var(--wm-emerald)] text-[#eef4ef] hover:bg-[#357a5b]'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
