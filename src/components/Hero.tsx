import { CONFERENCE_DATA } from '../data/conference';
import { TbaText } from './TbaText';

/**
 * Full-screen hero anchored at the bottom-left so the center of the viewport
 * stays clear for the willow emblem in the background video.
 */
export function Hero() {
  return (
    <section
      id="top"
      aria-label="Conference overview"
      className="relative z-10 min-h-[100dvh] flex flex-col justify-end px-5 sm:px-8 md:px-12 pt-28 pb-20 sm:pb-16"
    >
      {/* Measured bottom scrim ensures headline and chip legibility without obscuring the center willow emblem */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] sm:h-[48%] bg-gradient-to-t from-[#191d0e]/92 via-[#191d0e]/60 to-transparent"
      />

      <div className="relative mx-auto w-full max-w-[1200px]">
        <div className="max-w-xl">
          <h1 className="font-serif text-[clamp(2.25rem,4.3vw,3.75rem)] leading-[1.05] tracking-tight font-medium text-[#ede6ca] [text-wrap:balance]">
            {CONFERENCE_DATA.hero.headlinePrefix}
            <br />
            <span className="italic font-normal text-[#c9c2a4]">
              {CONFERENCE_DATA.hero.headlineItalic}
            </span>
          </h1>

          <ul
            aria-label="Key conference details"
            className="mt-5 sm:mt-6 flex flex-wrap items-center gap-2.5"
          >
            {CONFERENCE_DATA.hero.chips.map((chip) => (
              <li
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#ede6ca]/28 bg-[#1e2311]/85 px-3.5 py-1.5 text-xs sm:text-sm text-[#c9c2a4] backdrop-blur-sm"
              >
                <span>{chip.label}:</span>
                <TbaText text={chip.value} className="text-sm sm:text-base" />
              </li>
            ))}
          </ul>

          <div className="mt-6 sm:mt-7">
            <a
              href={CONFERENCE_DATA.hero.ctaHref}
              className="inline-flex items-center justify-center min-h-[44px] rounded-sm bg-[#ede6ca] px-6 py-3 text-sm font-medium text-[#232814] hover:bg-[#c9c2a4] transition-colors whitespace-nowrap"
            >
              {CONFERENCE_DATA.hero.ctaLabel}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
