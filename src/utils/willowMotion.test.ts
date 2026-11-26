import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLICK_LEAF_COUNT,
  CLICK_LEAF_MAX_DURATION_MS,
  CLICK_LEAF_MAX_FALL_PX,
  CLICK_LEAF_MIN_DURATION_MS,
  CLICK_LEAF_MIN_FALL_PX,
  DOVE_FLIGHTS,
  GOLD_BRANCH_DRAW_DURATION_MS,
  MODAL_ENTRANCE_DURATION_MS,
  MODAL_ENTRANCE_INITIAL_SCALE,
  CARD_PULSE_DURATION_MS,
  TREE_PATH_DRAW_DURATION_MS,
  WILLOW_GUST_DURATION_MS,
  WILLOW_GUST_MULTIPLIER,
  WILLOW_SWAY_AMPLITUDE_DEG,
  WILLOW_SWAY_LAYERS,
  computeBackgroundScrollTransforms,
  computeSectionStaggerDelayMs,
  computeTreeEntranceSchedule,
  generateCardClickLeaves,
} from './willowMotion';
import type { SvgConnectorPath } from './familyTreeLayout';

test('background scroll moves tree 0.3x up, scales 1 -> 1.15, and rotates wreath 0 -> 40deg', () => {
  const top = computeBackgroundScrollTransforms(0, 900, 4500, false);
  assert.equal(top.progress, 0);
  assert.equal(top.treeTranslateYPx, 0);
  assert.equal(top.treeScale, 1);
  assert.equal(top.wreathRotateDeg, 0);

  const mid = computeBackgroundScrollTransforms(1800, 900, 4500, false);
  assert.equal(mid.progress, 0.5);
  assert.equal(mid.treeTranslateYPx, -540); // -1800 * 0.3
  assert.equal(mid.treeScale, 1.075);
  assert.equal(mid.wreathRotateDeg, 20);

  const bottom = computeBackgroundScrollTransforms(3600, 900, 4500, false);
  assert.equal(bottom.progress, 1);
  assert.equal(bottom.treeTranslateYPx, -1080); // -3600 * 0.3
  assert.equal(bottom.treeScale, 1.15);
  assert.equal(bottom.wreathRotateDeg, 40);

  const reduced = computeBackgroundScrollTransforms(1800, 900, 4500, true);
  assert.equal(reduced.treeTranslateYPx, 0);
  assert.equal(reduced.treeScale, 1);
  assert.equal(reduced.wreathRotateDeg, 0);
});

test('willow sway layers and dove flights match 5-8s sway, distinct negative delays, and 25-35s doves', () => {
  assert.equal(WILLOW_SWAY_LAYERS.length, 3);
  assert.deepEqual(
    WILLOW_SWAY_LAYERS.map((l) => l.id),
    ['left', 'center', 'right'],
  );
  const seenDelays = new Set<number>();
  for (const layer of WILLOW_SWAY_LAYERS) {
    assert.ok(layer.durationSec >= 5 && layer.durationSec <= 8);
    assert.ok(layer.negativeDelaySec < 0);
    assert.ok(!seenDelays.has(layer.negativeDelaySec));
    seenDelays.add(layer.negativeDelaySec);
  }
  assert.equal(WILLOW_SWAY_AMPLITUDE_DEG, 1.2);
  assert.equal(Number((WILLOW_SWAY_AMPLITUDE_DEG * WILLOW_GUST_MULTIPLIER).toFixed(2)), 3.6);
  assert.equal(WILLOW_GUST_DURATION_MS, 1200);

  assert.equal(DOVE_FLIGHTS.length, 2);
  for (const dove of DOVE_FLIGHTS) {
    assert.ok(dove.durationSec >= 25 && dove.durationSec <= 35);
  }
});

test('section reveal stagger calculates exact 70ms increments', () => {
  assert.equal(computeSectionStaggerDelayMs(0), 0);
  assert.equal(computeSectionStaggerDelayMs(1), 70);
  assert.equal(computeSectionStaggerDelayMs(2), 140);
  assert.equal(computeSectionStaggerDelayMs(3), 210);
});

test('Executive Board tree entrance schedule draws root -> label -> member cards with 700ms paths', () => {
  const samplePaths: SvgConnectorPath[] = [
    {
      id: 'desktop-trunk',
      d: 'M 500 20 V 400',
      stageOrder: 0,
      level: 0,
      groupId: 'secretariat',
      swayDuration: 6,
      swayDelay: 0,
      swayOrigin: { x: 500, y: 20 },
    },
    {
      id: 'branch-media',
      d: 'M 500 180 H 320',
      stageOrder: 1,
      level: 1,
      groupId: 'media',
      swayDuration: 5,
      swayDelay: 0,
      swayOrigin: { x: 500, y: 180 },
    },
    {
      id: 'tick-media-0',
      d: 'M 250 180 H 190',
      stageOrder: 3,
      level: 2,
      groupId: 'media',
      memberId: 'alya-ismail',
      swayDuration: 5,
      swayDelay: 0,
      swayOrigin: { x: 500, y: 180 },
    },
  ];

  const schedule = computeTreeEntranceSchedule(samplePaths);
  assert.equal(schedule.pathTimings['desktop-trunk'].durationMs, TREE_PATH_DRAW_DURATION_MS);
  assert.equal(schedule.pathTimings['desktop-trunk'].delayMs, 0);
  assert.equal(schedule.pathTimings['branch-media'].durationMs, TREE_PATH_DRAW_DURATION_MS);
  assert.equal(schedule.pathTimings['tick-media-0'].durationMs, TREE_PATH_DRAW_DURATION_MS);

  // Staggered root -> department label -> member card
  assert.ok(schedule.pathTimings['desktop-trunk'].delayMs < schedule.pathTimings['branch-media'].delayMs);
  assert.ok(schedule.pathTimings['branch-media'].delayMs < schedule.pathTimings['tick-media-0'].delayMs);

  // Card fades in as its line reaches it
  assert.ok(schedule.memberFadeDelaysMs['alya-ismail'] > schedule.pathTimings['tick-media-0'].delayMs);
});

test('card click generates exactly 8 olive leaves with 80-140px fall and 900-1300ms WAAPI duration', () => {
  assert.equal(GOLD_BRANCH_DRAW_DURATION_MS, 600);
  assert.equal(CARD_PULSE_DURATION_MS, 200);
  assert.equal(MODAL_ENTRANCE_DURATION_MS, 250);
  assert.equal(MODAL_ENTRANCE_INITIAL_SCALE, 0.94);

  let seed = 0.1;
  const detRng = () => {
    seed = (seed + 0.13) % 1;
    return seed;
  };
  const leaves = generateCardClickLeaves(detRng);
  assert.equal(leaves.length, CLICK_LEAF_COUNT);
  assert.equal(leaves.length, 8);
  for (const leaf of leaves) {
    assert.ok(leaf.fallDistPx >= CLICK_LEAF_MIN_FALL_PX && leaf.fallDistPx <= CLICK_LEAF_MAX_FALL_PX);
    assert.ok(leaf.durationMs >= CLICK_LEAF_MIN_DURATION_MS && leaf.durationMs <= CLICK_LEAF_MAX_DURATION_MS);
  }
});
