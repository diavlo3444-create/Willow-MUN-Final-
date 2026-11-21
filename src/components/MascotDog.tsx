import { useEffect, useRef } from 'react';
import {
  computeFacingTowardX,
  computeScrollRunSpeedMultiplier,
  computeScrollVelocityPxPerSec,
  computeTargetLeftClamped,
  DOG_EXCITED_MS,
  CARD_EXCITED_MS,
  getMascotBounds,
  getNearestEdgeTarget,
  IDLE_BEFORE_EDGE_MS,
  IDLE_SIT_BEFORE_SLEEP_MS,
  isFastScrollVelocity,
  isPointerWithinRange,
  MASCOT_ATLAS_ROWS,
  PATROL_PAUSE_MS,
  SCROLL_COOLDOWN_MS,
  SLEEP_Z_INTERVAL_MS,
  WAKE_STRETCH_MS,
  type MascotAnimationName,
  type MascotState,
} from '../utils/mascotDog';

export const MASCOT_HOVER_EVENT = 'willow:mascot-hover';
export const MASCOT_CARD_CLICK_EVENT = 'willow:mascot-card-click';
export const MASCOT_MODAL_EVENT = 'willow:mascot-modal';

export interface MascotHoverDetail {
  targetX: number | null;
}

export interface MascotCardClickDetail {
  targetX?: number;
}

export interface MascotModalDetail {
  open: boolean;
}

interface MascotDogProps {
  introPlaying?: boolean;
}

/**
 * Reactive 6x5 sprite-atlas Pekingese mascot:
 * - Zero React state updates: state machine lives in refs & writes `data-state` to DOM.
 * - Sprite row/frame stepping runs 100% in CSS (`--row`, `--frames`, `steps(var(--frames))`).
 * - Movement updates `transform: translateX(...) scaleX(±1)` only via single rAF loop when moving.
 * - One passive scroll listener (rAF) + one passive pointermove listener (rAF).
 */
export function MascotDog({ introPlaying = false }: MascotDogProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const dogRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<MascotState>('patrol');
  const introPlayingRef = useRef(introPlaying);
  introPlayingRef.current = introPlaying;
  const syncVisibilityRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const dog = dogRef.current;
    if (!layer || !dog) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const getDogSize = () => (window.innerWidth >= 768 ? 90 : 64);

    // Core mutable state refs (no React state)
    let posX = 24;
    let facing: 1 | -1 = 1;
    let currentAnim: MascotAnimationName = 'walk';
    let scrollSpeedMult = 1;

    let hoverTargetCenterX: number | null = null;
    let modalOpen = false;
    let modalCornerTargetX: number | null = null;
    let isPointerInsideViewport = false;
    let lastPointerX = -9999;
    let lastPointerY = -9999;
    let lastInputTs = performance.now();
    let lastScrollY = window.scrollY;
    let lastScrollTs = performance.now();

    // Active handles
    let moveRafId: number | null = null;
    let lastMoveTs = 0;
    let scrollRafId: number | null = null;
    let pointerRafId: number | null = null;

    let stateTimerId: number | null = null;
    let scrollCooldownTimerId: number | null = null;
    let idleCheckTimerId: number | null = null;
    let sleepZIntervalId: number | null = null;
    let hoverLeaveTimerId: number | null = null;

    const clearStateTimer = () => {
      if (stateTimerId !== null) {
        window.clearTimeout(stateTimerId);
        stateTimerId = null;
      }
    };

    const clearSleepZInterval = () => {
      if (sleepZIntervalId !== null) {
        window.clearInterval(sleepZIntervalId);
        sleepZIntervalId = null;
      }
    };

    const stopMoveLoop = () => {
      if (moveRafId !== null) {
        window.cancelAnimationFrame(moveRafId);
        moveRafId = null;
      }
      lastMoveTs = 0;
    };

    const isAllowedToAnimate = () =>
      !motionQuery.matches && !document.hidden && !introPlayingRef.current;

    const renderTransform = () => {
      dog.style.transform = `translateX(${posX.toFixed(1)}px) scaleX(${facing})`;
    };

    const setSpriteRow = (animName: MascotAnimationName, durationScale = 1) => {
      currentAnim = animName;
      const spec = MASCOT_ATLAS_ROWS[animName];
      dog.style.setProperty('--row', String(spec.row));
      dog.style.setProperty('--frames', String(spec.frames));
      dog.style.setProperty(
        '--frame-duration',
        `${Math.max(220, Math.round(spec.durationMs / durationScale))}ms`,
      );
      dog.dataset.frames = String(spec.frames);
    };

    const setDogState = (next: MascotState) => {
      stateRef.current = next;
      dog.dataset.state = next;
    };

    // Floating particles rendered only in response to discrete events (transform & opacity only)
    const spawnWoofLabel = () => {
      if (!isAllowedToAnimate()) return;
      const dogSize = getDogSize();
      const label = document.createElement('span');
      label.className = 'mascot-woof';
      label.textContent = 'woof!';
      label.style.left = `${Math.round(posX + dogSize / 2)}px`;
      label.style.bottom = `${Math.round(dogSize + 4)}px`;
      layer.appendChild(label);

      const anim = label.animate(
        [
          { transform: 'translate3d(-50%, 6px, 0) scale(0.85)', opacity: 0 },
          { transform: 'translate3d(-50%, -6px, 0) scale(1)', opacity: 1, offset: 0.2 },
          { transform: 'translate3d(-50%, -20px, 0) scale(1)', opacity: 1, offset: 0.72 },
          { transform: 'translate3d(-50%, -32px, 0) scale(0.95)', opacity: 0 },
        ],
        { duration: 1150, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
      );
      anim.onfinish = () => label.remove();
    };

    const spawnClickBurst = () => {
      if (!isAllowedToAnimate()) return;
      const dogSize = getDogSize();
      const originX = posX + dogSize / 2;
      const originBottom = dogSize * 0.75;

      for (let i = 0; i < 6; i += 1) {
        const el = document.createElement('span');
        el.className = 'mascot-particle';
        el.style.left = `${Math.round(originX)}px`;
        el.style.bottom = `${Math.round(originBottom)}px`;
        const isHeart = i % 2 === 1;
        el.innerHTML = isHeart
          ? '<svg width="12" height="12" viewBox="0 0 16 16" fill="#efe9d0" aria-hidden="true"><path d="M8 14s-5.5-3.6-5.5-7.4C2.5 4.4 4.2 3 6.1 3c1.1 0 1.9.6 1.9.6S8.8 3 9.9 3C11.8 3 13.5 4.4 13.5 6.6 13.5 10.4 8 14 8 14z"/></svg>'
          : '<svg width="13" height="13" viewBox="0 0 16 16" fill="#c9b36b" aria-hidden="true"><path d="M13.5 2.5C8 2.8 3.6 6.2 2.5 13.5c7.3-1.1 10.7-5.5 11-11z"/></svg>';

        layer.appendChild(el);
        const dx = (i - 2.5) * 14 + (Math.random() - 0.5) * 10;
        const dy = -48 - Math.random() * 34;
        const rot = (Math.random() - 0.5) * 80;
        const anim = el.animate(
          [
            { transform: 'translate3d(-50%, 0px, 0) scale(0.5) rotate(0deg)', opacity: 0 },
            { transform: `translate3d(calc(-50% + ${(dx * 0.35).toFixed(1)}px), ${(dy * 0.35).toFixed(1)}px, 0) scale(1.05) rotate(${(rot * 0.4).toFixed(0)}deg)`, opacity: 1, offset: 0.25 },
            { transform: `translate3d(calc(-50% + ${dx.toFixed(1)}px), ${dy.toFixed(1)}px, 0) scale(0.85) rotate(${rot.toFixed(0)}deg)`, opacity: 0 },
          ],
          {
            duration: 900 + i * 65,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'forwards',
          },
        );
        anim.onfinish = () => el.remove();
      }
    };

    const spawnSleepZ = () => {
      if (!isAllowedToAnimate() || stateRef.current !== 'sleep') return;
      const dogSize = getDogSize();
      const headOffset = facing === 1 ? dogSize * 0.72 : dogSize * 0.28;
      const z = document.createElement('span');
      z.className = 'mascot-sleep-z';
      z.textContent = 'z';
      z.style.left = `${Math.round(posX + headOffset)}px`;
      z.style.bottom = `${Math.round(dogSize * 0.55)}px`;
      layer.appendChild(z);

      const driftX = facing * (10 + Math.random() * 8);
      const anim = z.animate(
        [
          { transform: 'translate3d(-50%, 0px, 0) scale(0.75)', opacity: 0 },
          { transform: `translate3d(calc(-50% + ${(driftX * 0.4).toFixed(1)}px), -14px, 0) scale(1)`, opacity: 0.92, offset: 0.3 },
          { transform: `translate3d(calc(-50% + ${driftX.toFixed(1)}px), -34px, 0) scale(1.12)`, opacity: 0 },
        ],
        { duration: 1700, easing: 'ease-out', fill: 'forwards' },
      );
      anim.onfinish = () => z.remove();
    };

    // Forward declarations for state transitions
    const enterPatrol = () => {
      if (motionQuery.matches) return;
      clearStateTimer();
      clearSleepZInterval();
      modalCornerTargetX = null;

      if (modalOpen) {
        enterModalSit();
        return;
      }
      if (hoverTargetCenterX !== null) {
        enterHoverRun(hoverTargetCenterX);
        return;
      }

      setDogState('patrol');
      setSpriteRow('walk', 1);
      ensureMoveLoop();
    };

    const enterPatrolPause = () => {
      clearStateTimer();
      clearSleepZInterval();
      stopMoveLoop();
      setDogState('patrol-sit');
      setSpriteRow('sit', 1);

      stateTimerId = window.setTimeout(() => {
        stateTimerId = null;
        if (stateRef.current !== 'patrol-sit') return;
        facing = facing === 1 ? -1 : 1;
        renderTransform();
        enterPatrol();
      }, PATROL_PAUSE_MS);
    };

    const enterHoverRun = (targetCenterX: number) => {
      if (motionQuery.matches || modalOpen) return;
      clearStateTimer();
      clearSleepZInterval();
      hoverTargetCenterX = targetCenterX;

      const dogSize = getDogSize();
      const targetLeft = computeTargetLeftClamped(targetCenterX, window.innerWidth, dogSize);
      const dist = Math.abs(targetLeft - posX);

      if (dist <= 6) {
        facing = computeFacingTowardX(posX + dogSize / 2, targetCenterX, facing);
        renderTransform();
        stopMoveLoop();
        setDogState('hover-sit');
        setSpriteRow('sit', 1);
        return;
      }

      facing = targetLeft > posX ? 1 : -1;
      renderTransform();
      setDogState('hover-run');
      setSpriteRow('run', 1.15);
      ensureMoveLoop();
    };

    const enterModalSit = () => {
      clearStateTimer();
      clearSleepZInterval();

      const dogSize = getDogSize();
      const corner = getNearestEdgeTarget(posX, window.innerWidth, dogSize);
      modalCornerTargetX = corner.targetLeft;

      if (Math.abs(posX - corner.targetLeft) <= 8) {
        posX = corner.targetLeft;
        facing = corner.facing;
        renderTransform();
        stopMoveLoop();
        setDogState('modal-sit');
        setSpriteRow('sit', 1);
        return;
      }

      facing = corner.targetLeft > posX ? 1 : -1;
      renderTransform();
      setDogState('modal-sit');
      setSpriteRow('run', 1.1);
      ensureMoveLoop();
    };

    const enterExcited = (durationMs: number, source: 'card' | 'dog') => {
      if (motionQuery.matches) return;
      clearStateTimer();
      clearSleepZInterval();
      stopMoveLoop();

      setDogState('excited');
      setSpriteRow('excited', 1);

      if (source === 'card') {
        spawnWoofLabel();
      } else {
        spawnClickBurst();
      }

      stateTimerId = window.setTimeout(() => {
        stateTimerId = null;
        if (stateRef.current !== 'excited') return;
        if (modalOpen) {
          enterModalSit();
        } else if (hoverTargetCenterX !== null) {
          enterHoverRun(hoverTargetCenterX);
        } else {
          enterPatrol();
        }
      }, durationMs);
    };

    const enterSleep = () => {
      clearStateTimer();
      stopMoveLoop();
      setDogState('sleep');
      setSpriteRow('sleep', 1);
      spawnSleepZ();
      clearSleepZInterval();
      sleepZIntervalId = window.setInterval(spawnSleepZ, SLEEP_Z_INTERVAL_MS);
    };

    const enterIdleSit = () => {
      clearStateTimer();
      clearSleepZInterval();
      stopMoveLoop();
      setDogState('idle-sit');
      setSpriteRow('sit', 1);

      stateTimerId = window.setTimeout(() => {
        stateTimerId = null;
        if (stateRef.current !== 'idle-sit') return;
        enterSleep();
      }, IDLE_SIT_BEFORE_SLEEP_MS);
    };

    const enterIdleToEdge = () => {
      if (motionQuery.matches || modalOpen || hoverTargetCenterX !== null) return;
      clearStateTimer();
      clearSleepZInterval();
      const dogSize = getDogSize();
      const edge = getNearestEdgeTarget(posX, window.innerWidth, dogSize);
      if (Math.abs(posX - edge.targetLeft) <= 4) {
        posX = edge.targetLeft;
        facing = edge.facing;
        renderTransform();
        enterIdleSit();
        return;
      }
      facing = edge.targetLeft > posX ? 1 : -1;
      renderTransform();
      setDogState('idle-walk');
      setSpriteRow('walk', 1);
      ensureMoveLoop();
    };

    const wakeFromSleep = () => {
      if (stateRef.current !== 'sleep') return;
      clearStateTimer();
      clearSleepZInterval();
      stopMoveLoop();
      setDogState('waking');
      setSpriteRow('excited', 1);

      stateTimerId = window.setTimeout(() => {
        stateTimerId = null;
        if (stateRef.current !== 'waking') return;
        enterPatrol();
      }, WAKE_STRETCH_MS);
    };

    const scheduleIdleCheck = () => {
      if (idleCheckTimerId !== null) {
        window.clearTimeout(idleCheckTimerId);
      }
      const remaining = Math.max(250, IDLE_BEFORE_EDGE_MS - (performance.now() - lastInputTs));
      idleCheckTimerId = window.setTimeout(() => {
        idleCheckTimerId = null;
        const elapsed = performance.now() - lastInputTs;
        if (elapsed < IDLE_BEFORE_EDGE_MS) {
          scheduleIdleCheck();
          return;
        }
        const st = stateRef.current;
        if (
          isAllowedToAnimate() &&
          !modalOpen &&
          hoverTargetCenterX === null &&
          (st === 'patrol' || st === 'patrol-sit')
        ) {
          enterIdleToEdge();
        }
        scheduleIdleCheck();
      }, remaining);
    };

    const recordUserActivity = (canWakeSleep = true) => {
      lastInputTs = performance.now();
      if (!canWakeSleep) return;
      if (stateRef.current === 'sleep') {
        wakeFromSleep();
      } else if (stateRef.current === 'idle-walk' || stateRef.current === 'idle-sit') {
        enterPatrol();
      }
    };

    // Single rAF movement loop (runs strictly while actively walking/running)
    const stepMovement = (now: number) => {
      moveRafId = null;
      if (!isAllowedToAnimate()) return;

      const dtSec = lastMoveTs > 0 ? Math.min(0.05, Math.max(0.001, (now - lastMoveTs) / 1000)) : 0.016;
      lastMoveTs = now;

      const st = stateRef.current;
      const dogSize = getDogSize();
      const { minX, maxX } = getMascotBounds(window.innerWidth, dogSize);
      const isDesktop = dogSize >= 90;

      if (st === 'patrol') {
        const walkPxPerSec = isDesktop ? 68 : 48;
        posX += facing * walkPxPerSec * dtSec;
        if (posX >= maxX) {
          posX = maxX;
          renderTransform();
          enterPatrolPause();
          return;
        }
        if (posX <= minX) {
          posX = minX;
          renderTransform();
          enterPatrolPause();
          return;
        }
        renderTransform();
        moveRafId = window.requestAnimationFrame(stepMovement);
        return;
      }

      if (st === 'scrolling') {
        const runPxPerSec = (isDesktop ? 235 : 165) * scrollSpeedMult;
        posX += facing * runPxPerSec * dtSec;
        if (posX >= maxX) {
          posX = maxX;
          facing = -1;
        } else if (posX <= minX) {
          posX = minX;
          facing = 1;
        }
        renderTransform();
        moveRafId = window.requestAnimationFrame(stepMovement);
        return;
      }

      if (st === 'hover-run' && hoverTargetCenterX !== null) {
        const targetLeft = computeTargetLeftClamped(hoverTargetCenterX, window.innerWidth, dogSize);
        const runPxPerSec = isDesktop ? 360 : 250;
        const delta = targetLeft - posX;
        const step = runPxPerSec * dtSec;
        if (Math.abs(delta) <= step + 1) {
          posX = targetLeft;
          facing = computeFacingTowardX(posX + dogSize / 2, hoverTargetCenterX, facing);
          renderTransform();
          setDogState('hover-sit');
          setSpriteRow('sit', 1);
          return;
        }
        facing = delta > 0 ? 1 : -1;
        posX += facing * step;
        renderTransform();
        moveRafId = window.requestAnimationFrame(stepMovement);
        return;
      }

      if (st === 'idle-walk') {
        const edge = getNearestEdgeTarget(posX, window.innerWidth, dogSize);
        const delta = edge.targetLeft - posX;
        const walkPxPerSec = isDesktop ? 76 : 54;
        const step = walkPxPerSec * dtSec;
        if (Math.abs(delta) <= step + 1) {
          posX = edge.targetLeft;
          facing = edge.facing;
          renderTransform();
          enterIdleSit();
          return;
        }
        facing = delta > 0 ? 1 : -1;
        posX += facing * step;
        renderTransform();
        moveRafId = window.requestAnimationFrame(stepMovement);
        return;
      }

      if (st === 'modal-sit' && modalCornerTargetX !== null) {
        const corner = getNearestEdgeTarget(posX, window.innerWidth, dogSize);
        const delta = modalCornerTargetX - posX;
        const runPxPerSec = isDesktop ? 340 : 240;
        const step = runPxPerSec * dtSec;
        if (Math.abs(delta) <= step + 1) {
          posX = modalCornerTargetX;
          facing = corner.facing;
          renderTransform();
          setSpriteRow('sit', 1);
          modalCornerTargetX = null;
          return;
        }
        facing = delta > 0 ? 1 : -1;
        posX += facing * step;
        renderTransform();
        moveRafId = window.requestAnimationFrame(stepMovement);
      }
    };

    function ensureMoveLoop() {
      if (!isAllowedToAnimate()) return;
      if (moveRafId === null) {
        lastMoveTs = performance.now();
        moveRafId = window.requestAnimationFrame(stepMovement);
      }
    }

    // Reduced-motion & visibility sync
    const syncVisibilityAndMotion = () => {
      if (motionQuery.matches) {
        clearStateTimer();
        clearSleepZInterval();
        stopMoveLoop();
        setDogState('reduced-motion');
        dog.style.animationPlayState = 'paused';
        dog.style.setProperty('--row', String(MASCOT_ATLAS_ROWS.sit.row));
        dog.style.setProperty('--frames', String(MASCOT_ATLAS_ROWS.sit.frames));
        dog.dataset.frames = String(MASCOT_ATLAS_ROWS.sit.frames);
        dog.style.transform = 'translateX(16px) scaleX(1)';
        return;
      }

      if (document.hidden || introPlayingRef.current) {
        dog.style.animationPlayState = 'paused';
        stopMoveLoop();
        clearSleepZInterval();
        return;
      }

      dog.style.animationPlayState = 'running';
      renderTransform();

      const st = stateRef.current;
      if (st === 'reduced-motion') {
        enterPatrol();
      } else if (st === 'sleep') {
        clearSleepZInterval();
        sleepZIntervalId = window.setInterval(spawnSleepZ, SLEEP_Z_INTERVAL_MS);
      } else if (
        st === 'patrol' ||
        st === 'scrolling' ||
        st === 'hover-run' ||
        st === 'idle-walk' ||
        (st === 'modal-sit' && modalCornerTargetX !== null)
      ) {
        ensureMoveLoop();
      }
    };

    syncVisibilityRef.current = syncVisibilityAndMotion;

    // 1. One passive scroll listener (rAF + refs, zero React state)
    const onScroll = () => {
      recordUserActivity(true);
      if (!isAllowedToAnimate()) return;
      if (scrollRafId !== null) return;

      scrollRafId = window.requestAnimationFrame(() => {
        scrollRafId = null;
        const now = performance.now();
        const nextY = window.scrollY;
        const rawDtMs = now - lastScrollTs;
        const dy = Math.abs(nextY - lastScrollY);
        lastScrollY = nextY;
        lastScrollTs = now;

        const pxPerSec = computeScrollVelocityPxPerSec(dy, rawDtMs);
        if (
          isFastScrollVelocity(pxPerSec) &&
          !modalOpen &&
          hoverTargetCenterX === null &&
          stateRef.current !== 'excited' &&
          stateRef.current !== 'waking'
        ) {
          scrollSpeedMult = computeScrollRunSpeedMultiplier(pxPerSec);
          if (stateRef.current !== 'scrolling') {
            clearStateTimer();
            setDogState('scrolling');
            setSpriteRow('run', Math.min(1.55, scrollSpeedMult));
            ensureMoveLoop();
          } else {
            setSpriteRow('run', Math.min(1.55, scrollSpeedMult));
          }

          if (scrollCooldownTimerId !== null) {
            window.clearTimeout(scrollCooldownTimerId);
          }
          scrollCooldownTimerId = window.setTimeout(() => {
            scrollCooldownTimerId = null;
            scrollSpeedMult = 1;
            if (stateRef.current === 'scrolling') {
              enterPatrol();
            }
          }, SCROLL_COOLDOWN_MS);
        } else if (stateRef.current === 'scrolling' && dy > 0) {
          if (scrollCooldownTimerId !== null) {
            window.clearTimeout(scrollCooldownTimerId);
          }
          scrollCooldownTimerId = window.setTimeout(() => {
            scrollCooldownTimerId = null;
            scrollSpeedMult = 1;
            if (stateRef.current === 'scrolling') {
              enterPatrol();
            }
          }, SCROLL_COOLDOWN_MS);
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // 2. One pointermove listener (throttled with rAF, refs only)
    const onPointerMove = (e: PointerEvent) => {
      isPointerInsideViewport = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      recordUserActivity(true);

      if (!isAllowedToAnimate()) return;
      if (pointerRafId !== null) return;

      pointerRafId = window.requestAnimationFrame(() => {
        pointerRafId = null;
        if (!isPointerInsideViewport || !isAllowedToAnimate()) return;

        const st = stateRef.current;
        if (st === 'patrol-sit' || st === 'hover-sit' || st === 'idle-sit' || st === 'modal-sit') {
          const dogSize = getDogSize();
          const dogCenterX = posX + dogSize / 2;
          const dogCenterY = window.innerHeight - 52 - dogSize / 2;
          if (isPointerWithinRange(lastPointerX, lastPointerY, dogCenterX, dogCenterY)) {
            const nextFacing = computeFacingTowardX(dogCenterX, lastPointerX, facing, 6);
            if (nextFacing !== facing) {
              facing = nextFacing;
              renderTransform();
            }
          }
        }
      });
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const onGenericInput = () => {
      recordUserActivity(true);
    };
    window.addEventListener('keydown', onGenericInput, { passive: true });
    window.addEventListener('pointerdown', onGenericInput, { passive: true });
    window.addEventListener('touchstart', onGenericInput, { passive: true });

    // Click dog interaction -> EXCITED + 6 olive leaves/hearts
    const onDogClick = (e: MouseEvent) => {
      e.stopPropagation();
      recordUserActivity(false);
      if (!isAllowedToAnimate()) return;
      enterExcited(DOG_EXCITED_MS, 'dog');
    };
    dog.addEventListener('click', onDogClick);

    // Executive Board bridge events (zero re-render)
    const onHoverEvent = (event: Event) => {
      const detail = (event as CustomEvent<MascotHoverDetail>).detail;
      recordUserActivity(false);
      if (detail && typeof detail.targetX === 'number') {
        if (hoverLeaveTimerId !== null) {
          window.clearTimeout(hoverLeaveTimerId);
          hoverLeaveTimerId = null;
        }
        hoverTargetCenterX = detail.targetX;
        if (!modalOpen && stateRef.current !== 'excited' && stateRef.current !== 'waking') {
          enterHoverRun(detail.targetX);
        }
      } else {
        hoverTargetCenterX = null;
        if (hoverLeaveTimerId !== null) {
          window.clearTimeout(hoverLeaveTimerId);
        }
        hoverLeaveTimerId = window.setTimeout(() => {
          hoverLeaveTimerId = null;
          if (hoverTargetCenterX === null && !modalOpen && (stateRef.current === 'hover-run' || stateRef.current === 'hover-sit')) {
            enterPatrol();
          }
        }, 32);
      }
    };

    const onCardClickEvent = () => {
      recordUserActivity(false);
      hoverTargetCenterX = null;
      if (!isAllowedToAnimate()) return;
      enterExcited(CARD_EXCITED_MS, 'card');
    };

    const onModalEvent = (event: Event) => {
      const detail = (event as CustomEvent<MascotModalDetail>).detail;
      const nextOpen = Boolean(detail?.open);
      modalOpen = nextOpen;
      recordUserActivity(false);

      if (nextOpen) {
        if (stateRef.current !== 'excited') {
          enterModalSit();
        }
      } else if (stateRef.current === 'modal-sit') {
        enterPatrol();
      }
    };

    window.addEventListener(MASCOT_HOVER_EVENT, onHoverEvent);
    window.addEventListener(MASCOT_CARD_CLICK_EVENT, onCardClickEvent);
    window.addEventListener(MASCOT_MODAL_EVENT, onModalEvent);

    const onResize = () => {
      const { minX, maxX } = getMascotBounds(window.innerWidth, getDogSize());
      posX = Math.max(minX, Math.min(maxX, posX));
      renderTransform();
    };
    window.addEventListener('resize', onResize, { passive: true });

    document.addEventListener('visibilitychange', syncVisibilityAndMotion);
    motionQuery.addEventListener('change', syncVisibilityAndMotion);

    // Initialize position & start patrol state
    setSpriteRow('walk', 1);
    setDogState(motionQuery.matches ? 'reduced-motion' : 'patrol');
    renderTransform();
    syncVisibilityAndMotion();
    scheduleIdleCheck();

    return () => {
      syncVisibilityRef.current = null;
      clearStateTimer();
      clearSleepZInterval();
      stopMoveLoop();
      if (scrollRafId !== null) window.cancelAnimationFrame(scrollRafId);
      if (pointerRafId !== null) window.cancelAnimationFrame(pointerRafId);
      if (scrollCooldownTimerId !== null) window.clearTimeout(scrollCooldownTimerId);
      if (idleCheckTimerId !== null) window.clearTimeout(idleCheckTimerId);
      if (hoverLeaveTimerId !== null) window.clearTimeout(hoverLeaveTimerId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onGenericInput);
      window.removeEventListener('pointerdown', onGenericInput);
      window.removeEventListener('touchstart', onGenericInput);
      window.removeEventListener('resize', onResize);
      dog.removeEventListener('click', onDogClick);
      window.removeEventListener(MASCOT_HOVER_EVENT, onHoverEvent);
      window.removeEventListener(MASCOT_CARD_CLICK_EVENT, onCardClickEvent);
      window.removeEventListener(MASCOT_MODAL_EVENT, onModalEvent);
      document.removeEventListener('visibilitychange', syncVisibilityAndMotion);
      motionQuery.removeEventListener('change', syncVisibilityAndMotion);
    };
  }, []);

  // Re-sync cleanly when opening intro finishes
  useEffect(() => {
    syncVisibilityRef.current?.();
  }, [introPlaying]);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      data-testid="mascot-dog-layer"
      className="mascot-dog-layer"
    >
      <div
        ref={dogRef}
        data-testid="mascot-dog"
        data-state="patrol"
        data-frames="6"
        className="mascot-dog"
      />
    </div>
  );
}
