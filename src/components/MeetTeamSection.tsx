import { CONFERENCE_DATA } from '../data/conference';
import { InteractiveCard } from './InteractiveCard';
import { RevealSection, SectionHeading } from './RevealSection';
import { TbaText } from './TbaText';

/**
 * Meet the Team section: grouped by department across all 12 conference departments,
 * each card displaying its department, role, and italic moss TBA.
 */
export function MeetTeamSection() {
  let cardCounter = 0;

  return (
    <RevealSection id="team" ariaLabelledBy="team-heading">
      <div className="mb-12">
        <SectionHeading
          id="team-heading"
          label={CONFERENCE_DATA.team.label}
          prefix="MEET THE"
          italicWord="TEAM"
          period
        />
      </div>

      <div className="space-y-12">
        {CONFERENCE_DATA.team.groups.map((group) => (
          <div key={group.id}>
            <div className="mb-5 flex items-center gap-4 min-w-0">
              <h3 className="text-[clamp(0.6875rem,2.6vw,0.875rem)] font-medium uppercase tracking-[0.2em] text-[#cfc8aa] break-words">
                {group.title}
              </h3>
              <div className="h-px flex-1 min-w-[24px] bg-[#ede6ca]/15" aria-hidden="true" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {group.departments.map((dept) => {
                const idx = cardCounter++;
                return (
                  <InteractiveCard
                    key={dept.id}
                    staggerIndex={idx % 4}
                    className="p-5 sm:p-6"
                  >
                    <article className="h-full min-w-0 flex flex-col justify-between gap-4">
                      <div className="min-w-0">
                        <h4 className="font-serif text-[clamp(1.2rem,2.4vw,1.5rem)] font-medium text-[#ede6ca] break-words">
                          {dept.name}
                        </h4>
                        <p className="mt-1 text-[clamp(0.65rem,2.3vw,0.75rem)] uppercase tracking-[0.14em] text-[#cfc8aa] break-words">
                          {dept.role}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[#ede6ca]/12">
                        <TbaText text={dept.holder} className="text-xl whitespace-nowrap" />
                      </div>
                    </article>
                  </InteractiveCard>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </RevealSection>
  );
}
