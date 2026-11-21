export type MascotAnimationName = 'walk' | 'run' | 'sit' | 'excited' | 'sleep';

export type MascotState =
  | 'patrol'
  | 'patrol-sit'
  | 'scrolling'
  | 'hover-run'
  | 'hover-sit'
  | 'excited'
  | 'idle-walk'
  | 'idle-sit'
  | 'sleep'
  | 'waking'
  | 'modal-sit'
  | 'reduced-motion';

export interface AtlasRowSpec {
  row: number;
  frames: number;
  durationMs: number;
}

export const MASCOT_ATLAS_ROWS: Record<MascotAnimationName, AtlasRowSpec> = {
  walk: { row: 0, frames: 6, durationMs: 720 },
  run: { row: 1, frames: 6, durationMs: 440 },
  sit: { row: 2, frames: 4, durationMs: 1100 },
  excited: { row: 3, frames: 6, durationMs: 660 },
  sleep: { row: 4, frames: 4, durationMs: 2200 },
};

export const PATROL_EDGE_MARGIN_PX = 12;
export const PATROL_PAUSE_MS = 5000;
export const SCROLL_COOLDOWN_MS = 1500;
export const CARD_EXCITED_MS = 1200;
export const DOG_EXCITED_MS = 1100;
export const WAKE_STRETCH_MS = 600;
export const IDLE_BEFORE_EDGE_MS = 20000;
export const IDLE_SIT_BEFORE_SLEEP_MS = 5000;
export const SLEEP_Z_INTERVAL_MS = 2000;
export const CURSOR_NEAR_RADIUS_PX = 120;
export const FAST_SCROLL_THRESHOLD_PX_PER_SEC = 220;

export function getMascotBounds(
  viewportWidth: number,
  dogSize: number,
  margin = PATROL_EDGE_MARGIN_PX,
): { minX: number; maxX: number } {
  const minX = margin;
  const maxX = Math.max(minX, viewportWidth - dogSize - margin);
  return { minX, maxX };
}

export function computeTargetLeftClamped(
  targetCenterX: number,
  viewportWidth: number,
  dogSize: number,
  margin = PATROL_EDGE_MARGIN_PX,
): number {
  const { minX, maxX } = getMascotBounds(viewportWidth, dogSize, margin);
  const raw = targetCenterX - dogSize / 2;
  return Math.round(Math.max(minX, Math.min(maxX, raw)));
}

export function computeFacingTowardX(
  dogCenterX: number,
  targetX: number,
  currentFacing: 1 | -1,
  deadzonePx = 2,
): 1 | -1 {
  const delta = targetX - dogCenterX;
  if (delta >= deadzonePx) return 1;
  if (delta <= -deadzonePx) return -1;
  return currentFacing;
}

export function computeScrollVelocityPxPerSec(dyPx: number, rawDtMs: number): number {
  const safeDy = Math.max(0, Math.abs(dyPx));
  if (safeDy === 0) return 0;
  // Idle gap (>180ms) represents reading time before a flick, so cap initial burst dt.
  const effectiveDtMs = rawDtMs > 180 ? 64 : Math.max(8, rawDtMs);
  return (safeDy / effectiveDtMs) * 1000;
}

export function isFastScrollVelocity(pxPerSec: number): boolean {
  return pxPerSec >= FAST_SCROLL_THRESHOLD_PX_PER_SEC;
}

export function computeScrollRunSpeedMultiplier(pxPerSec: number): number {
  if (pxPerSec < FAST_SCROLL_THRESHOLD_PX_PER_SEC) return 1;
  const t = Math.min(1, (pxPerSec - FAST_SCROLL_THRESHOLD_PX_PER_SEC) / 1800);
  return Number((1 + t * 0.75).toFixed(2));
}

export function getNearestEdgeTarget(
  currentLeft: number,
  viewportWidth: number,
  dogSize: number,
  margin = PATROL_EDGE_MARGIN_PX,
): { edge: 'left' | 'right'; targetLeft: number; facing: 1 | -1 } {
  const { minX, maxX } = getMascotBounds(viewportWidth, dogSize, margin);
  const distLeft = Math.abs(currentLeft - minX);
  const distRight = Math.abs(maxX - currentLeft);
  if (distLeft <= distRight) {
    // At left edge facing inward (right)
    return { edge: 'left', targetLeft: minX, facing: 1 };
  }
  // At right edge facing inward (left)
  return { edge: 'right', targetLeft: maxX, facing: -1 };
}

export function isPointerWithinRange(
  pointerX: number,
  pointerY: number,
  dogCenterX: number,
  dogCenterY: number,
  radiusPx = CURSOR_NEAR_RADIUS_PX,
): boolean {
  const dx = pointerX - dogCenterX;
  const dy = pointerY - dogCenterY;
  return dx * dx + dy * dy <= radiusPx * radiusPx;
}
