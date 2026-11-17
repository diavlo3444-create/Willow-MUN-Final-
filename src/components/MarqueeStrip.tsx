import { type MouseEvent } from 'react';

const INDEX_CHAPTERS = [
  { num: '01', label: 'Charter & Overview', href: '#about' },
  { num: '02', label: 'Chambers', href: '#committees' },
  { num: '03', label: 'Executive Board', href: '#executive-board' },
  { num: '04', label: 'Organizing Departments', href: '#team' },
  { num: '05', label: 'Releases', href: '#updates' },
  { num: '06', label: 'Team Applications', href: '#apply' },
] as const;

interface MarqueeStripProps {
  paused?: boolean;
}

/**
 * Calm institutional edition index strip directly below the hero masthead,
 * replacing scrolling ticker clutter with purposeful chapter jump links.
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
      className="relative z-[1] w-full border-y border-[#ede6ca]/16 bg-[#12160a]/86"
    >
      <div className="mx-auto max-w-[1200px] px-[clamp(16px,4vw,48px)]">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-[#ede6ca]/12">
          {INDEX_CHAPTERS.map((chapter) => (
            <a
              key={chapter.href}
              href={chapter.href}
              onClick={(e) => handleJump(e, chapter.href)}
              className="group flex items-baseline justify-between gap-2 px-3 py-3 text-left transition-colors duration-150 hover:bg-[#ede6ca]/[0.04]"
            >
              <span className="font-mono text-[11px] text-[#a9b47e] tabular-nums">
                {chapter.num}
              </span>
              <span className="text-xs font-medium text-[#cfc8aa] group-hover:text-[#ede6ca] truncate">
                {chapter.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
