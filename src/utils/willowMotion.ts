import type { SvgConnectorPath } from './familyTreeLayout';

export const WILLOW_SCROLL_PARALLAX_RATIO = 0.3;
export const WILLOW_TREE_MIN_SCALE = 1;
export const WILLOW_TREE_MAX_SCALE = 1.15;
export const WILLOW_WREATH_MAX_ROTATE_DEG = 40;

export const WILLOW_SWAY_AMPLITUDE_DEG = 1.2;
export const WILLOW_GUST_MULTIPLIER = 3;
export const WILLOW_GUST_DURATION_MS = 1200;

export const SECTION_REVEAL_OFFSET_PX = 24;
export const SECTION_REVEAL_STAGGER_MS = 70;
export const SECTION_REVEAL_DURATION_MS = 400;

export const TREE_PATH_DRAW_DURATION_MS = 700;
export const GOLD_BRANCH_DRAW_DURATION_MS = 600;
export const CARD_PULSE_DURATION_MS = 200;
export const CARD_PULSE_PEAK_SCALE = 1.04;
export const MODAL_ENTRANCE_DURATION_MS = 250;
export const MODAL_ENTRANCE_INITIAL_SCALE = 0.94;

export const CLICK_LEAF_COUNT = 8;
export const CLICK_LEAF_MIN_FALL_PX = 80;
export const CLICK_LEAF_MAX_FALL_PX = 140;
export const CLICK_LEAF_MIN_DURATION_MS = 900;
export const CLICK_LEAF_MAX_DURATION_MS = 1300;

export interface WillowStrandLayerConfig {
  id: 'left' | 'center' | 'right';
  durationSec: number;
  negativeDelaySec: number;
}

export const WILLOW_SWAY_LAYERS: readonly WillowStrandLayerConfig[] = [
  { id: 'left', durationSec: 5.6, negativeDelaySec: -1.4 },
  { id: 'center', durationSec: 6.8, negativeDelaySec: -3.7 },
  { id: 'right', durationSec: 7.6, negativeDelaySec: -5.4 },
] as const;

export interface DoveFlightConfig {
  id: 'dove-1' | 'dove-2';
  durationSec: number;
  negativeDelaySec: number;
}

export const DOVE_FLIGHTS: readonly DoveFlightConfig[] = [
  { id: 'dove-1', durationSec: 28, negativeDelaySec: -4 },
  { id: 'dove-2', durationSec: 34, negativeDelaySec: -18 },
] as const;

export interface BackgroundScrollTransforms {
  progress: number;
  treeTranslateYPx: number;
  treeScale: number;
  wreathRotateDeg: number;
}

/**
 * Pure scroll calculation for the fixed background layer:
 * - Tree layer translates upward at 0.3x scroll speed and scales 1 -> 1.15 over the whole page
 * - Wreath rotates 0 -> 40deg over the whole page
 * - Reduced motion disables all scroll-driven motion cleanly
 */
export function computeBackgroundScrollTransforms(
  scrollY: number,
  viewportHeight: number,
  documentHeight: number,
  prefersReducedMotion = false,
): BackgroundScrollTransforms {
  if (prefersReducedMotion) {
    return {
      progress: 0,
      treeTranslateYPx: 0,
      treeScale: WILLOW_TREE_MIN_SCALE,
      wreathRotateDeg: 0,
    };
  }

  const clampedScrollY = Math.max(0, Number.isFinite(scrollY) ? scrollY : 0);
  const safeVh = Math.max(1, Number.isFinite(viewportHeight) ? viewportHeight : 1);
  const maxScroll = Math.max(0, (Number.isFinite(documentHeight) ? documentHeight : safeVh) - safeVh);
  const progress = maxScroll > 0 ? Math.min(1, clampedScrollY / maxScroll) : 0;

  const treeTranslateYPx = Number((-clampedScrollY * WILLOW_SCROLL_PARALLAX_RATIO).toFixed(2));
  const treeScale = Number(
    (WILLOW_TREE_MIN_SCALE + progress * (WILLOW_TREE_MAX_SCALE - WILLOW_TREE_MIN_SCALE)).toFixed(4),
  );
  const wreathRotateDeg = Number((progress * WILLOW_WREATH_MAX_ROTATE_DEG).toFixed(2));

  return {
    progress: Number(progress.toFixed(4)),
    treeTranslateYPx,
    treeScale,
    wreathRotateDeg,
  };
}

/**
 * Computes staggered delay in ms for section headings/cards (70ms increments).
 */
export function computeSectionStaggerDelayMs(staggerIndex: number, maxSteps = 10): number {
  const clamped = Math.max(0, Math.min(maxSteps, Math.floor(staggerIndex)));
  return clamped * SECTION_REVEAL_STAGGER_MS;
}

export interface TreeEntranceSchedule {
  pathTimings: Record<string, { delayMs: number; durationMs: number }>;
  memberFadeDelaysMs: Record<string, number>;
  groupLabelDelaysMs: Record<string, number>;
  totalDurationMs: number;
}

/**
 * Builds deterministic entrance timings for the Executive Board SVG tree:
 * - Level 0 (SECRETARIAT trunk) starts at 0ms (duration 700ms)
 * - Level 1 (department branches) stagger from 180ms outward (duration 700ms each)
 * - Level 2 (stems/spines/card ticks) stagger outward after department labels (duration 700ms each)
 * - Each member card fades in as its connector line reaches it
 */
export function computeTreeEntranceSchedule(paths: SvgConnectorPath[]): TreeEntranceSchedule {
  const pathTimings: Record<string, { delayMs: number; durationMs: number }> = {};
  const memberFadeDelaysMs: Record<string, number> = {};
  const groupLabelDelaysMs: Record<string, number> = {};

  const groupRanks = new Map<string, number>();
  for (const p of paths) {
    if (p.groupId !== 'secretariat' && !groupRanks.has(p.groupId)) {
      groupRanks.set(p.groupId, groupRanks.size);
    }
  }

  let maxEndMs = 0;

  for (const p of paths) {
    let delayMs = 0;
    const rank = p.groupId === 'secretariat' ? 0 : (groupRanks.get(p.groupId) ?? 0);

    if (p.level === 0) {
      delayMs = 0;
    } else if (p.level === 1) {
      delayMs = 160 + rank * 70;
      const reachLabel = delayMs + 480;
      const existing = groupLabelDelaysMs[p.groupId];
      groupLabelDelaysMs[p.groupId] = existing === undefined ? reachLabel : Math.min(existing, reachLabel);
    } else if (p.id.startsWith('tick-secretariat')) {
      delayMs = 220 + Math.round(p.stageOrder * 160);
    } else if (p.id.startsWith('tick-')) {
      delayMs = 460 + rank * 70 + Math.round((p.stageOrder % 1) * 140);
    } else if (p.id.startsWith('spine-')) {
      delayMs = 380 + rank * 70;
    } else if (p.id.startsWith('stem-')) {
      delayMs = 310 + rank * 70;
    } else {
      delayMs = 260 + Math.round(p.stageOrder * 70);
    }

    pathTimings[p.id] = { delayMs, durationMs: TREE_PATH_DRAW_DURATION_MS };
    maxEndMs = Math.max(maxEndMs, delayMs + TREE_PATH_DRAW_DURATION_MS);

    if (p.memberId) {
      // Fade the card in right as the drawing tip of its connector line reaches it
      const fadeDelay = delayMs + Math.round(TREE_PATH_DRAW_DURATION_MS * 0.72);
      memberFadeDelaysMs[p.memberId] = fadeDelay;
      maxEndMs = Math.max(maxEndMs, fadeDelay + 280);
    }
  }

  if (groupLabelDelaysMs['secretariat'] === undefined) {
    groupLabelDelaysMs['secretariat'] = 0;
  }

  return {
    pathTimings,
    memberFadeDelaysMs,
    groupLabelDelaysMs,
    totalDurationMs: maxEndMs,
  };
}

export interface ClickLeafSpec {
  index: number;
  outwardX: number;
  outwardY: number;
  fallDistPx: number;
  rotateDeg: number;
  durationMs: number;
  color: string;
}

const LEAF_COLORS = ['#c9d98a', '#b6c973', '#d9e5a8', '#d4bc74'] as const;

/**
 * Generates exact 8 olive-leaf particle trajectories for card click burst:
 * - Outward burst + 80..140px gravity fall
 * - 900..1300ms WAAPI duration
 */
export function generateCardClickLeaves(rng: () => number = Math.random): ClickLeafSpec[] {
  const leaves: ClickLeafSpec[] = [];
  for (let i = 0; i < CLICK_LEAF_COUNT; i++) {
    const baseAngle = (i / CLICK_LEAF_COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const outwardDist = 36 + rng() * 52;
    const outwardX = Number((Math.cos(baseAngle) * outwardDist).toFixed(1));
    const outwardY = Number((Math.sin(baseAngle) * (outwardDist * 0.55)).toFixed(1));
    const fallDistPx = Number(
      (CLICK_LEAF_MIN_FALL_PX + rng() * (CLICK_LEAF_MAX_FALL_PX - CLICK_LEAF_MIN_FALL_PX)).toFixed(1),
    );
    const rotateDeg = Number((180 + rng() * 360).toFixed(1));
    const durationMs = Math.round(
      CLICK_LEAF_MIN_DURATION_MS + rng() * (CLICK_LEAF_MAX_DURATION_MS - CLICK_LEAF_MIN_DURATION_MS),
    );
    leaves.push({
      index: i,
      outwardX,
      outwardY,
      fallDistPx,
      rotateDeg,
      durationMs,
      color: LEAF_COLORS[i % LEAF_COLORS.length],
    });
  }
  return leaves;
}
