import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  buildWillowCanvasGeometry,
  configureWillowCanvasContext,
  drawWillowCanvasFrame,
} from '../utils/willowCanvasIntro';

const INTRO_DURATION_MS = 7900;
const FALLBACK_TIMEOUT_MS = 12000;

export interface WillowIntroEmblemHandle {
  replay: () => void;
}

interface WillowIntroEmblemProps {
  introPlaying: boolean;
  onIntroStateChange: (playing: boolean) => void;
}

/** Transparent canvas intro: no footage or baked-in matte, only the Willow tree drawing. */
export const WillowIntroEmblem = forwardRef<WillowIntroEmblemHandle, WillowIntroEmblemProps>(
  function WillowIntroEmblem({ introPlaying, onIntroStateChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rafRef = useRef<number>(0);
    const timeoutRef = useRef<number>(0);
    const finishedRef = useRef(false);
    const startAtRef = useRef(0);
    const geometryRef = useRef(buildWillowCanvasGeometry());
    const autoStartRef = useRef(introPlaying);

    const clearAnimation = useCallback(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      rafRef.current = 0;
      timeoutRef.current = 0;
    }, []);

    const drawProgress = useCallback((progress: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.round(width * dpr);
      const targetHeight = Math.round(height * dpr);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      canvas.style.width = '100vw';
      canvas.style.height = '100dvh';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(width / 800, height / 720) * 1.15;
      const x = (width - 800 * scale) / 2;
      const y = (height - 720 * scale) / 2;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * x, dpr * y);
      configureWillowCanvasContext(ctx);
      drawWillowCanvasFrame(ctx, geometryRef.current, progress);
    }, []);

    const finishIntro = useCallback(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearAnimation();
      drawProgress(1);
      document.body.classList.add('intro-transitioning');
      window.setTimeout(() => document.body.classList.remove('intro-transitioning'), 2200);
      document.body.classList.remove('intro-on');
      onIntroStateChange(false);
    }, [clearAnimation, drawProgress, onIntroStateChange]);

    const startIntro = useCallback((replay: boolean) => {
      clearAnimation();
      finishedRef.current = false;
      onIntroStateChange(true);
      document.body.classList.remove('intro-transitioning');
      document.body.classList.add('intro-on');
      const docEl = document.documentElement;
      const oldScrollBehavior = docEl.style.scrollBehavior;
      docEl.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      docEl.style.scrollBehavior = oldScrollBehavior;
      drawProgress(0);
      startAtRef.current = performance.now();
      const loop = (now: number) => {
        if (finishedRef.current) return;
        if (document.hidden) {
          rafRef.current = 0;
          return;
        }
        const progress = Math.min(1, (now - startAtRef.current) / INTRO_DURATION_MS);
        drawProgress(progress);
        if (progress >= 1) {
          rafRef.current = 0;
          finishIntro();
          return;
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
      timeoutRef.current = window.setTimeout(finishIntro, FALLBACK_TIMEOUT_MS);
      if (replay) canvasRef.current?.focus();
    }, [clearAnimation, drawProgress, finishIntro, onIntroStateChange]);

    useImperativeHandle(ref, () => ({ replay: () => { if (finishedRef.current) startIntro(true); } }), [startIntro]);

    useEffect(() => {
      drawProgress(0);
      const resize = () => {
        if (finishedRef.current) drawProgress(1);
        else drawProgress(Math.min(1, (performance.now() - startAtRef.current) / INTRO_DURATION_MS));
      };
      window.addEventListener('resize', resize);
      const visibility = () => {
        if (document.hidden || finishedRef.current) return;
        if (rafRef.current === 0) {
          const progress = Math.min(1, (performance.now() - startAtRef.current) / INTRO_DURATION_MS);
          if (progress >= 1) finishIntro();
          else rafRef.current = requestAnimationFrame((now) => {
            const loop = (t: number) => {
              if (finishedRef.current || document.hidden) { rafRef.current = 0; return; }
              const p = Math.min(1, (t - startAtRef.current) / INTRO_DURATION_MS);
              drawProgress(p);
              if (p >= 1) { rafRef.current = 0; finishIntro(); }
              else rafRef.current = requestAnimationFrame(loop);
            };
            loop(now);
          });
        }
      };
      document.addEventListener('visibilitychange', visibility);
      const keydown = (event: KeyboardEvent) => {
        if (!finishedRef.current && ['Escape', ' ', 'Enter'].includes(event.key)) {
          event.preventDefault();
          finishIntro();
        }
      };
      document.addEventListener('keydown', keydown);
      if (autoStartRef.current) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          finishedRef.current = true;
          drawProgress(1);
          document.body.classList.remove('intro-on');
          onIntroStateChange(false);
        } else startIntro(false);
      }
      return () => {
        clearAnimation();
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', visibility);
        document.removeEventListener('keydown', keydown);
      };
    }, [clearAnimation, drawProgress, finishIntro, onIntroStateChange, startIntro]);

    return (
      <>
        <div className="willow-intro-backdrop" aria-hidden="true" />
        <canvas ref={canvasRef} aria-hidden="true" tabIndex={-1} className="willow-intro-video willow-intro-canvas" />
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
            onClick={(e) => { e.stopPropagation(); finishIntro(); }}
          >
            Skip
          </button>
        </div>
      </>
    );
  },
);
