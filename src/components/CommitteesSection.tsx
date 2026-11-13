import { CONFERENCE_DATA } from '../data/conference';
import { PanelSection } from './PanelSection';
import { TbaText } from './TbaText';

/**
 * Section 2: Committees — four placeholder rows separated by thin cream lines,
 * stacking vertically on mobile viewports.
 */
export function CommitteesSection() {
  return (
    <PanelSection id="committees" heading={CONFERENCE_DATA.committees.heading}>
      <ul className="divide-y divide-[#ede6ca]/18 border-y border-[#ede6ca]/18">
        {CONFERENCE_DATA.committees.items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 py-5 md:grid md:grid-cols-12 md:items-baseline md:gap-6"
          >
            <div className="md:col-span-4 font-serif text-xl sm:text-2xl font-medium text-[#ede6ca]">
              {item.name}
            </div>
            <div className="md:col-span-5 text-sm sm:text-base text-[#c9c2a4]">
              Agenda: <TbaText text={item.agenda} className="text-lg sm:text-xl" />
            </div>
            <div className="md:col-span-3 md:text-right text-sm sm:text-base text-[#c9c2a4]">
              Chairs: <TbaText text={item.chairs} className="text-lg sm:text-xl" />
            </div>
          </li>
        ))}
      </ul>
    </PanelSection>
  );
}
