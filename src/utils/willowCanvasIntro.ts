import {
  BOARD_ARCHING_LIMBS,
  TREE_SEED,
  createSeededRng,
  evalCubicBezier,
  type CubicBezier,
  type DepthLayer,
} from './willowTree';

export const CANVAS_VIEWBOX_W = 800;
export const CANVAS_VIEWBOX_H = 720;

export interface QuadraticSegment {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
}

export interface WillowStrandSpec {
  segments: [QuadraticSegment, QuadraticSegment];
  layer: DepthLayer;
  startAt: number;
  endAt: number;
}

export interface WillowLeafSpec {
  layer: DepthLayer | 'laurel';
  x0: number;
  y0: number;
  rcx: number;
  rcy: number;
  dtx: number;
  dty: number;
  lcx: number;
  lcy: number;
  revealStart: number;
  revealEnd: number;
}

export interface WillowLimbSpec {
  segments: [QuadraticSegment, QuadraticSegment];
  startAt: number;
  endAt: number;
}

export interface WillowTuftSpec {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  startAt: number;
  endAt: number;
}

export interface WillowCanvasGeometry {
  laurelArcs: WillowLimbSpec[];
  limbs: WillowLimbSpec[];
  tufts: WillowTuftSpec[];
  strands: WillowStrandSpec[];
  backLeaves: WillowLeafSpec[];
  middleLeaves: WillowLeafSpec[];
  frontAndLaurelLeaves: WillowLeafSpec[];
}

export interface CanvasRenderContext2D {
  save: () => void;
  restore: () => void;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void;
  bezierCurveTo: (
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ) => void;
  closePath: () => void;
  rect: (x: number, y: number, w: number, h: number) => void;
  clip: () => void;
  fill: (fillRule?: CanvasFillRule) => void;
  stroke: () => void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  globalAlpha: number;
  imageSmoothingEnabled?: boolean;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function easeOutCubic(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

/**
 * Splits a cubic Bezier into two C1-continuous quadratic Bezier curves
 * so trunk, limbs, and drooping strands render via `quadraticCurveTo`.
 */
function cubicToTwoQuadratics(b: CubicBezier): [QuadraticSegment, QuadraticSegment] {
  const mid = evalCubicBezier(b, 0.5);
  const p01x = (b.x0 + b.cx1) * 0.5;
  const p01y = (b.y0 + b.cy1) * 0.5;
  const p23x = (b.cx2 + b.x1) * 0.5;
  const p23y = (b.cy2 + b.y1) * 0.5;

  const c1x = b.x0 + 0.75 * (b.cx1 - b.x0);
  const c1y = b.y0 + 0.75 * (b.cy1 - b.y0);
  const c2x = b.x1 + 0.75 * (b.cx2 - b.x1);
  const c2y = b.y1 + 0.75 * (b.cy2 - b.y1);

  const q1cx = (c1x + p01x) * 0.5;
  const q1cy = (c1y + p01y) * 0.5;
  const q2cx = (c2x + p23x) * 0.5;
  const q2cy = (c2y + p23y) * 0.5;

  return [
    { x0: b.x0, y0: b.y0, cx: q1cx, cy: q1cy, x1: mid.x, y1: mid.y },
    { x0: mid.x, y0: mid.y, cx: q2cx, cy: q2cy, x1: b.x1, y1: b.y1 },
  ];
}

/**
 * Precomputes world-space quadratic control deltas for a slender willow leaf anchored at (x0, y0)
 * so per-frame growth scaling requires zero trigonometry or canvas style changes.
 */
function createLeafSpec(
  layer: DepthLayer | 'laurel',
  x0: number,
  y0: number,
  angleDeg: number,
  scale: number,
  revealStart: number,
  revealEnd: number,
): WillowLeafSpec {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad) * scale;
  const sin = Math.sin(rad) * scale;

  const rx = (lx: number, ly: number) => lx * cos - ly * sin;
  const ry = (lx: number, ly: number) => lx * sin + ly * cos;

  return {
    layer,
    x0,
    y0,
    rcx: rx(6.2, 12.8),
    rcy: ry(6.2, 12.8),
    dtx: rx(0, 26.6),
    dty: ry(0, 26.6),
    lcx: rx(-6.2, 12.8),
    lcy: ry(-6.2, 12.8),
    revealStart,
    revealEnd,
  };
}

/**
 * Configures canvas stroke and fill styles once before the animation loop starts.
 */
export function configureWillowCanvasContext(ctx: CanvasRenderContext2D): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ede6ca';
  ctx.strokeStyle = '#ede6ca';
  ctx.lineWidth = 1.45;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.78;
}

/**
 * Builds deterministic geometry for the weeping willow & laurel emblem once at initialization.
 */
export function buildWillowCanvasGeometry(): WillowCanvasGeometry {
  const rng = createSeededRng(TREE_SEED);

  const leftLaurel: CubicBezier = {
    x0: 358,
    y0: 682,
    cx1: 118,
    cy1: 632,
    cx2: 44,
    cy2: 348,
    x1: 136,
    y1: 122,
  };
  const rightLaurel: CubicBezier = {
    x0: 442,
    y0: 682,
    cx1: 682,
    cy1: 632,
    cx2: 756,
    cy2: 348,
    x1: 664,
    y1: 122,
  };

  const laurelArcs: WillowLimbSpec[] = [
    { segments: cubicToTwoQuadratics(leftLaurel), startAt: 0.03, endAt: 0.48 },
    { segments: cubicToTwoQuadratics(rightLaurel), startAt: 0.03, endAt: 0.48 },
  ];

  const frontAndLaurelLeaves: WillowLeafSpec[] = [];
  const laurelPairCount = 16;
  for (let i = 1; i <= laurelPairCount; i++) {
    const t = i / (laurelPairCount + 1);
    const scale = 1.05 + Math.sin(t * Math.PI) * 0.45;
    const revStart = 0.06 + t * 0.42;
    const revEnd = revStart + 0.14;

    const pL = evalCubicBezier(leftLaurel, t);
    frontAndLaurelLeaves.push(
      createLeafSpec('laurel', pL.x, pL.y, pL.tangentDeg + 148, scale, revStart, revEnd),
      createLeafSpec('laurel', pL.x, pL.y, pL.tangentDeg - 148, scale * 0.92, revStart, revEnd),
    );

    const pR = evalCubicBezier(rightLaurel, t);
    frontAndLaurelLeaves.push(
      createLeafSpec('laurel', pR.x, pR.y, pR.tangentDeg - 148, scale, revStart, revEnd),
      createLeafSpec('laurel', pR.x, pR.y, pR.tangentDeg + 148, scale * 0.92, revStart, revEnd),
    );
  }

  const limbs: WillowLimbSpec[] = BOARD_ARCHING_LIMBS.map((limb, i) => ({
    segments: cubicToTwoQuadratics(limb.curve),
    startAt: 0.14 + (i % 3) * 0.04,
    endAt: 0.36 + (i % 3) * 0.04,
  }));

  const tufts: WillowTuftSpec[] = [
    { x0: 322, y0: 666, cx: 312, cy: 645, x1: 302, y1: 634, startAt: 0.02, endAt: 0.18 },
    { x0: 336, y0: 665, cx: 332, cy: 647, x1: 325, y1: 638, startAt: 0.04, endAt: 0.2 },
    { x0: 352, y0: 662, cx: 350, cy: 647, x1: 346, y1: 640, startAt: 0.06, endAt: 0.22 },
    { x0: 458, y0: 662, cx: 463, cy: 646, x1: 470, y1: 637, startAt: 0.06, endAt: 0.22 },
    { x0: 474, y0: 665, cx: 482, cy: 648, x1: 492, y1: 639, startAt: 0.04, endAt: 0.2 },
    { x0: 488, y0: 666, cx: 499, cy: 652, x1: 509, y1: 644, startAt: 0.02, endAt: 0.18 },
  ];

  const layers: DepthLayer[] = ['back', 'middle', 'front'];
  const strands: WillowStrandSpec[] = [];
  const backLeaves: WillowLeafSpec[] = [];
  const middleLeaves: WillowLeafSpec[] = [];

  let strandCounter = 0;

  for (let limbIdx = 0; limbIdx < BOARD_ARCHING_LIMBS.length; limbIdx++) {
    const { curve, strandCount } = BOARD_ARCHING_LIMBS[limbIdx];
    for (let s = 0; s < strandCount; s++) {
      const tAnchor = 0.14 + (s / Math.max(1, strandCount - 1)) * 0.85;
      const anchor = evalCubicBezier(curve, tAnchor);
      const layer = layers[(strandCounter + limbIdx) % 3];
      strandCounter++;

      const distFromTrunk = anchor.x - 400;
      const outwardDrift = Math.sign(distFromTrunk) * (10 + rng() * 24);
      const targetBottomY = 485 + rng() * 145;
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

      const layerDelay = layer === 'back' ? 0 : layer === 'middle' ? 0.05 : 0.1;
      const startAt = 0.24 + tAnchor * 0.16 + layerDelay;
      const endAt = Math.min(0.84, startAt + 0.36);

      strands.push({
        segments: cubicToTwoQuadratics(strandCurve),
        layer,
        startAt,
        endAt,
      });

      const pairCount = dropLen > 310 ? 10 : dropLen > 240 ? 9 : 8;
      const targetList =
        layer === 'back'
          ? backLeaves
          : layer === 'middle'
            ? middleLeaves
            : frontAndLaurelLeaves;

      for (let p = 0; p < pairCount; p++) {
        const t = 0.08 + (p / pairCount) * 0.88;
        const pt = evalCubicBezier(strandCurve, t);
        const taper = 0.94 - t * 0.42;

        const leftAngle = pt.tangentDeg - (26 + rng() * 14);
        const rightAngle = pt.tangentDeg + (26 + rng() * 14);
        const leftScale = taper * (0.9 + rng() * 0.2);
        const rightScale = taper * (0.9 + rng() * 0.2);

        const leafStart = startAt + (endAt - startAt) * (t * 0.9);
        const leafEnd = Math.min(0.97, leafStart + 0.13);

        targetList.push(
          createLeafSpec(layer, pt.x, pt.y, leftAngle, leftScale, leafStart, leafEnd),
          createLeafSpec(layer, pt.x, pt.y, rightAngle, rightScale, leafStart, leafEnd),
        );
      }
    }
  }

  return {
    laurelArcs,
    limbs,
    tufts,
    strands,
    backLeaves,
    middleLeaves,
    frontAndLaurelLeaves,
  };
}

/**
 * Appends a partial quadratic Bezier [0..t] into the active path using De Casteljau subdivision.
 */
function appendPartialQuadratic(
  ctx: CanvasRenderContext2D,
  q: QuadraticSegment,
  t: number,
  moveToStart: boolean,
): void {
  if (t <= 0.001) return;
  if (moveToStart) {
    ctx.moveTo(q.x0, q.y0);
  }
  if (t >= 0.999) {
    ctx.quadraticCurveTo(q.cx, q.cy, q.x1, q.y1);
    return;
  }

  const q1x = q.x0 + (q.cx - q.x0) * t;
  const q1y = q.y0 + (q.cy - q.y0) * t;
  const q2x = q.cx + (q.x1 - q.cx) * t;
  const q2y = q.cy + (q.y1 - q.cy) * t;
  const ex = q1x + (q2x - q1x) * t;
  const ey = q1y + (q2y - q1y) * t;
  ctx.quadraticCurveTo(q1x, q1y, ex, ey);
}

function appendTwoSegmentCurve(
  ctx: CanvasRenderContext2D,
  segments: [QuadraticSegment, QuadraticSegment],
  progress: number,
): void {
  if (progress <= 0.001) return;
  if (progress <= 0.5) {
    appendPartialQuadratic(ctx, segments[0], progress * 2, true);
    return;
  }
  ctx.moveTo(segments[0].x0, segments[0].y0);
  ctx.quadraticCurveTo(segments[0].cx, segments[0].cy, segments[0].x1, segments[0].y1);
  appendPartialQuadratic(ctx, segments[1], (progress - 0.5) * 2, false);
}

function appendLeafPaths(
  ctx: CanvasRenderContext2D,
  leaves: WillowLeafSpec[],
  progress: number,
): void {
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i];
    if (progress <= leaf.revealStart) continue;
    const raw = (progress - leaf.revealStart) / (leaf.revealEnd - leaf.revealStart);
    const g = raw >= 1 ? 1 : easeOutCubic(raw);
    if (g <= 0.02) continue;

    const x0 = leaf.x0;
    const y0 = leaf.y0;
    const tx = x0 + leaf.dtx * g;
    const ty = y0 + leaf.dty * g;

    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + leaf.rcx * g, y0 + leaf.rcy * g, tx, ty);
    ctx.quadraticCurveTo(x0 + leaf.lcx * g, y0 + leaf.lcy * g, x0, y0);
  }
}

/**
 * Renders one animation frame of the weeping willow + laurel emblem into the active
 * canvas coordinate space (800x720 logical units).
 *
 * Performance guarantees:
 * - `ctx.imageSmoothingEnabled = false` at the top of the frame.
 * - Zero `strokeStyle`/`fillStyle` changes inside the per-frame render call.
 * - ONE `ctx.beginPath()` at the start of the frame; trunk, branches, vines, and leaves
 *   are all appended using `quadraticCurveTo` without mid-loop draws; then ONE `ctx.fill()`
 *   and ONE `ctx.stroke()` at the very end of the frame.
 */
export function drawWillowCanvasFrame(
  ctx: CanvasRenderContext2D,
  geometry: WillowCanvasGeometry,
  progressInput: number,
): void {
  ctx.imageSmoothingEnabled = false;
  if (typeof document !== 'undefined' && document.hidden) return;

  const progress = clamp01(progressInput);
  if (progress <= 0) return;

  ctx.beginPath();

  // 1. Curved S-shaped trunk & root flare growing upward smoothly with quadraticCurveTo
  const trunkGrowth = easeOutCubic(clamp01(progress / 0.24));
  if (trunkGrowth > 0.01) {
    const yAt = (y: number) => 670 - (670 - y) * trunkGrowth;

    ctx.moveTo(276, yAt(668));
    ctx.quadraticCurveTo(340, yAt(662), 372, yAt(650));
    ctx.quadraticCurveTo(382, yAt(618), 389, yAt(572));
    ctx.quadraticCurveTo(397, yAt(518), 412, yAt(465));
    ctx.quadraticCurveTo(422, yAt(430), 413, yAt(386));
    ctx.quadraticCurveTo(405, yAt(352), 396, yAt(312));
    ctx.quadraticCurveTo(405, yAt(309), 414, yAt(310));
    ctx.quadraticCurveTo(426, yAt(348), 432, yAt(388));
    ctx.quadraticCurveTo(440, yAt(434), 428, yAt(482));
    ctx.quadraticCurveTo(411, yAt(542), 414, yAt(608));
    ctx.quadraticCurveTo(418, yAt(648), 436, yAt(655));
    ctx.quadraticCurveTo(470, yAt(663), 534, yAt(668));
    ctx.quadraticCurveTo(455, yAt(672), 404, yAt(670));
    ctx.quadraticCurveTo(342, yAt(672), 276, yAt(668));
    ctx.closePath();

    const barkSlivers: Array<[number, number, number, number, number, number]> = [
      [401, 642, 404, 590, 412, 546],
      [394, 604, 400, 572, 404, 548],
      [416, 462, 420, 426, 414, 394],
      [403, 374, 408, 346, 405, 324],
    ];
    for (let i = 0; i < barkSlivers.length; i++) {
      const [bx0, by0, bcx, bcy, bx1, by1] = barkSlivers[i];
      ctx.moveTo(bx0, yAt(by0));
      ctx.quadraticCurveTo(bcx, yAt(bcy), bx1, yAt(by1));
      ctx.quadraticCurveTo(bcx + 2.2, yAt(bcy), bx0 + 1.8, yAt(by0));
      ctx.closePath();
    }
  }

  // 2. Laurel arcs (quadraticCurveTo)
  for (let i = 0; i < geometry.laurelArcs.length; i++) {
    const arc = geometry.laurelArcs[i];
    if (progress > arc.startAt) {
      const t = easeOutCubic((progress - arc.startAt) / (arc.endAt - arc.startAt));
      appendTwoSegmentCurve(ctx, arc.segments, t);
    }
  }

  // 3. Main arching branches (quadraticCurveTo)
  for (let i = 0; i < geometry.limbs.length; i++) {
    const limb = geometry.limbs[i];
    if (progress > limb.startAt) {
      const t = easeOutCubic((progress - limb.startAt) / (limb.endAt - limb.startAt));
      appendTwoSegmentCurve(ctx, limb.segments, t);
    }
  }

  // 4. Grass tufts at root flare (quadraticCurveTo)
  for (let i = 0; i < geometry.tufts.length; i++) {
    const tuft = geometry.tufts[i];
    if (progress > tuft.startAt) {
      const t = easeOutCubic((progress - tuft.startAt) / (tuft.endAt - tuft.startAt));
      appendPartialQuadratic(ctx, tuft, t, true);
    }
  }

  // 5. All 74 drooping vines / strands (quadraticCurveTo)
  for (let i = 0; i < geometry.strands.length; i++) {
    const strand = geometry.strands[i];
    if (progress > strand.startAt) {
      const t = easeOutCubic((progress - strand.startAt) / (strand.endAt - strand.startAt));
      appendTwoSegmentCurve(ctx, strand.segments, t);
    }
  }

  // 6. All revealed leaves across back, middle, and front/laurel layers
  appendLeafPaths(ctx, geometry.backLeaves, progress);
  appendLeafPaths(ctx, geometry.middleLeaves, progress);
  appendLeafPaths(ctx, geometry.frontAndLaurelLeaves, progress);

  // Single batched fill() and single batched stroke() at the very end of the frame
  ctx.fill('evenodd');
  ctx.stroke();
}

/**
 * Starts a 60fps requestAnimationFrame loop that configures canvas styles once before
 * the loop starts and pauses cleanly when `document.hidden` is true.
 */
export function startWillowCanvasIntroLoop(
  ctx: CanvasRenderContext2D,
  geometry: WillowCanvasGeometry,
  durationMs: number,
  onComplete: () => void,
): () => void {
  configureWillowCanvasContext(ctx);

  let rafId = 0;
  let stopped = false;
  const startTime = performance.now();

  const tick = (now: number) => {
    if (document.hidden) return;
    if (stopped) return;

    const progress = clamp01((now - startTime) / durationMs);
    drawWillowCanvasFrame(ctx, geometry, progress);

    if (progress >= 1) {
      rafId = 0;
      stopped = true;
      onComplete();
      return;
    }

    rafId = window.requestAnimationFrame(tick);
  };

  const onVisibilityChange = () => {
    if (!document.hidden && !stopped && rafId === 0) {
      rafId = window.requestAnimationFrame(tick);
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  rafId = window.requestAnimationFrame(tick);

  return () => {
    stopped = true;
    if (rafId !== 0) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
