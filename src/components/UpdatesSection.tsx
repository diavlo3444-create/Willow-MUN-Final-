import { CONFERENCE_DATA } from '../data/conference';
import { RevealSection, SectionHeading } from './RevealSection';
import { TbaText } from './TbaText';

/**
 * Editorial conference dispatches and release schedule ledger.
 */
export function UpdatesSection() {
  return (
    <RevealSection id="updates" ariaLabelledBy="updates-heading">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <div className="lg:col-span-4 space-y-4">
          <SectionHeading
            id="updates-heading"
            indexLabel="05"
            label={CONFERENCE_DATA.updates.label}
            prefix="Official"
            italicWord="Updates"
          />
          <p className="text-sm leading-[1.7] text-[#c9c2a6] max-w-[36ch]">
            Official conference releases, registration timelines, and venue confirmations published by
            the Secretariat.
          </p>
        </div>

        <div className="lg:col-span-8 willow-folio rounded-[3px] overflow-hidden">
          <div className="divide-y divide-[#ede6ca]/14">
            {CONFERENCE_DATA.updates.entries.map((entry, idx) => (
              <article
                key={entry.id}
                className="p-6 sm:p-7 grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-6 items-start"
              >
                <div className="sm:col-span-4 flex sm:flex-col items-baseline sm:items-start justify-between gap-2">
                  <span className="font-mono text-xs text-[#a9b47e] tabular-nums">
                    Dispatch 0{idx + 1}
                  </span>
                  <span className="text-xs text-[#c9c2a6]">
                    Schedule{' '}
                    <TbaText text={entry.badge} className="text-base ml-1" />
                  </span>
                </div>

                <div className="sm:col-span-8 space-y-2">
                  <h3 className="font-serif text-2xl sm:text-[26px] font-medium leading-snug text-[#ede6ca]">
                    {entry.title}
                  </h3>
                  <p className="text-sm sm:text-[15px] leading-[1.7] text-[#c9c2a6]">
                    {entry.summary}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </RevealSection>
  );
}
