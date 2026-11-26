import { type MouseEvent } from 'react';

const INDEX_CHAPTERS = [
  { num: '01', label: 'Theme & Charter', href: '#about' },
  { num: '02', label: 'Committees', href: '#committees' },
  { num: '03', label: 'Executive Board', href: '#executive-board' },
  { num: '04', label: 'Dispatches', href: '#updates' },
  { num: '05', label: 'Instagram', href: '#instagram' },
  { num: '06', label: 'Apply', href: '#apply' },
] as const;

interface MarqueeStripProps {
  paused?: boolean;
}

/**
 * Architectural table-of-contents ribbon separating the frontispiece from the prospectus.
 * Uses horizontal smooth scroll on narrow phones and an even 6-column ruled strip on desktop.
 */
export function MarqueeStrip(_props: MarqueeStripProps) {
  const handleJump = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = document.querySelector(href);
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav
      aria-label="Conference prospectus index"
      className="mun-chapter-index relative z-[2] w-full border-y border-[#ede6ca]/20 bg-[#101408]"
    >
      <div className="mx-auto max-w-[1320px] px-[clamp(18px,5vw,76px)]">
        <div className="mun-no-scrollbar flex overflow-x-auto divide-x divide-[#ede6ca]/14 lg:grid lg:grid-cols-6">
          {INDEX_CHAPTERS.map((chapter) => (
            <a
              key={chapter.href}
              href={chapter.href}
              onClick={(e) => handleJump(e, chapter.href)}
              className="mun-chapter-link group flex min-h-[52px] shrink-0 items-baseline gap-3 px-4 lg:gap-2 lg:px-3 xl:gap-3 xl:px-4 py-4 first:pl-0 transition-colors duration-200 hover:bg-[#ede6ca]/[0.045] lg:justify-between lg:first:pl-3 xl:first:pl-4 whitespace-nowrap"
            >
              <span className="font-mono text-[11px] text-[#a9b47e] tabular-nums transition-transform duration-200 group-hover:translate-x-0.5">
                {chapter.num}
              </span>
              <span className="text-xs font-medium tracking-[0.02em] text-[#cfc8aa] transition-colors duration-200 group-hover:text-[#ede6ca]">
                {chapter.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
