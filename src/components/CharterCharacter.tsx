import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CHARTER_CANVAS_SIZE,
  CHARTER_PIVOTS,
  CHARTER_SPRITE_PATHS,
  createRigState,
  stepRigState,
  triggerPlayfulReaction,
  type CharterRigState,
  type CharterSpriteKey,
  type JointTransform,
} from '../utils/charterCharacterRig';
import { useSectionMotion } from './MotionPrimitives';

type SpriteMap = Record<CharterSpriteKey, HTMLImageElement>;

const DEG_TO_RAD = Math.PI / 180;

function applyPivotTransform(
  ctx: CanvasRenderingContext2D,
  pivotX: number,
  pivotY: number,
  transform: JointTransform,
): void {
  ctx.translate(pivotX + transform.tx, pivotY + transform.ty);
  if (transform.rotDeg !== 0) {
    ctx.rotate(transform.rotDeg * DEG_TO_RAD);
  }
  if (transform.scaleX !== 1 || transform.scaleY !== 1) {
    ctx.scale(transform.scaleX, transform.scaleY);
  }
  ctx.translate(-pivotX, -pivotY);
}

function drawChildAtPivot(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  pivot: { x: number; y: number },
  transform: JointTransform,
): void {
  ctx.save();
  applyPivotTransform(ctx, pivot.x, pivot.y, transform);
  ctx.drawImage(image, 0, 0, CHARTER_CANVAS_SIZE, CHARTER_CANVAS_SIZE);
  ctx.restore();
}

function renderRigToCanvas(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteMap,
  state: CharterRigState,
  cssSize: number,
  dpr: number,
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Always keep every background pixel strictly transparent: rgba(0, 0, 0, 0)
  ctx.clearRect(0, 0, cssSize, cssSize);

  if (state.opacity <= 0.004) return;

  const scaleToRig = cssSize / CHARTER_CANVAS_SIZE;
  ctx.save();
  ctx.scale(scaleToRig, scaleToRig);
  ctx.globalAlpha = state.opacity;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Root grounded at feet pivot (360, 672)
  ctx.save();
  applyPivotTransform(ctx, CHARTER_PIVOTS.feet.x, CHARTER_PIVOTS.feet.y, state.root);

  // 1. Legs (grounded shorts, socks, and shoes)
  drawChildAtPivot(ctx, sprites.legs, CHARTER_PIVOTS.hip, state.legs);

  // 2. Torso bone subtree rooted at hip pivot (360, 536)
  ctx.save();
  applyPivotTransform(ctx, CHARTER_PIVOTS.hip.x, CHARTER_PIVOTS.hip.y, state.torso);
  ctx.drawImage(sprites.torso, 0, 0, CHARTER_CANVAS_SIZE, CHARTER_CANVAS_SIZE);

  // 3. Head bone subtree rooted at neck pivot (360, 420)
  ctx.save();
  applyPivotTransform(ctx, CHARTER_PIVOTS.neck.x, CHARTER_PIVOTS.neck.y, state.head);

  // Secondary physics: ribbons & buns drawn behind head silhouette so hairties stay crisp
  drawChildAtPivot(ctx, sprites.ribbonLeft, CHARTER_PIVOTS.ribbonLeft, state.ribbonLeft);
  drawChildAtPivot(ctx, sprites.ribbonRight, CHARTER_PIVOTS.ribbonRight, state.ribbonRight);
  drawChildAtPivot(ctx, sprites.bunLeft, CHARTER_PIVOTS.bunLeft, state.bunLeft);
  drawChildAtPivot(ctx, sprites.bunRight, CHARTER_PIVOTS.bunRight, state.bunRight);

  // Main head & expression layer
  ctx.drawImage(sprites.head, 0, 0, CHARTER_CANVAS_SIZE, CHARTER_CANVAS_SIZE);

  // Subtle organic blush warmth tint strictly over cheek area during shy peek
  if (state.blushWarmth > 0.01) {
    ctx.save();
    ctx.translate(360, 312);
    ctx.scale(1.0, 0.42);
    const grad = ctx.createRadialGradient(0, 0, 18, 0, 0, 114);
    grad.addColorStop(0, `rgba(244, 108, 118, ${(state.blushWarmth * 0.42).toFixed(3)})`);
    grad.addColorStop(0.65, `rgba(244, 108, 118, ${(state.blushWarmth * 0.22).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(244, 108, 118, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 114, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore(); // End head subtree

  // 4. Shy raised arms drawn cleanly over torso collar & lower cheeks
  drawChildAtPivot(ctx, sprites.armLeft, CHARTER_PIVOTS.shoulderLeft, state.armLeft);
  drawChildAtPivot(ctx, sprites.armRight, CHARTER_PIVOTS.shoulderRight, state.armRight);

  ctx.restore(); // End torso subtree
  ctx.restore(); // End root
  ctx.restore(); // End rig scale
}

function loadSpriteImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode();
        }
      } catch {
        // Already loaded via onload; safe to render
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load Charter sprite: ${url}`));
    img.src = url;
  });
}

interface CharterCharacterProps {
  introPlaying: boolean;
}

/**
 * Multi-joint video-game style character animation rendered onto a strictly
 * transparent HiDPI HTML5 Canvas over the live Willow background video.
 * Replays its full entrance cleanly from Frame 0 on every page refresh and
 * whenever the user leaves and re-enters the Charter section.
 */
export function CharterCharacter({ introPlaying }: CharterCharacterProps) {
  const { isVisible } = useSectionMotion();
  const wrapperRef = useRef<HTMLButtonElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spritesRef = useRef<SpriteMap | null>(null);
  const rigRef = useRef<CharterRigState>(createRigState());
  const wasActiveRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const leaveTimerRef = useRef<number | null>(null);

  const [spritesReady, setSpritesReady] = useState(false);
  const [characterVisibleOnce, setCharacterVisibleOnce] = useState(false);
  const [sectionActive, setSectionActive] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Preload & decode all 9 segmented RGBA layers offscreen before rendering a single frame
  useEffect(() => {
    let cancelled = false;
    const keys = Object.keys(CHARTER_SPRITE_PATHS) as CharterSpriteKey[];
    Promise.all(keys.map(async (key) => [key, await loadSpriteImage(CHARTER_SPRITE_PATHS[key])] as const))
      .then((pairs) => {
        if (cancelled) return;
        spritesRef.current = Object.fromEntries(pairs) as SpriteMap;
        setSpritesReady(true);
      })
      .catch(() => {
        // Keep transparent canvas clean if asset fetch fails
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Arm character entrance only when the character itself enters the viewport inside Charter
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setCharacterVisibleOnce(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.18) {
            setCharacterVisibleOnce(true);
          }
        }
      },
      { threshold: [0.18, 0.4] },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Hysteresis coordination: wait until opening Willow video intro completes, then require Charter section
  // + character entry to activate. Resets cleanly ONLY after exiting the Charter section entirely.
  useEffect(() => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }

    if (introPlaying) {
      setSectionActive(false);
      return;
    }

    if (!isVisible) {
      leaveTimerRef.current = window.setTimeout(() => {
        leaveTimerRef.current = null;
        setSectionActive(false);
        setCharacterVisibleOnce(false);
      }, 150);
      return () => {
        if (leaveTimerRef.current !== null) {
          window.clearTimeout(leaveTimerRef.current);
          leaveTimerRef.current = null;
        }
      };
    }

    if (characterVisibleOnce) {
      setSectionActive(true);
    }
  }, [characterVisibleOnce, introPlaying, isVisible]);

  // Canvas animation & HiDPI resize loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const sprites = spritesRef.current;
    if (!canvas || !spritesReady || !sprites) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let cssSize = canvas.clientWidth || 240;
    let dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    const syncCanvasMetrics = () => {
      const rect = canvas.getBoundingClientRect();
      cssSize = Math.max(120, Math.round(rect.width || canvas.clientWidth || 240));
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const targetPx = Math.round(cssSize * dpr);
      if (canvas.width !== targetPx || canvas.height !== targetPx) {
        canvas.width = targetPx;
        canvas.height = targetPx;
      }
    };

    syncCanvasMetrics();

    if (!sectionActive) {
      wasActiveRef.current = false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssSize, cssSize);
      return;
    }

    // Rising edge -> always start cleanly from Frame 0 entrance (zero storage flags)
    if (!wasActiveRef.current) {
      wasActiveRef.current = true;
      rigRef.current = createRigState();
    }

    let resizeObserver: ResizeObserver | null = null;
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        syncCanvasMetrics();
        renderRigToCanvas(ctx, sprites, rigRef.current, cssSize, dpr);
      });
      resizeObserver.observe(canvas);
    }

    if (prefersReducedMotion) {
      stepRigState(rigRef.current, 0, true);
      renderRigToCanvas(ctx, sprites, rigRef.current, cssSize, dpr);
      return () => {
        resizeObserver?.disconnect();
      };
    }

    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;

      stepRigState(rigRef.current, dt, false);
      renderRigToCanvas(ctx, sprites, rigRef.current, cssSize, dpr);
      rafRef.current = window.requestAnimationFrame(tick);
    };

    renderRigToCanvas(ctx, sprites, rigRef.current, cssSize, dpr);
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      resizeObserver?.disconnect();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [prefersReducedMotion, sectionActive, spritesReady]);

  const handlePlayfulNudge = useCallback(() => {
    if (!spritesReady || !sectionActive || prefersReducedMotion) return;
    triggerPlayfulReaction(rigRef.current);
  }, [prefersReducedMotion, sectionActive, spritesReady]);

  return (
    <div className="flex justify-center">
      <button
        ref={wrapperRef}
        type="button"
        onClick={handlePlayfulNudge}
        aria-label="Willow MUN Charter character"
        className="group relative block h-[206px] w-[206px] sm:h-[234px] sm:w-[234px] lg:h-[258px] lg:w-[258px] cursor-pointer select-none border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ede6ca]/45"
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full bg-transparent"
          style={{ background: 'transparent' }}
        />
      </button>
    </div>
  );
}
