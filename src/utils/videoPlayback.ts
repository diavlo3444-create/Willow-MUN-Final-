/**
 * Pure helper functions for background video autoplay state and scroll-driven effects.
 */

export const HERO_SCRIM_OPACITY = 0.4;
export const SCROLLED_SCRIM_OPACITY = 0.75;
export const VIDEO_BASE_SCALE = 1.0;
export const VIDEO_MAX_SCALE = 1.08;

export interface AutoplayRetryContext {
  pausedByUser: boolean;
  isVideoPaused: boolean;
  isDocumentHidden: boolean;
}

/**
 * Determines whether an interaction or visibility event should attempt to start/resume playback.
 * Never disables background video for prefers-reduced-motion per site specification.
 */
export function shouldRetryAutoplay(ctx: AutoplayRetryContext): boolean {
  if (ctx.pausedByUser || ctx.isDocumentHidden) {
    return false;
  }
  return ctx.isVideoPaused;
}

/**
 * Computes the dark olive scrim (#14180a) opacity over the fixed background video:
 * 0.40 at the very top, rising smoothly to 0.75 after one screen of scrolling, then staying there.
 */
export function computeOverlayOpacity(scrollY: number, viewportHeight: number): number {
  if (viewportHeight <= 0) {
    return SCROLLED_SCRIM_OPACITY;
  }

  if (scrollY <= 0) {
    return HERO_SCRIM_OPACITY;
  }
  if (scrollY >= viewportHeight) {
    return SCROLLED_SCRIM_OPACITY;
  }

  const progress = scrollY / viewportHeight;
  return Number(
    (HERO_SCRIM_OPACITY + progress * (SCROLLED_SCRIM_OPACITY - HERO_SCRIM_OPACITY)).toFixed(4),
  );
}

/**
 * Computes normalized page scroll progress (0..1) and video scale (1.0..1.08).
 */
export function computeScrollMetrics(
  scrollY: number,
  viewportHeight: number,
  documentHeight: number,
): { progress: number; videoScale: number; scrimOpacity: number } {
  const maxScroll = Math.max(0, documentHeight - viewportHeight);
  const progress =
    maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;
  const videoScale = Number(
    (VIDEO_BASE_SCALE + progress * (VIDEO_MAX_SCALE - VIDEO_BASE_SCALE)).toFixed(5),
  );
  const scrimOpacity = computeOverlayOpacity(scrollY, viewportHeight);

  return {
    progress: Number(progress.toFixed(5)),
    videoScale,
    scrimOpacity,
  };
}
