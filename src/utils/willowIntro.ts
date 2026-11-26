/**
 * Pure coordination and timing helpers for the Willow MUN opening video intro.
 */

export const INTRO_SETTLE_TIME_SEC = 7.6;
export const INTRO_FADE_OUT_MS = 600;
export const INTRO_WATCHDOG_TIMEOUT_MS = 10000;
export const INTRO_AUTOPLAY_FALLBACK_MS = 2200;

export interface IntroLoadEnvironment {
  search: string;
  prefersReducedMotion: boolean;
}

export function shouldSkipIntroOnLoad(env: IntroLoadEnvironment): boolean {
  const params = new URLSearchParams(env.search || '');
  if (params.get('autostart') === '1') {
    return true;
  }
  return Boolean(env.prefersReducedMotion);
}

export interface IntroTimeCheckInput {
  currentTime: number;
  duration: number;
  alreadyFinished: boolean;
}

export function shouldFinishIntroAtTime(input: IntroTimeCheckInput): boolean {
  if (input.alreadyFinished) return false;
  if (!Number.isFinite(input.currentTime) || input.currentTime < 0) {
    return false;
  }
  if (input.currentTime >= INTRO_SETTLE_TIME_SEC) {
    return true;
  }
  if (Number.isFinite(input.duration) && input.duration > 0.5) {
    return input.currentTime >= Math.max(0.5, input.duration - 0.15);
  }
  return false;
}

export function shouldSkipIntroOnKey(key: string): boolean {
  return key === 'Escape' || key === ' ' || key === 'Enter';
}
