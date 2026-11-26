import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTRO_SETTLE_TIME_SEC,
  shouldFinishIntroAtTime,
  shouldSkipIntroOnKey,
  shouldSkipIntroOnLoad,
} from './willowIntro';

test('skips intro immediately only when ?autostart=1 or prefers-reduced-motion is enabled', () => {
  assert.equal(
    shouldSkipIntroOnLoad({ search: '', prefersReducedMotion: false }),
    false,
  );
  assert.equal(
    shouldSkipIntroOnLoad({ search: '?foo=bar', prefersReducedMotion: false }),
    false,
  );
  assert.equal(
    shouldSkipIntroOnLoad({ search: '?autostart=1', prefersReducedMotion: false }),
    true,
  );
  assert.equal(
    shouldSkipIntroOnLoad({ search: '', prefersReducedMotion: true }),
    true,
  );
});

test('triggers smooth intro fade-out once playback reaches settle time or near duration end', () => {
  assert.equal(
    shouldFinishIntroAtTime({
      currentTime: 0,
      duration: 8.4,
      alreadyFinished: false,
    }),
    false,
  );
  assert.equal(
    shouldFinishIntroAtTime({
      currentTime: 5.5,
      duration: 8.4,
      alreadyFinished: false,
    }),
    false,
  );
  assert.equal(
    shouldFinishIntroAtTime({
      currentTime: INTRO_SETTLE_TIME_SEC,
      duration: 8.4,
      alreadyFinished: false,
    }),
    true,
  );
  assert.equal(
    shouldFinishIntroAtTime({
      currentTime: 8.0,
      duration: 8.4,
      alreadyFinished: true,
    }),
    false,
  );
  assert.equal(
    shouldFinishIntroAtTime({
      currentTime: 5.9,
      duration: 6.0,
      alreadyFinished: false,
    }),
    true,
  );
});

test('recognizes Escape, Space, and Enter as accessible skip keys', () => {
  assert.equal(shouldSkipIntroOnKey('Escape'), true);
  assert.equal(shouldSkipIntroOnKey(' '), true);
  assert.equal(shouldSkipIntroOnKey('Enter'), true);
  assert.equal(shouldSkipIntroOnKey('Tab'), false);
  assert.equal(shouldSkipIntroOnKey('a'), false);
});
