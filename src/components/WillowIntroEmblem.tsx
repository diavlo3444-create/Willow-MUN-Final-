import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  CANVAS_VIEWBOX_H,
  CANVAS_VIEWBOX_W,
  buildWillowCanvasGeometry,
  drawWillowCanvasFrame,
} from '../utils/willowCanvasIntro';

const INTRO_DURATION_MS = 3200;

export interface WillowIntroEmblemHandle {
  replay: () => void;
}

interface WillowIntroEmblemProps {
  introPlaying: boolean;
  onIntroStateChange: (playing: boolean) => void;
}

/**
 * Unified intro & background emblem canvas:
 * - Renders the seeded weeping willow + laurel wreath onto a DPR-aware <canvas>
 *   at a locked 60 FPS with all strokes batched into ONE path per frame.
 * - Lives inside a single unified fixed container (`.willow-emblem-container`) that
 *   transitions seamlessly via CSS `transform: scale(0.92)` and `opacity: 0.22` with a
 *   `1.6s cubic-bezier(0.16, 1, 0.3, 1)` curve into the background emblem behind 'WILLOW MUN'.
 */
export const WillowIntroEmblem = forwardRef<WillowIntroEmblemHandle, WillowIntroEmblemProps>(
  function WillowIntroEmblem({ introPlaying, onIntroStateChange }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const geometry = useMemo(() => buildWillowCanvasGeometry(), []);

    const rafIdRef = useRef<number>(0);
    const finishedRef = useRef<boolean>(false);
    const progressRef = useRef<number>(0);
    const canvasScaleRef = useRef<{
      widthPx: number;
      heightPx: number;
      scale: number;
      offsetX: number;
      offsetY: number;
    }>({
      widthPx: 0,
      heightPx: 0,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });

    const paintAtProgress = useCallback(
      (progress: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { widthPx, heightPx, scale, offsetX, offsetY } = canvasScaleRef.current;
        if (widthPx <= 0 || heightPx <= 0) return;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, widthPx, heightPx);

        if (progress <= 0) return;

        ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
        drawWillowCanvasFrame(ctx, geometry, progress);
      },
      [geometry],
    );

    const syncCanvasBackingStore = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const widthPx = Math.max(1, Math.round(rect.width * dpr));
      const heightPx = Math.max(1, Math.round(rect.height * dpr));

      if (canvas.width !== widthPx || canvas.height !== heightPx) {
        canvas.width = widthPx;
        canvas.height = heightPx;
      }

      const scale = Math.min(widthPx / CANVAS_VIEWBOX_W, heightPx / CANVAS_VIEWBOX_H);
      const offsetX = (widthPx - CANVAS_VIEWBOX_W * scale) / 2;
      const offsetY = (heightPx - CANVAS_VIEWBOX_H * scale) / 2;

      canvasScaleRef.current = { widthPx, heightPx, scale, offsetX, offsetY };
      paintAtProgress(progressRef.current);
    }, [paintAtProgress]);

    const finishIntro = useCallback(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      if (rafIdRef.current !== 0) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }

      progressRef.current = 1;
      paintAtProgress(1);

      const bg = document.getElementById('bgVideo') as HTMLVideoElement | null;
      if (bg) {
        bg.muted = true;
        bg.play().catch(() => {});
      }

      document.body.classList.remove('intro-on');
      onIntroStateChange(false);
    }, [onIntroStateChange, paintAtProgress]);

    const startIntro = useCallback(
      (isReplay: boolean) => {
        if (rafIdRef.current !== 0) {
          window.cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = 0;
        }

        finishedRef.current = false;
        onIntroStateChange(true);

        const docEl = document.documentElement;
        const prevScrollBehavior = docEl.style.scrollBehavior;
        docEl.style.scrollBehavior = 'auto';
        window.scrollTo(0, 0);
        docEl.style.scrollBehavior = prevScrollBehavior;

        const bg = document.getElementById('bgVideo') as HTMLVideoElement | null;
        if (bg) {
          bg.pause();
          try {
            bg.currentTime = 0;
          } catch {
            // Ignore seek error prior to metadata
          }
        }

        const container = containerRef.current;
        if (isReplay && container) {
          container.classList.add('willow-emblem-instant');
        }

        document.body.classList.add('intro-on');

        if (isReplay && container) {
          void container.offsetWidth;
          container.classList.remove('willow-emblem-instant');
        }

        progressRef.current = 0;
        paintAtProgress(0);

        const startTime = performance.now();
        const tick = (now: number) => {
          if (finishedRef.current) return;
          const elapsed = now - startTime;
          const nextProgress = Math.min(1, elapsed / INTRO_DURATION_MS);
          progressRef.current = nextProgress;
          paintAtProgress(nextProgress);

          if (nextProgress >= 1) {
            rafIdRef.current = 0;
            finishIntro();
            return;
          }
          rafIdRef.current = window.requestAnimationFrame(tick);
        };

        rafIdRef.current = window.requestAnimationFrame(tick);
      },
      [finishIntro, onIntroStateChange, paintAtProgress],
    );

    useImperativeHandle(
      ref,
      () => ({
        replay: () => {
          if (!finishedRef.current) return;
          startIntro(true);
        },
      }),
      [startIntro],
    );

    useEffect(() => {
      syncCanvasBackingStore();

      const canvas = canvasRef.current;
      let resizeObserver: ResizeObserver | null = null;
      if (canvas && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          syncCanvasBackingStore();
        });
        resizeObserver.observe(canvas);
      }
      window.addEventListener('resize', syncCanvasBackingStore, { passive: true });

      const onKeyDown = (event: KeyboardEvent) => {
        if (
          !finishedRef.current &&
          (event.key === 'Escape' || event.key === ' ' || event.key === 'Enter')
        ) {
          event.preventDefault();
          finishIntro();
        }
      };
      document.addEventListener('keydown', onKeyDown);

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finishedRef.current = false;
        finishIntro();
      } else {
        startIntro(false);
      }

      return () => {
        if (rafIdRef.current !== 0) {
          window.cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = 0;
        }
        resizeObserver?.disconnect();
        window.removeEventListener('resize', syncCanvasBackingStore);
        document.removeEventListener('keydown', onKeyDown);
      };
    }, [finishIntro, startIntro, syncCanvasBackingStore]);

    return (
      <>
        {/* Olive gradient backdrop during the intro (fades smoothly into #bgVideo + scrim at handoff) */}
        <div className="willow-intro-backdrop" aria-hidden="true" />

        {/* Unified container: stays mounted, gliding from scale(1)/opacity(1) -> scale(0.92)/opacity(0.22) behind WILLOW MUN */}
        <div
          ref={containerRef}
          className="willow-emblem-container"
          aria-hidden="true"
        >
          <canvas
            ref={canvasRef}
            className="block w-[min(92vw,92vh)] max-w-[940px] aspect-[10/9] pointer-events-none"
          />
        </div>

        {/* Click/Skip interaction layer active only while intro is playing */}
        <div
          id="intro"
          aria-hidden={!introPlaying}
          onClick={introPlaying ? finishIntro : undefined}
          className={`willow-intro-controls ${introPlaying ? 'is-active' : ''}`}
        >
          <button
            id="introSkip"
            type="button"
            tabIndex={introPlaying ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              finishIntro();
            }}
          >
            Skip
          </button>
        </div>
      </>
    );
  },
);
