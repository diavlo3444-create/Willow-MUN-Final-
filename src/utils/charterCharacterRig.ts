export const CHARTER_CANVAS_SIZE = 720;
export const CHARTER_IDLE_PERIOD_S = 12.0;
export const CHARTER_ENTRANCE_DURATION_S = 1.45;

export const CHARTER_SPRITE_PATHS = {
  legs: '/assets/charter/legs.png',
  torso: '/assets/charter/torso.png',
  head: '/assets/charter/head.png',
  bunLeft: '/assets/charter/bun-left.png',
  bunRight: '/assets/charter/bun-right.png',
  ribbonLeft: '/assets/charter/ribbon-left.png',
  ribbonRight: '/assets/charter/ribbon-right.png',
  armLeft: '/assets/charter/arm-left.png',
  armRight: '/assets/charter/arm-right.png',
} as const;

export type CharterSpriteKey = keyof typeof CHARTER_SPRITE_PATHS;

export const CHARTER_PIVOTS: Record<
  'feet' | 'hip' | 'neck' | 'shoulderLeft' | 'shoulderRight' | 'bunLeft' | 'bunRight' | 'ribbonLeft' | 'ribbonRight',
  { x: number; y: number }
> = {
  feet: { x: 360, y: 672 },
  hip: { x: 360, y: 536 },
  neck: { x: 360, y: 420 },
  shoulderLeft: { x: 296, y: 436 },
  shoulderRight: { x: 424, y: 444 },
  bunLeft: { x: 204, y: 184 },
  bunRight: { x: 512, y: 196 },
  ribbonLeft: { x: 192, y: 228 },
  ribbonRight: { x: 528, y: 240 },
};

export interface SpringChannel {
  value: number;
  velocity: number;
}

export interface JointTransform {
  tx: number;
  ty: number;
  rotDeg: number;
  scaleX: number;
  scaleY: number;
}

export interface CharterRigState {
  elapsedS: number;
  prevRootY: number;
  prevRootX: number;
  prevHeadRotDeg: number;
  prevTorsoY: number;
  bunLeftSpring: SpringChannel;
  bunRightSpring: SpringChannel;
  ribbonLeftSpring: SpringChannel;
  ribbonRightSpring: SpringChannel;
  neckBobSpring: SpringChannel;
  reactionImpulse: number;
  opacity: number;
  blushWarmth: number;
  root: JointTransform;
  legs: JointTransform;
  torso: JointTransform;
  head: JointTransform;
  armLeft: JointTransform;
  armRight: JointTransform;
  bunLeft: JointTransform;
  bunRight: JointTransform;
  ribbonLeft: JointTransform;
  ribbonRight: JointTransform;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function raisedCosineWindow(t: number, start: number, end: number): number {
  if (t <= start || t >= end) return 0;
  const u = (t - start) / (end - start);
  return 0.5 * (1 - Math.cos(Math.PI * 2 * u));
}

function identityTransform(): JointTransform {
  return { tx: 0, ty: 0, rotDeg: 0, scaleX: 1, scaleY: 1 };
}

function lerpTransform(a: JointTransform, b: JointTransform, alpha: number): JointTransform {
  const u = clamp(alpha, 0, 1);
  return {
    tx: a.tx + (b.tx - a.tx) * u,
    ty: a.ty + (b.ty - a.ty) * u,
    rotDeg: a.rotDeg + (b.rotDeg - a.rotDeg) * u,
    scaleX: a.scaleX + (b.scaleX - a.scaleX) * u,
    scaleY: a.scaleY + (b.scaleY - a.scaleY) * u,
  };
}

function stepSpring(
  spring: SpringChannel,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
  maxAbs: number,
): void {
  // Sub-step at <= 1/120s so springs remain unconditionally stable even after tab switches
  const clampedDt = clamp(dt, 0, 0.05);
  const steps = Math.max(1, Math.ceil(clampedDt / (1 / 120)));
  const h = clampedDt / steps;
  for (let i = 0; i < steps; i += 1) {
    const accel = stiffness * (target - spring.value) - damping * spring.velocity;
    spring.velocity += accel * h;
    spring.value += spring.velocity * h;
    spring.value = clamp(spring.value, -maxAbs, maxAbs);
  }
}

export function createRigState(): CharterRigState {
  const state: CharterRigState = {
    elapsedS: 0,
    prevRootY: -28,
    prevRootX: 0,
    prevHeadRotDeg: -3,
    prevTorsoY: 0,
    bunLeftSpring: { value: -5, velocity: 0 },
    bunRightSpring: { value: 5, velocity: 0 },
    ribbonLeftSpring: { value: -9, velocity: 0 },
    ribbonRightSpring: { value: 9, velocity: 0 },
    neckBobSpring: { value: -3, velocity: 0 },
    reactionImpulse: 0,
    opacity: 0,
    blushWarmth: 0,
    root: identityTransform(),
    legs: identityTransform(),
    torso: identityTransform(),
    head: identityTransform(),
    armLeft: identityTransform(),
    armRight: identityTransform(),
    bunLeft: identityTransform(),
    bunRight: identityTransform(),
    ribbonLeft: identityTransform(),
    ribbonRight: identityTransform(),
  };
  return stepRigState(state, 0, false);
}

export function triggerPlayfulReaction(state: CharterRigState): void {
  state.reactionImpulse = 1.0;
  state.bunLeftSpring.velocity -= 105;
  state.bunRightSpring.velocity += 105;
  state.ribbonLeftSpring.velocity -= 145;
  state.ribbonRightSpring.velocity += 145;
  state.neckBobSpring.velocity += 36;
}

/**
 * Computes exact periodic base idle pose (t in [0, CHARTER_IDLE_PERIOD_S)).
 * Every term uses integer harmonics of 2*PI / 12.0s or vanishes smoothly at boundaries,
 * guaranteeing pose(t = 0) === pose(t = 12.0s) with zero seam or jump.
 */
export function evaluateIdlePose(elapsedS: number): {
  root: JointTransform;
  legs: JointTransform;
  torso: JointTransform;
  head: JointTransform;
  armLeft: JointTransform;
  armRight: JointTransform;
  blushWarmth: number;
  ribbonBreezeDeg: number;
} {
  const phase = ((elapsedS % CHARTER_IDLE_PERIOD_S) + CHARTER_IDLE_PERIOD_S) % CHARTER_IDLE_PERIOD_S;
  const tau = (Math.PI * 2 * phase) / CHARTER_IDLE_PERIOD_S;

  // 4 breaths per 12s (3.0s per breath)
  const breath = Math.sin(4 * tau);
  const breathLag = Math.sin(4 * tau - 0.55);

  // 2 weight-shift sway cycles per 12s (6.0s per shift)
  const sway = Math.sin(2 * tau);
  const swaySlow = Math.sin(tau);

  // Idle Variation A (2.1s..5.1s): shy gentle peek & warm blush pulse
  const peekEnv = raisedCosineWindow(phase, 2.1, 5.1);
  const peekTilt = Math.sin(((phase - 2.1) / 3.0) * Math.PI * 2) * peekEnv;

  // Idle Variation B (7.2s..9.9s): tiny playful bounce / micro-hop
  const hopPreCrouch = raisedCosineWindow(phase, 7.2, 8.05);
  const hopAir = raisedCosineWindow(phase, 7.9, 8.95);
  const hopLandSquash = raisedCosineWindow(phase, 8.85, 9.8);

  const rootY = hopPreCrouch * 6.5 - hopAir * 13.0 + hopLandSquash * 5.0;
  const rootScaleY = 1 - hopPreCrouch * 0.045 + hopAir * 0.032 - hopLandSquash * 0.04;
  const rootScaleX = 1 / Math.sqrt(rootScaleY);

  const root: JointTransform = {
    tx: sway * 4.2 + swaySlow * 1.4,
    ty: rootY,
    rotDeg: sway * 1.1,
    scaleX: rootScaleX,
    scaleY: rootScaleY,
  };

  const legs: JointTransform = {
    tx: sway * 1.1,
    ty: 0,
    rotDeg: sway * 0.85,
    scaleX: 1,
    scaleY: 1,
  };

  const torso: JointTransform = {
    tx: sway * 0.8,
    ty: -breath * 3.0 + hopLandSquash * 3.2,
    rotDeg: -sway * 1.2 + peekTilt * 1.3,
    scaleX: 1 + breath * 0.014,
    scaleY: 1 + breath * 0.017 - hopLandSquash * 0.025,
  };

  const head: JointTransform = {
    tx: sway * 0.9,
    ty: -breathLag * 1.9 + hopLandSquash * 2.4 + peekEnv * 1.5,
    rotDeg: swaySlow * 1.6 - sway * 1.5 + peekEnv * -3.6 + hopAir * 2.2 - hopLandSquash * 1.8,
    scaleX: 1,
    scaleY: 1,
  };

  // Shy raised hands subtly hug/peek while following breathing & weight shifts
  const armBobY = -breathLag * 2.1 + peekEnv * 4.2 + hopPreCrouch * 1.8 - hopAir * 2.5;
  const armLeft: JointTransform = {
    tx: -peekEnv * 2.8 - sway * 0.5,
    ty: armBobY + Math.sin(3 * tau) * 0.8,
    rotDeg: -1.1 * breathLag - peekEnv * 2.8 + sway * 1.0,
    scaleX: 1,
    scaleY: 1,
  };

  const armRight: JointTransform = {
    tx: peekEnv * 2.8 - sway * 0.5,
    ty: armBobY - Math.sin(3 * tau) * 0.8,
    rotDeg: 1.1 * breathLag + peekEnv * 2.8 + sway * 1.0,
    scaleX: 1,
    scaleY: 1,
  };

  return {
    root,
    legs,
    torso,
    head,
    armLeft,
    armRight,
    blushWarmth: clamp(0.03 + 0.04 * (0.5 + 0.5 * breath) + 0.14 * peekEnv, 0, 0.22),
    ribbonBreezeDeg: Math.sin(2 * tau + 0.6) * 1.8 + Math.sin(4 * tau) * 0.7,
  };
}

function evaluateEntrancePose(elapsedS: number): {
  opacity: number;
  root: JointTransform;
  legs: JointTransform;
  torso: JointTransform;
  head: JointTransform;
  armLeft: JointTransform;
  armRight: JointTransform;
  blushWarmth: number;
} {
  // 0.00 -> 0.30: Graceful drop-in with air stretch
  // 0.30 -> 0.52: Ground impact squash & shy hug
  // 0.52 -> 0.96: Rebound perk-up & playful shy head-tilt welcome
  // 0.96 -> 1.45: Smoothly hand-off to idlePose(elapsedS)
  const opacity = smoothstep(0.0, 0.18, elapsedS);

  const dropU = smoothstep(0.0, 0.30, elapsedS);
  const airStretch = Math.sin(clamp(elapsedS / 0.28, 0, 1) * Math.PI);
  const impactSquash = raisedCosineWindow(elapsedS, 0.22, 0.58);
  const reboundWave = raisedCosineWindow(elapsedS, 0.46, 0.98);
  const shyGreet = raisedCosineWindow(elapsedS, 0.52, 1.24);

  const rootY = -36 * (1 - dropU) + impactSquash * 11.5 - reboundWave * 6.5;
  const rootScaleY = 1 + airStretch * 0.055 - impactSquash * 0.095 + reboundWave * 0.035;
  const rootScaleX = 1 / Math.sqrt(rootScaleY);

  const root: JointTransform = {
    tx: shyGreet * 2.5,
    ty: rootY,
    rotDeg: -shyGreet * 1.1,
    scaleX: rootScaleX,
    scaleY: rootScaleY,
  };

  const legs: JointTransform = {
    tx: 0,
    ty: 0,
    rotDeg: shyGreet * 0.8,
    scaleX: 1,
    scaleY: 1,
  };

  const torso: JointTransform = {
    tx: 0,
    ty: impactSquash * 6.0 - reboundWave * 3.0,
    rotDeg: -2.0 * (1 - dropU) + shyGreet * 2.2,
    scaleX: 1 + impactSquash * 0.025,
    scaleY: 1 - impactSquash * 0.03,
  };

  const head: JointTransform = {
    tx: 0,
    ty: impactSquash * 5.0 - reboundWave * 2.5,
    rotDeg: -4.0 * (1 - dropU) + impactSquash * -3.5 + shyGreet * 5.2,
    scaleX: 1,
    scaleY: 1,
  };

  const armLeft: JointTransform = {
    tx: impactSquash * 3.0 - shyGreet * 2.4,
    ty: impactSquash * 4.5 + shyGreet * 2.6,
    rotDeg: impactSquash * 3.5 - shyGreet * 3.0,
    scaleX: 1,
    scaleY: 1,
  };

  const armRight: JointTransform = {
    tx: -impactSquash * 3.0 + shyGreet * 2.4,
    ty: impactSquash * 4.5 + shyGreet * 2.6,
    rotDeg: -impactSquash * 3.5 + shyGreet * 3.0,
    scaleX: 1,
    scaleY: 1,
  };

  return {
    opacity,
    root,
    legs,
    torso,
    head,
    armLeft,
    armRight,
    blushWarmth: 0.04 + 0.14 * shyGreet,
  };
}

export function stepRigState(
  state: CharterRigState,
  dtSeconds: number,
  prefersReducedMotion: boolean,
): CharterRigState {
  if (prefersReducedMotion) {
    state.opacity = 1;
    state.blushWarmth = 0;
    state.root = identityTransform();
    state.legs = identityTransform();
    state.torso = identityTransform();
    state.head = identityTransform();
    state.armLeft = identityTransform();
    state.armRight = identityTransform();
    state.bunLeft = identityTransform();
    state.bunRight = identityTransform();
    state.ribbonLeft = identityTransform();
    state.ribbonRight = identityTransform();
    return state;
  }

  const dt = clamp(dtSeconds, 0, 0.05);
  state.elapsedS += dt;

  const idle = evaluateIdlePose(state.elapsedS);
  const inEntrance = state.elapsedS < CHARTER_ENTRANCE_DURATION_S;

  let opacity = 1;
  let root = idle.root;
  let legs = idle.legs;
  let torso = idle.torso;
  let head = idle.head;
  let armLeft = idle.armLeft;
  let armRight = idle.armRight;
  let blushWarmth = idle.blushWarmth;

  if (inEntrance) {
    const ent = evaluateEntrancePose(state.elapsedS);
    const blend = smoothstep(0.95, CHARTER_ENTRANCE_DURATION_S, state.elapsedS);
    opacity = ent.opacity;
    root = lerpTransform(ent.root, idle.root, blend);
    legs = lerpTransform(ent.legs, idle.legs, blend);
    torso = lerpTransform(ent.torso, idle.torso, blend);
    head = lerpTransform(ent.head, idle.head, blend);
    armLeft = lerpTransform(ent.armLeft, idle.armLeft, blend);
    armRight = lerpTransform(ent.armRight, idle.armRight, blend);
    blushWarmth = ent.blushWarmth + (idle.blushWarmth - ent.blushWarmth) * blend;
  }

  // Playful click/tap micro-nudge decay
  if (state.reactionImpulse > 0.001) {
    state.reactionImpulse = Math.max(0, state.reactionImpulse - dt * 1.35);
    const rWave = Math.sin(state.reactionImpulse * Math.PI * 2.5) * state.reactionImpulse;
    torso = { ...torso, ty: torso.ty + rWave * 3.0 };
    head = { ...head, rotDeg: head.rotDeg + rWave * 3.8 };
    armLeft = { ...armLeft, ty: armLeft.ty + state.reactionImpulse * 3.2 };
    armRight = { ...armRight, ty: armRight.ty + state.reactionImpulse * 3.2 };
    blushWarmth = clamp(blushWarmth + state.reactionImpulse * 0.14, 0, 0.28);
  } else {
    state.reactionImpulse = 0;
  }

  // Compute velocities from previous frame to excite genuine follow-through springs
  const safeDt = dt > 0.0005 ? dt : 1 / 60;
  const velY = (root.ty + torso.ty - (state.prevRootY + state.prevTorsoY)) / safeDt;
  const velX = (root.tx - state.prevRootX) / safeDt;
  const velHeadRot = (head.rotDeg - state.prevHeadRotDeg) / safeDt;

  // Vertical bounce & head tilt inertia target angles (in degrees)
  const leftBunTarget = clamp(velY * 0.085 - velX * 0.12 - velHeadRot * 0.11, -11, 11);
  const rightBunTarget = clamp(-velY * 0.085 - velX * 0.12 - velHeadRot * 0.11, -11, 11);
  const leftRibbonTarget = clamp(
    velY * 0.125 - velX * 0.16 - velHeadRot * 0.14 - idle.ribbonBreezeDeg,
    -15,
    15,
  );
  const rightRibbonTarget = clamp(
    -velY * 0.125 - velX * 0.16 - velHeadRot * 0.14 + idle.ribbonBreezeDeg,
    -15,
    15,
  );
  const neckBobTarget = clamp(velY * 0.045, -7, 7);

  if (dt > 0) {
    stepSpring(state.bunLeftSpring, leftBunTarget, 175, 13.5, dt, 12);
    stepSpring(state.bunRightSpring, rightBunTarget, 175, 13.5, dt, 12);
    stepSpring(state.ribbonLeftSpring, leftRibbonTarget, 125, 10.2, dt, 16);
    stepSpring(state.ribbonRightSpring, rightRibbonTarget, 125, 10.2, dt, 16);
    stepSpring(state.neckBobSpring, neckBobTarget, 210, 16.5, dt, 8);
  }

  state.prevRootY = root.ty;
  state.prevRootX = root.tx;
  state.prevHeadRotDeg = head.rotDeg;
  state.prevTorsoY = torso.ty;

  state.opacity = opacity;
  state.blushWarmth = blushWarmth;
  state.root = root;
  state.legs = legs;
  state.torso = torso;
  state.head = { ...head, ty: head.ty + state.neckBobSpring.value * 0.55 };
  state.armLeft = armLeft;
  state.armRight = armRight;
  state.bunLeft = {
    tx: 0,
    ty: state.neckBobSpring.value * 0.25,
    rotDeg: state.bunLeftSpring.value,
    scaleX: 1,
    scaleY: 1,
  };
  state.bunRight = {
    tx: 0,
    ty: state.neckBobSpring.value * 0.25,
    rotDeg: state.bunRightSpring.value,
    scaleX: 1,
    scaleY: 1,
  };
  state.ribbonLeft = {
    tx: 0,
    ty: state.neckBobSpring.value * 0.35,
    rotDeg: state.ribbonLeftSpring.value,
    scaleX: 1,
    scaleY: 1,
  };
  state.ribbonRight = {
    tx: 0,
    ty: state.neckBobSpring.value * 0.35,
    rotDeg: state.ribbonRightSpring.value,
    scaleX: 1,
    scaleY: 1,
  };

  return state;
}
