import { type MouseEvent } from 'react';

const INDEX_CHAPTERS = [
  { num: '01', label: 'Theme & Charter', href: '#about' },
  { num: '02', label: 'Committees', href: '#committees' },
  { num: '03', label: 'Executive Board', href: '#executive-board' },
  { num: '04', label: 'Dispatches', href: '#updates' },
  { num: '05', label: 'Apply', href: '#apply' },
] as const;

interface MarqueeStripProps {
  paused?: boolean;
}

/**
 * Architectural table-of-contents ribbon separating the frontispiece from the prospectus.
 * Uses horizontal smooth scroll on narrow phones and an even 5-column ruled strip on desktop.
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
      className="mun-chapter-index relative z-[2] w-full border-y border-[#ede6ca]/20 bg-[#101408]/90 backdrop-blur-sm"
    >
      <div className="mx-auto max-w-[1320px] px-[clamp(18px,5vw,76px)]">
        <div className="mun-no-scrollbar flex overflow-x-auto divide-x divide-[#ede6ca]/14 lg:grid lg:grid-cols-5">
          {INDEX_CHAPTERS.map((chapter) => (
            <a
              key={chapter.href}
              href={chapter.href}
              onClick={(e) => handleJump(e, chapter.href)}
              className="mun-chapter-link group flex min-h-[52px] shrink-0 items-baseline gap-3 px-4 py-4 first:pl-0 transition-colors duration-200 hover:bg-[#ede6ca]/[0.045] lg:justify-between lg:first:pl-4 whitespace-nowrap"
            >
              <span className="font-mono text-[11px] text-[#a9b47e] tabular-nums">
                {chapter.num}
              </span>
              <span className="text-xs font-medium tracking-[0.02em] text-[#cfc8aa] group-hover:text-[#ede6ca]">
                {chapter.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
