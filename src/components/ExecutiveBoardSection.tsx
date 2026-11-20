import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import membersJson from '../data/members.json';
import { CONFERENCE_DATA } from '../data/conference';
import {
  computeDesktopGoldTravelPath,
  computeDesktopPedigreePaths,
  computeMobileGoldTravelPath,
  computeMobileTreePaths,
  generateLeafParticles,
  organizeFamilyTree,
  type DesktopGroupMeasurement,
  type FamilyTreeData,
  type LeafParticleSpec,
  type MobileGroupMeasurement,
  type OrderedMember,
  type RectBox,
  type SvgConnectorPath,
} from '../utils/familyTreeLayout';
import { MemberProfileModal } from './MemberProfileModal';
import { ParallaxFrame, RevealItem } from './MotionPrimitives';
import { RevealSection, SectionHeading } from './RevealSection';

interface StageGeometry {
  width: number;
  height: number;
  paths: SvgConnectorPath[];
}

interface GoldTravelSignal {
  id: string;
  d: string;
}

export interface ModalOriginCoords {
  clickPoint: { x: number; y: number };
  cardCenter: { x: number; y: number };
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

function LeafParticleOverlay({ particles }: { particles: LeafParticleSpec[] }) {
  if (particles.length === 0 || typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[95] overflow-hidden"
    >
      {particles.map((p, idx) => (
        <motion.div
          key={p.id}
          initial={{
            x: p.x - 6,
            y: p.y - 8,
            opacity: 0.95,
            scale: 0.4,
            rotate: p.rotateStart,
          }}
          animate={{
            x: [p.x - 6, p.x - 6 + p.dx * 0.65, p.x - 6 + p.dx],
            y: [p.y - 8, p.y - 8 + p.dy, p.y - 8 + p.gravityDy],
            opacity: [0.95, 0.88, 0],
            scale: [0.4, p.scale, p.scale * 0.45],
            rotate: p.rotateEnd,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{ willChange: 'transform, opacity' }}
          className="absolute top-0 left-0 h-4 w-3"
        >
          <svg viewBox="0 0 16 20" className="h-full w-full drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
            <path
              d="M8 1C4.4 4.8 3 9.4 3.9 14.1C4.5 16.7 6.3 18.4 8 19C9.7 18.4 11.5 16.7 12.1 14.1C13 9.4 11.6 4.8 8 1Z"
              fill={idx % 3 === 0 ? '#d4bc74' : idx % 2 === 0 ? '#c9d98a' : '#8fa058'}
            />
            <path
              d="M8 3.2V17.4"
              stroke="rgba(18, 22, 10, 0.45)"
              strokeWidth="0.9"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
      ))}
    </div>,
    document.body,
  );
}

interface MemberButtonProps {
  member: OrderedMember;
  prefersReduced: boolean;
  isActive: boolean;
  fadeDelayMs: number;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onSelect: (member: OrderedMember, event: ReactMouseEvent<HTMLButtonElement>) => void;
}

function MemberNodeButton({
  member,
  prefersReduced,
  isActive,
  fadeDelayMs,
  buttonRef,
  onSelect,
}: MemberButtonProps) {
  return (
    <div
      style={{ transitionDelay: `${fadeDelayMs}ms` }}
      className="ft-node-fade w-full"
    >
      <motion.button
        ref={buttonRef}
        type="button"
        data-member-id={member.id}
        aria-label={`${member.name}, ${member.displayRole}`}
        whileHover={prefersReduced ? undefined : { y: -2 }}
        whileTap={prefersReduced ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        style={{ willChange: 'transform' }}
        onClick={(e) => onSelect(member, e)}
        className={`ft-member-box group flex w-full items-center gap-3 rounded-[3px] px-3.5 py-2.5 text-left cursor-pointer focus-visible:outline-none ${
          isActive
            ? 'z-20 border-[#d4bc74]/85 bg-[#1b210e]'
            : member.side === 'center'
              ? 'z-10 border-[#ede6ca]/40 bg-[#171c0c]/96'
              : 'z-10'
        }`}
      >
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border ${
            member.photo ? '' : 'bg-[#202414]'
          } ${
            member.side === 'center'
              ? member.photo
                ? 'h-11 w-11 border-[#ede6ca]/55'
                : 'h-11 w-11 border-[#ede6ca]/45'
              : member.photo
                ? 'h-10 w-10 border-[#c9d98a]/35'
                : 'h-10 w-10 border-[#c9d98a]/25'
          }`}
        >
          {member.photo ? (
            <img
              src={member.photo.startsWith('/') ? member.photo : `/${member.photo}`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              style={{ objectPosition: member.objectPosition }}
            />
          ) : (
            <LeafGlyph />
          )}
        </div>

        <span className="min-w-0 flex-1">
          <span className="block font-serif text-[1.06rem] sm:text-[1.14rem] font-medium leading-tight text-[#ede6ca] break-words">
            {member.name}
          </span>
          <span
            style={{ fontVariantCaps: 'small-caps' }}
            className="mt-0.5 block text-[11px] font-medium tracking-[0.11em] text-[#cfc8aa] break-words"
          >
            {member.displayRole}
          </span>
        </span>
      </motion.button>
    </div>
  );
}

/**
 * Interactive Executive Board family-tree section built dynamically from members.json.
 * - Desktop (>= 900px): center Secretariat trunk + left/right bracket pedigree chart over faint willow-tree-only.svg
 * - Mobile (< 900px): vertical left-trunk tree with L-shaped group connectors
 * - Click triggers "Willow Unfurl": gold connector travel, olive-leaf burst, and circular clip-path reveal
 */
export function ExecutiveBoardSection() {
  const treeData = useMemo(() => organizeFamilyTree(membersJson as FamilyTreeData), []);
  const prefersReduced = useReducedMotion() ?? false;

  const outerWrapperRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const desktopButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobileButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const desktopLabelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mobileLabelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [treeRevealed, setTreeRevealed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [geometry, setGeometry] = useState<StageGeometry>({
    width: 0,
    height: 0,
    paths: [],
  });

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [navState, setNavState] = useState<{ direction: -1 | 1; step: number }>({
    direction: 1,
    step: 0,
  });
  const [modalOrigin, setModalOrigin] = useState<ModalOriginCoords | null>(null);
  const [closeTargetPoint, setCloseTargetPoint] = useState<{ x: number; y: number } | null>(null);
  const [goldTravel, setGoldTravel] = useState<GoldTravelSignal | null>(null);
  const [leafParticles, setLeafParticles] = useState<LeafParticleSpec[]>([]);

  const lastViewedIdRef = useRef<string | null>(null);
  const particleSeedRef = useRef<number>(1);
  const burstTimeoutRef = useRef<number | null>(null);
  const goldTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (burstTimeoutRef.current !== null) window.clearTimeout(burstTimeoutRef.current);
      if (goldTimeoutRef.current !== null) window.clearTimeout(goldTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (prefersReduced) {
      setTreeRevealed(true);
    }
  }, [prefersReduced]);

  // Bidirectional scroll-in connector draw trigger
  useEffect(() => {
    const el = outerWrapperRef.current;
    if (!el) return;

    if (prefersReduced) {
      setTreeRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setTreeRevealed(entry.isIntersecting);
        }
      },
      { threshold: [0, 0.04], rootMargin: '24px 0px -28px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [prefersReduced]);

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

    if (isDesktop) {
      const centerRects: RectBox[] = [];
      for (const cg of treeData.centerGroups) {
        for (const m of cg.members) {
          const btn = desktopButtonRefs.current[m.id];
          if (btn && btn.offsetWidth > 0) {
            centerRects.push(toLocalRect(btn, stageRect, scaleFactor));
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
            memberRects.push(toLocalRect(btn, stageRect, scaleFactor));
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
      setGeometry({ width: naturalW, height: naturalH, paths });
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
            memberRects.push(toLocalRect(btn, stageRect, scaleFactor));
          }
        }
        return {
          groupId: gw.group.id,
          labelRect,
          memberRects,
        };
      });

      const paths = computeMobileTreePaths(mobileGroups, 10);
      setGeometry({ width: naturalW, height: naturalH, paths });
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

  const spawnLeafBurst = useCallback(
    (origin: { x: number; y: number }, count = 9) => {
      if (prefersReduced) return;
      particleSeedRef.current += 1;
      const batch = generateLeafParticles(origin, count, particleSeedRef.current);
      setLeafParticles(batch);
      if (burstTimeoutRef.current !== null) {
        window.clearTimeout(burstTimeoutRef.current);
      }
      burstTimeoutRef.current = window.setTimeout(() => {
        burstTimeoutRef.current = null;
        setLeafParticles([]);
      }, 1050);
    },
    [prefersReduced],
  );

  const computeGoldPathForMember = useCallback(
    (member: OrderedMember): string | null => {
      const stage = stageRef.current;
      if (!stage) return null;
      const naturalW = stage.offsetWidth;
      if (naturalW === 0) return null;

      const stageRect = stage.getBoundingClientRect();
      const scaleFactor = stageRect.width / naturalW || 1;
      const isDesktop = window.matchMedia('(min-width: 900px)').matches;

      if (isDesktop) {
        const clickedBtn = desktopButtonRefs.current[member.id];
        if (!clickedBtn || clickedBtn.offsetWidth === 0) return null;
        const memberRect = toLocalRect(clickedBtn, stageRect, scaleFactor);

        const centerRects: RectBox[] = [];
        for (const cg of treeData.centerGroups) {
          for (const m of cg.members) {
            const btn = desktopButtonRefs.current[m.id];
            if (btn && btn.offsetWidth > 0) {
              centerRects.push(toLocalRect(btn, stageRect, scaleFactor));
            }
          }
        }

        const secretariatLabelEl = desktopLabelRefs.current['secretariat'];
        const secretariatLabelRect =
          secretariatLabelEl && secretariatLabelEl.offsetWidth > 0
            ? toLocalRect(secretariatLabelEl, stageRect, scaleFactor)
            : null;

        const sideGroups: DesktopGroupMeasurement[] = [
          ...treeData.leftGroups,
          ...treeData.rightGroups,
        ].map((gw) => {
          const labelEl = desktopLabelRefs.current[gw.group.id];
          const labelRect =
            labelEl && labelEl.offsetWidth > 0
              ? toLocalRect(labelEl, stageRect, scaleFactor)
              : null;
          const memberRects: RectBox[] = [];
          for (const m of gw.members) {
            const btn = desktopButtonRefs.current[m.id];
            if (btn && btn.offsetWidth > 0) {
              memberRects.push(toLocalRect(btn, stageRect, scaleFactor));
            }
          }
          return {
            groupId: gw.group.id,
            side: gw.group.side as 'left' | 'right',
            labelRect,
            memberRects,
          };
        });

        return computeDesktopGoldTravelPath(
          memberRect,
          member.side,
          member.group,
          centerRects,
          secretariatLabelRect,
          sideGroups,
          naturalW / 2,
        );
      }

      const clickedBtn = mobileButtonRefs.current[member.id];
      if (!clickedBtn || clickedBtn.offsetWidth === 0) return null;
      const memberRect = toLocalRect(clickedBtn, stageRect, scaleFactor);

      const mobileGroups: MobileGroupMeasurement[] = treeData.allGroupsInOrder.map((gw) => {
        const labelEl = mobileLabelRefs.current[gw.group.id];
        const labelRect =
          labelEl && labelEl.offsetWidth > 0
            ? toLocalRect(labelEl, stageRect, scaleFactor)
            : null;
        const memberRects: RectBox[] = [];
        for (const m of gw.members) {
          const btn = mobileButtonRefs.current[m.id];
          if (btn && btn.offsetWidth > 0) {
            memberRects.push(toLocalRect(btn, stageRect, scaleFactor));
          }
        }
        return {
          groupId: gw.group.id,
          labelRect,
          memberRects,
        };
      });

      return computeMobileGoldTravelPath(memberRect, member.group, mobileGroups, 10);
    },
    [treeData],
  );

  const activeMember =
    activeIndex !== null ? treeData.orderedMembers[activeIndex] ?? null : null;

  const handleSelectMember = useCallback(
    (member: OrderedMember, event: ReactMouseEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const cardCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      // Keyboard activation yields clientX === 0 && clientY === 0 -> anchor at card center
      const hasPointerCoords = event.clientX > 0 || event.clientY > 0;
      const clickPoint = hasPointerCoords
        ? { x: event.clientX, y: event.clientY }
        : cardCenter;

      lastViewedIdRef.current = member.id;
      setModalOrigin({ clickPoint, cardCenter });
      setCloseTargetPoint(cardCenter);
      setNavState({ direction: 1, step: 0 });
      setActiveIndex(member.canonicalIndex);

      if (!prefersReduced) {
        spawnLeafBurst(clickPoint, 9);
        const goldPath = computeGoldPathForMember(member);
        if (goldPath) {
          setGoldTravel({ id: `${member.id}-${Date.now()}`, d: goldPath });
          if (goldTimeoutRef.current !== null) {
            window.clearTimeout(goldTimeoutRef.current);
          }
          goldTimeoutRef.current = window.setTimeout(() => {
            goldTimeoutRef.current = null;
            setGoldTravel(null);
          }, 950);
        }
      }
    },
    [computeGoldPathForMember, prefersReduced, spawnLeafBurst],
  );

  const handleNavigate = useCallback(
    (direction: -1 | 1) => {
      if (activeIndex === null || treeData.orderedMembers.length === 0) return;
      const total = treeData.orderedMembers.length;
      const nextIndex = (activeIndex + direction + total) % total;
      const nextMember = treeData.orderedMembers[nextIndex];
      if (!nextMember) return;
      lastViewedIdRef.current = nextMember.id;
      setNavState((prev) => ({ direction, step: prev.step + 1 }));
      setActiveIndex(nextIndex);
    },
    [activeIndex, treeData.orderedMembers],
  );

  const handleRequestClose = useCallback(() => {
    const viewedId = lastViewedIdRef.current;
    let targetCenter = modalOrigin?.cardCenter ?? {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };

    if (viewedId) {
      const isDesktop = window.matchMedia('(min-width: 900px)').matches;
      const btn = isDesktop
        ? desktopButtonRefs.current[viewedId]
        : mobileButtonRefs.current[viewedId];
      if (btn && btn.offsetWidth > 0) {
        const r = btn.getBoundingClientRect();
        targetCenter = {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
        };
      }
    }

    setCloseTargetPoint(targetCenter);
    if (!prefersReduced) {
      spawnLeafBurst(
        { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        8,
      );
    }
    setActiveIndex(null);
  }, [modalOrigin, prefersReduced, spawnLeafBurst]);

  const handleExitComplete = useCallback(() => {
    const restoreId = lastViewedIdRef.current;
    setModalOrigin(null);
    setCloseTargetPoint(null);
    setNavState({ direction: 1, step: 0 });

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

  return (
    <RevealSection
      id="executive-board"
      ariaLabelledBy="executive-board-heading"
      style={{ scrollMarginTop: 'var(--nav-height, 72px)' }}
      className="pb-28 sm:pb-32"
    >
      <div className="mb-10 sm:mb-14 flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-[#ede6ca]/18 pb-6">
        <SectionHeading
          id="executive-board-heading"
          indexLabel="03"
          label={CONFERENCE_DATA.executiveBoard.label}
          prefix="Secretariat &"
          italicWord="Executive Board"
        />
        <RevealItem staggerIndex={1}>
          <p className="text-sm text-[#cfc8aa] max-w-[42ch]">
            Select any Secretariat or Department Head node to open their portfolio dossier and
            personal statement.
          </p>
        </RevealItem>
      </div>

      <div
        ref={outerWrapperRef}
        className={`relative mx-auto w-full max-w-[1160px] overflow-x-clip py-2 ${
          treeRevealed ? 'ft-tree-revealed' : ''
        }`}
      >
        <div ref={stageRef} className="relative w-full">
          {/* Faint centered willow-tree-only.svg background watermark with restrained scroll parallax */}
          <ParallaxFrame
            offsetPx={18}
            className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center select-none"
            innerClassName="flex w-full items-center justify-center"
          >
            <img
              src="willow-tree-only.svg"
              alt=""
              className="h-auto w-[min(86%,360px)] min-[900px]:w-[min(62%,540px)] opacity-[0.14]"
            />
          </ParallaxFrame>

          {/* Measured real-rect SVG connector overlay + Gold travel highlight */}
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
                    transitionDelay:
                      treeRevealed && !prefersReduced
                        ? `${Math.round(path.stageOrder * 70)}ms`
                        : '0ms',
                  }}
                  className="ft-connector-path"
                />
              ))}

              {goldTravel && !prefersReduced && (
                <motion.path
                  key={goldTravel.id}
                  data-testid="gold-connector-travel"
                  d={goldTravel.d}
                  pathLength={1}
                  strokeDasharray={1}
                  fill="none"
                  stroke="#d4bc74"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ strokeDashoffset: 1, opacity: 0.95 }}
                  animate={{
                    strokeDashoffset: 0,
                    opacity: [0.95, 1, 0],
                  }}
                  transition={{
                    strokeDashoffset: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.9, times: [0, 0.58, 1], ease: 'easeOut' },
                  }}
                />
              )}
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
                    {gw.members.map((member, mIdx) => (
                      <MemberNodeButton
                        key={member.id}
                        member={member}
                        prefersReduced={prefersReduced}
                        isActive={activeMember?.id === member.id}
                        fadeDelayMs={prefersReduced ? 0 : 120 + gIdx * 65 + mIdx * 35}
                        buttonRef={(el) => {
                          desktopButtonRefs.current[member.id] = el;
                        }}
                        onSelect={handleSelectMember}
                      />
                    ))}
                  </div>

                  <div
                    ref={(el) => {
                      desktopLabelRefs.current[gw.group.id] = el;
                    }}
                    style={{
                      transitionDelay: prefersReduced ? '0ms' : `${90 + gIdx * 65}ms`,
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
                    className="ft-node-fade rounded-[2px] bg-[#14180a]/95 px-3.5 py-1 text-center border border-[#ede6ca]/35"
                  >
                    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[#a9b47e]">
                      {gw.group.label}
                    </span>
                  </div>

                  <div className="flex w-full flex-col gap-3">
                    {gw.members.map((member, mIdx) => (
                      <MemberNodeButton
                        key={member.id}
                        member={member}
                        prefersReduced={prefersReduced}
                        isActive={activeMember?.id === member.id}
                        fadeDelayMs={prefersReduced ? 0 : 70 + mIdx * 45}
                        buttonRef={(el) => {
                          desktopButtonRefs.current[member.id] = el;
                        }}
                        onSelect={handleSelectMember}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Right Side Column: Security, IT, HR, Delegate Affairs, Volunteers, DCC, Logistics, Ceremonies */}
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
                      transitionDelay: prefersReduced ? '0ms' : `${90 + gIdx * 65}ms`,
                    }}
                    className="ft-node-fade justify-self-start px-2 py-1 text-left"
                  >
                    <span className="inline-block text-[11px] font-medium uppercase tracking-[0.18em] text-[#cfc8aa]">
                      {gw.group.label}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {gw.members.map((member, mIdx) => (
                      <MemberNodeButton
                        key={member.id}
                        member={member}
                        prefersReduced={prefersReduced}
                        isActive={activeMember?.id === member.id}
                        fadeDelayMs={prefersReduced ? 0 : 120 + gIdx * 65 + mIdx * 35}
                        buttonRef={(el) => {
                          desktopButtonRefs.current[member.id] = el;
                        }}
                        onSelect={handleSelectMember}
                      />
                    ))}
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
                      transitionDelay: prefersReduced ? '0ms' : `${gIdx * 45}ms`,
                    }}
                    className="ft-node-fade inline-block px-1.5 py-0.5"
                  >
                    <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#c9d98a]">
                      {gw.group.label}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 pl-12">
                  {gw.members.map((member, mIdx) => (
                    <MemberNodeButton
                      key={member.id}
                      member={member}
                      prefersReduced={prefersReduced}
                      isActive={activeMember?.id === member.id}
                      fadeDelayMs={prefersReduced ? 0 : 40 + gIdx * 45 + mIdx * 30}
                      buttonRef={(el) => {
                        mobileButtonRefs.current[member.id] = el;
                      }}
                      onSelect={handleSelectMember}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Olive-leaf burst particles on card click and modal close */}
      <LeafParticleOverlay particles={leafParticles} />

      {/* Willow Unfurl Profile Modal */}
      <AnimatePresence onExitComplete={handleExitComplete}>
        {activeMember && activeIndex !== null && modalOrigin && (
          <MemberProfileModal
            key="member-profile-modal"
            member={activeMember}
            activeIndex={activeIndex}
            totalCount={treeData.orderedMembers.length}
            navDirection={navState.direction}
            navStep={navState.step}
            openClickPoint={modalOrigin.clickPoint}
            closeTargetPoint={closeTargetPoint ?? modalOrigin.cardCenter}
            onNavigate={handleNavigate}
            onRequestClose={handleRequestClose}
          />
        )}
      </AnimatePresence>
    </RevealSection>
  );
}
