import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CHARTER_ENTRANCE_DURATION_S,
  CHARTER_IDLE_PERIOD_S,
  CHARTER_SPRITE_PATHS,
  createRigState,
  evaluateIdlePose,
  stepRigState,
  triggerPlayfulReaction,
} from './charterCharacterRig';

describe('Willow MUN Charter character game rig & kinematics', () => {
  it('defines all 9 segmented transparent RGBA sprite assets cleanly', () => {
    const entries = Object.values(CHARTER_SPRITE_PATHS);
    assert.equal(entries.length, 9);
    for (const url of entries) {
      assert.match(url, /^\/assets\/charter\/[a-z-]+\.png$/);
    }
  });

  it('guarantees seamless periodic idle loop continuity across the 12s cycle', () => {
    const startPose = evaluateIdlePose(0);
    const endPose = evaluateIdlePose(CHARTER_IDLE_PERIOD_S);
    const eps = 1e-6;

    assert.ok(Math.abs(startPose.root.tx - endPose.root.tx) < eps);
    assert.ok(Math.abs(startPose.root.ty - endPose.root.ty) < eps);
    assert.ok(Math.abs(startPose.torso.ty - endPose.torso.ty) < eps);
    assert.ok(Math.abs(startPose.head.rotDeg - endPose.head.rotDeg) < eps);
    assert.ok(Math.abs(startPose.armLeft.ty - endPose.armLeft.ty) < eps);
    assert.ok(Math.abs(startPose.armRight.rotDeg - endPose.armRight.rotDeg) < eps);
    assert.ok(Math.abs(startPose.blushWarmth - endPose.blushWarmth) < eps);
  });

  it('starts cleanly at Frame 0 drop-in entrance and blends into idle loop without NaN or divergence', () => {
    const state = createRigState();
    assert.equal(state.elapsedS, 0);
    assert.ok(state.root.ty < -20, 'Frame 0 should start elevated for weighted landing entrance');

    // Step across entrance + full 2 idle cycles with variable dt steps
    for (let i = 0; i < 60 * 25; i += 1) {
      const dt = i % 7 === 0 ? 1 / 30 : 1 / 60;
      stepRigState(state, dt, false);
      assert.ok(Number.isFinite(state.root.ty));
      assert.ok(Number.isFinite(state.bunLeft.rotDeg));
      assert.ok(Number.isFinite(state.ribbonRight.rotDeg));
      assert.ok(Math.abs(state.bunLeft.rotDeg) <= 12.1);
      assert.ok(Math.abs(state.ribbonLeft.rotDeg) <= 16.1);
    }

    assert.ok(state.elapsedS > CHARTER_ENTRANCE_DURATION_S);
    assert.equal(state.opacity, 1);
  });

  it('replays entrance cleanly from Frame 0 when re-initialized', () => {
    const first = createRigState();
    for (let i = 0; i < 120; i += 1) stepRigState(first, 1 / 60, false);
    assert.equal(first.opacity, 1);

    const rearmed = createRigState();
    assert.equal(rearmed.elapsedS, 0);
    assert.ok(rearmed.root.ty < -20);
  });

  it('reacts to playful click/tap impulse with damped spring motion that settles smoothly', () => {
    const state = createRigState();
    for (let i = 0; i < 120; i += 1) stepRigState(state, 1 / 60, false);

    triggerPlayfulReaction(state);
    assert.equal(state.reactionImpulse, 1);

    stepRigState(state, 1 / 60, false);
    assert.ok(Math.abs(state.bunLeftSpring.velocity) > 5);

    for (let i = 0; i < 120; i += 1) stepRigState(state, 1 / 60, false);
    assert.equal(state.reactionImpulse, 0);
  });

  it('honors prefers-reduced-motion cleanly with neutral identity transforms', () => {
    const state = createRigState();
    stepRigState(state, 1 / 60, true);
    assert.equal(state.opacity, 1);
    assert.equal(state.root.ty, 0);
    assert.equal(state.head.rotDeg, 0);
    assert.equal(state.bunLeft.rotDeg, 0);
    assert.equal(state.ribbonLeft.rotDeg, 0);
  });
});
