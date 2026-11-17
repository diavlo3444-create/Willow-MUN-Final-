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
 * Institutional editorial section band resting over the live willow background.
 * Content remains immediately readable in the DOM with subtle settle transition on scroll.
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
  const [revealed, setRevealed] = useState(true);

  useEffect(() => {
    if (!revealed && ref.current) {
      setRevealed(true);
    }
  }, [revealed]);

  return (
    <section
      ref={ref}
      id={id}
      aria-labelledby={ariaLabelledBy}
      style={style}
      className={`mun-section-gradient mun-offscreen-section relative z-[1] bg-transparent scroll-mt-20 py-14 sm:py-20 lg:py-24 ${
        noHorizontalPadding ? '' : 'px-[clamp(16px,4vw,48px)]'
      } mun-revealed ${className}`}
    >
      <div className="mx-auto w-full max-w-[1200px] min-w-0">
        {children}
      </div>
    </section>
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
    <div className={centered ? 'text-center mx-auto max-w-2xl' : ''}>
      <p className="text-xs font-medium tracking-[0.14em] text-[#a9b47e] mb-2.5">
        {indexLabel ? (
          <>
            <span className="font-mono text-[#cfc8aa]/75 mr-2">{indexLabel}</span>
            <span aria-hidden="true" className="mr-2 text-[#ede6ca]/35">
              /
            </span>
          </>
        ) : null}
        <span>{label}</span>
      </p>
      <h2
        id={id}
        className="font-serif text-[clamp(2rem,4.4vw,3.35rem)] leading-[1.06] font-medium tracking-[-0.015em] text-[#ede6ca] [text-wrap:balance]"
      >
        {formattedPrefix}
        {formattedItalic ? (
          <>
            {formattedPrefix ? ' ' : ''}
            <span className="italic font-normal text-[#ede6ca]">{formattedItalic}</span>
          </>
        ) : null}
      </h2>
    </div>
  );
}
