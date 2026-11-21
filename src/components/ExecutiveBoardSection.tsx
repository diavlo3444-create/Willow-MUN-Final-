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
  computeDesktopRootToMemberSegments,
  computeMobileRootToMemberSegments,
  computeMobileTreePaths,
  organizeFamilyTree,
  type DesktopGroupMeasurement,
  type FamilyTreeData,
  type MobileGroupMeasurement,
  type OrderedMember,
  type RectBox,
  type RootToMemberSegments,
  type SvgConnectorPath,
} from '../utils/familyTreeLayout';
import { MemberProfileModal } from './MemberProfileModal';
import { RevealSection, SectionHeading } from './RevealSection';

interface StageGeometry {
  width: number;
  height: number;
  paths: SvgConnectorPath[];
}

interface GoldBranchState {
  key: number;
  memberId: string;
  canonicalIndex: number;
  segments: RootToMemberSegments;
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
  isActive: boolean;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onSelect: (member: OrderedMember) => void;
}

function MemberNodeButton({
  member,
  isActive,
  buttonRef,
  onSelect,
}: MemberButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      data-member-id={member.id}
      aria-label={`${member.name}, ${member.displayRole}`}
      onClick={() => onSelect(member)}
      className={`ft-member-box group flex w-full items-center gap-3 rounded-[3px] px-3.5 py-2.5 text-left cursor-pointer focus-visible:outline-none ${
        isActive
          ? 'z-20 border-[#d4bc74]/85 bg-[#1b210e]'
          : member.side === 'center'
            ? 'z-10 border-[#ede6ca]/40 bg-[#171c0c]/96'
            : 'z-10'
      }`}
    >
      <span
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
      </span>

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
    </button>
  );
}

/**
 * Lightweight Executive Board org chart built from members.json.
 * - Static visible SVG <path> connectors (zero idle loops, zero blur/drop-shadow/layoutId)
 * - Single click interaction:
 *   1) Gold branch travels root -> department label -> card (700ms ease-out via WAAPI)
 *   2) Card scales 1 -> 1.04 -> 1 (250ms via WAAPI)
 *   3) Modal opens (250ms scale 0.9 -> 1 + opacity) and gold branch fades out
 */
export function ExecutiveBoardSection() {
  const treeData = useMemo(() => organizeFamilyTree(membersJson as FamilyTreeData), []);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const desktopButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobileButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const desktopLabelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mobileLabelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const goldGroupRef = useRef<SVGGElement | null>(null);
  const goldRootPathRef = useRef<SVGPathElement | null>(null);
  const goldCardPathRef = useRef<SVGPathElement | null>(null);
  const leafLayerRef = useRef<HTMLDivElement | null>(null);

  const [geometry, setGeometry] = useState<StageGeometry>({
    width: 0,
    height: 0,
    paths: [],
  });
  const [goldBranch, setGoldBranch] = useState<GoldBranchState | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const lastViewedIdRef = useRef<string | null>(null);
  const sequenceIdRef = useRef(0);
  const activeAnimationsRef = useRef<Animation[]>([]);
  const timersRef = useRef<number[]>([]);
  const leafTimersRef = useRef<number[]>([]);

  const clearClickSequence = useCallback(() => {
    for (const timerId of timersRef.current) {
      window.clearTimeout(timerId);
    }
    timersRef.current = [];
    for (const anim of activeAnimationsRef.current) {
      anim.cancel();
    }
    activeAnimationsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearClickSequence();
      for (const timerId of leafTimersRef.current) {
        window.clearTimeout(timerId);
      }
      leafTimersRef.current = [];
      leafLayerRef.current?.replaceChildren();
    };
  }, [clearClickSequence]);

  const spawnOliveLeaves = useCallback((btn: HTMLButtonElement) => {
    const stage = stageRef.current;
    const layer = leafLayerRef.current;
    if (!stage || !layer) return;

    const naturalW = stage.offsetWidth;
    if (naturalW === 0) return;

    const stageRect = stage.getBoundingClientRect();
    const scaleFactor = stageRect.width / naturalW || 1;
    const cardRect = toLocalRect(btn, stageRect, scaleFactor);
    const centerX = cardRect.left + cardRect.width / 2;
    const centerY = cardRect.top + cardRect.height / 2;

    const svgNs = 'http://www.w3.org/2000/svg';
    const leafColors = ['#c9d98a', '#b6c973', '#d9e5a8', '#d4bc74'];

    for (let i = 0; i < 10; i++) {
      const svg = document.createElementNS(svgNs, 'svg');
      svg.setAttribute('viewBox', '0 0 16 16');
      svg.setAttribute('width', '14');
      svg.setAttribute('height', '14');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('data-olive-leaf', 'true');

      const jitterX = (Math.random() - 0.5) * Math.min(48, cardRect.width * 0.35);
      const jitterY = (Math.random() - 0.5) * Math.min(18, cardRect.height * 0.3);
      svg.style.position = 'absolute';
      svg.style.left = `${(centerX - 7 + jitterX).toFixed(1)}px`;
      svg.style.top = `${(centerY - 7 + jitterY).toFixed(1)}px`;
      svg.style.width = '14px';
      svg.style.height = '14px';
      svg.style.pointerEvents = 'none';
      svg.style.willChange = 'transform';

      const path = document.createElementNS(svgNs, 'path');
      path.setAttribute(
        'd',
        'M8 1.2C4.9 4.3 3.7 7.9 4.4 11.4C4.8 13.4 6.3 14.7 8 15.1C9.7 14.7 11.2 13.4 11.6 11.4C12.3 7.9 11.1 4.3 8 1.2Z',
      );
      path.setAttribute('fill', leafColors[i % leafColors.length]);
      path.setAttribute('stroke', '#14180a');
      path.setAttribute('stroke-opacity', '0.55');
      path.setAttribute('stroke-width', '0.7');
      svg.appendChild(path);

      const vein = document.createElementNS(svgNs, 'path');
      vein.setAttribute('d', 'M8 3.2V13.8');
      vein.setAttribute('stroke', '#171c0c');
      vein.setAttribute('stroke-opacity', '0.5');
      vein.setAttribute('stroke-width', '0.9');
      vein.setAttribute('stroke-linecap', 'round');
      svg.appendChild(vein);

      layer.appendChild(svg);

      const baseAngle = (i / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.55;
      const outwardDist = 36 + Math.random() * 52;
      const outwardX = Math.cos(baseAngle) * outwardDist;
      const outwardY = Math.sin(baseAngle) * (outwardDist * 0.55);
      const fallDist = 80 + Math.random() * 60;
      const endRotate = 180 + Math.random() * 360;
      const duration = Math.round(900 + Math.random() * 500);

      const anim = svg.animate(
        [
          {
            transform: 'translate3d(0px, 0px, 0) rotate(0deg)',
            opacity: 1,
          },
          {
            offset: 0.28,
            transform: `translate3d(${(outwardX * 0.65).toFixed(1)}px, ${(outwardY - 8).toFixed(1)}px, 0) rotate(${(endRotate * 0.28).toFixed(1)}deg)`,
            opacity: 0.94,
          },
          {
            transform: `translate3d(${outwardX.toFixed(1)}px, ${(outwardY + fallDist).toFixed(1)}px, 0) rotate(${endRotate.toFixed(1)}deg)`,
            opacity: 0,
          },
        ],
        {
          duration,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
        },
      );

      let removed = false;
      const cleanupLeaf = () => {
        if (removed) return;
        removed = true;
        svg.remove();
      };

      const safetyTimer = window.setTimeout(cleanupLeaf, duration + 120);
      leafTimersRef.current.push(safetyTimer);

      anim.finished
        .catch(() => {})
        .finally(() => {
          window.clearTimeout(safetyTimer);
          cleanupLeaf();
        });
    }
  }, []);

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
      const centerIds: string[] = [];
      for (const gw of treeData.centerGroups) {
        for (const m of gw.members) {
          const btn = desktopButtonRefs.current[m.id];
          if (btn && btn.offsetWidth > 0) {
            centerRects.push(toLocalRect(btn, stageRect, scaleFactor));
            centerIds.push(m.id);
          }
        }
      }

      const secLabelEl = desktopLabelRefs.current['secretariat'];
      const secretariatLabelRect =
        secLabelEl && secLabelEl.offsetWidth > 0
          ? toLocalRect(secLabelEl, stageRect, scaleFactor)
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
        const memberIds: string[] = [];
        for (const m of gw.members) {
          const btn = desktopButtonRefs.current[m.id];
          if (btn && btn.offsetWidth > 0) {
            memberRects.push(toLocalRect(btn, stageRect, scaleFactor));
            memberIds.push(m.id);
          }
        }
        return {
          groupId: gw.group.id,
          side: gw.group.side as 'left' | 'right',
          labelRect,
          memberRects,
          memberIds,
        };
      });

      const paths = computeDesktopPedigreePaths(centerRects, sideGroups, naturalW / 2, {
        centerMemberIds: centerIds,
        secretariatLabelRect,
      });
      setGeometry({ width: naturalW, height: naturalH, paths });
    } else {
      const mobileGroups: MobileGroupMeasurement[] = treeData.allGroupsInOrder.map((gw) => {
        const labelEl = mobileLabelRefs.current[gw.group.id];
        const labelRect =
          labelEl && labelEl.offsetWidth > 0
            ? toLocalRect(labelEl, stageRect, scaleFactor)
            : null;
        const memberRects: RectBox[] = [];
        const memberIds: string[] = [];
        for (const m of gw.members) {
          const btn = mobileButtonRefs.current[m.id];
          if (btn && btn.offsetWidth > 0) {
            memberRects.push(toLocalRect(btn, stageRect, scaleFactor));
            memberIds.push(m.id);
          }
        }
        return {
          groupId: gw.group.id,
          labelRect,
          memberRects,
          memberIds,
        };
      });

      const paths = computeMobileTreePaths(mobileGroups, 10);
      setGeometry({ width: naturalW, height: naturalH, paths });
    }
  }, [treeData]);

  useLayoutEffect(() => {
    measureConnectors();
  }, [measureConnectors]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let debounceId: number | null = null;
    const scheduleMeasure = () => {
      if (debounceId !== null) window.clearTimeout(debounceId);
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
      if (debounceId !== null) window.clearTimeout(debounceId);
      ro.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [measureConnectors]);

  const computeRootSegmentsForMember = useCallback(
    (member: OrderedMember): RootToMemberSegments | null => {
      const stage = stageRef.current;
      if (!stage) return null;
      const naturalW = stage.offsetWidth;
      if (naturalW === 0) return null;

      const stageRect = stage.getBoundingClientRect();
      const scaleFactor = stageRect.width / naturalW || 1;
      const isDesktop = window.matchMedia('(min-width: 900px)').matches;

      if (isDesktop) {
        const btn = desktopButtonRefs.current[member.id];
        if (!btn || btn.offsetWidth === 0) return null;
        const memberRect = toLocalRect(btn, stageRect, scaleFactor);

        const centerRects: RectBox[] = [];
        for (const cg of treeData.centerGroups) {
          for (const m of cg.members) {
            const cBtn = desktopButtonRefs.current[m.id];
            if (cBtn && cBtn.offsetWidth > 0) {
              centerRects.push(toLocalRect(cBtn, stageRect, scaleFactor));
            }
          }
        }

        const secLabelEl = desktopLabelRefs.current['secretariat'];
        const secretariatLabelRect =
          secLabelEl && secLabelEl.offsetWidth > 0
            ? toLocalRect(secLabelEl, stageRect, scaleFactor)
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
            const gBtn = desktopButtonRefs.current[m.id];
            if (gBtn && gBtn.offsetWidth > 0) {
              memberRects.push(toLocalRect(gBtn, stageRect, scaleFactor));
            }
          }
          return {
            groupId: gw.group.id,
            side: gw.group.side as 'left' | 'right',
            labelRect,
            memberRects,
          };
        });

        return computeDesktopRootToMemberSegments(
          memberRect,
          member.side,
          member.group,
          centerRects,
          secretariatLabelRect,
          sideGroups,
          naturalW / 2,
        );
      }

      const btn = mobileButtonRefs.current[member.id];
      if (!btn || btn.offsetWidth === 0) return null;
      const memberRect = toLocalRect(btn, stageRect, scaleFactor);

      const mobileGroups: MobileGroupMeasurement[] = treeData.allGroupsInOrder.map((gw) => {
        const labelEl = mobileLabelRefs.current[gw.group.id];
        const labelRect =
          labelEl && labelEl.offsetWidth > 0
            ? toLocalRect(labelEl, stageRect, scaleFactor)
            : null;
        const memberRects: RectBox[] = [];
        for (const m of gw.members) {
          const gBtn = mobileButtonRefs.current[m.id];
          if (gBtn && gBtn.offsetWidth > 0) {
            memberRects.push(toLocalRect(gBtn, stageRect, scaleFactor));
          }
        }
        return {
          groupId: gw.group.id,
          labelRect,
          memberRects,
        };
      });

      return computeMobileRootToMemberSegments(memberRect, member.group, mobileGroups, 10);
    },
    [treeData],
  );

  // Run the 700ms gold branch draw -> 250ms card pulse -> modal open + gold fade
  useLayoutEffect(() => {
    if (!goldBranch) return;
    clearClickSequence();

    const seqKey = goldBranch.key;
    const rootPath = goldRootPathRef.current;
    const cardPath = goldCardPathRef.current;
    const goldGroup = goldGroupRef.current;

    const len1 = rootPath ? rootPath.getTotalLength() : 0;
    const len2 = cardPath && goldBranch.segments.labelToCardD ? cardPath.getTotalLength() : 0;
    const totalLen = len1 + len2;

    if (goldGroup) {
      goldGroup.style.opacity = '1';
    }

    if (rootPath && len1 > 0 && totalLen > 0) {
      const dur1 = len2 > 0 ? Math.max(120, Math.round(700 * (len1 / totalLen))) : 700;
      const dur2 = len2 > 0 ? Math.max(80, 700 - dur1) : 0;

      rootPath.style.strokeDasharray = `${len1}`;
      rootPath.style.strokeDashoffset = `${len1}`;
      activeAnimationsRef.current.push(
        rootPath.animate(
          [{ strokeDashoffset: len1 }, { strokeDashoffset: 0 }],
          { duration: dur1, easing: 'ease-out', fill: 'forwards' },
        ),
      );

      if (cardPath && len2 > 0 && dur2 > 0) {
        cardPath.style.strokeDasharray = `${len2}`;
        cardPath.style.strokeDashoffset = `${len2}`;
        activeAnimationsRef.current.push(
          cardPath.animate(
            [{ strokeDashoffset: len2 }, { strokeDashoffset: 0 }],
            { duration: dur2, delay: dur1, easing: 'ease-out', fill: 'forwards' },
          ),
        );
      }
    }

    const pulseTimer = window.setTimeout(() => {
      if (sequenceIdRef.current !== seqKey) return;

      const isDesktop = window.matchMedia('(min-width: 900px)').matches;
      const btn = isDesktop
        ? desktopButtonRefs.current[goldBranch.memberId]
        : mobileButtonRefs.current[goldBranch.memberId];

      if (btn) {
        spawnOliveLeaves(btn);
        activeAnimationsRef.current.push(
          btn.animate(
            [
              { transform: 'scale(1)' },
              { transform: 'scale(1.04)' },
              { transform: 'scale(1)' },
            ],
            { duration: 250, easing: 'ease-out' },
          ),
        );
      }

      const openTimer = window.setTimeout(() => {
        if (sequenceIdRef.current !== seqKey) return;
        setActiveIndex(goldBranch.canonicalIndex);

        if (goldGroupRef.current) {
          const fadeAnim = goldGroupRef.current.animate(
            [{ opacity: 1 }, { opacity: 0 }],
            { duration: 240, easing: 'ease-out', fill: 'forwards' },
          );
          activeAnimationsRef.current.push(fadeAnim);
        }

        const cleanupTimer = window.setTimeout(() => {
          if (sequenceIdRef.current !== seqKey) return;
          setGoldBranch(null);
        }, 250);
        timersRef.current.push(cleanupTimer);
      }, 250);

      timersRef.current.push(openTimer);
    }, 700);

    timersRef.current.push(pulseTimer);

    return () => {
      clearClickSequence();
    };
  }, [clearClickSequence, goldBranch, spawnOliveLeaves]);

  const handleSelectMember = useCallback(
    (member: OrderedMember) => {
      clearClickSequence();
      sequenceIdRef.current += 1;
      lastViewedIdRef.current = member.id;

      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReduced) {
        setGoldBranch(null);
        setActiveIndex(member.canonicalIndex);
        return;
      }

      const segments = computeRootSegmentsForMember(member);
      if (!segments) {
        setGoldBranch(null);
        setActiveIndex(member.canonicalIndex);
        return;
      }

      setGoldBranch({
        key: sequenceIdRef.current,
        memberId: member.id,
        canonicalIndex: member.canonicalIndex,
        segments,
      });
    },
    [clearClickSequence, computeRootSegmentsForMember],
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

  const handleCloseModal = useCallback(() => {
    const restoreId = lastViewedIdRef.current;
    setActiveIndex(null);

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

  const activeMember =
    activeIndex !== null ? treeData.orderedMembers[activeIndex] ?? null : null;

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
        <p className="text-sm text-[#cfc8aa] max-w-[42ch]">
          Select any Secretariat or Department Head node to open their portfolio dossier and
          personal statement.
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-[1160px] overflow-x-clip py-2">
        <div ref={stageRef} className="relative w-full">
          {/* Imperative WAAPI olive-leaf burst layer (only populated on card click) */}
          <div
            ref={leafLayerRef}
            aria-hidden="true"
            data-testid="olive-leaf-layer"
            className="pointer-events-none absolute inset-0 z-30"
          />

          {/* Static faint centered willow-tree-only.svg watermark */}
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

          {/* Static SVG Connector Lines + Click Gold Light-Up Overlay */}
          {geometry.width > 0 && geometry.height > 0 && (
            <svg
              aria-hidden="true"
              data-testid="living-tree-svg"
              viewBox={`0 0 ${geometry.width} ${geometry.height}`}
              className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
            >
              <g data-testid="tree-base-branches">
                {geometry.paths.map((p) => (
                  <path key={p.id} d={p.d} className="ft-connector-path" />
                ))}
              </g>

              {goldBranch && (
                <g ref={goldGroupRef} data-testid="active-gold-branch">
                  <path
                    ref={goldRootPathRef}
                    data-testid="active-gold-root-path"
                    d={goldBranch.segments.rootToLabelD}
                    fill="none"
                    stroke="#d4bc74"
                    strokeWidth={2.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {goldBranch.segments.labelToCardD && (
                    <path
                      ref={goldCardPathRef}
                      data-testid="active-gold-card-path"
                      d={goldBranch.segments.labelToCardD}
                      fill="none"
                      stroke="#d4bc74"
                      strokeWidth={2.25}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </g>
              )}
            </svg>
          )}

          {/* DESKTOP PEDIGREE CHART (>= 900px) */}
          <div className="ft-desktop-layout relative z-10 grid-cols-[minmax(0,1.25fr)_minmax(210px,240px)_minmax(0,1.25fr)] items-start gap-x-8 lg:gap-x-12">
            {/* Left Side Column */}
            <div className="flex flex-col gap-7 pt-4">
              {treeData.leftGroups.map((gw) => (
                <div
                  key={gw.group.id}
                  className="grid grid-cols-[minmax(190px,230px)_minmax(90px,130px)] items-center justify-end gap-8 lg:gap-11"
                >
                  <div className="flex flex-col gap-2.5">
                    {gw.members.map((member) => (
                      <MemberNodeButton
                        key={member.id}
                        member={member}
                        isActive={activeMember?.id === member.id}
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
                    className="justify-self-end px-2 py-1 text-right"
                  >
                    <span className="inline-block text-[11px] font-medium uppercase tracking-[0.18em] text-[#cfc8aa]">
                      {gw.group.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Center Trunk Column: SECRETARIAT root node + Secretariat members */}
            <div className="flex flex-col items-center gap-3.5 pt-2">
              {treeData.centerGroups.map((gw) => (
                <div key={gw.group.id} className="flex w-full flex-col items-center gap-3.5">
                  <div
                    ref={(el) => {
                      desktopLabelRefs.current[gw.group.id] = el;
                    }}
                    data-testid="secretariat-root-node"
                    className="rounded-[2px] bg-[#14180a]/95 px-3.5 py-1 text-center border border-[#ede6ca]/35"
                  >
                    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[#a9b47e]">
                      {gw.group.label}
                    </span>
                  </div>

                  <div className="flex w-full flex-col gap-3">
                    {gw.members.map((member) => (
                      <MemberNodeButton
                        key={member.id}
                        member={member}
                        isActive={activeMember?.id === member.id}
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

            {/* Right Side Column */}
            <div className="flex flex-col gap-7 pt-4">
              {treeData.rightGroups.map((gw) => (
                <div
                  key={gw.group.id}
                  className="grid grid-cols-[minmax(95px,145px)_minmax(190px,230px)] items-center justify-start gap-8 lg:gap-11"
                >
                  <div
                    ref={(el) => {
                      desktopLabelRefs.current[gw.group.id] = el;
                    }}
                    className="justify-self-start px-2 py-1 text-left"
                  >
                    <span className="inline-block text-[11px] font-medium uppercase tracking-[0.18em] text-[#cfc8aa]">
                      {gw.group.label}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {gw.members.map((member) => (
                      <MemberNodeButton
                        key={member.id}
                        member={member}
                        isActive={activeMember?.id === member.id}
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
            {treeData.allGroupsInOrder.map((gw) => (
              <div key={gw.group.id} className="flex flex-col gap-2.5">
                <div className="pl-7">
                  <div
                    ref={(el) => {
                      mobileLabelRefs.current[gw.group.id] = el;
                    }}
                    className="inline-block px-1.5 py-0.5"
                  >
                    <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#c9d98a]">
                      {gw.group.label}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 pl-12">
                  {gw.members.map((member) => (
                    <MemberNodeButton
                      key={member.id}
                      member={member}
                      isActive={activeMember?.id === member.id}
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

      {activeMember && activeIndex !== null && (
        <MemberProfileModal
          member={activeMember}
          activeIndex={activeIndex}
          totalCount={treeData.orderedMembers.length}
          onNavigate={handleNavigate}
          onClose={handleCloseModal}
        />
      )}
    </RevealSection>
  );
}
