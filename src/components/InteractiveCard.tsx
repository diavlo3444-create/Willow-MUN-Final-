import { useRef, type PointerEvent, type ReactNode } from 'react';
import { useDesktopPointerEnabled } from '../utils/pointerEffects';

interface InteractiveCardProps {
  children: ReactNode;
  className?: string;
  staggerIndex?: number;
}

const MAX_TILT_DEG = 4;

/**
 * Editorial card with:
 * - Outer one-time staggered fade-up wrapper (16px rise + fade, 300ms)
 * - Inner card surface with desktop-only 4px lift, subtle tilt, and soft opacity glow
 */
export function InteractiveCard({
  children,
  className = '',
  staggerIndex = 0,
}: InteractiveCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const desktopPointer = useDesktopPointerEnabled();

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!desktopPointer || event.pointerType !== 'mouse' || document.body.classList.contains('intro-on')) return;
    const el = cardRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const nx = (x / rect.width) * 2 - 1;
    const ny = (y / rect.height) * 2 - 1;

    const rotateY = nx * MAX_TILT_DEG;
    const rotateX = -ny * MAX_TILT_DEG;

    el.style.setProperty('--mx', `${x.toFixed(1)}px`);
    el.style.setProperty('--my', `${y.toFixed(1)}px`);
    el.style.transform = `perspective(900px) translate3d(0, -4px, 0) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
  };

  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (!desktopPointer || event.pointerType !== 'mouse' || document.body.classList.contains('intro-on')) return;
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)';
    el.dataset.hovered = 'true';
  };

  const handlePointerLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    delete el.dataset.hovered;
    el.style.transition = 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)';
    el.style.transform = 'perspective(900px) translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg)';
  };

  return (
    <div
      className="mun-card-reveal h-full min-w-0"
      style={{ transitionDelay: `${staggerIndex * 45}ms` }}
    >
      <div
        ref={cardRef}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={`mun-card group relative h-full min-w-0 rounded-sm overflow-hidden ${className}`}
      >
        {desktopPointer && (
          <div
            aria-hidden="true"
            className="mun-card-spotlight pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-250 group-hover:opacity-100"
          />
        )}
        <div className="relative z-10 h-full min-w-0">{children}</div>
      </div>
    </div>
  );
}
