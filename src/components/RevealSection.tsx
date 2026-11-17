import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

interface RevealSectionProps {
  id: string;
  ariaLabelledBy?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  noHorizontalPadding?: boolean;
}

/**
 * Editorial section wrapper positioned transparently over the background video.
 * Triggers a crisp one-time viewport fade-up (320ms, transform + opacity only).
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
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || revealed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.01, rootMargin: '0px 0px -24px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [revealed]);

  return (
    <section
      ref={ref}
      id={id}
      aria-labelledby={ariaLabelledBy}
      style={style}
      className={`mun-section-gradient mun-offscreen-section relative z-[1] bg-transparent scroll-mt-20 py-16 sm:py-24 lg:py-28 ${
        noHorizontalPadding ? '' : 'px-[clamp(16px,4vw,48px)]'
      } ${revealed ? 'mun-revealed' : ''} ${className}`}
    >
      <div className="mun-section-reveal mx-auto w-full max-w-[1200px] min-w-0">
        {children}
      </div>
    </section>
  );
}

interface SectionHeadingProps {
  id: string;
  label: string;
  prefix: string;
  italicWord?: string;
  period?: boolean;
  centered?: boolean;
}

export function SectionHeading({
  id,
  label,
  prefix,
  italicWord,
  period = false,
  centered = false,
}: SectionHeadingProps) {
  return (
    <div className={centered ? 'text-center' : ''}>
      <div
        aria-hidden="true"
        className={`text-xs text-[#a9b47e] mb-3 tracking-widest ${centered ? 'text-center' : ''}`}
      >
        <span className="mun-ornament-reveal">✦</span>
      </div>
      <p className="mun-heading-reveal text-[clamp(0.65rem,2.4vw,0.75rem)] font-medium uppercase tracking-[0.22em] text-[#cfc8aa] mb-3">
        {label}
      </p>
      <h2
        id={id}
        className="mun-heading-reveal font-serif text-[clamp(2rem,5vw,3.75rem)] leading-[1.02] font-medium tracking-tight text-[#ede6ca] [text-wrap:balance]"
      >
        {prefix}
        {italicWord ? (
          <>
            {prefix ? ' ' : ''}
            <span className="italic font-normal">
              {italicWord}
              {period ? '.' : ''}
            </span>
          </>
        ) : period ? (
          '.'
        ) : null}
      </h2>
    </div>
  );
}
