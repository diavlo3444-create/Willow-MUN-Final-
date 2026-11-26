import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useAdminStore } from '../../context/AdminStoreContext';

export function ToastViewport() {
  const { toasts, dismissToast } = useAdminStore();

  return (
    <div
      aria-live="polite"
      aria-label="System notifications"
      className="wm-admin pointer-events-none fixed bottom-4 right-4 z-[160] flex w-[min(370px,calc(100vw-2rem))] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon =
            toast.tone === 'success'
              ? CheckCircle2
              : toast.tone === 'error' || toast.tone === 'warning'
                ? AlertCircle
                : Info;
          const borderClass =
            toast.tone === 'success'
              ? 'border-emerald-400/35'
              : toast.tone === 'error'
                ? 'border-rose-400/40'
                : toast.tone === 'warning'
                  ? 'border-amber-400/40'
                  : 'border-[color:var(--wm-hairline-strong)]';
          const iconTone =
            toast.tone === 'success'
              ? 'text-emerald-300'
              : toast.tone === 'error'
                ? 'text-rose-300'
                : toast.tone === 'warning'
                  ? 'text-amber-300'
                  : 'text-[color:var(--wm-accent)]';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border ${borderClass} bg-[color:var(--wm-overlay)] px-4 py-3 text-sm text-[color:var(--wm-ink)]`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconTone}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug text-[color:var(--wm-ink)]">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[color:var(--wm-ink-secondary)] transition-colors duration-150 hover:bg-[color:var(--wm-inset)] hover:text-[color:var(--wm-ink)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
