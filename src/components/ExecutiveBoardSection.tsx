import {
  memo,
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
  computeCenteredCameraTransform,
  computeDesktopGoldTravelPath,
  computeDesktopPedigreePaths,
  computeMobileGoldTravelPath,
  computeMobileTreePaths,
  organizeFamilyTree,
  resolveMemberFallbackSrc,
  resolveMemberThumbSrc,
  type DesktopGroupMeasurement,
  type FamilyTreeData,
  type MobileGroupMeasurement,
  type OrderedMember,
  type RectBox,
  type SvgConnectorPath,
} from '../utils/familyTreeLayout';
import { MemberProfileModal, type ModalRectSnapshot } from './MemberProfileModal';
import { RevealSection, SectionHeading } from './RevealSection';

interface StageGeometry {
  width: number;
  height: number;
  paths: SvgConnectorPath[];
}

interface ModalSessionState {
  activeIndex: number;
  flipCardRect: ModalRectSnapshot | null;
  isReducedMotion: boolean;
  sessionKey: number;
}

interface CameraState {
  tx: number;
  ty: number;
  scale: number;
}

const EASE_OUT_EXPO = 'cubic-bezier(0.22, 1, 0.36, 1)';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

function getLiveCameraTransform(stage: HTMLElement, fallback: CameraState): CameraState {
  const raw = window.getComputedStyle(stage).transform;
  if (!raw || raw === 'none') return fallback;
  try {
    const matrix = new DOMMatrix(raw);
    if (Number.isFinite(matrix.a) && matrix.a > 0) {
      return {
        tx: matrix.e,
        ty: matrix.f,
        scale: matrix.a,
      };
    }
  } catch {
    // Fall back to tracked state
  }
  return fallback;
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
  buttonRef: (el: HTMLButtonElement | null) => void;
  onSelect: (member: OrderedMember) => void;
  onHoverEnter: (memberId: string) => void;
  onHoverLeave: () => void;
}

const MemberNodeButton = memo(function MemberNodeButton({
  member,
  buttonRef,
  onSelect,
  onHoverEnter,
  onHoverLeave,
}: MemberButtonProps) {
  const [useFallback, setUseFallback] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const imgSrc = useFallback
    ? resolveMemberFallbackSrc(member.photo)
    : resolveMemberThumbSrc(member.photo);

  return (
    <button
      ref={buttonRef}
      type="button"
      data-member-id={member.id}
      aria-label={`${member.name}, ${member.displayRole}`}
      onClick={() => onSelect(member)}
      onMouseEnter={() => onHoverEnter(member.id)}
      onMouseLeave={onHoverLeave}
      className={`ft-member-box group flex w-full items-center gap-3 rounded-[3px] px-3.5 py-2.5 text-left cursor-pointer focus-visible:outline-none ${
        member.side === 'center' ? 'z-10 border-[#ede6ca]/40 bg-[#171c0c]/96' : 'z-10'
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
        {imgSrc && !imgFailed ? (
          <img
            src={imgSrc}
            alt=""
            width={44}
            height={44}
            loading="lazy"
            decoding="async"
            onError={() => {
              if (!useFallback) {
                setUseFallback(true);
              } else {
                setImgFailed(true);
              }
            }}
            className="h-full w-full object-cover"
            style={{ objectPosition: useFallback ? member.objectPosition : '50% 50%' }}
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
});

/**
 * Executive Board org chart built from members.json:
 * - Zero-re-render hover branch highlight via precomputed SVG path ref + CSS class toggle
 * - `contain: layout paint` on org chart container + `96x96` WebP lazy thumbnails
 * - Smooth ~900ms WAAPI camera zoom + dim + FLIP expand on click (transform & opacity only)
 */
export function ExecutiveBoardSection() {
  const treeData = useMemo(() => organizeFamilyTree(membersJson as FamilyTreeData), []);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const baseBranchesGroupRef = useRef<SVGGElement | null>(null);
  const hoverOverlayPathRef = useRef<SVGPathElement | null>(null);

  const desktopButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobileButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const desktopLabelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mobileLabelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Precomputed once on mount/measure (zero state updates on hover)
  const hoverPathByIdRef = useRef<Record<string, string>>({});
  const hoverAnimRef = useRef<Animation | null>(null);

  const [geometry, setGeometry] = useState<StageGeometry>({
    width: 0,
    height: 0,
    paths: [],
  });
  const [modalSession, setModalSession] = useState<ModalSessionState | null>(null);

  const modalSessionRef = useRef<ModalSessionState | null>(null);
  modalSessionRef.current = modalSession;

  const isAnimatingRef = useRef(false);
  const isZoomActiveRef = useRef(false);
  const sessionSeqRef = useRef(0);
  const lastViewedIdRef = useRef<string | null>(null);
  const cameraStateRef = useRef<CameraState>({ tx: 0, ty: 0, scale: 1 });
  const cameraAnimRef = useRef<Animation | null>(null);
  const zoomAnimsRef = useRef<Animation[]>([]);
  const timersRef = useRef<number[]>([]);
  const savedScrollLockRef = useRef<{
    scrollY: number;
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
    htmlOverflowY: string;
  } | null>(null);

  const lockPageScroll = useCallback(() => {
    if (savedScrollLockRef.current) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    savedScrollLockRef.current = {
      scrollY,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      htmlOverflowY: html.style.overflowY,
    };

    html.style.overflowY = 'scroll';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
  }, []);

  const unlockPageScroll = useCallback(() => {
    const saved = savedScrollLockRef.current;
    if (!saved) return;
    savedScrollLockRef.current = null;

    const body = document.body;
    const html = document.documentElement;
    html.style.overflowY = saved.htmlOverflowY;
    body.style.position = saved.position;
    body.style.top = saved.top;
    body.style.left = saved.left;
    body.style.right = saved.right;
    body.style.width = saved.width;

    const prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, saved.scrollY);
    html.style.scrollBehavior = prevBehavior;
  }, []);

  const clearTimersAndAnims = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
    cameraAnimRef.current?.cancel();
    cameraAnimRef.current = null;
    for (const anim of zoomAnimsRef.current) anim.cancel();
    zoomAnimsRef.current = [];
  }, []);

  const getButtonForMember = useCallback((memberId: string): HTMLButtonElement | null => {
    const isDesktop = window.matchMedia('(min-width: 900px)').matches;
    return isDesktop
      ? desktopButtonRefs.current[memberId] ?? null
      : mobileButtonRefs.current[memberId] ?? null;
  }, []);

  const getActiveButtonsList = useCallback((): HTMLButtonElement[] => {
    const isDesktop = window.matchMedia('(min-width: 900px)').matches;
    const record = isDesktop ? desktopButtonRefs.current : mobileButtonRefs.current;
    return Object.values(record).filter(
      (btn): btn is HTMLButtonElement => Boolean(btn && btn.offsetWidth > 0),
    );
  }, []);

  const measureConnectors = useCallback(() => {
    if (isZoomActiveRef.current) return;
    const stage = stageRef.current;
    if (!stage) return;

    const naturalW = stage.offsetWidth;
    const naturalH = stage.offsetHeight;
    if (naturalW === 0 || naturalH === 0) return;

    const stageRect = stage.getBoundingClientRect();
    const scaleFactor = stageRect.width / naturalW || 1;
    const isDesktop = window.matchMedia('(min-width: 900px)').matches;
    const precomputedPaths: Record<string, string> = {};

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

      for (let i = 0; i < centerIds.length; i += 1) {
        const mId = centerIds[i];
        const mRect = centerRects[i];
        if (mId && mRect) {
          precomputedPaths[mId] = computeDesktopGoldTravelPath(
            mRect,
            'center',
            'secretariat',
            centerRects,
            secretariatLabelRect,
            sideGroups,
            naturalW / 2,
          );
        }
      }

      for (const sg of sideGroups) {
        const ids = sg.memberIds ?? [];
        for (let i = 0; i < ids.length; i += 1) {
          const mId = ids[i];
          const mRect = sg.memberRects[i];
          if (mId && mRect) {
            precomputedPaths[mId] = computeDesktopGoldTravelPath(
              mRect,
              sg.side,
              sg.groupId,
              centerRects,
              secretariatLabelRect,
              sideGroups,
              naturalW / 2,
            );
          }
        }
      }

      hoverPathByIdRef.current = precomputedPaths;
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

      for (const mg of mobileGroups) {
        const ids = mg.memberIds ?? [];
        for (let i = 0; i < ids.length; i += 1) {
          const mId = ids[i];
          const mRect = mg.memberRects[i];
          if (mId && mRect) {
            precomputedPaths[mId] = computeMobileGoldTravelPath(mRect, mg.groupId, mobileGroups, 10);
          }
        }
      }

      hoverPathByIdRef.current = precomputedPaths;
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
      }, 90);
    };

    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(stage);

    const sectionEl = document.getElementById('executive-board');
    const onCvState = (e: Event) => {
      const cvEvent = e as Event & { skipped?: boolean };
      if (!cvEvent.skipped) {
        window.requestAnimationFrame(measureConnectors);
      }
    };
    sectionEl?.addEventListener('contentvisibilityautostatechange', onCvState);

    window.addEventListener('resize', scheduleMeasure, { passive: true });
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) measureConnectors();
    });

    return () => {
      cancelled = true;
      if (debounceId !== null) window.clearTimeout(debounceId);
      ro.disconnect();
      sectionEl?.removeEventListener('contentvisibilityautostatechange', onCvState);
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [measureConnectors]);

  useEffect(() => {
    return () => {
      hoverAnimRef.current?.cancel();
      clearTimersAndAnims();
      unlockPageScroll();
    };
  }, [clearTimersAndAnims, unlockPageScroll]);

  // Zero-re-render hover highlight: set ONE overlay <path> d via ref + toggle CSS class
  const handleHoverEnter = useCallback((memberId: string) => {
    if (isZoomActiveRef.current || isAnimatingRef.current) return;
    const stage = stageRef.current;
    const overlay = hoverOverlayPathRef.current;
    const d = hoverPathByIdRef.current[memberId];
    if (!stage || !overlay || !d) return;

    hoverAnimRef.current?.cancel();
    hoverAnimRef.current = null;

    overlay.setAttribute('d', d);
    stage.classList.add('is-hovering');

    if (prefersReducedMotion()) {
      overlay.style.strokeDasharray = '';
      overlay.style.strokeDashoffset = '';
      return;
    }

    const len = overlay.getTotalLength();
    if (len > 0) {
      overlay.style.strokeDasharray = `${len}`;
      overlay.style.strokeDashoffset = `${len}`;
      hoverAnimRef.current = overlay.animate(
        [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
        {
          duration: 320,
          easing: EASE_OUT_EXPO,
          fill: 'forwards',
        },
      );
    }
  }, []);

  const handleHoverLeave = useCallback(() => {
    if (isZoomActiveRef.current || isAnimatingRef.current) return;
    const stage = stageRef.current;
    const overlay = hoverOverlayPathRef.current;

    hoverAnimRef.current?.cancel();
    hoverAnimRef.current = null;
    stage?.classList.remove('is-hovering');
    if (overlay) {
      overlay.setAttribute('d', '');
      overlay.style.strokeDasharray = '';
      overlay.style.strokeDashoffset = '';
    }
  }, []);

  // Click -> smooth ~900ms WAAPI camera zoom + dim + FLIP expand
  const handleSelectMember = useCallback(
    (member: OrderedMember) => {
      if (isAnimatingRef.current || isZoomActiveRef.current || modalSessionRef.current) return;

      const stage = stageRef.current;
      const btn = getButtonForMember(member.id);
      if (!stage || !btn) return;

      const reduced = prefersReducedMotion();
      lastViewedIdRef.current = member.id;
      sessionSeqRef.current += 1;
      const seqKey = sessionSeqRef.current;

      lockPageScroll();

      if (reduced) {
        isZoomActiveRef.current = true;
        setModalSession({
          activeIndex: member.canonicalIndex,
          flipCardRect: null,
          isReducedMotion: true,
          sessionKey: seqKey,
        });
        return;
      }

      isAnimatingRef.current = true;
      isZoomActiveRef.current = true;

      // Disable chart pointer events during animation & keep active branch lit
      stage.style.pointerEvents = 'none';
      stage.classList.remove('is-hovering');
      stage.classList.add('is-zoomed');
      document.getElementById('executive-board')?.setAttribute('data-chart-zoomed', 'true');

      hoverAnimRef.current?.cancel();
      hoverAnimRef.current = null;

      const overlay = hoverOverlayPathRef.current;
      const branchD = hoverPathByIdRef.current[member.id];
      if (overlay && branchD) {
        overlay.setAttribute('d', branchD);
        overlay.style.strokeDasharray = '';
        overlay.style.strokeDashoffset = '';
      }

      clearTimersAndAnims();

      // Compute centered camera zoom from live bounding rects (transform-origin: 0 0)
      const cam = computeCenteredCameraTransform({
        cardRect: btn.getBoundingClientRect(),
        chartRect: stage.getBoundingClientRect(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        currentTx: 0,
        currentTy: 0,
        currentScale: 1,
        targetScale: 1.5,
      });

      stage.style.willChange = 'transform';
      cameraStateRef.current = { tx: cam.tx, ty: cam.ty, scale: cam.scale };

      // 1. CAMERA ZOOM (0-700ms)
      cameraAnimRef.current = stage.animate(
        [
          { transform: 'translate3d(0px, 0px, 0) scale(1)' },
          { transform: cam.transform },
        ],
        {
          duration: 700,
          easing: EASE_OUT_EXPO,
          fill: 'forwards',
        },
      );

      // 2. DIM (0-500ms): every other card & non-active branch fades to 0.15
      const baseGroup = baseBranchesGroupRef.current;
      if (baseGroup) {
        zoomAnimsRef.current.push(
          baseGroup.animate([{ opacity: 1 }, { opacity: 0.15 }], {
            duration: 500,
            easing: EASE_OUT_EXPO,
            fill: 'forwards',
          }),
        );
      }

      for (const otherBtn of getActiveButtonsList()) {
        if (otherBtn === btn) continue;
        zoomAnimsRef.current.push(
          otherBtn.animate([{ opacity: 1 }, { opacity: 0.15 }], {
            duration: 500,
            easing: EASE_OUT_EXPO,
            fill: 'forwards',
          }),
        );
      }

      // 3. FLIP EXPAND (starts at 150ms using live zoomed card rect)
      const flipTimer = window.setTimeout(() => {
        if (sessionSeqRef.current !== seqKey) return;
        const cardRectAt150 = btn.getBoundingClientRect();
        btn.style.opacity = '0';

        setModalSession({
          activeIndex: member.canonicalIndex,
          flipCardRect: {
            left: cardRectAt150.left,
            top: cardRectAt150.top,
            width: cardRectAt150.width,
            height: cardRectAt150.height,
          },
          isReducedMotion: false,
          sessionKey: seqKey,
        });
      }, 150);
      timersRef.current.push(flipTimer);

      const finishTimer = window.setTimeout(() => {
        if (sessionSeqRef.current !== seqKey) return;
        stage.style.willChange = 'auto';
        isAnimatingRef.current = false;
      }, 910);
      timersRef.current.push(finishTimer);
    },
    [clearTimersAndAnims, getActiveButtonsList, getButtonForMember, lockPageScroll],
  );

  // Prev/Next inside panel: crossfade/slide 24px (200ms) while camera glides to new card (400ms)
  const handleNavigate = useCallback(
    (direction: -1 | 1) => {
      const currentSession = modalSessionRef.current;
      if (!currentSession || treeData.orderedMembers.length === 0) return;

      const total = treeData.orderedMembers.length;
      const prevMember = treeData.orderedMembers[currentSession.activeIndex];
      const nextIndex = (currentSession.activeIndex + direction + total) % total;
      const nextMember = treeData.orderedMembers[nextIndex];
      if (!nextMember) return;

      lastViewedIdRef.current = nextMember.id;
      setModalSession((prev) => (prev ? { ...prev, activeIndex: nextIndex } : prev));

      if (currentSession.isReducedMotion) return;

      const stage = stageRef.current;
      const nextBtn = getButtonForMember(nextMember.id);
      const prevBtn = prevMember ? getButtonForMember(prevMember.id) : null;
      if (!stage || !nextBtn) return;

      // Update lit gold branch to new target card
      const overlay = hoverOverlayPathRef.current;
      const branchD = hoverPathByIdRef.current[nextMember.id];
      if (overlay && branchD) {
        overlay.setAttribute('d', branchD);
      }

      // Dim previous active card cleanly and make new card ready behind backdrop
      if (prevBtn && prevBtn !== nextBtn) {
        prevBtn.style.opacity = '';
        zoomAnimsRef.current.push(
          prevBtn.animate([{ opacity: 0.15 }, { opacity: 0.15 }], {
            duration: 200,
            fill: 'forwards',
          }),
        );
      }
      zoomAnimsRef.current.push(
        nextBtn.animate([{ opacity: 0.15 }, { opacity: 1 }], {
          duration: 200,
          easing: EASE_OUT_EXPO,
          fill: 'forwards',
        }),
      );

      // Camera glide (400ms) from current live transform to centering next card
      const liveCam = getLiveCameraTransform(stage, cameraStateRef.current);
      const nextCam = computeCenteredCameraTransform({
        cardRect: nextBtn.getBoundingClientRect(),
        chartRect: stage.getBoundingClientRect(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        currentTx: liveCam.tx,
        currentTy: liveCam.ty,
        currentScale: liveCam.scale,
        targetScale: 1.5,
      });

      cameraAnimRef.current?.cancel();
      stage.style.willChange = 'transform';
      const fromTransform = `translate3d(${liveCam.tx.toFixed(1)}px, ${liveCam.ty.toFixed(1)}px, 0) scale(${liveCam.scale})`;
      const glideAnim = stage.animate(
        [{ transform: fromTransform }, { transform: nextCam.transform }],
        {
          duration: 400,
          easing: EASE_OUT_EXPO,
          fill: 'forwards',
        },
      );
      cameraAnimRef.current = glideAnim;
      cameraStateRef.current = { tx: nextCam.tx, ty: nextCam.ty, scale: nextCam.scale };

      glideAnim.finished
        .catch(() => {})
        .finally(() => {
          if (cameraAnimRef.current === glideAnim && !isAnimatingRef.current) {
            stage.style.willChange = 'auto';
          }
        });
    },
    [getButtonForMember, treeData.orderedMembers],
  );

  // Reverse zoom + un-dim when modal begins closing
  const handleStartClose = useCallback(() => {
    const currentSession = modalSessionRef.current;
    if (!currentSession || currentSession.isReducedMotion) return;

    const stage = stageRef.current;
    if (!stage) return;

    isAnimatingRef.current = true;
    const activeMember = treeData.orderedMembers[currentSession.activeIndex];
    const activeBtn = activeMember ? getButtonForMember(activeMember.id) : null;

    const liveCam = getLiveCameraTransform(stage, cameraStateRef.current);
    const fromTransform = `translate3d(${liveCam.tx.toFixed(1)}px, ${liveCam.ty.toFixed(1)}px, 0) scale(${liveCam.scale})`;

    clearTimersAndAnims();

    if (activeBtn) {
      activeBtn.style.opacity = '';
      zoomAnimsRef.current.push(
        activeBtn.animate([{ opacity: 0.25 }, { opacity: 1 }], {
          duration: 240,
          delay: 260,
          easing: EASE_OUT_EXPO,
          fill: 'forwards',
        }),
      );
    }

    stage.style.willChange = 'transform';
    cameraAnimRef.current = stage.animate(
      [
        { transform: fromTransform },
        { transform: 'translate3d(0px, 0px, 0) scale(1)' },
      ],
      {
        duration: 580,
        delay: 70,
        easing: EASE_OUT_EXPO,
        fill: 'forwards',
      },
    );
    cameraStateRef.current = { tx: 0, ty: 0, scale: 1 };

    const baseGroup = baseBranchesGroupRef.current;
    if (baseGroup) {
      zoomAnimsRef.current.push(
        baseGroup.animate([{ opacity: 0.15 }, { opacity: 1 }], {
          duration: 480,
          delay: 100,
          easing: EASE_OUT_EXPO,
          fill: 'forwards',
        }),
      );
    }

    for (const otherBtn of getActiveButtonsList()) {
      if (otherBtn === activeBtn) continue;
      zoomAnimsRef.current.push(
        otherBtn.animate([{ opacity: 0.15 }, { opacity: 1 }], {
          duration: 480,
          delay: 100,
          easing: EASE_OUT_EXPO,
          fill: 'forwards',
        }),
      );
    }

    const overlay = hoverOverlayPathRef.current;
    if (overlay) {
      zoomAnimsRef.current.push(
        overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 300,
          delay: 260,
          easing: EASE_OUT_EXPO,
          fill: 'forwards',
        }),
      );
    }
  }, [clearTimersAndAnims, getActiveButtonsList, getButtonForMember, treeData.orderedMembers]);

  const getActiveCardRect = useCallback((): ModalRectSnapshot | null => {
    const currentSession = modalSessionRef.current;
    if (!currentSession) return null;
    const activeMember = treeData.orderedMembers[currentSession.activeIndex];
    if (!activeMember) return null;
    const btn = getButtonForMember(activeMember.id);
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }, [getButtonForMember, treeData.orderedMembers]);

  const handleCloseComplete = useCallback(() => {
    const restoreId = lastViewedIdRef.current;
    clearTimersAndAnims();

    const stage = stageRef.current;
    if (stage) {
      stage.style.willChange = 'auto';
      stage.style.transform = '';
      stage.style.pointerEvents = '';
      stage.classList.remove('is-zoomed', 'is-hovering');
    }
    document.getElementById('executive-board')?.removeAttribute('data-chart-zoomed');

    const overlay = hoverOverlayPathRef.current;
    if (overlay) {
      overlay.setAttribute('d', '');
      overlay.style.strokeDasharray = '';
      overlay.style.strokeDashoffset = '';
    }

    for (const btn of Object.values(desktopButtonRefs.current)) {
      if (btn) btn.style.opacity = '';
    }
    for (const btn of Object.values(mobileButtonRefs.current)) {
      if (btn) btn.style.opacity = '';
    }

    cameraStateRef.current = { tx: 0, ty: 0, scale: 1 };
    isZoomActiveRef.current = false;
    isAnimatingRef.current = false;

    setModalSession(null);
    unlockPageScroll();

    if (restoreId) {
      window.requestAnimationFrame(() => {
        const btn = getButtonForMember(restoreId);
        btn?.focus({ preventScroll: true });
      });
    }
  }, [clearTimersAndAnims, getButtonForMember, unlockPageScroll]);

  const activeMember =
    modalSession !== null ? treeData.orderedMembers[modalSession.activeIndex] ?? null : null;

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

      <div className="relative mx-auto w-full max-w-[1160px] py-2">
        <div
          ref={stageRef}
          data-testid="org-chart-wrapper"
          className="ft-org-chart-container ft-stage relative w-full"
        >
          {/* Static faint centered willow-tree-only.svg watermark */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center select-none"
          >
            <img
              src="willow-tree-only.svg"
              alt=""
              loading="lazy"
              decoding="async"
              className="h-auto w-[min(86%,360px)] min-[900px]:w-[min(62%,540px)] opacity-[0.14]"
            />
          </div>

          {/* Static SVG Connector Lines + ONE Precomputed Hover/Zoom Gold Overlay <path> */}
          {geometry.width > 0 && geometry.height > 0 && (
            <svg
              aria-hidden="true"
              data-testid="living-tree-svg"
              viewBox={`0 0 ${geometry.width} ${geometry.height}`}
              className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
            >
              <g
                ref={baseBranchesGroupRef}
                data-testid="tree-base-branches"
                className="ft-base-branches"
              >
                {geometry.paths.map((p) => (
                  <path key={p.id} d={p.d} className="ft-connector-path" />
                ))}
              </g>

              <path
                ref={hoverOverlayPathRef}
                data-testid="hover-gold-branch"
                className="ft-hover-overlay-path"
                d=""
                fill="none"
                stroke="#d4bc74"
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
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
                        buttonRef={(el) => {
                          desktopButtonRefs.current[member.id] = el;
                        }}
                        onSelect={handleSelectMember}
                        onHoverEnter={handleHoverEnter}
                        onHoverLeave={handleHoverLeave}
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
                        buttonRef={(el) => {
                          desktopButtonRefs.current[member.id] = el;
                        }}
                        onSelect={handleSelectMember}
                        onHoverEnter={handleHoverEnter}
                        onHoverLeave={handleHoverLeave}
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
                        buttonRef={(el) => {
                          desktopButtonRefs.current[member.id] = el;
                        }}
                        onSelect={handleSelectMember}
                        onHoverEnter={handleHoverEnter}
                        onHoverLeave={handleHoverLeave}
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
                      buttonRef={(el) => {
                        mobileButtonRefs.current[member.id] = el;
                      }}
                      onSelect={handleSelectMember}
                      onHoverEnter={handleHoverEnter}
                      onHoverLeave={handleHoverLeave}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {activeMember && modalSession && (
        <MemberProfileModal
          key={modalSession.sessionKey}
          member={activeMember}
          activeIndex={modalSession.activeIndex}
          totalCount={treeData.orderedMembers.length}
          flipCardRect={modalSession.flipCardRect}
          isReducedMotion={modalSession.isReducedMotion}
          getActiveCardRect={getActiveCardRect}
          onStartClose={handleStartClose}
          onNavigate={handleNavigate}
          onCloseComplete={handleCloseComplete}
        />
      )}
    </RevealSection>
  );
}
