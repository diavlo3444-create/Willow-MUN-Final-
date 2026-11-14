/**
 * Seeded procedural weeping willow generator used by ExecutiveBoardSection.
 */

export type DepthLayer = 'back' | 'middle' | 'front';
export type SwaySide = 'left' | 'right';

export interface CubicBezier {
  x0: number;
  y0: number;
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;
  x1: number;
  y1: number;
}

export const TREE_SEED = 20260514;

/**
 * Deterministic seeded PRNG (Mulberry32) so the willow renders identically on every load.
 */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function evalCubicBezier(b: CubicBezier, t: number): { x: number; y: number; tangentDeg: number } {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  const x = mt2 * mt * b.x0 + 3 * mt2 * t * b.cx1 + 3 * mt * t2 * b.cx2 + t2 * t * b.x1;
  const y = mt2 * mt * b.y0 + 3 * mt2 * t * b.cy1 + 3 * mt * t2 * b.cy2 + t2 * t * b.y1;

  const dx =
    3 * mt2 * (b.cx1 - b.x0) + 6 * mt * t * (b.cx2 - b.cx1) + 3 * t2 * (b.x1 - b.cx2);
  const dy =
    3 * mt2 * (b.cy1 - b.y0) + 6 * mt * t * (b.cy2 - b.cy1) + 3 * t2 * (b.y1 - b.cy2);

  // 0 deg points straight down (+Y)
  const tangentDeg = (Math.atan2(dy, dx) * 180) / Math.PI - 90;
  return { x, y, tangentDeg };
}

// Canonical 6 arching primary willow limbs in 800x720 board coordinate space
export const BOARD_ARCHING_LIMBS: Array<{
  curve: CubicBezier;
  side: SwaySide;
  strandCount: number;
}> = [
  {
    side: 'left',
    strandCount: 13,
    curve: { x0: 388, y0: 356, cx1: 315, cy1: 278, cx2: 205, cy2: 215, x1: 118, y1: 266 },
  },
  {
    side: 'left',
    strandCount: 13,
    curve: { x0: 392, y0: 326, cx1: 342, cy1: 215, cx2: 255, cy2: 145, x1: 174, y1: 186 },
  },
  {
    side: 'left',
    strandCount: 11,
    curve: { x0: 398, y0: 304, cx1: 382, cy1: 196, cx2: 332, cy2: 102, x1: 268, y1: 112 },
  },
  {
    side: 'right',
    strandCount: 11,
    curve: { x0: 404, y0: 304, cx1: 422, cy1: 196, cx2: 472, cy2: 104, x1: 536, y1: 114 },
  },
  {
    side: 'right',
    strandCount: 13,
    curve: { x0: 412, y0: 324, cx1: 462, cy1: 215, cx2: 548, cy2: 146, x1: 628, y1: 188 },
  },
  {
    side: 'right',
    strandCount: 13,
    curve: { x0: 418, y0: 358, cx1: 492, cy1: 280, cx2: 598, cy2: 218, x1: 682, y1: 268 },
  },
];
