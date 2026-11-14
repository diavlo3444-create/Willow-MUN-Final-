import { useRef, type PointerEvent, type ReactNode } from 'react';
import { useDesktopPointerEnabled } from '../utils/pointerEffects';

interface InteractiveCardProps {
  children: ReactNode;
  className?: string;
  staggerIndex?: number;
}

const MAX_TILT_DEG = 5;

/**
 * Editorial card with:
 * - Outer one-time staggered reveal wrapper (24px rise + fade, 80ms per card)
 * - Inner card surface with desktop-only 6px lift, up-to-5deg cursor tilt (perspective 900px),
 *   40% cream border brighten, and radial-gradient cream spotlight at 10% opacity via --mx / --my.
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
    const nx = (x / rect.width) * 2 - 1; // -1..1
    const ny = (y / rect.height) * 2 - 1; // -1..1

    const rotateY = nx * MAX_TILT_DEG;
    const rotateX = -ny * MAX_TILT_DEG;

    el.style.setProperty('--mx', `${x.toFixed(1)}px`);
    el.style.setProperty('--my', `${y.toFixed(1)}px`);
    el.style.transform = `perspective(900px) translate3d(0, -6px, 0) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
  };

  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (!desktopPointer || event.pointerType !== 'mouse' || document.body.classList.contains('intro-on')) return;
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease';
    el.dataset.hovered = 'true';
  };

  const handlePointerLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    delete el.dataset.hovered;
    el.style.transition = 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease';
    el.style.transform = 'perspective(900px) translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg)';
  };

  return (
    <div
      className="mun-card-reveal h-full"
      style={{ transitionDelay: `${staggerIndex * 80}ms` }}
    >
      <div
        ref={cardRef}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={`mun-card mun-spotlight-card group relative h-full rounded-sm overflow-hidden ${className}`}
      >
        {desktopPointer && (
          <div
            aria-hidden="true"
            className="mun-card-spotlight pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          />
        )}
        <div className="relative z-10 h-full">{children}</div>
      </div>
    </div>
  );
}
