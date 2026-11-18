import { type MouseEvent } from 'react';
import { ArrowDownRight } from 'lucide-react';
import { CONFERENCE_DATA } from '../data/conference';
import { usePublishedWebsite } from '../utils/usePublishedWebsite';
import { RevealSection, SectionHeading } from './RevealSection';
import { TbaText } from './TbaText';

/**
 * Section 05: Conference Information & Official Dispatches
 * Combines practical conference logistics (dates, venue, registration timelines)
 * on the left with numbered Secretariat dispatches on the right.
 */
export function UpdatesSection() {
  const { settings } = usePublishedWebsite();
  const hasCustomDates = settings.datesText !== 'TBA';
  const hasCustomVenue = settings.venueText !== 'TBA';

  const handleJump = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = document.querySelector(href);
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <RevealSection id="updates" ariaLabelledBy="updates-heading">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Left: Practical Conference Key Details */}
        <div className="lg:col-span-5 space-y-6">
          <SectionHeading
            id="updates-heading"
            indexLabel="04"
            label={CONFERENCE_DATA.updates.label}
            prefix="Conference"
            italicWord="Dispatches"
          />

          <p className="text-sm sm:text-[15px] leading-[1.75] text-[#cfc8aa] max-w-[42ch]">
            Official conference releases, venue confirmations, and delegate application milestones
            issued by the Willow MUN Secretariat.
          </p>

          <dl className="divide-y divide-[#ede6ca]/14 border-y border-[#ede6ca]/18 text-sm">
            <div className="py-3.5 flex items-baseline justify-between gap-4">
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#cfc8aa]/80">
                Session Dates
              </dt>
              <dd className="font-serif text-xl text-[#ede6ca]">
                {hasCustomDates ? settings.datesText : <TbaText text="TBA" />}
              </dd>
            </div>
            <div className="py-3.5 flex items-baseline justify-between gap-4">
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#cfc8aa]/80">
                Conference Venue
              </dt>
              <dd className="font-serif text-xl text-[#ede6ca]">
                {hasCustomVenue ? settings.venueText : <TbaText text="TBA" />}
              </dd>
            </div>
            <div className="py-3.5 flex items-baseline justify-between gap-4">
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#cfc8aa]/80">
                Staff Recruitment
              </dt>
              <dd className="text-xs font-medium text-[#a9b47e]">
                <a
                  href="#apply"
                  onClick={(e) => handleJump(e, '#apply')}
                  className="inline-flex items-center gap-1 border-b border-[#a9b47e]/50 pb-0.5 hover:text-[#ede6ca] hover:border-[#ede6ca] transition-colors"
                >
                  <span>Volunteer, Media, Press &amp; Security</span>
                  <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </dd>
            </div>
          </dl>
        </div>

        {/* Right: Editorial Release Bulletin Board */}
        <div className="lg:col-span-7 divide-y divide-[#ede6ca]/16 border-t border-[#ede6ca]/24">
          {CONFERENCE_DATA.updates.entries.map((entry, idx) => (
            <article
              key={entry.id}
              className="py-6 sm:py-7 grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-6 items-start"
            >
              <div className="sm:col-span-4 flex sm:flex-col items-baseline sm:items-start justify-between gap-2">
                <span className="font-mono text-xs text-[#a9b47e] tabular-nums">
                  Bulletin 0{idx + 1}
                </span>
                <span className="text-xs text-[#cfc8aa]/80">
                  Target Date{' '}
                  <TbaText text={entry.badge} className="text-base ml-1" />
                </span>
              </div>

              <div className="sm:col-span-8 space-y-2">
                <h3 className="font-serif text-2xl sm:text-[28px] font-medium leading-snug text-[#ede6ca]">
                  {entry.title}
                </h3>
                <p className="text-sm sm:text-[15px] leading-[1.72] text-[#cfc8aa]">
                  {entry.summary}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </RevealSection>
  );
}
