import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HERO_SCRIM_OPACITY,
  SCROLLED_SCRIM_OPACITY,
  VIDEO_BASE_SCALE,
  VIDEO_MAX_SCALE,
  computeOverlayOpacity,
  computeScrollMetrics,
  shouldRetryAutoplay,
} from './videoPlayback';

test('retries autoplay only when not manually paused, visible, and currently paused', () => {
  assert.equal(
    shouldRetryAutoplay({
      pausedByUser: false,
      isVideoPaused: true,
      isDocumentHidden: false,
    }),
    true,
  );

  assert.equal(
    shouldRetryAutoplay({
      pausedByUser: true,
      isVideoPaused: true,
      isDocumentHidden: false,
    }),
    false,
  );

  assert.equal(
    shouldRetryAutoplay({
      pausedByUser: false,
      isVideoPaused: false,
      isDocumentHidden: false,
    }),
    false,
  );

  assert.equal(
    shouldRetryAutoplay({
      pausedByUser: false,
      isVideoPaused: true,
      isDocumentHidden: true,
    }),
    false,
  );
});

test('overlay scrim starts at 0.40 and rises smoothly to 0.75 after one viewport height', () => {
  const viewportHeight = 900;

  assert.equal(computeOverlayOpacity(0, viewportHeight), 0.4);
  assert.equal(computeOverlayOpacity(-10, viewportHeight), 0.4);

  const midScroll = computeOverlayOpacity(450, viewportHeight);
  assert.ok(midScroll > HERO_SCRIM_OPACITY && midScroll < SCROLLED_SCRIM_OPACITY);

  assert.equal(computeOverlayOpacity(900, viewportHeight), 0.75);
  assert.equal(computeOverlayOpacity(2400, viewportHeight), 0.75);
});

test('scroll metrics scale video from 1.0 to 1.08 across full document scroll', () => {
  const top = computeScrollMetrics(0, 900, 3900);
  assert.equal(top.progress, 0);
  assert.equal(top.videoScale, VIDEO_BASE_SCALE);

  const mid = computeScrollMetrics(1500, 900, 3900);
  assert.equal(mid.progress, 0.5);
  assert.equal(mid.videoScale, 1.04);

  const bottom = computeScrollMetrics(3000, 900, 3900);
  assert.equal(bottom.progress, 1);
  assert.equal(bottom.videoScale, VIDEO_MAX_SCALE);
});
