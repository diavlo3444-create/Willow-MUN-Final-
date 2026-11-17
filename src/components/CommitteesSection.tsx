import { CONFERENCE_DATA } from '../data/conference';
import { InteractiveCard } from './InteractiveCard';
import { RevealSection, SectionHeading } from './RevealSection';
import { TbaText } from './TbaText';

/**
 * Committees section: grid of six Chamber 01-06 cards with TBA agenda and chairs.
 */
export function CommitteesSection() {
  return (
    <RevealSection id="committees" ariaLabelledBy="committees-heading">
      <div className="mb-10 sm:mb-12">
        <SectionHeading
          id="committees-heading"
          label={CONFERENCE_DATA.committees.label}
          prefix="COMMITTEES"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {CONFERENCE_DATA.committees.items.map((item, idx) => (
          <InteractiveCard key={item.id} staggerIndex={idx} className="p-6 sm:p-7">
            <article className="h-full min-w-0 flex flex-col justify-between gap-6">
              <div className="min-w-0">
                <p className="text-[clamp(0.65rem,2.4vw,0.75rem)] uppercase tracking-[0.22em] text-[#cfc8aa] tabular-nums">
                  {item.chamber}
                </p>
                <h3 className="mt-3 font-serif text-[clamp(1.35rem,3vw,1.65rem)] font-medium text-[#ede6ca]">
                  {item.name} <TbaText text="TBA" />
                </h3>
              </div>

              <p className="pt-4 border-t border-[#ede6ca]/14 text-sm text-[#cfc8aa]">
                {item.details} <TbaText text="TBA" className="text-base" />
              </p>
            </article>
          </InteractiveCard>
        ))}
      </div>
    </RevealSection>
  );
}
