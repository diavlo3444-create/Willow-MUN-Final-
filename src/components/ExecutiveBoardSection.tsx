import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { CONFERENCE_DATA } from '../data/conference';
import { useDesktopPointerEnabled } from '../utils/pointerEffects';
import {
  BOARD_ARCHING_LIMBS,
  TREE_SEED,
  createSeededRng,
  evalCubicBezier,
  type CubicBezier,
  type DepthLayer,
  type SwaySide,
} from '../utils/willowTree';
import { RevealSection, SectionHeading } from './RevealSection';
import { TbaText } from './TbaText';

export interface BoardMember {
  name: string;
  role: string;
  photo: string;
}

export interface LeafFocusRequest {
  index: number;
  nonce: number;
}

export const members: BoardMember[] = [
  { name: 'Malek Arafah', role: 'Secretary-General', photo: 'malek.jpg' },
  { name: 'Naya Barakt', role: 'Deputy Secretary-General', photo: 'naya.jpg' },
  { name: 'Name TBA', role: 'General Advisor', photo: '' },
  { name: 'Name TBA', role: 'Role TBA', photo: '' },
  { name: 'Name TBA', role: 'Role TBA', photo: '' },
  { name: 'Name TBA', role: 'Role TBA', photo: '' },
  { name: 'Name TBA', role: 'Role TBA', photo: '' },
  { name: 'Name TBA', role: 'Role TBA', photo: '' },
];
// To add a person: add an item here. The tree creates a leaf for each item automatically.

interface GeneratedStrand {
  id: string;
  layer: DepthLayer;
  side: SwaySide;
  pathD: string;
}

interface DecorativeLeaf {
  key: string;
  x: number;
  y: number;
  angle: number;
  scale: number;
}

interface CandidateSlot {
  x: number;
  y: number;
  angle: number;
  side: SwaySide;
}

interface MemberLeafPlacement {
  index: number;
  member: BoardMember;
  x: number;
  y: number;
  angle: number;
  side: SwaySide;
}

interface LayerGroupData {
  key: string;
  layer: DepthLayer;
  side: SwaySide;
  pivotX: number;
  pivotY: number;
  className: string;
  duration: string;
  delay: string;
  color: string;
  leafOpacity: number;
  stemOpacity: number;
  strands: GeneratedStrand[];
  leaves: DecorativeLeaf[];
}

const VIEWBOX_W = 800;
const VIEWBOX_H = 720;
const CENTER_X = VIEWBOX_W / 2;
const CENTER_Y = VIEWBOX_H / 2;
const ARCHING_LIMBS = BOARD_ARCHING_LIMBS;

interface LaurelLeaf {
  key: string;
  x: number;
  y: number;
  angle: number;
  scale: number;
}

/**
 * Generates faint symmetrical laurel arcs cradling the willow tree (matching the emblem).
 */
function buildLaurelLeaves(): LaurelLeaf[] {
  const leaves: LaurelLeaf[] = [];
  const leftArc: CubicBezier = {
    x0: 358,
    y0: 682,
    cx1: 118,
    cy1: 632,
    cx2: 44,
    cy2: 348,
    x1: 136,
    y1: 122,
  };
  const rightArc: CubicBezier = {
    x0: 442,
    y0: 682,
    cx1: 682,
    cy1: 632,
    cx2: 756,
    cy2: 348,
    x1: 664,
    y1: 122,
  };

  const count = 16;
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const scale = 1.05 + Math.sin(t * Math.PI) * 0.45;

    const pL = evalCubicBezier(leftArc, t);
    leaves.push({
      key: `laurel-l-out-${i}`,
      x: Number(pL.x.toFixed(1)),
      y: Number(pL.y.toFixed(1)),
      angle: Number((pL.tangentDeg + 148).toFixed(1)),
      scale: Number(scale.toFixed(2)),
    });
    leaves.push({
      key: `laurel-l-in-${i}`,
      x: Number(pL.x.toFixed(1)),
      y: Number(pL.y.toFixed(1)),
      angle: Number((pL.tangentDeg - 148).toFixed(1)),
      scale: Number((scale * 0.92).toFixed(2)),
    });

    const pR = evalCubicBezier(rightArc, t);
    leaves.push({
      key: `laurel-r-out-${i}`,
      x: Number(pR.x.toFixed(1)),
      y: Number(pR.y.toFixed(1)),
      angle: Number((pR.tangentDeg - 148).toFixed(1)),
      scale: Number(scale.toFixed(2)),
    });
    leaves.push({
      key: `laurel-r-in-${i}`,
      x: Number(pR.x.toFixed(1)),
      y: Number(pR.y.toFixed(1)),
      angle: Number((pR.tangentDeg + 148).toFixed(1)),
      scale: Number((scale * 0.92).toFixed(2)),
    });
  }

  return leaves;
}

/**
 * Procedurally builds 74 weeping willow strands across 3 depth layers (6 swaying groups),
 * ~1,300 paired decorative leaves, and evenly spaced member leaf placements.
 */
function buildWillowTree(memberList: BoardMember[]): {
  layerGroups: LayerGroupData[];
  memberPlacements: MemberLeafPlacement[];
  memberLeafScale: number;
  zoomScale: number;
  laurelLeaves: LaurelLeaf[];
} {
  const rng = createSeededRng(TREE_SEED);

  const groupDefs: Array<{
    key: string;
    layer: DepthLayer;
    side: SwaySide;
    pivotX: number;
    pivotY: number;
    className: string;
    duration: string;
    delay: string;
    color: string;
    leafOpacity: number;
    stemOpacity: number;
  }> = [
    {
      key: 'back-left',
      layer: 'back',
      side: 'left',
      pivotX: 392,
      pivotY: 332,
      className: 'willow-branch-sway-a',
      duration: '9.1s',
      delay: '-1.4s',
      color: '#6b7547',
      leafOpacity: 0.45,
      stemOpacity: 0.35,
    },
    {
      key: 'back-right',
      layer: 'back',
      side: 'right',
      pivotX: 412,
      pivotY: 332,
      className: 'willow-branch-sway-b',
      duration: '8.7s',
      delay: '-4.2s',
      color: '#6b7547',
      leafOpacity: 0.45,
      stemOpacity: 0.35,
    },
    {
      key: 'middle-left',
      layer: 'middle',
      side: 'left',
      pivotX: 392,
      pivotY: 326,
      className: 'willow-branch-sway-b',
      duration: '7.8s',
      delay: '-2.6s',
      color: '#6b7547',
      leafOpacity: 0.75,
      stemOpacity: 0.48,
    },
    {
      key: 'middle-right',
      layer: 'middle',
      side: 'right',
      pivotX: 412,
      pivotY: 326,
      className: 'willow-branch-sway-a',
      duration: '8.2s',
      delay: '-5.1s',
      color: '#6b7547',
      leafOpacity: 0.75,
      stemOpacity: 0.48,
    },
    {
      key: 'front-left',
      layer: 'front',
      side: 'left',
      pivotX: 394,
      pivotY: 320,
      className: 'willow-branch-sway-a',
      duration: '6.8s',
      delay: '-0.8s',
      color: '#ede6ca',
      leafOpacity: 0.9,
      stemOpacity: 0.52,
    },
    {
      key: 'front-right',
      layer: 'front',
      side: 'right',
      pivotX: 410,
      pivotY: 320,
      className: 'willow-branch-sway-b',
      duration: '7.1s',
      delay: '-3.3s',
      color: '#ede6ca',
      leafOpacity: 0.9,
      stemOpacity: 0.52,
    },
  ];

  const groupMap = new Map<string, LayerGroupData>();
  for (const def of groupDefs) {
    groupMap.set(def.key, { ...def, strands: [], leaves: [] });
  }

  const layers: DepthLayer[] = ['back', 'middle', 'front'];
  const candidateSlots: CandidateSlot[] = [];
  let strandCounter = 0;

  for (let limbIdx = 0; limbIdx < ARCHING_LIMBS.length; limbIdx++) {
    const { curve, side, strandCount } = ARCHING_LIMBS[limbIdx];
    for (let s = 0; s < strandCount; s++) {
      const tAnchor = 0.14 + (s / Math.max(1, strandCount - 1)) * 0.85;
      const anchor = evalCubicBezier(curve, tAnchor);
      const layer = layers[(strandCounter + limbIdx) % 3];
      const group = groupMap.get(`${layer}-${side}`)!;

      // Outer strands curve gently outward before falling straight down toward the lower panel
      const distFromTrunk = anchor.x - 400;
      const outwardDrift = Math.sign(distFromTrunk) * (10 + rng() * 24);
      const targetBottomY = 485 + rng() * 145; // Reaches 485..630 near bottom of panel
      const dropLen = Math.max(185, targetBottomY - anchor.y);

      const strandCurve: CubicBezier = {
        x0: anchor.x + (rng() - 0.5) * 8,
        y0: anchor.y + (rng() - 0.5) * 6,
        cx1: anchor.x + outwardDrift * 0.85,
        cy1: anchor.y + dropLen * 0.28,
        cx2: anchor.x + outwardDrift * 1.15 + (rng() - 0.5) * 14,
        cy2: anchor.y + dropLen * 0.68,
        x1: anchor.x + outwardDrift + (rng() - 0.5) * 16,
        y1: Math.min(636, anchor.y + dropLen),
      };

      const strandId = `st-${strandCounter++}`;
      group.strands.push({
        id: strandId,
        layer,
        side,
        pathD: `M${strandCurve.x0.toFixed(1)} ${strandCurve.y0.toFixed(1)} C${strandCurve.cx1.toFixed(1)} ${strandCurve.cy1.toFixed(1)} ${strandCurve.cx2.toFixed(1)} ${strandCurve.cy2.toFixed(1)} ${strandCurve.x1.toFixed(1)} ${strandCurve.y1.toFixed(1)}`,
      });

      // Paired leaves along both sides of the stem, tapering smaller toward the tip (9 pairs = 18 leaves/strand)
      const pairCount = dropLen > 310 ? 10 : dropLen > 240 ? 9 : 8;
      for (let p = 0; p < pairCount; p++) {
        const t = 0.08 + (p / pairCount) * 0.88;
        const pt = evalCubicBezier(strandCurve, t);
        const taper = 0.94 - t * 0.42; // Smaller toward tip

        // Left & right leaf of the pair
        const leftAngle = pt.tangentDeg - (26 + rng() * 14);
        const rightAngle = pt.tangentDeg + (26 + rng() * 14);
        const leftScale = taper * (0.9 + rng() * 0.2);
        const rightScale = taper * (0.9 + rng() * 0.2);

        group.leaves.push({
          key: `${strandId}-l-${p}`,
          x: Number(pt.x.toFixed(1)),
          y: Number(pt.y.toFixed(1)),
          angle: Number(leftAngle.toFixed(1)),
          scale: Number(leftScale.toFixed(2)),
        });

        group.leaves.push({
          key: `${strandId}-r-${p}`,
          x: Number(pt.x.toFixed(1)),
          y: Number(pt.y.toFixed(1)),
          angle: Number(rightAngle.toFixed(1)),
          scale: Number(rightScale.toFixed(2)),
        });

        // Candidate slots for member leaves along middle/front strands well inside the panel
        if (
          layer !== 'back' &&
          p >= 1 &&
          p <= pairCount - 2 &&
          pt.x >= 98 &&
          pt.x <= 702 &&
          pt.y >= 150 &&
          pt.y <= 595 &&
          // Avoid overlapping directly over the thickest trunk core
          !(Math.abs(pt.x - 406) < 24 && pt.y > 330)
        ) {
          candidateSlots.push({
            x: Number(pt.x.toFixed(1)),
            y: Number(pt.y.toFixed(1)),
            angle: Number((p % 2 === 0 ? rightAngle : leftAngle).toFixed(1)),
            side,
          });
        }
      }
    }
  }

  // Select N maximally-spaced positions across the canopy:
  // 1) Reserve top-center crown positions for Secretary-General (0) and Deputy Secretary-General (1)
  // 2) Spread the remaining members evenly across the rest of the tree via farthest-point sampling
  const totalMembers = memberList.length;
  const chosenSlots: CandidateSlot[] = [];
  const usedIndices = new Set<number>();

  if (totalMembers > 0 && candidateSlots.length > 0) {
    const pickClosestTo = (targetX: number, targetY: number, minSeparationFromExisting: number) => {
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < candidateSlots.length; i++) {
        if (usedIndices.has(i)) continue;
        const cand = candidateSlots[i];
        const tooClose = chosenSlots.some(
          (picked) => Math.hypot(cand.x - picked.x, cand.y - picked.y) < minSeparationFromExisting,
        );
        if (tooClose) continue;
        const dist = Math.hypot(cand.x - targetX, cand.y - targetY);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      return bestIdx;
    };

    const sgIdx = pickClosestTo(366, 178, 0);
    if (sgIdx !== -1) {
      usedIndices.add(sgIdx);
      chosenSlots.push(candidateSlots[sgIdx]);
    }

    if (totalMembers > 1) {
      const dsgIdx = pickClosestTo(434, 184, 52);
      if (dsgIdx !== -1) {
        usedIndices.add(dsgIdx);
        chosenSlots.push(candidateSlots[dsgIdx]);
      }
    }

    while (chosenSlots.length < totalMembers && usedIndices.size < candidateSlots.length) {
      let farthestIdx = -1;
      let maxMinDist = -1;

      for (let i = 0; i < candidateSlots.length; i++) {
        if (usedIndices.has(i)) continue;
        const cand = candidateSlots[i];
        let minDist = Infinity;
        for (let j = 0; j < chosenSlots.length; j++) {
          const picked = chosenSlots[j];
          const d = Math.hypot(cand.x - picked.x, cand.y - picked.y);
          if (d < minDist) minDist = d;
        }
        if (minDist > maxMinDist) {
          maxMinDist = minDist;
          farthestIdx = i;
        }
      }

      if (farthestIdx === -1) break;
      usedIndices.add(farthestIdx);
      chosenSlots.push(candidateSlots[farthestIdx]);
    }
  }

  // Keep SG (0) and DSG (1) pinned to the top-center crown slots; shuffle remaining slots deterministically
  const remainingSlots = chosenSlots.slice(2).map((slot) => ({ slot, sortKey: rng() }));
  remainingSlots.sort((a, b) => a.sortKey - b.sortKey);
  const orderedSlots = [...chosenSlots.slice(0, 2), ...remainingSlots.map((item) => item.slot)];

  const memberPlacements: MemberLeafPlacement[] = memberList.map((member, index) => {
    const fallback = chosenSlots[index % Math.max(1, chosenSlots.length)] ?? {
      x: 400,
      y: 280,
      angle: 0,
      side: 'left' as SwaySide,
    };
    const picked = orderedSlots[index] ?? fallback;
    return {
      index,
      member,
      x: picked.x,
      y: picked.y,
      angle: picked.angle,
      side: picked.side,
    };
  });

  // Scale member leaves and zoom automatically when there are many members
  const densityRatio = Math.min(1, Math.max(0, (totalMembers - 8) / 52));
  const memberLeafScale = Number((1.0 - densityRatio * 0.3).toFixed(3));
  const zoomScale = Number((6.0 / memberLeafScale).toFixed(2));

  return {
    layerGroups: Array.from(groupMap.values()),
    memberPlacements,
    memberLeafScale,
    zoomScale,
    laurelLeaves: buildLaurelLeaves(),
  };
}

function renderTbaAwareName(value: string) {
  if (value.trim() === 'Name TBA') {
    return <TbaText text="Name TBA" />;
  }
  if (!value.includes('TBA')) return value;
  const parts = value.split('TBA');
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <TbaText text="TBA" />}
        </span>
      ))}
    </>
  );
}

function renderTbaAwareRole(value: string) {
  if (!value.includes('TBA')) return value;
  const parts = value.split('TBA');
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <TbaText text="TBA" className="normal-case text-sm" />}
        </span>
      ))}
    </>
  );
}

/**
 * Executive Board section powered by a lush, logo-inspired procedural weeping willow SVG.
 * Supports 8 to 60+ members automatically, cursor-following edge-flipping hover tooltips,
 * keyboard focus tooltips/outlines, 6x auto-adjusted leaf zoom, card frame, arrows, and swipe.
 */
interface ExecutiveBoardSectionProps {
  focusLeafRequest?: LeafFocusRequest | null;
}

export function ExecutiveBoardSection({ focusLeafRequest }: ExecutiveBoardSectionProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const leafButtonRefs = useRef<Record<number, SVGGElement | null>>({});
  const lastOpenedIndexRef = useRef<number | null>(null);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const transitionTimersRef = useRef<number[]>([]);
  const focusRequestTimerRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const desktopPointer = useDesktopPointerEnabled();

  const [isTreeOnScreen, setIsTreeOnScreen] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [cardVisible, setCardVisible] = useState(false);
  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({});
  const [zoomTransform, setZoomTransform] = useState<{
    tx: number;
    ty: number;
    scale: number;
    durationMs: number;
    easing: string;
  }>({
    tx: 0,
    ty: 0,
    scale: 1,
    durationMs: 900,
    easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
  });

  const { layerGroups, memberPlacements, memberLeafScale, zoomScale, laurelLeaves } = useMemo(
    () => buildWillowTree(members),
    [],
  );

  const hitRadius = Math.max(18, Math.round(24 * memberLeafScale));

  const clearTimers = useCallback(() => {
    for (const id of transitionTimersRef.current) {
      window.clearTimeout(id);
    }
    transitionTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // Pause branch sway when tree is off-screen
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setIsTreeOnScreen(Boolean(entries[0]?.isIntersecting));
      },
      { threshold: 0.05 },
    );
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  // Track prefers-reduced-motion
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const positionTooltipAtPanelPoint = useCallback((relX: number, relY: number) => {
    const panel = panelRef.current;
    const tip = tooltipRef.current;
    if (!panel || !tip) return;

    const pw = panel.clientWidth;
    const ph = panel.clientHeight;
    const tw = tip.offsetWidth || 180;
    const th = tip.offsetHeight || 56;
    const pad = 10;
    const offset = 16;

    let tx = relX + offset;
    if (tx + tw > pw - pad) {
      tx = relX - tw - offset;
    }
    tx = Math.max(pad, Math.min(pw - tw - pad, tx));

    let ty = relY + offset;
    if (ty + th > ph - pad) {
      ty = relY - th - offset;
    }
    ty = Math.max(pad, Math.min(ph - th - pad, ty));

    tip.style.transform = `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0)`;
  }, []);

  useEffect(() => {
    if (tooltipIndex !== null && lastPointerPosRef.current) {
      positionTooltipAtPanelPoint(lastPointerPosRef.current.x, lastPointerPosRef.current.y);
    }
  }, [tooltipIndex, positionTooltipAtPanelPoint]);

  const handleLeafPointerEnter = useCallback(
    (event: ReactPointerEvent<SVGGElement>, index: number) => {
      if (!desktopPointer || event.pointerType !== 'mouse' || activeIndex !== null) return;
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      const relX = event.clientX - rect.left;
      const relY = event.clientY - rect.top;
      lastPointerPosRef.current = { x: relX, y: relY };
      setTooltipIndex(index);
      positionTooltipAtPanelPoint(relX, relY);
    },
    [activeIndex, desktopPointer, positionTooltipAtPanelPoint],
  );

  const handleLeafPointerMove = useCallback(
    (event: ReactPointerEvent<SVGGElement>) => {
      if (!desktopPointer || event.pointerType !== 'mouse' || activeIndex !== null) return;
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      const relX = event.clientX - rect.left;
      const relY = event.clientY - rect.top;
      lastPointerPosRef.current = { x: relX, y: relY };
      positionTooltipAtPanelPoint(relX, relY);
    },
    [activeIndex, desktopPointer, positionTooltipAtPanelPoint],
  );

  const handleLeafPointerLeave = useCallback(() => {
    lastPointerPosRef.current = null;
    setTooltipIndex(null);
  }, []);

  const handleLeafFocus = useCallback(
    (index: number) => {
      if (activeIndex !== null) return;
      const panel = panelRef.current;
      const placement = memberPlacements[index];
      if (!panel || !placement) return;

      const pw = panel.clientWidth;
      const ph = panel.clientHeight;
      const scale = Math.min(pw / VIEWBOX_W, ph / VIEWBOX_H);
      const offsetX = (pw - VIEWBOX_W * scale) / 2;
      const offsetY = (ph - VIEWBOX_H * scale) / 2;
      const px = offsetX + placement.x * scale;
      const py = offsetY + placement.y * scale;

      lastPointerPosRef.current = { x: px, y: py };
      setTooltipIndex(index);
    },
    [activeIndex, memberPlacements],
  );

  const handleLeafBlur = useCallback(() => {
    lastPointerPosRef.current = null;
    setTooltipIndex(null);
  }, []);

  const computeFocusTransform = useCallback((x: number, y: number, scale: number) => {
    return {
      tx: Number((CENTER_X - scale * x).toFixed(2)),
      ty: Number((CENTER_Y - scale * y).toFixed(2)),
      scale,
    };
  }, []);

  const openLeaf = useCallback(
    (index: number) => {
      const target = memberPlacements[index];
      if (!target) return;

      clearTimers();
      setTooltipIndex(null);
      lastOpenedIndexRef.current = index;
      setActiveIndex(index);
      setCardVisible(false);

      if (prefersReducedMotion) {
        setZoomTransform({
          tx: 0,
          ty: 0,
          scale: 1,
          durationMs: 200,
          easing: 'ease',
        });
        const t = window.setTimeout(() => setCardVisible(true), 60);
        transitionTimersRef.current.push(t);
        return;
      }

      const { tx, ty, scale } = computeFocusTransform(target.x, target.y, zoomScale);
      setZoomTransform({
        tx,
        ty,
        scale,
        durationMs: 900,
        easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
      });

      const t = window.setTimeout(() => {
        setCardVisible(true);
      }, 880);
      transitionTimersRef.current.push(t);
    },
    [clearTimers, computeFocusTransform, memberPlacements, prefersReducedMotion, zoomScale],
  );

  // Programmatic scroll-to-tree and zoom into a requested member leaf (e.g. from Secretariat cards)
  useEffect(() => {
    if (!focusLeafRequest || focusLeafRequest.nonce <= 0) return;
    if (focusRequestTimerRef.current !== null) {
      window.clearTimeout(focusRequestTimerRef.current);
      focusRequestTimerRef.current = null;
    }

    const panel = panelRef.current;
    if (panel) {
      panel.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
    }

    focusRequestTimerRef.current = window.setTimeout(
      () => {
        focusRequestTimerRef.current = null;
        openLeaf(focusLeafRequest.index);
      },
      prefersReducedMotion ? 40 : 480,
    );

    return () => {
      if (focusRequestTimerRef.current !== null) {
        window.clearTimeout(focusRequestTimerRef.current);
        focusRequestTimerRef.current = null;
      }
    };
  }, [focusLeafRequest, openLeaf, prefersReducedMotion]);

  const navigateLeaf = useCallback(
    (direction: -1 | 1) => {
      if (activeIndex === null || memberPlacements.length === 0) return;
      const nextIndex =
        (activeIndex + direction + memberPlacements.length) % memberPlacements.length;
      const current = memberPlacements[activeIndex];
      const next = memberPlacements[nextIndex];
      if (!current || !next) return;

      clearTimers();
      lastOpenedIndexRef.current = nextIndex;
      setCardVisible(false);

      if (prefersReducedMotion) {
        setActiveIndex(nextIndex);
        const t = window.setTimeout(() => setCardVisible(true), 80);
        transitionTimersRef.current.push(t);
        return;
      }

      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;
      const hop = computeFocusTransform(midX, midY, Math.max(2.1, zoomScale * 0.38));

      const tHop = window.setTimeout(() => {
        setActiveIndex(nextIndex);
        setZoomTransform({
          ...hop,
          durationMs: 320,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        });
      }, 140);

      const focusNext = computeFocusTransform(next.x, next.y, zoomScale);
      const tZoomIn = window.setTimeout(() => {
        setZoomTransform({
          ...focusNext,
          durationMs: 650,
          easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
        });
      }, 430);

      const tShow = window.setTimeout(() => {
        setCardVisible(true);
      }, 1050);

      transitionTimersRef.current.push(tHop, tZoomIn, tShow);
    },
    [
      activeIndex,
      clearTimers,
      computeFocusTransform,
      memberPlacements,
      prefersReducedMotion,
      zoomScale,
    ],
  );

  const closeZoom = useCallback(() => {
    if (activeIndex === null) return;
    clearTimers();
    const restoreIndex = lastOpenedIndexRef.current ?? activeIndex;
    setCardVisible(false);
    setActiveIndex(null);

    setZoomTransform({
      tx: 0,
      ty: 0,
      scale: 1,
      durationMs: prefersReducedMotion ? 180 : 820,
      easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
    });

    const tFocus = window.setTimeout(() => {
      leafButtonRefs.current[restoreIndex]?.focus();
    }, 60);
    transitionTimersRef.current.push(tFocus);
  }, [activeIndex, clearTimers, prefersReducedMotion]);

  // Keyboard navigation while zoomed (Escape, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (activeIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeZoom();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateLeaf(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateLeaf(1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, closeZoom, navigateLeaf]);

  const handleLeafKeyDown = (event: ReactKeyboardEvent<SVGGElement>, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openLeaf(index);
    }
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (activeIndex === null || event.touches.length !== 1) return;
    touchStartXRef.current = event.touches[0].clientX;
    touchStartYRef.current = event.touches[0].clientY;
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (
      activeIndex === null ||
      touchStartXRef.current === null ||
      touchStartYRef.current === null ||
      event.changedTouches.length !== 1
    ) {
      return;
    }

    const dx = event.changedTouches[0].clientX - touchStartXRef.current;
    const dy = event.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      navigateLeaf(dx < 0 ? 1 : -1);
    }
  };

  const isZoomed = activeIndex !== null;
  const activeMember = isZoomed ? members[activeIndex] : null;
  const hoveredMember = tooltipIndex !== null && !isZoomed ? members[tooltipIndex] : null;
  const pauseSway = !isTreeOnScreen || isZoomed;

  const frontLeftMembers = memberPlacements.filter((m) => m.side === 'left');
  const frontRightMembers = memberPlacements.filter((m) => m.side === 'right');

  return (
    <RevealSection id="executive-board" ariaLabelledBy="executive-board-heading">
      <div className="mb-8 sm:mb-10 text-center">
        <SectionHeading
          id="executive-board-heading"
          label={CONFERENCE_DATA.executiveBoard.label}
          prefix="EXECUTIVE"
          italicWord="BOARD"
          period
          centered
        />
        <p className="mun-heading-reveal mt-3 text-xs sm:text-sm uppercase tracking-[0.2em] text-[#cfc8aa]">
          Hover a leaf to see who they are. Click to meet them.
        </p>
      </div>

      {/* Rounded dark panel (max 1000px, ~4:3 desktop, ~1:1.2 mobile) */}
      <div
        ref={panelRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`relative mx-auto w-full max-w-[1000px] aspect-[1/1.2] md:aspect-[4/3] overflow-hidden rounded-lg border border-[#ede6ca]/15 bg-[rgba(24,28,13,0.94)] ${
          pauseSway ? 'willow-paused' : ''
        }`}
      >
        <svg
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Interactive Willow MUN Executive Board tree"
          className="block h-full w-full select-none"
        >
          <defs>
            {/* Reusable slender willow leaf symbol (origin at stem base x=0, y=0) */}
            <symbol id="willow-leaf-decor" viewBox="0 0 12 28">
              <path
                d="M6 0.6 C9.1 6.4 9.4 16.5 6 27.2 C2.6 16.5 2.9 6.4 6 0.6 Z"
                fill="currentColor"
              />
            </symbol>
          </defs>

          {/* Inner camera zoom group (translate + scale on transform only) */}
          <g
            style={{
              transformOrigin: '0px 0px',
              transform: `translate3d(${zoomTransform.tx}px, ${zoomTransform.ty}px, 0) scale(${zoomTransform.scale})`,
              transition: `transform ${zoomTransform.durationMs}ms ${zoomTransform.easing}`,
            }}
          >
            {/* Very faint laurel wreath arcs behind the tree (cream at 12% opacity) */}
            <g
              color="#ede6ca"
              style={{
                opacity: isZoomed ? 0.04 : 0.12,
                transition: 'opacity 600ms ease',
              }}
              aria-hidden="true"
            >
              <path
                d="M358 682 C118 632 44 348 136 122 M442 682 C682 632 756 348 664 122"
                fill="none"
                stroke="#ede6ca"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              {laurelLeaves.map((leaf) => (
                <use
                  key={leaf.key}
                  href="#willow-leaf-decor"
                  x="-6"
                  y="0"
                  width="12"
                  height="28"
                  transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.angle}) scale(${leaf.scale})`}
                />
              ))}
            </g>

            {/* Trunk, roots, grass tufts & thick arching limbs (fade to 20% while zoomed) */}
            <g
              style={{
                opacity: isZoomed ? 0.2 : 1,
                transition: 'opacity 600ms ease',
              }}
            >
              {/* Curved S-shaped trunk & root flare */}
              <path
                d="M276 668 Q340 662 372 650 Q382 618 389 572 Q397 518 412 465 Q422 430 413 386 Q405 352 396 312 L414 310 Q426 348 432 388 Q440 434 428 482 Q411 542 414 608 Q418 648 436 655 Q470 663 534 668 Q455 672 404 670 Q342 672 276 668 Z"
                fill="#ede6ca"
              />

              {/* Bark texture lines matching logo woodcut character */}
              <path
                d="M402 642 Q405 590 413 546 M395 604 Q401 572 405 548 M417 462 Q421 426 415 394 M404 374 Q409 346 406 324 M388 644 Q395 622 397 598"
                fill="none"
                stroke="#232814"
                strokeWidth="1.9"
                strokeLinecap="round"
                opacity="0.45"
              />

              {/* Small grass tufts at roots */}
              <path
                d="M322 666 Q312 645 302 634 M336 665 Q332 647 325 638 M352 662 Q350 647 346 640 M458 662 Q463 646 470 637 M474 665 Q482 648 492 639 M488 666 Q499 652 509 644"
                fill="none"
                stroke="#ede6ca"
                strokeWidth="1.9"
                strokeLinecap="round"
                opacity="0.86"
              />

              {/* Thick arching primary limbs (cubic Béziers) */}
              {ARCHING_LIMBS.map((limb, i) => {
                const b = limb.curve;
                return (
                  <path
                    key={`limb-${i}`}
                    d={`M${b.x0} ${b.y0} C${b.cx1} ${b.cy1} ${b.cx2} ${b.cy2} ${b.x1} ${b.y1}`}
                    fill="none"
                    stroke="#ede6ca"
                    strokeWidth={i === 2 || i === 3 ? '4.4' : '5.2'}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>

            {/* 6 swaying depth-layered strand groups (back moss 45%, middle moss 75%, front cream 90%) */}
            {layerGroups.map((group) => {
              const groupMembers =
                group.layer === 'front'
                  ? group.side === 'left'
                    ? frontLeftMembers
                    : frontRightMembers
                  : [];

              return (
                <g
                  key={group.key}
                  className={group.className}
                  style={{
                    transformOrigin: `${group.pivotX}px ${group.pivotY}px`,
                    animationDuration: group.duration,
                    animationDelay: group.delay,
                  }}
                >
                  {/* Decorative stems + paired <use> leaves (fade to 20% while zoomed) */}
                  <g
                    style={{
                      opacity: isZoomed ? 0.2 : 1,
                      transition: 'opacity 600ms ease',
                    }}
                  >
                    <g fill="none" stroke={group.color} strokeWidth="1.15" strokeLinecap="round" opacity={group.stemOpacity}>
                      {group.strands.map((st) => (
                        <path key={st.id} d={st.pathD} />
                      ))}
                    </g>

                    <g color={group.color} opacity={group.leafOpacity}>
                      {group.leaves.map((leaf) => (
                        <use
                          key={leaf.key}
                          href="#willow-leaf-decor"
                          x="-6"
                          y="0"
                          width="12"
                          height="28"
                          transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.angle}) scale(${leaf.scale})`}
                        />
                      ))}
                    </g>
                  </g>

                  {/* Interactive bright cream member leaves in front of all decorative leaves */}
                  {groupMembers.map((item) => {
                    const isActive = activeIndex === item.index;
                    const leafOpacity = isZoomed ? (isActive ? 1 : 0.2) : 1;

                    return (
                      <g
                        key={`member-leaf-${item.index}`}
                        ref={(el) => {
                          leafButtonRefs.current[item.index] = el;
                        }}
                        role="button"
                        tabIndex={isZoomed ? -1 : 0}
                        aria-label={`${item.member.role}: ${item.member.name}. Activate to view details`}
                        onPointerEnter={(e) => handleLeafPointerEnter(e, item.index)}
                        onPointerMove={handleLeafPointerMove}
                        onPointerLeave={handleLeafPointerLeave}
                        onFocus={() => handleLeafFocus(item.index)}
                        onBlur={handleLeafBlur}
                        onClick={(e) => {
                          e.stopPropagation();
                          openLeaf(item.index);
                        }}
                        onKeyDown={(e) => handleLeafKeyDown(e, item.index)}
                        transform={`translate(${item.x} ${item.y})`}
                        style={{
                          opacity: leafOpacity,
                          transition: 'opacity 600ms ease',
                        }}
                        className="willow-member-leaf cursor-pointer"
                      >
                        {/* Invisible generous hit area (>= 15 SVG units radius) */}
                        <circle
                          cx="0"
                          cy={16 * memberLeafScale}
                          r={hitRadius}
                          fill="transparent"
                        />

                        <g
                          transform={`rotate(${item.angle}) scale(${memberLeafScale})`}
                          className="willow-member-shape"
                        >
                          {/* Keyboard focus cream outline */}
                          <path
                            d="M0 -3 C9.2 10.5 9.6 26.5 0 41 C-9.6 26.5 -9.2 10.5 0 -3 Z"
                            fill="none"
                            stroke="#ede6ca"
                            strokeWidth="2.1"
                            className="willow-member-focus-ring"
                          />

                          {/* Bright cream member leaf (larger than decorative leaves) */}
                          <path
                            d="M0 0 C7.4 10.5 7.8 24.5 0 38 C-7.8 24.5 -7.4 10.5 0 0 Z"
                            fill="#ede6ca"
                            className="willow-member-fill"
                          />

                          {/* Subtle stem/midrib vein */}
                          <path
                            d="M0 3.5 L0 33.5"
                            stroke="#232814"
                            strokeWidth="1.05"
                            strokeLinecap="round"
                            opacity="0.35"
                          />
                        </g>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Cursor-following flat dark pill tooltip (desktop hover & keyboard focus) */}
        <div
          ref={tooltipRef}
          role="tooltip"
          aria-hidden={!hoveredMember}
          style={{
            backgroundColor: 'rgba(20, 24, 10, 0.96)',
            border: '1px solid rgba(237, 230, 202, 0.30)',
            borderRadius: '12px',
            opacity: hoveredMember ? 1 : 0,
            transition: 'opacity 120ms ease',
          }}
          className="pointer-events-none absolute top-0 left-0 z-20 w-max max-w-[calc(100%-20px)] px-4 py-2.5 text-left"
        >
          {hoveredMember && (
            <>
              <p className="font-serif text-[clamp(1rem,2.6vw,1.25rem)] font-medium leading-tight text-[#ede6ca] whitespace-nowrap">
                {renderTbaAwareName(hoveredMember.name)}
              </p>
              <p className="mt-1 text-[clamp(9px,2.2vw,11px)] font-medium uppercase tracking-[0.18em] text-[#cfc8aa] whitespace-nowrap">
                {hoveredMember.role}
              </p>
            </>
          )}
        </div>

        {/* Zoomed Member Leaf Card Overlay */}
        {isZoomed && activeMember && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${activeMember.role} details`}
            onClick={closeZoom}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 sm:p-8"
          >
            {/* Close button (✕) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeZoom();
              }}
              aria-label="Close member details"
              className="mun-btn-interactive absolute top-3 right-3 sm:top-5 sm:right-5 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[#ede6ca]/35 bg-[#181c0d]/95 text-[#ede6ca] hover:border-[#ede6ca] cursor-pointer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Big Leaf Card Frame (fades in over 300ms once zoom settles) */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                opacity: cardVisible ? 1 : 0,
                transform: cardVisible ? 'scale(1)' : 'scale(0.96)',
                transition:
                  'opacity 300ms ease, transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className="relative flex w-full max-w-[310px] sm:max-w-[390px] flex-col items-center justify-center rounded-[72px_12px_72px_12px] border border-[#ede6ca]/45 bg-[#181c0d]/95 px-6 py-6 sm:px-10 sm:py-10 text-center"
            >
              {/* Photo circle (~130px desktop, 96px on 360px phone) with cream ring */}
              <div className="flex h-[96px] w-[96px] sm:h-[130px] sm:w-[130px] items-center justify-center overflow-hidden rounded-full border-2 border-[#ede6ca] bg-[#232814]">
                {activeMember.photo && !failedPhotos[activeMember.photo] ? (
                  <img
                    src={
                      activeMember.photo.startsWith('/') || activeMember.photo.startsWith('http')
                        ? activeMember.photo
                        : `/${activeMember.photo}`
                    }
                    alt={activeMember.name}
                    style={{ objectPosition: 'center 20%' }}
                    onError={() =>
                      setFailedPhotos((prev) => ({ ...prev, [activeMember.photo]: true }))
                    }
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={CONFERENCE_DATA.brand.logoSrc}
                    alt="Willow MUN emblem placeholder"
                    className="h-full w-full object-contain p-2.5 sm:p-3"
                  />
                )}
              </div>

              <h3 className="mt-5 font-serif text-2xl sm:text-4xl font-medium leading-tight text-[#ede6ca] [text-wrap:balance]">
                {renderTbaAwareName(activeMember.name)}
              </h3>

              <p className="mt-2 text-[11px] sm:text-xs font-medium uppercase tracking-[0.22em] text-[#cfc8aa]">
                {renderTbaAwareRole(activeMember.role)}
              </p>

              {/* Prev / Counter / Next Controls */}
              <div className="mt-6 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => navigateLeaf(-1)}
                  aria-label="Previous Executive Board member"
                  className="mun-btn-interactive flex h-11 w-11 items-center justify-center rounded-full border border-[#ede6ca]/35 bg-[#14180a] text-[#ede6ca] hover:border-[#ede6ca] cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>

                <span className="min-w-[52px] text-xs font-medium tracking-[0.2em] text-[#cfc8aa] tabular-nums">
                  {activeIndex + 1} / {members.length}
                </span>

                <button
                  type="button"
                  onClick={() => navigateLeaf(1)}
                  aria-label="Next Executive Board member"
                  className="mun-btn-interactive flex h-11 w-11 items-center justify-center rounded-full border border-[#ede6ca]/35 bg-[#14180a] text-[#ede6ca] hover:border-[#ede6ca] cursor-pointer"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RevealSection>
  );
}
