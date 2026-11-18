import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { ArrowDownRight, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { CONFERENCE_DATA } from '../data/conference';
import { COMMITTEES_UPDATED_EVENT, fetchPublicCommittees } from '../services/liveBackendService';
import type { CommitteeRecord } from '../types/admin';
import { usePublishedWebsite } from '../utils/usePublishedWebsite';
import { ParallaxFrame, RevealItem } from './MotionPrimitives';
import { RevealSection, SectionHeading } from './RevealSection';
import { TbaText } from './TbaText';

interface DisplayCommittee {
  id: string;
  chamber: string;
  abbreviation: string;
  difficulty: string;
  name: string;
  description: string;
  topics: string[];
  chairName: string;
  viceChairName: string;
  capacity: number | null;
  isTbaName: boolean;
  isTbaDetails: boolean;
}

/**
 * Section 02: Interactive Conference Chambers Explorer
 * - Live-synced with Supabase `wm_committees` / DCC Committee Management
 * - Desktop: Interactive index list + Active Dossier inspection panel
 * - Mobile: Clean inline accordion rows so exploring chambers takes zero vertical hunting
 */
export function CommitteesSection() {
  const { published } = usePublishedWebsite();
  const [liveCommittees, setLiveCommittees] = useState<CommitteeRecord[]>([]);
  const [chamberFilter, setChamberFilter] = useState<string>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileExpandedId, setMobileExpandedId] = useState<string | null>(null);

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
    'Diplomatic chambers spanning specialized multilateral debate formats, curated and maintained by Delegate & Committee Affairs.';

  const items: DisplayCommittee[] = useMemo(() => {
    if (liveCommittees.length > 0) {
      return liveCommittees.map((c) => {
        const cleanDesc = (c.description || '').trim();
        return {
          id: c.id,
          chamber: c.chamber || 'Chamber',
          abbreviation: c.abbreviation || '',
          difficulty: c.difficulty || '',
          name: c.name,
          description:
            cleanDesc ||
            'Full background guide, procedural scope, and committee briefing will be published ahead of delegate allocation.',
          topics: c.topics.filter(Boolean),
          chairName: c.chairName || 'TBA',
          viceChairName: c.viceChairName || 'TBA',
          capacity: c.capacity || null,
          isTbaName: c.name.trim().toLowerCase() === 'committee',
          isTbaDetails: !cleanDesc || cleanDesc.toLowerCase().includes('to be announced'),
        };
      });
    }

    return CONFERENCE_DATA.committees.items.map((item) => ({
      id: item.id,
      chamber: item.chamber,
      abbreviation: '',
      difficulty: '',
      name: item.name,
      description:
        'Committee mandate, substantive study guide, and dais appointments will be published by Delegate & Committee Affairs.',
      topics: [],
      chairName: 'TBA',
      viceChairName: 'TBA',
      capacity: null,
      isTbaName: true,
      isTbaDetails: true,
    }));
  }, [liveCommittees]);

  const chamberCategories = useMemo(() => {
    const unique = Array.from(new Set(items.map((i) => i.chamber).filter(Boolean)));
    // Show filter bar when meaningful distinct chamber types exist (not just Chamber 01..06)
    const distinctRealChambers = unique.filter((u) => !/^Chamber\s+\d+$/i.test(u));
    return distinctRealChambers.length > 1 ? ['All', ...unique] : [];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (chamberFilter === 'All' || chamberCategories.length === 0) return items;
    return items.filter((item) => item.chamber === chamberFilter);
  }, [chamberCategories.length, chamberFilter, items]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredItems.some((i) => i.id === selectedId)) {
      setSelectedId(filteredItems[0].id);
    }
    if (!mobileExpandedId) {
      setMobileExpandedId(filteredItems[0].id);
    }
  }, [filteredItems, selectedId, mobileExpandedId]);

  const activeIndex = Math.max(
    0,
    filteredItems.findIndex((i) => i.id === selectedId),
  );
  const activeCommittee = filteredItems[activeIndex] ?? filteredItems[0] ?? null;

  const stepCommittee = (delta: -1 | 1) => {
    if (filteredItems.length <= 1) return;
    const nextIdx = (activeIndex + delta + filteredItems.length) % filteredItems.length;
    setSelectedId(filteredItems[nextIdx].id);
  };

  const handleAnchor = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = document.querySelector(href);
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <RevealSection id="committees" ariaLabelledBy="committees-heading">
      {/* Header Row */}
      <div className="mb-8 sm:mb-10 grid grid-cols-1 items-end gap-6 lg:grid-cols-12 lg:gap-12 border-b border-[#ede6ca]/18 pb-6">
        <div className="lg:col-span-7">
          <SectionHeading
            id="committees-heading"
            indexLabel="02"
            label={label}
            prefix="Conference"
            italicWord="Chambers"
          />
        </div>
        <RevealItem staggerIndex={1} className="lg:col-span-5 space-y-3">
          <p className="text-sm leading-[1.7] text-[#cfc8aa]">{subIntro}</p>
          {chamberCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1" role="tablist" aria-label="Filter committees by chamber">
              {chamberCategories.map((cat) => {
                const isSelected = chamberFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setChamberFilter(cat)}
                    className={`pb-1 text-xs font-medium tracking-[0.04em] border-b transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'border-[#ede6ca] text-[#ede6ca]'
                        : 'border-transparent text-[#cfc8aa]/70 hover:text-[#ede6ca]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}
        </RevealItem>
      </div>

      {/* DESKTOP EXPLORER (>= 1024px): Master Index + Featured Active Dossier */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-8 items-start">
        <RevealItem staggerIndex={2} className="lg:col-span-5">
          <div
            role="listbox"
            aria-label="Conference committees directory"
            className="divide-y divide-[#ede6ca]/14 border-y border-[#ede6ca]/14"
          >
            {filteredItems.map((item, idx) => {
              const isSelected = activeCommittee?.id === item.id;
              const indexNum = String(idx + 1).padStart(2, '0');
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => setSelectedId(item.id)}
                  className={`group w-full px-4 py-4 text-left transition-colors duration-150 cursor-pointer flex items-center justify-between gap-4 ${
                    isSelected
                      ? 'bg-[#ede6ca]/[0.07] text-[#ede6ca]'
                      : 'text-[#cfc8aa] hover:bg-[#ede6ca]/[0.03] hover:text-[#ede6ca]'
                  }`}
                >
                  <div className="min-w-0 flex items-baseline gap-3.5">
                    <span
                      className={`font-mono text-xs tabular-nums shrink-0 ${
                        isSelected ? 'text-[#ede6ca]' : 'text-[#a9b47e]/80'
                      }`}
                    >
                      {indexNum}
                    </span>
                    <div className="min-w-0">
                      <p className="font-serif text-xl font-medium leading-snug text-[#ede6ca] truncate">
                        {item.name}{' '}
                        {item.isTbaName ? <TbaText text="TBA" className="text-lg" /> : null}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-[#cfc8aa]/75 truncate">
                        {item.chamber}
                        {item.abbreviation ? ` · ${item.abbreviation}` : ''}
                      </p>
                    </div>
                  </div>

                  <span
                    aria-hidden="true"
                    className={`font-mono text-xs transition-opacity duration-150 shrink-0 ${
                      isSelected ? 'opacity-100 text-[#a9b47e]' : 'opacity-0 group-hover:opacity-60'
                    }`}
                  >
                    Open
                  </span>
                </button>
              );
            })}
          </div>
        </RevealItem>

        {/* Active Chamber Dossier */}
        {activeCommittee && (
          <ParallaxFrame offsetPx={10} className="lg:col-span-7 min-w-0">
            <RevealItem staggerIndex={3}>
              <article
                key={activeCommittee.id}
                className="mun-step-enter border border-[#ede6ca]/20 bg-[#12160a]/88 p-8 rounded-[3px] min-w-0"
              >
            <div className="flex items-center justify-between gap-4 border-b border-[#ede6ca]/14 pb-4">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs text-[#a9b47e]">
                <span>Dossier {String(activeIndex + 1).padStart(2, '0')}</span>
                <span aria-hidden="true" className="text-[#ede6ca]/30">
                  ·
                </span>
                <span>{activeCommittee.chamber}</span>
                {activeCommittee.abbreviation && (
                  <>
                    <span aria-hidden="true" className="text-[#ede6ca]/30">
                      ·
                    </span>
                    <span className="text-[#ede6ca]">{activeCommittee.abbreviation}</span>
                  </>
                )}
                {activeCommittee.difficulty && (
                  <>
                    <span aria-hidden="true" className="text-[#ede6ca]/30">
                      ·
                    </span>
                    <span className="text-[#cfc8aa]">{activeCommittee.difficulty}</span>
                  </>
                )}
              </div>

              {filteredItems.length > 1 && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => stepCommittee(-1)}
                    aria-label="Previous chamber"
                    className="mun-btn-interactive flex h-9 w-9 items-center justify-center rounded-[2px] border border-[#ede6ca]/24 text-[#ede6ca] hover:border-[#ede6ca]/60 cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepCommittee(1)}
                    aria-label="Next chamber"
                    className="mun-btn-interactive flex h-9 w-9 items-center justify-center rounded-[2px] border border-[#ede6ca]/24 text-[#ede6ca] hover:border-[#ede6ca]/60 cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

            <div className="pt-6 space-y-6">
              <div>
                <h3 className="font-serif text-3xl sm:text-4xl font-medium leading-[1.08] text-[#ede6ca] [text-wrap:balance]">
                  {activeCommittee.name}{' '}
                  {activeCommittee.isTbaName ? <TbaText text="TBA" /> : null}
                </h3>
                <p className="mt-4 text-[15px] leading-[1.78] text-[#d6cfb4]">
                  {activeCommittee.description}{' '}
                  {activeCommittee.isTbaDetails ? <TbaText text="TBA" className="text-lg" /> : null}
                </p>
              </div>

              {activeCommittee.topics.length > 0 && (
                <div className="border-t border-[#ede6ca]/14 pt-5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#a9b47e] mb-3">
                    Provisional Agenda Topics
                  </p>
                  <ol className="space-y-2 text-sm text-[#ede6ca]">
                    {activeCommittee.topics.map((topic, idx) => (
                      <li key={topic} className="flex items-baseline gap-3">
                        <span className="font-mono text-xs text-[#cfc8aa]/70 tabular-nums">
                          0{idx + 1}
                        </span>
                        <span>{topic}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <dl className="grid grid-cols-3 gap-4 border-t border-[#ede6ca]/14 pt-5 text-sm">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#cfc8aa]/75">
                    Chair
                  </dt>
                  <dd className="mt-1 font-serif text-lg text-[#ede6ca]">
                    {activeCommittee.chairName === 'TBA' ? (
                      <TbaText text="TBA" />
                    ) : (
                      activeCommittee.chairName
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#cfc8aa]/75">
                    Vice-Chair
                  </dt>
                  <dd className="mt-1 font-serif text-lg text-[#ede6ca]">
                    {activeCommittee.viceChairName === 'TBA' ? (
                      <TbaText text="TBA" />
                    ) : (
                      activeCommittee.viceChairName
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#cfc8aa]/75">
                    Delegations
                  </dt>
                  <dd className="mt-1 font-serif text-lg text-[#ede6ca] tabular-nums">
                    {activeCommittee.capacity ? `${activeCommittee.capacity} Seats` : <TbaText text="TBA" />}
                  </dd>
                </div>
              </dl>

              <div className="border-t border-[#ede6ca]/14 pt-5 flex items-center justify-between gap-4">
                <span className="text-xs text-[#cfc8aa]">
                  Managed by Delegate & Committee Affairs
                </span>
                <a
                  href="#updates"
                  onClick={(e) => handleAnchor(e, '#updates')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#ede6ca] hover:text-[#a9b47e] transition-colors"
                >
                  <span className="border-b border-[#ede6ca]/40 pb-0.5">
                    Delegate registration timeline
                  </span>
                  <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
            </article>
            </RevealItem>
          </ParallaxFrame>
        )}
      </div>

      {/* MOBILE / TABLET ACCORDION DIRECTORY (< 1024px) */}
      <RevealItem staggerIndex={2} className="lg:hidden divide-y divide-[#ede6ca]/16 border-y border-[#ede6ca]/16">
        {filteredItems.map((item, idx) => {
          const isOpen = mobileExpandedId === item.id;
          const indexNum = String(idx + 1).padStart(2, '0');
          return (
            <div key={item.id} className="py-1">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setMobileExpandedId(isOpen ? null : item.id)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left cursor-pointer min-h-[56px]"
              >
                <div className="min-w-0 flex items-baseline gap-3">
                  <span className="font-mono text-xs text-[#a9b47e] tabular-nums shrink-0">
                    {indexNum}
                  </span>
                  <div className="min-w-0">
                    <p className="font-serif text-xl sm:text-2xl font-medium leading-snug text-[#ede6ca]">
                      {item.name}{' '}
                      {item.isTbaName ? <TbaText text="TBA" className="text-lg" /> : null}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-[#cfc8aa]/75">
                      {item.chamber}
                      {item.abbreviation ? ` · ${item.abbreviation}` : ''}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[#cfc8aa] transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-[#ede6ca]' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {isOpen && (
                <div className="mun-step-enter pb-5 pl-7 space-y-4">
                  <p className="text-sm leading-[1.72] text-[#d6cfb4]">
                    {item.description}{' '}
                    {item.isTbaDetails ? <TbaText text="TBA" className="text-base" /> : null}
                  </p>

                  {item.topics.length > 0 && (
                    <ul className="space-y-1.5 border-t border-[#ede6ca]/12 pt-3 text-xs text-[#ede6ca]">
                      {item.topics.map((topic, tIdx) => (
                        <li key={topic} className="flex items-baseline gap-2">
                          <span className="font-mono text-[#a9b47e] tabular-nums">
                            0{tIdx + 1}
                          </span>
                          <span>{topic}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <dl className="grid grid-cols-2 gap-3 border-t border-[#ede6ca]/12 pt-3 text-xs">
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#cfc8aa]/75">
                        Chair
                      </dt>
                      <dd className="mt-0.5 text-sm text-[#ede6ca]">
                        {item.chairName === 'TBA' ? <TbaText text="TBA" /> : item.chairName}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#cfc8aa]/75">
                        Capacity
                      </dt>
                      <dd className="mt-0.5 text-sm text-[#ede6ca] tabular-nums">
                        {item.capacity ? `${item.capacity} Seats` : <TbaText text="TBA" />}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          );
        })}
      </RevealItem>
    </RevealSection>
  );
}
