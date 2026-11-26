import { type MouseEvent } from 'react';
import { ArrowDownRight, MoveDown } from 'lucide-react';
import { CONFERENCE_DATA } from '../data/conference';
import { usePublishedWebsite } from '../utils/usePublishedWebsite';
import { TbaText } from './TbaText';

interface HeroProps {
  cursorEffectsActive?: boolean;
}

export function Hero({ cursorEffectsActive = false }: HeroProps) {
  const { published, settings } = usePublishedWebsite();
  const heroSec = published.sections.find((s) => s.sectionKey === 'hero');
  const ctaHref = heroSec?.buttonHref || CONFERENCE_DATA.hero.ctaHref;
  const ctaLabel = heroSec?.buttonLabel || CONFERENCE_DATA.hero.ctaLabel;
  const fullTitle = heroSec?.heading || CONFERENCE_DATA.hero.fullTitle;
  const editionYear = settings.editionYear || CONFERENCE_DATA.brand.year;
  const hasCustomVenue = settings.venueText !== 'TBA';
  const departmentCount = CONFERENCE_DATA.team.groups.reduce(
    (sum, group) => sum + group.departments.length,
    0,
  );

  const handleSmoothAnchor = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith('#')) return;
    const target = document.querySelector(href);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section
      id="top"
      aria-label="Willow Model United Nations overview"
      className="mun-hero relative z-[1] isolate flex min-h-[100svh] flex-col justify-end overflow-hidden bg-transparent px-[clamp(18px,5vw,76px)] pb-10 pt-[calc(var(--nav-height,64px)+5vh)] sm:pb-14 lg:pb-16"
    >
      <div
        className={`mun-hero-content mx-auto w-full max-w-[1320px] ${
          cursorEffectsActive ? 'mun-hero-ready' : ''
        }`}
      >
        <div className="mb-7 flex items-center gap-3 sm:mb-9">
          <span className="h-px w-9 bg-[#a9b47e]" />
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#d3d0b7] sm:text-[11px]">
            Willow Model United Nations
          </p>
          <span aria-hidden="true" className="font-mono text-[10px] text-[#ede6ca]/45">
            /
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#a9b47e] sm:text-[11px]">
            Session {editionYear}
          </p>
        </div>

        <div className="grid grid-cols-1 items-end gap-8 border-b border-[#ede6ca]/28 pb-9 lg:grid-cols-12 lg:gap-12 lg:pb-12">
          <div className="min-w-0 lg:col-span-8">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#cfc8aa]/85 sm:text-xs">
              An assembly for principled diplomacy
            </p>
            <h1 className="max-w-[13ch] font-serif text-[clamp(3.65rem,8.2vw,7.7rem)] font-medium leading-[0.88] tracking-[-0.055em] text-[#f1ecd9] [text-wrap:balance]">
              {fullTitle}
            </h1>
          </div>
          <div className="min-w-0 border-l border-[#ede6ca]/28 pl-5 lg:col-span-4 lg:pl-7">
            <p className="max-w-[38ch] text-[14px] leading-[1.8] text-[#e0dbc7] sm:text-[15px]">
              {CONFERENCE_DATA.hero.thesis}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <a
                href={ctaHref}
                onClick={(event) => handleSmoothAnchor(event, ctaHref)}
                className="mun-btn-interactive group inline-flex min-h-[46px] items-center justify-center gap-3 rounded-[2px] bg-[#ede6ca] px-5 py-3 text-[13px] font-semibold text-[#181c0d] hover:bg-[#d9d1b1] sm:px-6"
              >
                <span>{ctaLabel}</span>
                <ArrowDownRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:translate-y-0.5"
                  aria-hidden="true"
                />
              </a>
              <a
                href="#committees"
                onClick={(event) => handleSmoothAnchor(event, '#committees')}
                className="mun-link-underline inline-flex min-h-[44px] items-center text-[13px] font-medium text-[#ede6ca] hover:text-[#c9d98a]"
              >
                Explore committees
              </a>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-5 pt-6 sm:grid-cols-4 sm:pt-7">
          <div className="mun-hero-detail">
            <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-[#cfc8aa]/75 sm:text-[10px]">
              Conference dates
            </p>
            <p className="mt-1.5 font-serif text-xl font-medium text-[#f1ecd9] sm:text-2xl">
              March 18, 19 & 20, 2027
            </p>
          </div>
          <div className="mun-hero-detail">
            <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-[#cfc8aa]/75 sm:text-[10px]">
              Official venue
            </p>
            <p className="mt-1.5 font-serif text-xl font-medium text-[#f1ecd9] sm:text-2xl">
              {hasCustomVenue ? settings.venueText : <TbaText text="TBA" />}
            </p>
          </div>
          <div className="mun-hero-detail">
            <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-[#cfc8aa]/75 sm:text-[10px]">
              Committees
            </p>
            <p className="mt-1.5 font-serif text-xl font-medium text-[#f1ecd9] sm:text-2xl">
              {CONFERENCE_DATA.committees.items.length} planned
            </p>
          </div>
          <div className="mun-hero-detail">
            <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-[#cfc8aa]/75 sm:text-[10px]">
              Organizing departments
            </p>
            <p className="mt-1.5 font-serif text-xl font-medium text-[#f1ecd9] sm:text-2xl">
              {departmentCount} departments
            </p>
          </div>
        </div>
      </div>

      <a
        href="#about"
        onClick={(event) => handleSmoothAnchor(event, '#about')}
        aria-label="Scroll to the conference charter"
        className="group absolute bottom-7 right-[clamp(18px,5vw,76px)] hidden items-center gap-3 font-mono text-[9px] uppercase tracking-[0.2em] text-[#ede6ca]/70 transition-colors hover:text-[#ede6ca] lg:flex"
      >
        <span>Scroll to explore</span>
        <MoveDown
          className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-y-0.5"
          aria-hidden="true"
        />
      </a>
    </section>
  );
}
