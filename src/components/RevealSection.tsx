import { useEffect, useRef, useState, type ReactNode } from 'react';

interface RevealSectionProps {
  id: string;
  ariaLabelledBy?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Editorial section wrapper with the flat transparent-to-dark-olive vertical gradient.
 * Triggers one-time reveal of headings (+30px slide), ✦ ornament (90deg spin),
 * and staggered cards (+24px slide, 80ms apart).
 */
export function RevealSection({
  id,
  ariaLabelledBy,
  children,
  className = '',
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
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [revealed]);

  return (
    <section
      ref={ref}
      id={id}
      aria-labelledby={ariaLabelledBy}
      className={`mun-section-gradient scroll-mt-20 py-20 sm:py-28 px-5 sm:px-8 md:px-12 ${
        revealed ? 'mun-revealed' : ''
      } ${className}`}
    >
      <div className="mx-auto w-full max-w-[1120px]">{children}</div>
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
      <p className="mun-heading-reveal text-[clamp(10px,2.7vw,12px)] font-medium uppercase tracking-[0.22em] text-[#cfc8aa] mb-3 whitespace-nowrap">
        {label}
      </p>
      <h2
        id={id}
        className="mun-heading-reveal font-serif text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.02] font-medium tracking-tight text-[#ede6ca] [text-wrap:balance]"
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
