import { CONFERENCE_DATA } from '../data/conference';
import { usePublishedWebsite } from '../utils/usePublishedWebsite';
import { RevealSection, SectionHeading } from './RevealSection';
import { TbaText } from './TbaText';

/**
 * Architectural two-column Chamber Directory for Committees 01-06,
 * replacing six identical rounded box clones with a calm ruled broadsheet index.
 */
export function CommitteesSection() {
  const { published } = usePublishedWebsite();
  const committeesSec = published.sections.find((s) => s.sectionKey === 'committees');
  const label = committeesSec?.label || CONFERENCE_DATA.committees.label;
  const subIntro =
    committeesSec?.bodyText ||
    'Six diplomatic chambers spanning specialized multilateral debate formats. Formal agendas, study guides, and chair appointments remain to be announced.';

  return (
    <RevealSection id="committees" ariaLabelledBy="committees-heading">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end mb-8 sm:mb-10">
        <div className="lg:col-span-7">
          <SectionHeading
            id="committees-heading"
            indexLabel="02"
            label={label}
            prefix="Conference"
            italicWord="Chambers"
          />
        </div>
        <p className="lg:col-span-5 text-sm leading-[1.7] text-[#c9c2a6] max-w-[50ch]">
          {subIntro}
        </p>
      </div>

      <div className="willow-folio rounded-[3px] overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y divide-[#ede6ca]/14">
          {CONFERENCE_DATA.committees.items.map((item, idx) => {
            const indexNum = String(idx + 1).padStart(2, '0');
            const isLeftCol = idx % 2 === 0;
            const isLastRow = idx >= CONFERENCE_DATA.committees.items.length - 2;

            return (
              <article
                key={item.id}
                className={`p-6 sm:p-7 transition-colors duration-150 hover:bg-[#ede6ca]/[0.025] ${
                  isLeftCol ? 'md:border-r md:border-[#ede6ca]/14' : ''
                } ${isLastRow ? 'md:border-b-0' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-xs text-[#a9b47e] tabular-nums">
                    {item.chamber}
                  </span>
                  <span className="font-mono text-[11px] text-[#cfc8aa]/70 tabular-nums">
                    Dossier {indexNum}
                  </span>
                </div>

                <h3 className="mt-3 font-serif text-2xl sm:text-[26px] font-medium leading-snug text-[#ede6ca]">
                  {item.name} <TbaText text="TBA" />
                </h3>

                <p className="mt-3 pt-3 border-t border-[#ede6ca]/10 text-sm text-[#c9c2a6] flex items-baseline justify-between gap-3">
                  <span>{item.details}</span>
                  <TbaText text="TBA" className="text-base shrink-0" />
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </RevealSection>
  );
}
