import { CONFERENCE_DATA } from '../data/conference';
import { usePublishedWebsite } from '../utils/usePublishedWebsite';
import { ParallaxFrame, RevealItem } from './MotionPrimitives';
import { RevealSection, SectionHeading } from './RevealSection';
import { TbaText } from './TbaText';

/**
 * Section 01: Conference Theme, Meaning & Charter
 * Editorial two-part spread featuring a full-width serif pull-quote on the Willow ethos
 * paired with a drop-cap Charter statement and a ruled Conference Architecture folio.
 */
export function AboutSection() {
  const { published, settings } = usePublishedWebsite();
  const aboutSec = published.sections.find((s) => s.sectionKey === 'about');
  const label = aboutSec?.label || CONFERENCE_DATA.about.label;
  const paragraph = aboutSec?.bodyText || CONFERENCE_DATA.about.paragraphs[0];

  const charterSpecs = [
    {
      key: 'committees',
      term: 'Planned Committees',
      value: `${CONFERENCE_DATA.committees.items.length} Chambers`,
      note: 'Agendas & Study Guides TBA',
      isTba: false,
    },
    {
      key: 'year',
      term: 'Edition Cycle',
      value: settings.editionYear || CONFERENCE_DATA.brand.year,
      note: 'Inaugural annual conference',
      isTba: false,
    },
    {
      key: 'venue',
      term: 'Dates & Venue',
      value:
        settings.datesText !== 'TBA' || settings.venueText !== 'TBA'
          ? `${settings.datesText} · ${settings.venueText}`
          : 'TBA',
      note: 'Official Secretariat confirmation',
      isTba: settings.datesText === 'TBA' && settings.venueText === 'TBA',
    },
    {
      key: 'cadre',
      term: 'Organizing Structure',
      value: `${CONFERENCE_DATA.team.groups.reduce((n, g) => n + g.departments.length, 0)} Departments`,
      note: 'Operations, Creative & Logistics',
      isTba: false,
    },
  ];

  return (
    <RevealSection id="about" ariaLabelledBy="about-heading">
      <div className="space-y-10 sm:space-y-14">
        {/* Top Row: Heading + Editorial Theme Pull-Quote */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
          <div className="lg:col-span-5">
            <SectionHeading
              id="about-heading"
              indexLabel="01"
              label={label}
              prefix="The Spirit of"
              italicWord="Willow"
            />
          </div>

          <RevealItem staggerIndex={1} className="lg:col-span-7">
            <figure className="border-y border-[#ede6ca]/18 py-5 sm:py-6">
              <blockquote className="font-serif text-xl sm:text-2xl lg:text-[27px] italic leading-[1.38] text-[#ede6ca] [text-wrap:balance]">
                &ldquo;{CONFERENCE_DATA.about.themeQuote}&rdquo;
              </blockquote>
              <figcaption className="mt-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#a9b47e]">
                Inaugural Theme · Flexibility Rooted in Principle
              </figcaption>
            </figure>
          </RevealItem>
        </div>

        {/* Lower Asymmetric Spread: Long-form Charter + Unboxed Ruled Fact Directory */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          <RevealItem
            staggerIndex={2}
            className="lg:col-span-7 space-y-5 max-w-[64ch] text-base sm:text-[17px] leading-[1.8] text-[#dcd5ba]"
          >
            <p className="first-letter:float-left first-letter:mr-3.5 first-letter:mt-1 first-letter:font-serif first-letter:text-5xl first-letter:font-medium first-letter:leading-[0.85] first-letter:text-[#ede6ca]">
              {paragraph}
            </p>
            <p className="text-[#cbc4a8]">{CONFERENCE_DATA.about.themeMeaning}</p>
            <p className="text-[#bcb598]">
              {CONFERENCE_DATA.globalStage.description} The complete institutional charter,
              committee background guides, and rules of procedure remain{' '}
              <TbaText text="TBA" className="text-xl" /> ahead of delegate registration.
            </p>
          </RevealItem>

          <ParallaxFrame offsetPx={12} className="lg:col-span-5">
            <RevealItem staggerIndex={3}>
              <aside
                aria-label="Conference charter specifications"
                className="border-t border-[#ede6ca]/24 pt-2"
              >
                <p className="py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[#a9b47e]">
                  {CONFERENCE_DATA.globalStage.label} · Session Prospectus
                </p>

                <dl className="divide-y divide-[#ede6ca]/14 border-y border-[#ede6ca]/14">
                  {charterSpecs.map((entry) => (
                    <div
                      key={entry.key}
                      className="py-4 flex items-baseline justify-between gap-4 transition-colors duration-200 hover:bg-[#ede6ca]/[0.02]"
                    >
                      <div className="min-w-0">
                        <dt className="text-sm font-medium text-[#ede6ca]">{entry.term}</dt>
                        <dd className="mt-0.5 text-xs text-[#cfc8aa]/75">{entry.note}</dd>
                      </div>
                      <dd className="font-serif text-xl sm:text-2xl font-medium text-[#ede6ca] tabular-nums text-right shrink-0">
                        {entry.isTba ? <TbaText text={entry.value} /> : entry.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </aside>
            </RevealItem>
          </ParallaxFrame>
        </div>
      </div>
    </RevealSection>
  );
}
