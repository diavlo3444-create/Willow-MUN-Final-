/**
 * Pure helper functions for background video autoplay state and scroll-driven scrim opacity.
 */

export const HERO_SCRIM_OPACITY = 0.22;
export const SCROLLED_SCRIM_OPACITY = 0.56;

export interface AutoplayRetryContext {
  pausedByUser: boolean;
  prefersReducedMotion: boolean;
  isVideoPaused: boolean;
  isDocumentHidden: boolean;
}

/**
 * Determines whether the background video should begin paused on load.
 * Respects prefers-reduced-motion accessibility preference.
 */
export function getInitialVideoPaused(prefersReducedMotion: boolean): boolean {
  return prefersReducedMotion;
}

/**
 * Determines whether an interaction or visibility event should attempt to start/resume playback.
 */
export function shouldRetryAutoplay(ctx: AutoplayRetryContext): boolean {
  if (ctx.pausedByUser || ctx.prefersReducedMotion || ctx.isDocumentHidden) {
    return false;
  }
  return ctx.isVideoPaused;
}

/**
 * Computes the dark olive scrim opacity over the fixed background video.
 * Stays very light in the hero so the willow logo in the video remains clearly visible,
 * then darkens smoothly once the user scrolls past the hero.
 */
export function computeOverlayOpacity(scrollY: number, heroHeight: number): number {
  if (heroHeight <= 0) {
    return SCROLLED_SCRIM_OPACITY;
  }

  const startFade = heroHeight * 0.15;
  const endFade = heroHeight * 0.85;

  if (scrollY <= startFade) {
    return HERO_SCRIM_OPACITY;
  }
  if (scrollY >= endFade) {
    return SCROLLED_SCRIM_OPACITY;
  }

  const progress = (scrollY - startFade) / (endFade - startFade);
  return Number(
    (HERO_SCRIM_OPACITY + progress * (SCROLLED_SCRIM_OPACITY - HERO_SCRIM_OPACITY)).toFixed(4),
  );
}
