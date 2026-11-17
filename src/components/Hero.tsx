import { type MouseEvent } from 'react';
import { ArrowDownRight } from 'lucide-react';
import { CONFERENCE_DATA } from '../data/conference';
import { usePublishedWebsite } from '../utils/usePublishedWebsite';
import { TbaText } from './TbaText';

interface HeroProps {
  cursorEffectsActive?: boolean;
}

/**
 * Asymmetric diplomatic masthead framed against the preserved willow canopy video:
 * - Left-weighted editorial lockup anchored near the lower third so the willow backdrop breathes cleanly
 * - Right architectural conference specification block (Edition, Dates, Venue, Chambers)
 * - No centered stacking, no decorative sparkles, no capsule pill buttons
 */
export function Hero(_props: HeroProps) {
  const { published, settings } = usePublishedWebsite();
  const heroSec = published.sections.find((s) => s.sectionKey === 'hero');
  const ctaHref = heroSec?.buttonHref || CONFERENCE_DATA.hero.ctaHref;
  const ctaLabel = heroSec?.buttonLabel || CONFERENCE_DATA.hero.ctaLabel;
  const fullTitle = heroSec?.heading || CONFERENCE_DATA.hero.fullTitle;
  const editionYear = settings.editionYear || CONFERENCE_DATA.brand.year;
  const hasCustomDates = settings.datesText !== 'TBA';
  const hasCustomVenue = settings.venueText !== 'TBA';

  const handleSmoothAnchor = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      const target = document.querySelector(href);
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <section
      id="top"
      aria-label="Willow Model United Nations overview"
      className="relative z-[1] min-h-[100dvh] flex flex-col justify-end bg-transparent px-[clamp(16px,4vw,48px)] pt-24 pb-28 sm:pb-16 lg:pb-16"
    >
      {/* Measured vertical readability scrim spanning only the lower masthead footprint */}
      <div
        aria-hidden="true"
        className="mun-hero-scrim pointer-events-none absolute inset-x-0 bottom-0 top-[28%]"
      />

      <div className="chrome relative z-10 mx-auto w-full max-w-[1200px] min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end border-t border-[#ede6ca]/18 pt-7 sm:pt-9">
          {/* Left Masthead Column (8 cols) */}
          <div className="lg:col-span-8 min-w-0">
            <p className="text-xs font-medium tracking-[0.18em] text-[#a9b47e] mb-3.5">
              <span>{editionYear} Conference</span>
              <span aria-hidden="true" className="mx-2 text-[#ede6ca]/35">
                /
              </span>
              <span className="text-[#cfc8aa]">Inaugural Session Prospectus</span>
            </p>

            <h1 className="mun-hero-shadow font-serif text-[clamp(2.65rem,6.5vw,5.75rem)] font-medium leading-[0.96] tracking-[-0.02em] text-[#ede6ca] [text-wrap:balance]">
              {fullTitle}
            </h1>

            <p className="mun-hero-shadow mt-5 max-w-[54ch] text-base sm:text-[17px] leading-[1.68] text-[#ddd6bc]">
              {CONFERENCE_DATA.about.paragraphs[0]}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-4 sm:gap-6">
              <a
                href={ctaHref}
                onClick={(e) => handleSmoothAnchor(e, ctaHref)}
                className="mun-btn-interactive inline-flex items-center justify-center gap-2 min-h-[44px] rounded-[2px] bg-[#ede6ca] px-6 py-2.5 text-sm font-semibold text-[#181c0d] hover:bg-[#dad3b4] whitespace-nowrap"
              >
                <span>{ctaLabel}</span>
                <ArrowDownRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </a>

              <a
                href="#committees"
                onClick={(e) => handleSmoothAnchor(e, '#committees')}
                className="group inline-flex items-center min-h-[44px] text-sm font-medium text-[#ede6ca] hover:text-[#a9b47e] transition-colors whitespace-nowrap"
              >
                <span className="border-b border-[#ede6ca]/45 pb-0.5 transition-colors duration-150 group-hover:border-[#a9b47e]">
                  Explore Conference Chambers
                </span>
              </a>
            </div>
          </div>

          {/* Right Specification Ledger (4 cols) */}
          <aside
            aria-label="Conference briefing details"
            className="lg:col-span-4 willow-folio rounded-[3px] px-5 py-4 sm:px-6 sm:py-5"
          >
            <dl className="divide-y divide-[#ede6ca]/14 text-sm">
              <div className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0">
                <dt className="text-xs tracking-[0.1em] text-[#cfc8aa]">Edition</dt>
                <dd className="font-mono text-xs text-[#ede6ca] tabular-nums">{editionYear}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-xs tracking-[0.1em] text-[#cfc8aa]">Dates</dt>
                <dd className="text-right text-sm text-[#ede6ca]">
                  {hasCustomDates ? settings.datesText : <TbaText text="TBA" className="text-base" />}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-xs tracking-[0.1em] text-[#cfc8aa]">Venue</dt>
                <dd className="text-right text-sm text-[#ede6ca]">
                  {hasCustomVenue ? settings.venueText : <TbaText text="TBA" className="text-base" />}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2.5 last:pb-0">
                <dt className="text-xs tracking-[0.1em] text-[#cfc8aa]">Chambers</dt>
                <dd className="font-mono text-xs text-[#ede6ca] tabular-nums">
                  {CONFERENCE_DATA.committees.items.length} Planned
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </section>
  );
}
