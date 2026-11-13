import { CONFERENCE_DATA } from '../data/conference';
import { PanelSection } from './PanelSection';
import { TbaText } from './TbaText';

/**
 * Section 4: Updates — two editorial entries with "Date TBA" on the left
 * and title + single-line note on the right.
 */
export function UpdatesSection() {
  return (
    <PanelSection id="updates" heading={CONFERENCE_DATA.updates.heading}>
      <ul className="divide-y divide-[#ede6ca]/18 border-y border-[#ede6ca]/18">
        {CONFERENCE_DATA.updates.entries.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-col gap-2 py-6 md:grid md:grid-cols-12 md:items-baseline md:gap-8"
          >
            <div className="md:col-span-3 text-sm sm:text-base text-[#c9c2a4]">
              Date <TbaText text="TBA" className="text-lg sm:text-xl" />
            </div>
            <div className="md:col-span-9 space-y-1.5">
              <h3 className="font-serif text-xl sm:text-2xl font-medium text-[#ede6ca]">
                {entry.title}
              </h3>
              <p className="text-sm sm:text-base text-[#c9c2a4] leading-relaxed">
                {entry.summary}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </PanelSection>
  );
}
