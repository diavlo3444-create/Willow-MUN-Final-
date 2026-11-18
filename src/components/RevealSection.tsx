import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

interface RevealSectionProps {
  id: string;
  ariaLabelledBy?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  noHorizontalPadding?: boolean;
}

export function RevealSection({
  id, ariaLabelledBy, children, className = '', style, noHorizontalPadding = false,
}: RevealSectionProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element || isVisible) return;
    if (!('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreferenceChange = (event: MediaQueryListEvent) => {
      if (event.matches) setIsVisible(true);
    };
    media.addEventListener('change', onPreferenceChange);
    return () => media.removeEventListener('change', onPreferenceChange);
  }, []);

  return (
    <section ref={ref} id={id} aria-labelledby={ariaLabelledBy}
      data-revealed={isVisible ? 'true' : 'false'} style={style}
      className={`mun-section-gradient mun-offscreen-section mun-scroll-section relative z-[1] scroll-mt-[var(--nav-height,72px)] py-16 sm:py-20 lg:py-28 ${noHorizontalPadding ? '' : 'px-[clamp(18px,5vw,76px)]'} ${isVisible ? 'is-visible' : ''} ${className}`}>
      <div className="mun-section-inner mx-auto w-full max-w-[1320px] min-w-0">{children}</div>
    </section>
  );
}

function toEditorialTitleCase(word: string): string {
  const clean = word.trim();
  if (!clean) return '';
  if (clean === clean.toUpperCase() && clean.length > 2) {
    return clean.split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
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

export function SectionHeading({ id, label, prefix, italicWord, centered = false, indexLabel }: SectionHeadingProps) {
  const formattedPrefix = toEditorialTitleCase(prefix);
  const formattedItalic = italicWord ? toEditorialTitleCase(italicWord) : '';
  return (
    <div className={`mun-section-heading ${centered ? 'text-center mx-auto max-w-2xl' : ''}`}>
      <p className="mun-section-kicker mb-3 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#a9b47e] sm:text-[11px]">
        <span aria-hidden="true" className="h-px w-7 shrink-0 bg-[#a9b47e]/75" />
        {indexLabel ? <span className="text-[#ede6ca]/65">{indexLabel}</span> : null}
        <span>{label}</span>
      </p>
      <h2 id={id} className="mun-display-heading max-w-[16ch] font-serif text-[clamp(2.35rem,5vw,4.7rem)] font-medium leading-[0.98] tracking-[-0.045em] text-[#f1ecd9] [text-wrap:balance]">
        {formattedPrefix}{formattedItalic ? <>{' '}<span className="font-normal italic text-[#d9d5bd]">{formattedItalic}</span></> : null}
      </h2>
    </div>
  );
}
