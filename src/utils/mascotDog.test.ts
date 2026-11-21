import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFacingTowardX,
  computeScrollRunSpeedMultiplier,
  computeScrollVelocityPxPerSec,
  computeTargetLeftClamped,
  getMascotBounds,
  getNearestEdgeTarget,
  isFastScrollVelocity,
  isPointerWithinRange,
  MASCOT_ATLAS_ROWS,
} from './mascotDog';

test('MASCOT_ATLAS_ROWS maps 6x5 sprite atlas rows and frame counts accurately', () => {
  assert.deepEqual(
    {
      walk: [MASCOT_ATLAS_ROWS.walk.row, MASCOT_ATLAS_ROWS.walk.frames],
      run: [MASCOT_ATLAS_ROWS.run.row, MASCOT_ATLAS_ROWS.run.frames],
      sit: [MASCOT_ATLAS_ROWS.sit.row, MASCOT_ATLAS_ROWS.sit.frames],
      excited: [MASCOT_ATLAS_ROWS.excited.row, MASCOT_ATLAS_ROWS.excited.frames],
      sleep: [MASCOT_ATLAS_ROWS.sleep.row, MASCOT_ATLAS_ROWS.sleep.frames],
    },
    {
      walk: [0, 6],
      run: [1, 6],
      sit: [2, 4],
      excited: [3, 6],
      sleep: [4, 4],
    },
  );
});

test('getMascotBounds and computeTargetLeftClamped clamp horizontally within viewport', () => {
  assert.deepEqual(getMascotBounds(1440, 90), { minX: 12, maxX: 1338 });
  assert.equal(computeTargetLeftClamped(720, 1440, 90), 675);
  assert.equal(computeTargetLeftClamped(0, 1440, 90), 12);
  assert.equal(computeTargetLeftClamped(2000, 1440, 90), 1338);
});

test('computeFacingTowardX respects deadzone and flips when pointer or card is left/right', () => {
  assert.equal(computeFacingTowardX(500, 700, -1), 1);
  assert.equal(computeFacingTowardX(500, 300, 1), -1);
  assert.equal(computeFacingTowardX(500, 501, -1), -1);
});

test('scroll velocity helpers detect fast scroll bursts across idle gaps', () => {
  assert.equal(isFastScrollVelocity(computeScrollVelocityPxPerSec(6, 5000)), false);
  const fastPxPerSec = computeScrollVelocityPxPerSec(640, 5000);
  assert.equal(isFastScrollVelocity(fastPxPerSec), true);
  assert.ok(computeScrollRunSpeedMultiplier(fastPxPerSec) > 1.5);
  assert.equal(computeScrollRunSpeedMultiplier(100), 1);
});

test('getNearestEdgeTarget picks closest viewport corner and inward facing direction', () => {
  assert.deepEqual(getNearestEdgeTarget(200, 1440, 90), {
    edge: 'left',
    targetLeft: 12,
    facing: 1,
  });
  assert.deepEqual(getNearestEdgeTarget(1100, 1440, 90), {
    edge: 'right',
    targetLeft: 1338,
    facing: -1,
  });
});

test('isPointerWithinRange measures Euclidean 120px proximity accurately', () => {
  assert.equal(isPointerWithinRange(500, 750, 580, 810, 120), true); // dist = 100
  assert.equal(isPointerWithinRange(500, 700, 620, 780, 120), false); // dist ~ 144
});
