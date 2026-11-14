import { CONFERENCE_DATA } from '../data/conference';
import { InteractiveCard } from './InteractiveCard';
import { RevealSection, SectionHeading } from './RevealSection';
import { TbaText } from './TbaText';

/**
 * Live Updates section: "Stay Informed" / "LIVE UPDATES" with two timeline cards.
 */
export function UpdatesSection() {
  return (
    <RevealSection id="updates" ariaLabelledBy="updates-heading">
      <div className="mb-10 sm:mb-12">
        <SectionHeading
          id="updates-heading"
          label={CONFERENCE_DATA.updates.label}
          prefix="LIVE"
          italicWord="UPDATES"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {CONFERENCE_DATA.updates.entries.map((entry, idx) => (
          <InteractiveCard key={entry.id} staggerIndex={idx} className="p-6 sm:p-8">
            <article className="h-full flex flex-col justify-between gap-6">
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-2 border border-[#ede6ca]/22 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#cfc8aa] whitespace-nowrap">
                  <span>Date</span>
                  <TbaText text={entry.badge} className="normal-case text-sm" />
                </span>
                <span className="text-[11px] uppercase tracking-[0.22em] text-[#cfc8aa] tabular-nums whitespace-nowrap">
                  0{idx + 1}
                </span>
              </div>

              <div className="space-y-2.5">
                <h3 className="font-serif text-2xl sm:text-[28px] font-medium text-[#ede6ca] leading-snug [text-wrap:balance]">
                  {entry.title}
                </h3>
                <p className="text-sm sm:text-base leading-relaxed text-[#cfc8aa]">
                  {entry.summary}
                </p>
              </div>
            </article>
          </InteractiveCard>
        ))}
      </div>
    </RevealSection>
  );
}
