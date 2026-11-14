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

export interface WillowStrandSpec {
  curve: CubicBezier;
  layer: DepthLayer;
  startAt: number;
  endAt: number;
}

export interface WillowLeafSpec {
  layer: DepthLayer | 'laurel';
  x0: number;
  y0: number;
  dx1: number;
  dy1: number;
  dx2: number;
  dy2: number;
  dtx: number;
  dty: number;
  dx3: number;
  dy3: number;
  dx4: number;
  dy4: number;
  revealStart: number;
  revealEnd: number;
}

export interface WillowLimbSpec {
  curve: CubicBezier;
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
 * Precomputes world-space control deltas for a slender willow leaf anchored at (x0, y0)
 * so per-frame growth scaling requires zero trigonometry or canvas state changes.
 * Local symbol (0,0)->(0,28) rotated by `angleDeg` (0 deg = +Y down).
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

  // Map local point (lx, ly) with pivot at stem base (0, 0) to world delta (dx, dy)
  const rx = (lx: number, ly: number) => lx * cos - ly * sin;
  const ry = (lx: number, ly: number) => lx * sin + ly * cos;

  // Slender leaf contour matching #willow-leaf-decor (half-width ~3.3, length ~26.6)
  return {
    layer,
    x0,
    y0,
    dx1: rx(3.1, 5.8),
    dy1: ry(3.1, 5.8),
    dx2: rx(3.4, 15.9),
    dy2: ry(3.4, 15.9),
    dtx: rx(0, 26.6),
    dty: ry(0, 26.6),
    dx3: rx(-3.4, 15.9),
    dy3: ry(-3.4, 15.9),
    dx4: rx(-3.1, 5.8),
    dy4: ry(-3.1, 5.8),
    revealStart,
    revealEnd,
  };
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
    { curve: leftLaurel, startAt: 0.03, endAt: 0.48 },
    { curve: rightLaurel, startAt: 0.03, endAt: 0.48 },
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
    curve: limb.curve,
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
        curve: strandCurve,
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
 * Appends a partial cubic Bezier [0..t] into the current canvas path using De Casteljau subdivision
 * with zero heap allocations.
 */
function appendPartialCubic(
  ctx: CanvasRenderContext2D,
  b: CubicBezier,
  t: number,
): void {
  if (t <= 0.001) return;
  if (t >= 0.999) {
    ctx.moveTo(b.x0, b.y0);
    ctx.bezierCurveTo(b.cx1, b.cy1, b.cx2, b.cy2, b.x1, b.y1);
    return;
  }

  const q1x = b.x0 + (b.cx1 - b.x0) * t;
  const q1y = b.y0 + (b.cy1 - b.y0) * t;
  const p12x = b.cx1 + (b.cx2 - b.cx1) * t;
  const p12y = b.cy1 + (b.cy2 - b.cy1) * t;
  const q2x = q1x + (p12x - q1x) * t;
  const q2y = q1y + (p12y - q1y) * t;
  const p23x = b.cx2 + (b.x1 - b.cx2) * t;
  const p23y = b.cy2 + (b.y1 - b.cy2) * t;
  const r1x = p12x + (p23x - p12x) * t;
  const r1y = p12y + (p23y - p12y) * t;
  const q3x = q2x + (r1x - q2x) * t;
  const q3y = q2y + (r1y - q2y) * t;

  ctx.moveTo(b.x0, b.y0);
  ctx.bezierCurveTo(q1x, q1y, q2x, q2y, q3x, q3y);
}

function appendLeafLayerFill(
  ctx: CanvasRenderContext2D,
  leaves: WillowLeafSpec[],
  progress: number,
  color: string,
  alpha: number,
): void {
  let hasAny = false;
  ctx.beginPath();

  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i];
    if (progress <= leaf.revealStart) continue;
    const raw = (progress - leaf.revealStart) / (leaf.revealEnd - leaf.revealStart);
    const g = raw >= 1 ? 1 : easeOutCubic(raw);
    if (g <= 0.02) continue;

    hasAny = true;
    const x0 = leaf.x0;
    const y0 = leaf.y0;
    const tx = x0 + leaf.dtx * g;
    const ty = y0 + leaf.dty * g;

    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(
      x0 + leaf.dx1 * g,
      y0 + leaf.dy1 * g,
      x0 + leaf.dx2 * g,
      y0 + leaf.dy2 * g,
      tx,
      ty,
    );
    ctx.bezierCurveTo(
      x0 + leaf.dx3 * g,
      y0 + leaf.dy3 * g,
      x0 + leaf.dx4 * g,
      y0 + leaf.dy4 * g,
      x0,
      y0,
    );
  }

  if (hasAny) {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fill();
  }
}

function appendLeafVeinsToSingleStrokePath(
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

    ctx.moveTo(leaf.x0, leaf.y0);
    ctx.lineTo(leaf.x0 + leaf.dtx * g * 0.88, leaf.y0 + leaf.dty * g * 0.88);
  }
}

/**
 * Renders one animation frame of the weeping willow + laurel emblem into the active
 * canvas coordinate space (800x720 logical units).
 *
 * All willow stems, branches, laurel arcs, grass tufts, and leaf vein strokes are
 * batched into ONE single `ctx.stroke()` call per frame to stay locked at 60 FPS.
 */
export function drawWillowCanvasFrame(
  ctx: CanvasRenderContext2D,
  geometry: WillowCanvasGeometry,
  progressInput: number,
): void {
  const progress = clamp01(progressInput);
  if (progress <= 0) return;

  // 1. Curved S-shaped trunk & root flare growing upward from roots (y=672 -> y=310)
  const trunkGrowth = easeOutCubic(clamp01(progress / 0.24));
  if (trunkGrowth > 0.01) {
    const clipTop = 672 - trunkGrowth * (672 - 306);
    ctx.save();
    ctx.beginPath();
    ctx.rect(250, clipTop, 310, 678 - clipTop);
    ctx.clip();

    ctx.beginPath();
    ctx.moveTo(276, 668);
    ctx.quadraticCurveTo(340, 662, 372, 650);
    ctx.quadraticCurveTo(382, 618, 389, 572);
    ctx.quadraticCurveTo(397, 518, 412, 465);
    ctx.quadraticCurveTo(422, 430, 413, 386);
    ctx.quadraticCurveTo(405, 352, 396, 312);
    ctx.lineTo(414, 310);
    ctx.quadraticCurveTo(426, 348, 432, 388);
    ctx.quadraticCurveTo(440, 434, 428, 482);
    ctx.quadraticCurveTo(411, 542, 414, 608);
    ctx.quadraticCurveTo(418, 648, 436, 655);
    ctx.quadraticCurveTo(470, 663, 534, 668);
    ctx.quadraticCurveTo(455, 672, 404, 670);
    ctx.quadraticCurveTo(342, 672, 276, 668);
    ctx.closePath();

    // Carve negative-space woodcut bark slivers inside the trunk fill (evenodd)
    const barkSlivers: Array<[number, number, number, number, number, number]> = [
      [401, 642, 404, 590, 412, 546],
      [394, 604, 400, 572, 404, 548],
      [416, 462, 420, 426, 414, 394],
      [403, 374, 408, 346, 405, 324],
    ];
    for (let i = 0; i < barkSlivers.length; i++) {
      const [bx0, by0, bcx, bcy, bx1, by1] = barkSlivers[i];
      ctx.moveTo(bx0, by0);
      ctx.quadraticCurveTo(bcx, bcy, bx1, by1);
      ctx.quadraticCurveTo(bcx + 2.2, bcy, bx0 + 1.8, by0);
      ctx.closePath();
    }

    ctx.fillStyle = '#ede6ca';
    ctx.globalAlpha = 0.94;
    ctx.fill('evenodd');
    ctx.restore();
  }

  // 2. Depth-layered batched leaf fills (one fill() per depth layer)
  appendLeafLayerFill(ctx, geometry.backLeaves, progress, '#6b7547', 0.45);
  appendLeafLayerFill(ctx, geometry.middleLeaves, progress, '#6b7547', 0.75);
  appendLeafLayerFill(ctx, geometry.frontAndLaurelLeaves, progress, '#ede6ca', 0.9);

  // 3. SINGLE batched stroke() call per frame for ALL weeping willow stems, limbs, laurel arcs, grass tufts, and leaf veins
  ctx.beginPath();

  // Laurel arcs
  for (let i = 0; i < geometry.laurelArcs.length; i++) {
    const arc = geometry.laurelArcs[i];
    if (progress > arc.startAt) {
      const t = easeOutCubic((progress - arc.startAt) / (arc.endAt - arc.startAt));
      appendPartialCubic(ctx, arc.curve, t);
    }
  }

  // 6 arching primary limbs
  for (let i = 0; i < geometry.limbs.length; i++) {
    const limb = geometry.limbs[i];
    if (progress > limb.startAt) {
      const t = easeOutCubic((progress - limb.startAt) / (limb.endAt - limb.startAt));
      appendPartialCubic(ctx, limb.curve, t);
    }
  }

  // Grass tufts at root flare
  for (let i = 0; i < geometry.tufts.length; i++) {
    const tuft = geometry.tufts[i];
    if (progress > tuft.startAt) {
      const t = easeOutCubic((progress - tuft.startAt) / (tuft.endAt - tuft.startAt));
      if (t >= 0.999) {
        ctx.moveTo(tuft.x0, tuft.y0);
        ctx.quadraticCurveTo(tuft.cx, tuft.cy, tuft.x1, tuft.y1);
      } else if (t > 0.01) {
        const q1x = tuft.x0 + (tuft.cx - tuft.x0) * t;
        const q1y = tuft.y0 + (tuft.cy - tuft.y0) * t;
        const q2x = tuft.cx + (tuft.x1 - tuft.cx) * t;
        const q2y = tuft.cy + (tuft.y1 - tuft.cy) * t;
        const ex = q1x + (q2x - q1x) * t;
        const ey = q1y + (q2y - q1y) * t;
        ctx.moveTo(tuft.x0, tuft.y0);
        ctx.quadraticCurveTo(q1x, q1y, ex, ey);
      }
    }
  }

  // All 74 drooping willow strands
  for (let i = 0; i < geometry.strands.length; i++) {
    const strand = geometry.strands[i];
    if (progress > strand.startAt) {
      const t = easeOutCubic((progress - strand.startAt) / (strand.endAt - strand.startAt));
      appendPartialCubic(ctx, strand.curve, t);
    }
  }

  // All revealed leaf vein strokes across every layer, appended into the exact same single path
  appendLeafVeinsToSingleStrokePath(ctx, geometry.backLeaves, progress);
  appendLeafVeinsToSingleStrokePath(ctx, geometry.middleLeaves, progress);
  appendLeafVeinsToSingleStrokePath(ctx, geometry.frontAndLaurelLeaves, progress);

  ctx.strokeStyle = '#ede6ca';
  ctx.lineWidth = 1.45;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.56;
  ctx.stroke();
}
