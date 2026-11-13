import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HERO_SCRIM_OPACITY,
  SCROLLED_SCRIM_OPACITY,
  computeOverlayOpacity,
  getInitialVideoPaused,
  shouldRetryAutoplay,
} from './videoPlayback';

test('starts paused when prefers-reduced-motion is enabled', () => {
  assert.equal(getInitialVideoPaused(true), true);
  assert.equal(getInitialVideoPaused(false), false);
});

test('retries autoplay only when not manually paused, not reduced motion, visible, and currently paused', () => {
  assert.equal(
    shouldRetryAutoplay({
      pausedByUser: false,
      prefersReducedMotion: false,
      isVideoPaused: true,
      isDocumentHidden: false,
    }),
    true,
  );

  assert.equal(
    shouldRetryAutoplay({
      pausedByUser: true,
      prefersReducedMotion: false,
      isVideoPaused: true,
      isDocumentHidden: false,
    }),
    false,
  );

  assert.equal(
    shouldRetryAutoplay({
      pausedByUser: false,
      prefersReducedMotion: true,
      isVideoPaused: true,
      isDocumentHidden: false,
    }),
    false,
  );

  assert.equal(
    shouldRetryAutoplay({
      pausedByUser: false,
      prefersReducedMotion: false,
      isVideoPaused: false,
      isDocumentHidden: false,
    }),
    false,
  );

  assert.equal(
    shouldRetryAutoplay({
      pausedByUser: false,
      prefersReducedMotion: false,
      isVideoPaused: true,
      isDocumentHidden: true,
    }),
    false,
  );
});

test('overlay scrim remains light in the hero and darkens after scrolling past hero', () => {
  const heroHeight = 900;

  assert.equal(computeOverlayOpacity(0, heroHeight), HERO_SCRIM_OPACITY);
  assert.equal(computeOverlayOpacity(100, heroHeight), HERO_SCRIM_OPACITY);

  const midScroll = computeOverlayOpacity(450, heroHeight);
  assert.ok(midScroll > HERO_SCRIM_OPACITY && midScroll < SCROLLED_SCRIM_OPACITY);

  assert.equal(computeOverlayOpacity(850, heroHeight), SCROLLED_SCRIM_OPACITY);
  assert.equal(computeOverlayOpacity(2400, heroHeight), SCROLLED_SCRIM_OPACITY);
});
