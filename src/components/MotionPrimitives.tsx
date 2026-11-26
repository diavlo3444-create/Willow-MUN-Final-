import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { computeSectionStaggerDelayMs } from '../utils/willowMotion';

export type ScrollEnterDirection = 'down' | 'up';

export interface SectionMotionState {
  isVisible: boolean;
  enterDirection: ScrollEnterDirection;
}

export const SectionMotionContext = createContext<SectionMotionState>({
  isVisible: true,
  enterDirection: 'down',
});

export function useSectionMotion(): SectionMotionState {
  return useContext(SectionMotionContext);
}

interface RevealItemProps {
  children: ReactNode;
  className?: string;
  staggerIndex?: number;
}

/**
 * Staggered editorial element synchronized with parent RevealSection once-only entrance.
 * Fades and slides up 24px with a 70ms stagger over 400ms ease-out (transform + opacity only).
 */
export function RevealItem({
  children,
  className = '',
  staggerIndex = 0,
}: RevealItemProps) {
  const delayMs = computeSectionStaggerDelayMs(staggerIndex, 10);
  return (
    <div
      style={{ '--mun-stagger-delay': `${delayMs}ms` } as CSSProperties}
      className={`mun-stagger-item ${className}`}
    >
      {children}
    </div>
  );
}

interface ParallaxFrameProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  offsetPx?: number;
}

/**
 * Clean static structural wrapper (zero scroll-driven parallax or permanent will-change,
 * keeping scroll exclusively on the fixed willow tree + wreath background layers).
 */
export function ParallaxFrame({
  children,
  className = '',
  innerClassName = '',
}: ParallaxFrameProps) {
  return (
    <div className={className}>
      <div className={innerClassName}>{children}</div>
    </div>
  );
}
