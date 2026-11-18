import { type MouseEvent } from 'react';
import { ArrowDownRight } from 'lucide-react';
import { CONFERENCE_DATA } from '../data/conference';
import { usePublishedWebsite } from '../utils/usePublishedWebsite';
import { TbaText } from './TbaText';

interface HeroProps {
  cursorEffectsActive?: boolean;
}

/**
 * Editorial conference frontispiece:
 * - Portrait mobile leaves the upper 42dvh open so the 9:16 portrait swaying willow & birds breathe cleanly
 * - Desktop frames an asymmetric diplomatic masthead anchored above a ruled 4-column Prospectus Strip
 * - Avoids duplicating About section body copy and avoids boxed side cards
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
  const departmentCount = CONFERENCE_DATA.team.groups.reduce(
    (sum, g) => sum + g.departments.length,
    0,
  );

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
      className="relative z-[1] min-h-[100dvh] flex flex-col justify-end bg-transparent px-[clamp(16px,4vw,48px)] pt-[39dvh] sm:pt-28 pb-20 sm:pb-16"
    >
      {/* Measured lower readability scrim keeping the upper willow emblem canopy luminous */}
      <div
        aria-hidden="true"
        className="mun-hero-scrim pointer-events-none absolute inset-x-0 bottom-0 top-[28%]"
      />

      <div className="chrome relative z-10 mx-auto w-full max-w-[1200px] min-w-0">
        {/* Masthead Editorial Spread */}
        <div className="border-t border-[#ede6ca]/25 pt-5 sm:pt-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-12 items-end">
            {/* Primary Title Lockup */}
            <div className="lg:col-span-7 min-w-0">
              <p className="font-mono text-[11px] sm:text-xs uppercase tracking-[0.18em] text-[#a9b47e] mb-3">
                <span>Session {editionYear}</span>
                <span aria-hidden="true" className="mx-2 text-[#ede6ca]/35">
                  ·
                </span>
                <span className="text-[#cfc8aa]">International Youth Conference</span>
              </p>

              <h1 className="mun-hero-shadow font-serif text-[clamp(2.4rem,6vw,5.4rem)] font-medium leading-[0.95] tracking-[-0.02em] text-[#ede6ca] [text-wrap:balance]">
                {fullTitle}
              </h1>
            </div>

            {/* Right Asymmetric Diplomatic Thesis & Actions */}
            <div className="lg:col-span-5 min-w-0 space-y-5">
              <p className="mun-hero-shadow text-[15px] sm:text-base leading-[1.68] text-[#e2dcc4] max-w-[46ch]">
                {CONFERENCE_DATA.hero.thesis}
              </p>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
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
                    Explore Chambers
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width Ruled Conference Briefing Strip */}
        <aside
          aria-label="Key conference details"
          className="mt-8 sm:mt-10 border-t border-[#ede6ca]/20 pt-4 sm:pt-5"
        >
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
            <div className="border-r border-[#ede6ca]/14 pr-4 last:border-r-0">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#cfc8aa]/80">
                Conference Dates
              </dt>
              <dd className="mt-1 font-serif text-xl sm:text-2xl font-medium text-[#ede6ca] tabular-nums">
                {hasCustomDates ? settings.datesText : <TbaText text="TBA" />}
              </dd>
            </div>

            <div className="lg:border-r lg:border-[#ede6ca]/14 lg:pr-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#cfc8aa]/80">
                Official Venue
              </dt>
              <dd className="mt-1 font-serif text-xl sm:text-2xl font-medium text-[#ede6ca]">
                {hasCustomVenue ? settings.venueText : <TbaText text="TBA" />}
              </dd>
            </div>

            <div className="border-r border-[#ede6ca]/14 pr-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#cfc8aa]/80">
                Committee Chambers
              </dt>
              <dd className="mt-1 font-serif text-xl sm:text-2xl font-medium text-[#ede6ca] tabular-nums">
                {CONFERENCE_DATA.committees.items.length} Planned
              </dd>
            </div>

            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#cfc8aa]/80">
                Organizing Cadre
              </dt>
              <dd className="mt-1 font-serif text-xl sm:text-2xl font-medium text-[#ede6ca] tabular-nums">
                {departmentCount} Departments
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
