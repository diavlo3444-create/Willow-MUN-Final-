import { useEffect, useState } from 'react';
import { CONFERENCE_DATA } from '../data/conference';
import { COMMITTEES_UPDATED_EVENT, fetchPublicCommittees } from '../services/liveBackendService';
import type { CommitteeRecord } from '../types/admin';
import { usePublishedWebsite } from '../utils/usePublishedWebsite';
import { RevealSection, SectionHeading } from './RevealSection';
import { TbaText } from './TbaText';

/**
 * Architectural two-column Chamber Directory for Committees,
 * synced live with Supabase / DCC Committee Management and falling back cleanly to conference baseline.
 */
export function CommitteesSection() {
  const { published } = usePublishedWebsite();
  const [liveCommittees, setLiveCommittees] = useState<CommitteeRecord[]>([]);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      const items = await fetchPublicCommittees();
      if (active && items.length > 0) {
        setLiveCommittees(items);
      }
    };
    void sync();

    const onUpdated = () => void sync();
    window.addEventListener(COMMITTEES_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onUpdated);
    return () => {
      active = false;
      window.removeEventListener(COMMITTEES_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onUpdated);
    };
  }, []);

  const committeesSec = published.sections.find((s) => s.sectionKey === 'committees');
  const label = committeesSec?.label || CONFERENCE_DATA.committees.label;
  const subIntro =
    committeesSec?.bodyText ||
    'Diplomatic chambers spanning specialized multilateral debate formats. Managed live by Delegate & Committee Affairs.';

  const items =
    liveCommittees.length > 0
      ? liveCommittees.map((c) => ({
          id: c.id,
          chamber: c.chamber || 'Chamber',
          name: c.name,
          details: [
            c.description || null,
            c.topics.length ? `Topics: ${c.topics.join(' · ')}` : null,
            c.chairName && c.chairName !== 'TBA' ? `Chair: ${c.chairName}` : null,
          ]
            .filter(Boolean)
            .join(' — ') || 'Agenda & Study Guide',
          isTbaName: c.name.trim().toLowerCase() === 'committee' || c.chairName === 'TBA',
          isTbaDetails: !c.description || c.description.toLowerCase().includes('to be announced'),
        }))
      : CONFERENCE_DATA.committees.items.map((item) => ({
          id: item.id,
          chamber: item.chamber,
          name: item.name,
          details: item.details,
          isTbaName: true,
          isTbaDetails: true,
        }));

  return (
    <RevealSection id="committees" ariaLabelledBy="committees-heading">
      <div className="mb-8 grid grid-cols-1 items-end gap-6 sm:mb-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <SectionHeading
            id="committees-heading"
            indexLabel="02"
            label={label}
            prefix="Conference"
            italicWord="Chambers"
          />
        </div>
        <p className="max-w-[50ch] text-sm leading-[1.7] text-[#c9c2a6] lg:col-span-5">
          {subIntro}
        </p>
      </div>

      <div className="willow-folio overflow-hidden rounded-[3px]">
        <div className="grid grid-cols-1 divide-y divide-[#ede6ca]/14 md:grid-cols-2">
          {items.map((item, idx) => {
            const indexNum = String(idx + 1).padStart(2, '0');
            const isLeftCol = idx % 2 === 0;
            const isLastRow = idx >= items.length - 2;

            return (
              <article
                key={item.id}
                className={`p-6 transition-colors duration-150 hover:bg-[#ede6ca]/[0.025] sm:p-7 ${
                  isLeftCol ? 'md:border-r md:border-[#ede6ca]/14' : ''
                } ${isLastRow ? 'md:border-b-0' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-xs tabular-nums text-[#a9b47e]">
                    {item.chamber}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[#cfc8aa]/70">
                    Dossier {indexNum}
                  </span>
                </div>

                <h3 className="mt-3 font-serif text-2xl font-medium leading-snug text-[#ede6ca] sm:text-[26px]">
                  {item.name} {item.isTbaName && <TbaText text="TBA" />}
                </h3>

                <p className="mt-3 flex items-baseline justify-between gap-3 border-t border-[#ede6ca]/10 pt-3 text-sm text-[#c9c2a6]">
                  <span>{item.details}</span>
                  {item.isTbaDetails && <TbaText text="TBA" className="shrink-0 text-base" />}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </RevealSection>
  );
}
