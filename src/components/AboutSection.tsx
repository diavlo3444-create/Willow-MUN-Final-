import { CONFERENCE_DATA } from '../data/conference';
import { usePublishedWebsite } from '../utils/usePublishedWebsite';
import { InteractiveCard } from './InteractiveCard';
import { RevealSection, SectionHeading } from './RevealSection';
import { TbaText } from './TbaText';

/**
 * About section: "Conference identity" / "ABOUT WILLOW." with two editorial paragraphs
 * followed by the three conference overview stat boxes (Committees, Conference Year, Venue).
 */
export function AboutSection() {
  const { published } = usePublishedWebsite();
  const aboutSec = published.sections.find((s) => s.sectionKey === 'about');
  const label = aboutSec?.label || CONFERENCE_DATA.about.label;
  const paragraph = aboutSec?.bodyText || CONFERENCE_DATA.about.paragraphs[0];

  return (
    <RevealSection id="about" ariaLabelledBy="about-heading">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        <div className="lg:col-span-5">
          <SectionHeading
            id="about-heading"
            label={label}
            prefix="ABOUT"
            italicWord="WILLOW"
            period
          />
        </div>

        <div className="lg:col-span-7 space-y-5 border-t border-[#ede6ca]/18 pt-6 lg:border-t-0 lg:pt-2 text-base sm:text-[17px] leading-[1.75] text-[#cfc8aa] max-w-[65ch]">
          <p>{paragraph}</p>
          <p>
            The full conference story, guiding theme, and institutional charter are currently{' '}
            <TbaText text="TBA" className="text-xl" /> and will be published ahead of delegate
            registrations.
          </p>
        </div>
      </div>

      <dl className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {CONFERENCE_DATA.globalStage.stats.map((stat, idx) => (
          <InteractiveCard key={stat.id} staggerIndex={idx} className="px-6 py-5">
            <dt className="text-[clamp(10px,2.8vw,11px)] uppercase tracking-[0.2em] text-[#cfc8aa] whitespace-nowrap">
              {stat.label}
            </dt>
            <dd className="mt-2 font-serif text-[clamp(1.4rem,3vw,1.875rem)] font-medium text-[#ede6ca] tabular-nums whitespace-nowrap">
              {stat.isTba ? <TbaText text={stat.value} /> : stat.value}
            </dd>
          </InteractiveCard>
        ))}
      </dl>
    </RevealSection>
  );
}
