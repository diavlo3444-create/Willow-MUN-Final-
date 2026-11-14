import { useRef, type PointerEvent, type ReactNode } from 'react';
import { useDesktopPointerEnabled } from '../utils/pointerEffects';

interface MagneticWrapProps {
  children: ReactNode;
  maxPullPx?: number;
  className?: string;
}

/**
 * Applies a subtle magnetic pull toward the cursor (up to maxPullPx, default 8px)
 * on desktop hover devices only, disabled on touch and prefers-reduced-motion.
 */
export function MagneticWrap({
  children,
  maxPullPx = 8,
  className = '',
}: MagneticWrapProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const desktopPointer = useDesktopPointerEnabled();

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!desktopPointer || event.pointerType !== 'mouse' || document.body.classList.contains('intro-on')) return;
    const el = wrapRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const relX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const relY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    const tx = Math.max(-maxPullPx, Math.min(maxPullPx, relX * maxPullPx));
    const ty = Math.max(-maxPullPx, Math.min(maxPullPx, relY * maxPullPx));

    el.style.transition = 'transform 140ms cubic-bezier(0.16, 1, 0.3, 1)';
    el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
  };

  const handlePointerLeave = () => {
    const el = wrapRef.current;
    if (!el) return;
    el.style.transition = 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)';
    el.style.transform = 'translate3d(0, 0, 0)';
  };

  return (
    <div
      ref={wrapRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`inline-block ${className}`}
    >
      {children}
    </div>
  );
}
