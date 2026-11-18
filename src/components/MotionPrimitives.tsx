import { createContext, useContext, useRef, type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';

/**
 * Shared Willow MUN botanical-editorial motion curve.
 * Weighted settling curve with zero bounce or artificial overshoot.
 */
export const WILLOW_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

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
 * Staggered editorial element synchronized with parent RevealSection visibility
 * and bidirectional scroll travel direction. Pure CSS transform + opacity only.
 */
export function RevealItem({
  children,
  className = '',
  staggerIndex = 0,
}: RevealItemProps) {
  const cappedIndex = Math.min(8, Math.max(0, staggerIndex));
  return (
    <div
      style={{ '--mun-stagger-delay': `${cappedIndex * 65}ms` } as CSSProperties}
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
  /** Vertical drift excursion in px (+/-) across the viewport passage. Default: 14px */
  offsetPx?: number;
}

/**
 * Subtle compositor-only continuous parallax column / media frame.
 * Naturally responds identically smoothly when scrolling both down and back up,
 * and completely freezes at 0px when `prefers-reduced-motion` is enabled.
 */
export function ParallaxFrame({
  children,
  className = '',
  innerClassName = '',
  offsetPx = 14,
}: ParallaxFrameProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const prefersReduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [offsetPx, -offsetPx]);

  return (
    <div ref={ref} className={className}>
      <motion.div
        className={innerClassName}
        style={{
          y: prefersReduced ? 0 : y,
          willChange: prefersReduced ? 'auto' : 'transform',
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
