import { CONFERENCE_DATA } from '../data/conference';
import { PanelSection } from './PanelSection';
import { TbaText } from './TbaText';

/**
 * Section 3: Executive Board — four-item grid with a small role label,
 * large italic moss-green TBA, and a thin 1px moss-green line on the left.
 */
export function ExecutiveBoardSection() {
  return (
    <PanelSection id="executive-board" heading={CONFERENCE_DATA.executiveBoard.heading}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-8">
        {CONFERENCE_DATA.executiveBoard.roles.map((entry) => (
          <div
            key={entry.id}
            className="border-l border-[#6b7547] pl-5 py-1 flex flex-col gap-2"
          >
            <span className="text-xs sm:text-sm font-medium tracking-wide text-[#c9c2a4]">
              {entry.role}
            </span>
            <TbaText
              text={entry.holder}
              className="text-3xl sm:text-4xl font-normal leading-none"
            />
          </div>
        ))}
      </div>
    </PanelSection>
  );
}
