import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SectionMotionContext, type ScrollEnterDirection } from './MotionPrimitives';

interface RevealSectionProps {
  id: string;
  ariaLabelledBy?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  noHorizontalPadding?: boolean;
}

/**
 * Bidirectional scroll-choreography section wrapper:
 * - Responds naturally when scrolling BOTH down and up
 * - Tracks entry edge (`down` vs `up`) when re-entering the viewport so section travel
 *   aligns with reading direction
 * - Never keeps intersecting content hidden; respects `prefers-reduced-motion`
 */
export function RevealSection({
  id,
  ariaLabelledBy,
  children,
  className = '',
  style,
  noHorizontalPadding = false,
}: RevealSectionProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [enterDirection, setEnterDirection] = useState<ScrollEnterDirection>('down');

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreferenceChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
      if (event.matches) setIsVisible(true);
    };
    media.addEventListener('change', onPreferenceChange);
    return () => media.removeEventListener('change', onPreferenceChange);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // Infer entry travel direction from viewport position when crossing threshold
            const rect = entry.boundingClientRect;
            setEnterDirection(rect.top < 0 ? 'up' : 'down');
            setIsVisible(true);
          } else {
            // Section has cleanly left viewport: arm opposite directional settle for next visit
            const exitedBelowViewport = entry.boundingClientRect.top > 0;
            setEnterDirection(exitedBelowViewport ? 'down' : 'up');
            setIsVisible(false);
          }
        }
      },
      {
        threshold: [0, 0.03],
        rootMargin: '20px 0px -3% 0px',
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return (
    <SectionMotionContext.Provider value={{ isVisible, enterDirection }}>
      <section
        ref={ref}
        id={id}
        aria-labelledby={ariaLabelledBy}
        data-revealed={isVisible ? 'true' : 'false'}
        data-enter-dir={enterDirection}
        style={style}
        className={`mun-section-gradient mun-offscreen-section mun-scroll-section relative z-[1] scroll-mt-[var(--nav-height,72px)] py-16 sm:py-20 lg:py-28 ${
          noHorizontalPadding ? '' : 'px-[clamp(18px,5vw,76px)]'
        } ${isVisible ? 'is-visible' : ''} ${
          enterDirection === 'up' ? 'mun-enter-up' : 'mun-enter-down'
        } ${className}`}
      >
        <div className="mun-section-inner mx-auto w-full max-w-[1320px] min-w-0">
          {children}
        </div>
      </section>
    </SectionMotionContext.Provider>
  );
}

function toEditorialTitleCase(word: string): string {
  const clean = word.trim();
  if (!clean) return '';
  if (clean === clean.toUpperCase() && clean.length > 2) {
    return clean
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
  return clean;
}

interface SectionHeadingProps {
  id: string;
  label: string;
  prefix: string;
  italicWord?: string;
  period?: boolean;
  centered?: boolean;
  indexLabel?: string;
}

export function SectionHeading({
  id,
  label,
  prefix,
  italicWord,
  centered = false,
  indexLabel,
}: SectionHeadingProps) {
  const formattedPrefix = toEditorialTitleCase(prefix);
  const formattedItalic = italicWord ? toEditorialTitleCase(italicWord) : '';

  return (
    <div className={`mun-section-heading ${centered ? 'text-center mx-auto max-w-2xl' : ''}`}>
      <p className="mun-section-kicker mun-heading-kicker mb-3 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#a9b47e] sm:text-[11px]">
        <span aria-hidden="true" className="mun-rule-draw h-px w-7 shrink-0 bg-[#a9b47e]/75" />
        {indexLabel ? <span className="text-[#ede6ca]/65">{indexLabel}</span> : null}
        <span>{label}</span>
      </p>
      <h2
        id={id}
        className="mun-display-heading mun-heading-title max-w-[16ch] font-serif text-[clamp(2.35rem,5vw,4.7rem)] font-medium leading-[0.98] tracking-[-0.045em] text-[#f1ecd9] [text-wrap:balance]"
      >
        {formattedPrefix}
        {formattedItalic ? (
          <>
            {' '}
            <span className="font-normal italic text-[#d9d5bd]">{formattedItalic}</span>
          </>
        ) : null}
      </h2>
    </div>
  );
}
