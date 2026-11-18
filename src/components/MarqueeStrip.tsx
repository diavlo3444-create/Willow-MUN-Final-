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
      className="relative z-[1] w-full border-y border-[#ede6ca]/16 bg-[#111508]/92"
    >
      <div className="mx-auto max-w-[1200px] px-[clamp(16px,4vw,48px)]">
        <div className="mun-no-scrollbar flex lg:grid lg:grid-cols-5 overflow-x-auto divide-x divide-[#ede6ca]/14">
          {INDEX_CHAPTERS.map((chapter) => (
            <a
              key={chapter.href}
              href={chapter.href}
              onClick={(e) => handleJump(e, chapter.href)}
              className="group flex shrink-0 items-baseline gap-2.5 px-4 py-3.5 first:pl-0 lg:first:pl-4 lg:justify-between transition-colors duration-150 hover:bg-[#ede6ca]/[0.04] whitespace-nowrap"
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
