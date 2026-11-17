import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import membersJson from '../data/members.json';
import { CONFERENCE_DATA } from '../data/conference';
import {
  computeDesktopPedigreePaths,
  computeMobileTreePaths,
  computeZoomTransform,
  organizeFamilyTree,
  type FamilyTreeData,
  type OrderedMember,
  type RectBox,
  type SvgConnectorPath,
} from '../utils/familyTreeLayout';
import { MemberProfileModal } from './MemberProfileModal';
import { RevealSection, SectionHeading } from './RevealSection';

interface StageGeometry {
  width: number;
  height: number;
  paths: SvgConnectorPath[];
  boxLocalRects: Record<string, RectBox>;
}

function toLocalRect(el: HTMLElement, stageRect: DOMRect, scaleFactor: number): RectBox {
  const r = el.getBoundingClientRect();
  const inv = scaleFactor !== 0 ? 1 / scaleFactor : 1;
  const left = (r.left - stageRect.left) * inv;
  const top = (r.top - stageRect.top) * inv;
  const width = r.width * inv;
  const height = r.height * inv;
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

function LeafGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 text-[#c9d98a]"
    >
      <path
        fill="currentColor"
        d="M10 1.8C6.3 5.5 4.7 9.7 5.5 14C6 16.4 7.8 18 10 18.6C12.2 18 14 16.4 14.5 14C15.3 9.7 13.7 5.5 10 1.8Z"
      />
    </svg>
  );
}

interface MemberButtonProps {
  member: OrderedMember;
  layoutKey: 'desktop' | 'mobile';
  isActive: boolean;
  isPulsing: boolean;
  isDimmed: boolean;
  fadeDelayMs: number;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onSelect: (member: OrderedMember, buttonEl: HTMLButtonElement) => void;
}

function MemberNodeButton({
  member,
  isActive,
  isPulsing,
  isDimmed,
  fadeDelayMs,
  buttonRef,
  onSelect,
}: MemberButtonProps) {
  return (
    <div
      style={{ transitionDelay: `${fadeDelayMs}ms` }}
      className="ft-node-fade w-full"
    >
      <button
        ref={buttonRef}
        type="button"
        data-member-id={member.id}
        data-pulsing={isPulsing ? 'true' : undefined}
        aria-label={`${member.name}, ${member.displayRole}`}
        style={{
          opacity: isDimmed ? 0.15 : 1,
        }}
        onClick={(e) => onSelect(member, e.currentTarget)}
        className={`ft-member-box group flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-left cursor-pointer focus-visible:outline-none ${
          isActive ? 'z-20 border-[#ede6ca]/80' : 'z-10'
        }`}
      >
        {member.photo ? (
          <img
            src={member.photo.startsWith('/') ? member.photo : `/${member.photo}`}
            alt=""
            loading="lazy"
            className="h-10 w-10 shrink-0 rounded-full border border-[#c9d98a]/35 object-cover"
            style={{ objectPosition: member.objectPosition }}
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#c9d98a]/25 bg-[#202414]">
            <LeafGlyph />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-[1.06rem] sm:text-[1.12rem] font-medium leading-tight text-[#ede6ca] break-words">
            {member.name}
          </span>
          <span
            style={{ fontVariantCaps: 'small-caps' }}
            className="mt-0.5 block text-[11px] font-medium tracking-[0.11em] text-[#cfc8aa] break-words"
          >
            {member.displayRole}
          </span>
        </span>
      </button>
    </div>
  );
}

/**
 * Interactive Executive Board family-tree section built dynamically from members.json.
 * - Desktop (>= 900px): center Secretariat trunk + left/right bracket pedigree chart over faint willow-tree-only.svg
 * - Mobile (< 900px): vertical left-trunk tree with L-shaped group connectors
 * - Click opens FLIP profile card with zoomed focus, bud photo clip reveal, word-by-word quote, and focus trap
 */
export function ExecutiveBoardSection() {
  const treeData = useMemo(() => organizeFamilyTree(membersJson as FamilyTreeData), []);

  const outerWrapperRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const desktopButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobileButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const desktopLabelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mobileLabelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pulseTimerRef = useRef<number | null>(null);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [treeRevealed, setTreeRevealed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [geometry, setGeometry] = useState<StageGeometry>({
    width: 0,
    height: 0,
    paths: [],
    boxLocalRects: {},
  });

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pulsingId, setPulsingId] = useState<string | null>(null);
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
  const [isClosingModal, setIsClosingModal] = useState(false);

  const lastViewedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
      if (e.matches) {
        setTreeRevealed(true);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current !== null) {
        window.clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  // Scroll-in connector draw trigger using IntersectionObserver (no scroll listener)
  useEffect(() => {
    const el = outerWrapperRef.current;
    if (!el || treeRevealed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setTreeRevealed(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.06, rootMargin: '0px 0px -32px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [treeRevealed]);

  // Measure real DOM rects of rendered boxes & group labels and compute SVG overlay paths
  const measureConnectors = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const naturalW = stage.offsetWidth;
    const naturalH = stage.offsetHeight;
    if (naturalW === 0 || naturalH === 0) return;

    const stageRect = stage.getBoundingClientRect();
    const scaleFactor = stageRect.width / naturalW || 1;
    const isDesktop = window.matchMedia('(min-width: 900px)').matches;
    const boxLocalRects: Record<string, RectBox> = {};

    if (isDesktop) {
      const centerRects: RectBox[] = [];
      for (const cg of treeData.centerGroups) {
        for (const m of cg.members) {
          const btn = desktopButtonRefs.current[m.id];
          if (btn && btn.offsetWidth > 0) {
            const local = toLocalRect(btn, stageRect, scaleFactor);
            centerRects.push(local);
            boxLocalRects[m.id] = local;
          }
        }
      }

      const sideGroups = [...treeData.leftGroups, ...treeData.rightGroups].map((gw) => {
        const labelEl = desktopLabelRefs.current[gw.group.id];
        const labelRect =
          labelEl && labelEl.offsetWidth > 0
            ? toLocalRect(labelEl, stageRect, scaleFactor)
            : null;
        const memberRects: RectBox[] = [];
        for (const m of gw.members) {
          const btn = desktopButtonRefs.current[m.id];
          if (btn && btn.offsetWidth > 0) {
            const local = toLocalRect(btn, stageRect, scaleFactor);
            memberRects.push(local);
            boxLocalRects[m.id] = local;
          }
        }
        return {
          groupId: gw.group.id,
          side: gw.group.side as 'left' | 'right',
          labelRect,
          memberRects,
        };
      });

      const paths = computeDesktopPedigreePaths(centerRects, sideGroups, naturalW / 2);
      setGeometry({ width: naturalW, height: naturalH, paths, boxLocalRects });
    } else {
      const mobileGroups = treeData.allGroupsInOrder.map((gw) => {
        const labelEl = mobileLabelRefs.current[gw.group.id];
        const labelRect =
          labelEl && labelEl.offsetWidth > 0
            ? toLocalRect(labelEl, stageRect, scaleFactor)
            : null;
        const memberRects: RectBox[] = [];
        for (const m of gw.members) {
          const btn = mobileButtonRefs.current[m.id];
          if (btn && btn.offsetWidth > 0) {
            const local = toLocalRect(btn, stageRect, scaleFactor);
            memberRects.push(local);
            boxLocalRects[m.id] = local;
          }
        }
        return {
          groupId: gw.group.id,
          labelRect,
          memberRects,
        };
      });

      const paths = computeMobileTreePaths(mobileGroups, 10);
      setGeometry({ width: naturalW, height: naturalH, paths, boxLocalRects });
    }
  }, [treeData]);

  useLayoutEffect(() => {
    measureConnectors();
  }, [measureConnectors]);

  // Debounced ResizeObserver + font readiness re-measurement
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let debounceId: number | null = null;
    const scheduleMeasure = () => {
      if (debounceId !== null) {
        window.clearTimeout(debounceId);
      }
      debounceId = window.setTimeout(() => {
        debounceId = null;
        measureConnectors();
      }, 100);
    };

    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(stage);

    window.addEventListener('resize', scheduleMeasure, { passive: true });
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) measureConnectors();
    });

    return () => {
      cancelled = true;
      if (debounceId !== null) {
        window.clearTimeout(debounceId);
      }
      ro.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [measureConnectors]);

  const activeMember =
    activeIndex !== null ? treeData.orderedMembers[activeIndex] ?? null : null;

  const isZoomed = activeMember !== null && !isClosingModal && !prefersReducedMotion;

  const stageZoomStyle = useMemo(() => {
    if (!isZoomed || !activeMember) {
      return {
        transform: 'translate3d(0, 0, 0) scale(1)',
        transformOrigin: '50% 50%',
      };
    }
    const localBox = geometry.boxLocalRects[activeMember.id];
    if (!localBox || geometry.width === 0 || geometry.height === 0) {
      return {
        transform: 'translate3d(0, 0, 0) scale(1)',
        transformOrigin: '50% 50%',
      };
    }
    return computeZoomTransform(localBox, geometry.width, geometry.height, 1.5);
  }, [activeMember, geometry.boxLocalRects, geometry.height, geometry.width, isZoomed]);

  const handleSelectMember = useCallback(
    (member: OrderedMember, buttonEl: HTMLButtonElement) => {
      if (pulseTimerRef.current !== null) {
        window.clearTimeout(pulseTimerRef.current);
      }

      const rect = buttonEl.getBoundingClientRect();
      lastViewedIdRef.current = member.id;
      setSourceRect(rect);
      setIsClosingModal(false);
      setActiveIndex(member.canonicalIndex);

      if (!prefersReducedMotion) {
        setPulsingId(member.id);
        pulseTimerRef.current = window.setTimeout(() => {
          setPulsingId(null);
          pulseTimerRef.current = null;
        }, 480);
      }
    },
    [prefersReducedMotion],
  );

  const handleNavigate = useCallback(
    (direction: -1 | 1) => {
      if (activeIndex === null || treeData.orderedMembers.length === 0) return;
      const total = treeData.orderedMembers.length;
      const nextIndex = (activeIndex + direction + total) % total;
      const nextMember = treeData.orderedMembers[nextIndex];
      if (!nextMember) return;
      lastViewedIdRef.current = nextMember.id;
      setActiveIndex(nextIndex);
    },
    [activeIndex, treeData.orderedMembers],
  );

  const getActiveBoxViewportRectAtRest = useCallback((): DOMRect | null => {
    if (!activeMember) return null;
    const outer = outerWrapperRef.current;
    const localBox = geometry.boxLocalRects[activeMember.id];
    if (outer && localBox) {
      const outerRect = outer.getBoundingClientRect();
      return new DOMRect(
        outerRect.left + localBox.left,
        outerRect.top + localBox.top,
        localBox.width,
        localBox.height,
      );
    }
    const isDesktop = window.matchMedia('(min-width: 900px)').matches;
    const btn = isDesktop
      ? desktopButtonRefs.current[activeMember.id]
      : mobileButtonRefs.current[activeMember.id];
    return btn ? btn.getBoundingClientRect() : null;
  }, [activeMember, geometry.boxLocalRects]);

  const handleRequestClose = useCallback(() => {
    if (activeIndex === null || isClosingModal) return;
    setIsClosingModal(true);
  }, [activeIndex, isClosingModal]);

  const handleCloseComplete = useCallback(() => {
    const restoreId = lastViewedIdRef.current;
    setActiveIndex(null);
    setIsClosingModal(false);
    setSourceRect(null);
    setPulsingId(null);

    if (restoreId) {
      window.requestAnimationFrame(() => {
        const isDesktop = window.matchMedia('(min-width: 900px)').matches;
        const btn = isDesktop
          ? desktopButtonRefs.current[restoreId]
          : mobileButtonRefs.current[restoreId];
        btn?.focus({ preventScroll: true });
      });
    }
  }, []);

  const isModalEngaged = activeMember !== null && !isClosingModal;

  return (
    <RevealSection
      id="executive-board"
      ariaLabelledBy="executive-board-heading"
      style={{ scrollMarginTop: 'var(--nav-height, 72px)' }}
      className="pb-28 sm:pb-32"
    >
      <div className="mb-10 sm:mb-14 text-center">
        <SectionHeading
          id="executive-board-heading"
          label={CONFERENCE_DATA.executiveBoard.label}
          prefix="EXECUTIVE"
          italicWord="BOARD"
          period
          centered
        />
        <p className="mun-heading-reveal mt-3 text-xs sm:text-sm uppercase tracking-[0.2em] text-[#cfc8aa]">
          Click a name to meet them.
        </p>
      </div>

      {/* Outer container prevents 1.5x zoom from producing horizontal page scroll */}
      <div
        ref={outerWrapperRef}
        className={`relative mx-auto w-full max-w-[1160px] overflow-x-clip py-2 ${
          treeRevealed ? 'ft-tree-revealed' : ''
        }`}
      >
        <div
          ref={stageRef}
          style={stageZoomStyle}
          className="ft-stage-zoomable relative w-full"
        >
          {/* Faint centered willow-tree-only.svg background watermark (~14% opacity) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center select-none"
          >
            <img
              src="willow-tree-only.svg"
              alt=""
              className="h-auto w-[min(86%,360px)] min-[900px]:w-[min(62%,540px)] opacity-[0.14]"
            />
          </div>

          {/* Measured real-rect SVG connector overlay */}
          {geometry.width > 0 && geometry.height > 0 && (
            <svg
              aria-hidden="true"
              viewBox={`0 0 ${geometry.width} ${geometry.height}`}
              className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible"
            >
              {geometry.paths.map((path) => (
                <path
                  key={path.id}
                  d={path.d}
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={treeRevealed ? 0 : 1}
                  style={{
                    opacity: isModalEngaged ? 0.25 : 1,
                    transitionDelay:
                      treeRevealed && !prefersReducedMotion
                        ? `${Math.round(path.stageOrder * 70)}ms`
                        : '0ms',
                  }}
                  className="ft-connector-path"
                />
              ))}
            </svg>
          )}

          {/* DESKTOP PEDIGREE CHART (>= 900px) */}
          <div className="ft-desktop-layout relative z-10 grid-cols-[minmax(0,1.25fr)_minmax(210px,240px)_minmax(0,1.25fr)] items-start gap-x-8 lg:gap-x-12">
            {/* Left Side Column: Media, Press, Marketing, Design */}
            <div className="flex flex-col gap-7 pt-4">
              {treeData.leftGroups.map((gw, gIdx) => (
                <div
                  key={gw.group.id}
                  className="grid grid-cols-[minmax(190px,230px)_minmax(90px,130px)] items-center justify-end gap-8 lg:gap-11"
                >
                  <div className="flex flex-col gap-2.5">
                    {gw.members.map((member, mIdx) => {
                      const isActive = activeMember?.id === member.id;
                      return (
                        <MemberNodeButton
                          key={member.id}
                          layoutKey="desktop"
                          member={member}
                          isActive={isActive}
                          isPulsing={pulsingId === member.id}
                          isDimmed={isModalEngaged && !isActive}
                          fadeDelayMs={prefersReducedMotion ? 0 : 120 + gIdx * 65 + mIdx * 35}
                          buttonRef={(el) => {
                            desktopButtonRefs.current[member.id] = el;
                          }}
                          onSelect={handleSelectMember}
                        />
                      );
                    })}
                  </div>

                  <div
                    ref={(el) => {
                      desktopLabelRefs.current[gw.group.id] = el;
                    }}
                    style={{
                      opacity: isModalEngaged ? 0.15 : undefined,
                      transitionDelay:
                        prefersReducedMotion || isModalEngaged ? '0ms' : `${90 + gIdx * 65}ms`,
                    }}
                    className="ft-node-fade justify-self-end px-2 py-1 text-right"
                  >
                    <span className="inline-block text-[11px] font-medium uppercase tracking-[0.18em] text-[#cfc8aa]">
                      {gw.group.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Center Trunk Column: Secretariat */}
            <div className="flex flex-col items-center gap-3.5 pt-2">
              {treeData.centerGroups.map((gw) => (
                <div key={gw.group.id} className="flex w-full flex-col items-center gap-3.5">
                  <div
                    ref={(el) => {
                      desktopLabelRefs.current[gw.group.id] = el;
                    }}
                    style={{
                      opacity: isModalEngaged ? 0.15 : undefined,
                    }}
                    className="ft-node-fade rounded-md bg-[#14180a]/90 px-3 py-1 text-center border border-[#ede6ca]/25"
                  >
                    <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#c9d98a]">
                      {gw.group.label}
                    </span>
                  </div>

                  <div className="flex w-full flex-col gap-3">
                    {gw.members.map((member, mIdx) => {
                      const isActive = activeMember?.id === member.id;
                      return (
                        <MemberNodeButton
                          key={member.id}
                          layoutKey="desktop"
                          member={member}
                          isActive={isActive}
                          isPulsing={pulsingId === member.id}
                          isDimmed={isModalEngaged && !isActive}
                          fadeDelayMs={prefersReducedMotion ? 0 : 70 + mIdx * 45}
                          buttonRef={(el) => {
                            desktopButtonRefs.current[member.id] = el;
                          }}
                          onSelect={handleSelectMember}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Right Side Column: Security, Information Technology, Human Resources, Delegate Affairs, Volunteers */}
            <div className="flex flex-col gap-7 pt-4">
              {treeData.rightGroups.map((gw, gIdx) => (
                <div
                  key={gw.group.id}
                  className="grid grid-cols-[minmax(95px,145px)_minmax(190px,230px)] items-center justify-start gap-8 lg:gap-11"
                >
                  <div
                    ref={(el) => {
                      desktopLabelRefs.current[gw.group.id] = el;
                    }}
                    style={{
                      opacity: isModalEngaged ? 0.15 : undefined,
                      transitionDelay:
                        prefersReducedMotion || isModalEngaged ? '0ms' : `${90 + gIdx * 65}ms`,
                    }}
                    className="ft-node-fade justify-self-start px-2 py-1 text-left"
                  >
                    <span className="inline-block text-[11px] font-medium uppercase tracking-[0.18em] text-[#cfc8aa]">
                      {gw.group.label}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {gw.members.map((member, mIdx) => {
                      const isActive = activeMember?.id === member.id;
                      return (
                        <MemberNodeButton
                          key={member.id}
                          layoutKey="desktop"
                          member={member}
                          isActive={isActive}
                          isPulsing={pulsingId === member.id}
                          isDimmed={isModalEngaged && !isActive}
                          fadeDelayMs={prefersReducedMotion ? 0 : 120 + gIdx * 65 + mIdx * 35}
                          buttonRef={(el) => {
                            desktopButtonRefs.current[member.id] = el;
                          }}
                          onSelect={handleSelectMember}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MOBILE VERTICAL TREE (< 900px) */}
          <div className="ft-mobile-layout relative z-10 flex-col gap-6">
            {treeData.allGroupsInOrder.map((gw, gIdx) => (
              <div key={gw.group.id} className="flex flex-col gap-2.5">
                <div className="pl-7">
                  <div
                    ref={(el) => {
                      mobileLabelRefs.current[gw.group.id] = el;
                    }}
                    style={{
                      opacity: isModalEngaged ? 0.15 : undefined,
                      transitionDelay:
                        prefersReducedMotion || isModalEngaged ? '0ms' : `${gIdx * 45}ms`,
                    }}
                    className="ft-node-fade inline-block px-1.5 py-0.5"
                  >
                    <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#c9d98a]">
                      {gw.group.label}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 pl-12">
                  {gw.members.map((member, mIdx) => {
                    const isActive = activeMember?.id === member.id;
                    return (
                      <MemberNodeButton
                        key={member.id}
                        layoutKey="mobile"
                        member={member}
                        isActive={isActive}
                        isPulsing={pulsingId === member.id}
                        isDimmed={isModalEngaged && !isActive}
                        fadeDelayMs={prefersReducedMotion ? 0 : 40 + gIdx * 45 + mIdx * 30}
                        buttonRef={(el) => {
                          mobileButtonRefs.current[member.id] = el;
                        }}
                        onSelect={handleSelectMember}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FLIP Profile Card Modal */}
      {activeMember && activeIndex !== null && (
        <MemberProfileModal
          member={activeMember}
          activeIndex={activeIndex}
          totalCount={treeData.orderedMembers.length}
          sourceRect={sourceRect}
          getTargetBoxRect={getActiveBoxViewportRectAtRest}
          isClosing={isClosingModal}
          prefersReducedMotion={prefersReducedMotion}
          onNavigate={handleNavigate}
          onRequestClose={handleRequestClose}
          onCloseComplete={handleCloseComplete}
        />
      )}
    </RevealSection>
  );
}
