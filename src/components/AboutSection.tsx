import { CONFERENCE_DATA } from '../data/conference';
import { usePublishedWebsite } from '../utils/usePublishedWebsite';
import { RevealSection, SectionHeading } from './RevealSection';
import { TbaText } from './TbaText';

/**
 * Conference Charter section:
 * - Asymmetric 7/5 layout: drop-cap institutional statement + ruled summary ledger
 * - Replaces identical summary cards with refined hairline typography
 */
export function AboutSection() {
  const { published, settings } = usePublishedWebsite();
  const aboutSec = published.sections.find((s) => s.sectionKey === 'about');
  const label = aboutSec?.label || CONFERENCE_DATA.about.label;
  const paragraph = aboutSec?.bodyText || CONFERENCE_DATA.about.paragraphs[0];

  const ledgerEntries = [
    {
      key: 'committees',
      term: 'Planned Committees',
      value: `${CONFERENCE_DATA.committees.items.length} Chambers`,
      note: 'Agendas & chairs to be announced',
    },
    {
      key: 'year',
      term: 'Conference Year',
      value: settings.editionYear || CONFERENCE_DATA.brand.year,
      note: 'Edition publication cycle',
    },
    {
      key: 'venue',
      term: 'Venue & Dates',
      value:
        settings.datesText !== 'TBA' || settings.venueText !== 'TBA'
          ? `${settings.datesText} · ${settings.venueText}`
          : 'TBA',
      isTba: settings.datesText === 'TBA' && settings.venueText === 'TBA',
      note: 'Official secretariat confirmation',
    },
    {
      key: 'cadre',
      term: 'Organizing Structure',
      value: `${CONFERENCE_DATA.team.groups.reduce((n, g) => n + g.departments.length, 0)} Departments`,
      note: 'Operations, Creative & Administration',
    },
  ];

  return (
    <RevealSection id="about" ariaLabelledBy="about-heading">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        <div className="lg:col-span-7 space-y-6">
          <SectionHeading
            id="about-heading"
            indexLabel="01"
            label={label}
            prefix="About"
            italicWord="Willow"
          />

          <div className="border-t border-[#ede6ca]/16 pt-6 space-y-5 max-w-[65ch] text-base sm:text-[17px] leading-[1.78] text-[#d6cfb4]">
            <p className="first-letter:float-left first-letter:mr-3.5 first-letter:mt-1 first-letter:font-serif first-letter:text-5xl first-letter:font-medium first-letter:leading-[0.85] first-letter:text-[#ede6ca]">
              {paragraph}
            </p>
            <p className="text-[#c9c2a6]">
              {CONFERENCE_DATA.globalStage.description} The complete institutional charter, delegate
              preparatory guides, and procedural handbook are currently{' '}
              <TbaText text="TBA" className="text-xl" /> ahead of delegate registration.
            </p>
          </div>
        </div>

        <aside className="lg:col-span-5 willow-folio rounded-[3px] overflow-hidden">
          <div className="border-b border-[#ede6ca]/14 px-6 py-4 bg-[#191f0e]/70">
            <p className="text-xs font-medium tracking-[0.12em] text-[#cfc8aa]">
              {CONFERENCE_DATA.globalStage.label}
            </p>
          </div>

          <dl className="divide-y divide-[#ede6ca]/14">
            {ledgerEntries.map((entry) => (
              <div key={entry.key} className="px-6 py-4 flex items-start justify-between gap-4">
                <div>
                  <dt className="text-xs font-medium text-[#cfc8aa]">{entry.term}</dt>
                  <dd className="mt-1 text-xs text-[#a9b47e]/85">{entry.note}</dd>
                </div>
                <dd className="font-serif text-xl sm:text-2xl font-medium text-[#ede6ca] tabular-nums text-right shrink-0">
                  {entry.isTba ? <TbaText text={entry.value} /> : entry.value}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </RevealSection>
  );
}
