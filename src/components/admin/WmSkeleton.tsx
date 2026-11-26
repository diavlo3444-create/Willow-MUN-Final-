import { useRef } from 'react';
import { useInViewPlayState } from '../../utils/useInViewPlayState';

interface WmSkeletonProps {
  variant?: 'table' | 'cards' | 'dossier' | 'qr';
  rows?: number;
}

export function WmSkeleton({ variant = 'table', rows = 4 }: WmSkeletonProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isActive = useInViewPlayState(rootRef);
  const pauseClass = isActive ? '' : 'willow-anim-paused';

  if (variant === 'qr') {
    return (
      <div
        ref={rootRef}
        className={`wm-surface-panel p-6 sm:p-8 ${pauseClass}`}
        aria-busy="true"
        aria-label="Loading personal QR credential"
      >
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div className="wm-skeleton h-44 w-44 shrink-0 rounded-lg" />
          <div className="w-full max-w-sm space-y-3">
            <div className="wm-skeleton h-3 w-28 rounded" />
            <div className="wm-skeleton h-7 w-56 rounded" />
            <div className="wm-skeleton h-4 w-40 rounded" />
            <div className="wm-skeleton mt-4 h-9 w-48 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'dossier') {
    return (
      <div
        ref={rootRef}
        className={`wm-surface-panel space-y-5 p-6 ${pauseClass}`}
        aria-busy="true"
        aria-label="Loading applicant dossier"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--wm-hairline)] pb-5">
          <div className="space-y-2.5">
            <div className="wm-skeleton h-3 w-32 rounded" />
            <div className="wm-skeleton h-7 w-64 rounded" />
            <div className="wm-skeleton h-4 w-48 rounded" />
          </div>
          <div className="wm-skeleton h-9 w-28 rounded" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="wm-skeleton h-16 rounded-md" />
          <div className="wm-skeleton h-16 rounded-md" />
          <div className="wm-skeleton h-16 rounded-md" />
          <div className="wm-skeleton h-16 rounded-md" />
        </div>
        <div className="wm-skeleton h-28 rounded-md" />
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div
        ref={rootRef}
        className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${pauseClass}`}
        aria-busy="true"
        aria-label="Loading records"
      >
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="wm-surface-panel space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="wm-skeleton h-5 w-20 rounded" />
              <div className="wm-skeleton h-4 w-24 rounded" />
            </div>
            <div className="wm-skeleton h-5 w-44 rounded" />
            <div className="wm-skeleton h-3.5 w-full rounded" />
            <div className="wm-skeleton h-3.5 w-3/4 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`wm-surface-panel divide-y divide-[color:var(--wm-hairline)] overflow-hidden ${pauseClass}`}
      aria-busy="true"
      aria-label="Loading rows"
    >
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="space-y-2">
            <div className="wm-skeleton h-4 w-48 rounded" />
            <div className="wm-skeleton h-3 w-64 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="wm-skeleton h-6 w-20 rounded" />
            <div className="wm-skeleton h-8 w-24 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
