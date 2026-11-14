import { useEffect, useRef } from 'react';
import { TbaText } from './TbaText';

const MARQUEE_ITEMS = [0, 1, 2, 3];

function MarqueePhrase() {
  return (
    <span className="inline-flex items-center gap-5 px-5 text-xs sm:text-sm uppercase tracking-[0.22em] text-[#cfc8aa] whitespace-nowrap">
      <span className="text-[#ede6ca] font-medium">Willow MUN</span>
      <span className="text-[#a9b47e]" aria-hidden="true">
        ✦
      </span>
      <span>Model United Nations</span>
      <span className="text-[#a9b47e]" aria-hidden="true">
        ✦
      </span>
      <span>
        Dates <TbaText text="TBA" className="normal-case text-base" />
      </span>
      <span className="text-[#a9b47e]" aria-hidden="true">
        ✦
      </span>
      <span>
        Venue <TbaText text="TBA" className="normal-case text-base" />
      </span>
      <span className="text-[#a9b47e]" aria-hidden="true">
        ✦
      </span>
    </span>
  );
}

/**
 * Thin continuous editorial marquee strip directly under the hero.
 * Smoothly slows down to a stop when hovered, animating only transform.
 */
interface MarqueeStripProps {
  paused?: boolean;
}

export function MarqueeStrip({ paused = false }: MarqueeStripProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const firstHalfRef = useRef<HTMLDivElement | null>(null);
  const targetSpeedRef = useRef(1);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const resumeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!paused) {
      resumeRef.current?.();
    }
  }, [paused]);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    const firstHalf = firstHalfRef.current;
    if (!container || !track || !firstHalf) return;

    let offsetPx = 0;
    let speed = 1;
    let halfWidth = firstHalf.offsetWidth || 1;
    let isVisible = true;
    let isTabActive = !document.hidden;
    let rafId = 0;
    let lastTime = performance.now();

    const BASE_PX_PER_SEC = 58;

    const tick = (now: number) => {
      rafId = 0;
      if (!isVisible || !isTabActive || pausedRef.current) return;

      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const target = targetSpeedRef.current;
      speed += (target - speed) * 0.08;
      if (Math.abs(target - speed) < 0.002) {
        speed = target;
      }

      if (speed > 0) {
        offsetPx += BASE_PX_PER_SEC * speed * dt;
        if (offsetPx >= halfWidth) {
          offsetPx -= halfWidth;
        }
        track.style.transform = `translate3d(${-offsetPx.toFixed(2)}px, 0, 0)`;
      }

      if ((speed > 0 || target > 0) && !pausedRef.current) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const startLoop = () => {
      if (rafId === 0 && isVisible && isTabActive && !pausedRef.current) {
        lastTime = performance.now();
        rafId = window.requestAnimationFrame(tick);
      }
    };

    resumeRef.current = startLoop;

    const stopLoop = () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const onMouseEnter = () => {
      targetSpeedRef.current = 0;
    };

    const onMouseLeave = () => {
      targetSpeedRef.current = 1;
      startLoop();
    };

    const onVisibilityChange = () => {
      isTabActive = !document.hidden;
      if (isTabActive) startLoop();
      else stopLoop();
    };

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        isVisible = Boolean(entries[0]?.isIntersecting);
        if (isVisible) startLoop();
        else stopLoop();
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(container);

    const resizeObserver = new ResizeObserver(() => {
      halfWidth = firstHalf.offsetWidth || 1;
    });
    resizeObserver.observe(firstHalf);

    container.addEventListener('mouseenter', onMouseEnter);
    container.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);

    startLoop();

    return () => {
      resumeRef.current = null;
      stopLoop();
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      container.removeEventListener('mouseenter', onMouseEnter);
      container.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-label="Conference ticker"
      className="relative z-10 w-full overflow-x-clip border-y border-[#ede6ca]/18 bg-[#14180a]/85 py-3"
    >
      <div ref={trackRef} className="flex w-max will-change-transform">
        <div ref={firstHalfRef} className="flex items-center shrink-0">
          {MARQUEE_ITEMS.map((idx) => (
            <MarqueePhrase key={`a-${idx}`} />
          ))}
        </div>
        <div className="flex items-center shrink-0" aria-hidden="true">
          {MARQUEE_ITEMS.map((idx) => (
            <MarqueePhrase key={`b-${idx}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
