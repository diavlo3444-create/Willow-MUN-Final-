import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SectionMotionContext } from './MotionPrimitives';

interface RevealSectionProps {
  id: string;
  ariaLabelledBy?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  noHorizontalPadding?: boolean;
}

/**
 * Once-only viewport entrance wrapper using IntersectionObserver:
 * - Fades and slides heading and cards up 24px with 70ms stagger over 400ms ease-out
 * - Adds will-change: transform, opacity during active entrance and removes it after completion
 * - Applies content-visibility: auto to below-the-fold sections
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
  const animTimerRef = useRef<number | null>(null);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreferenceChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
      if (event.matches) {
        setIsVisible(true);
        setIsAnimating(false);
      }
    };
    media.addEventListener('change', onPreferenceChange);
    return () => media.removeEventListener('change', onPreferenceChange);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      setIsAnimating(false);
      return;
    }

    if (isVisible) return;

    const triggerOnce = () => {
      setIsAnimating(true);
      setIsVisible(true);
      if (animTimerRef.current !== null) {
        window.clearTimeout(animTimerRef.current);
      }
      // Remove will-change once 400ms animation + up to 700ms stagger settles
      animTimerRef.current = window.setTimeout(() => {
        animTimerRef.current = null;
        setIsAnimating(false);
      }, 1150);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            triggerOnce();
            observer.disconnect();
            break;
          }
        }
      },
      {
        threshold: 0.04,
        rootMargin: '0px 0px -4% 0px',
      },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [isVisible, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (animTimerRef.current !== null) {
        window.clearTimeout(animTimerRef.current);
      }
    };
  }, []);

  return (
    <SectionMotionContext.Provider value={{ isVisible, enterDirection: 'down' }}>
      <section
        ref={ref}
        id={id}
        aria-labelledby={ariaLabelledBy}
        data-revealed={isVisible ? 'true' : 'false'}
        style={style}
        className={`mun-section-gradient mun-offscreen-section mun-scroll-section relative z-[1] scroll-mt-[var(--nav-height,72px)] py-16 sm:py-20 lg:py-28 ${
          noHorizontalPadding ? '' : 'px-[clamp(18px,5vw,76px)]'
        } ${isVisible ? 'is-visible' : ''} ${
          isAnimating ? 'mun-is-animating' : ''
        } ${className}`}
      >
        <div className="mx-auto w-full max-w-[1320px] min-w-0">
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
        <span aria-hidden="true" className="h-px w-7 shrink-0 bg-[#a9b47e]/75" />
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
