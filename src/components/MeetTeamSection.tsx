import { CONFERENCE_DATA } from '../data/conference';
import { RevealSection, SectionHeading } from './RevealSection';
import { TbaText } from './TbaText';

/**
 * Institutional three-column organizing departments directory,
 * replacing 12 repetitive boxed cards with a clean structured roster.
 */
export function MeetTeamSection() {
  return (
    <RevealSection id="team" ariaLabelledBy="team-heading">
      <div className="mb-10 sm:mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-[#ede6ca]/16 pb-6">
        <SectionHeading
          id="team-heading"
          indexLabel="04"
          label={CONFERENCE_DATA.team.label}
          prefix="Organizing"
          italicWord="Departments"
        />
        <p className="text-sm text-[#c9c2a6] max-w-[44ch]">
          Twelve specialized departments across operations, creative communications, and logistics
          administration.
        </p>
      </div>

      <div className="willow-folio rounded-[3px] overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[#ede6ca]/14">
          {CONFERENCE_DATA.team.groups.map((group) => (
            <section key={group.id} aria-label={group.title} className="flex flex-col">
              <header className="border-b border-[#ede6ca]/14 bg-[#191f0e]/70 px-6 py-4">
                <h3 className="text-xs font-semibold tracking-[0.1em] text-[#ede6ca]">
                  {group.title}
                </h3>
              </header>

              <ul className="divide-y divide-[#ede6ca]/12 flex-1">
                {group.departments.map((dept) => (
                  <li
                    key={dept.id}
                    className="px-6 py-4 flex items-baseline justify-between gap-4 hover:bg-[#ede6ca]/[0.025] transition-colors duration-150"
                  >
                    <div className="min-w-0">
                      <p className="font-serif text-xl font-medium text-[#ede6ca] leading-snug">
                        {dept.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[#c9c2a6]">{dept.role}</p>
                    </div>
                    <TbaText text={dept.holder} className="text-lg shrink-0" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </RevealSection>
  );
}
