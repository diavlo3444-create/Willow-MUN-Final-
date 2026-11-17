import { useEffect, useRef, type MouseEvent } from 'react';
import { CONFERENCE_DATA } from '../data/conference';
import { useDesktopPointerEnabled } from '../utils/pointerEffects';
import { MagneticWrap } from './MagneticWrap';
import { TbaText } from './TbaText';

const MAX_PARALLAX_PX = 12;

interface HeroProps {
  cursorEffectsActive?: boolean;
}

/**
 * Full-screen editorial hero featuring single-line display typography ("WILLOW MUN"),
 * smooth desktop-only cursor parallax (up to 12px opposite cursor),
 * magnetic hero CTA button, soft radial scrim, and text-shadow.
 * Entrance transition is governed by .chrome / body.intro-on.
 */
export function Hero({ cursorEffectsActive = true }: HeroProps) {
  const titleRef = useRef<HTMLSpanElement | null>(null);
  const desktopPointer = useDesktopPointerEnabled();

  useEffect(() => {
    const titleEl = titleRef.current;
    if (!titleEl) return;

    if (!desktopPointer || !cursorEffectsActive) {
      titleEl.style.transform = 'translate3d(0, 0, 0)';
      return;
    }

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let rafId = 0;

    const animate = () => {
      rafId = 0;
      const dx = targetX - currentX;
      const dy = targetY - currentY;

      currentX += dx * 0.1;
      currentY += dy * 0.1;

      titleEl.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;

      if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
        rafId = window.requestAnimationFrame(animate);
      }
    };

    const schedule = () => {
      if (rafId === 0) {
        rafId = window.requestAnimationFrame(animate);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || document.body.classList.contains('intro-on')) return;
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      const nx = (event.clientX / vw) * 2 - 1;
      const ny = (event.clientY / vh) * 2 - 1;

      targetX = Math.max(-MAX_PARALLAX_PX, Math.min(MAX_PARALLAX_PX, -nx * MAX_PARALLAX_PX));
      targetY = Math.max(-MAX_PARALLAX_PX, Math.min(MAX_PARALLAX_PX, -ny * MAX_PARALLAX_PX));
      schedule();
    };

    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
      schedule();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);

    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [desktopPointer, cursorEffectsActive]);

  const handleCtaClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.querySelector(CONFERENCE_DATA.hero.ctaHref);
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section
      id="top"
      aria-label="Willow Model United Nations overview"
      className="relative z-[1] min-h-[100dvh] flex items-center justify-center bg-transparent px-[clamp(16px,4vw,48px)] pt-24 pb-20"
    >
      <div className="chrome mun-hero-scrim relative mx-auto flex w-full max-w-[1200px] min-w-0 flex-col items-center text-center px-1 py-12 sm:px-6 sm:py-16">
        <p className="mun-hero-shadow text-[clamp(0.65rem,2.6vw,0.75rem)] font-medium uppercase tracking-[0.26em] text-[#cfc8aa] mb-5">
          ✦ <span className="mx-2">{CONFERENCE_DATA.brand.year} Edition</span> ✦
        </p>

        <h1 className="mun-hero-shadow font-serif uppercase text-[#ede6ca] select-none w-full flex justify-center min-w-0">
          <span
            ref={titleRef}
            className="block whitespace-nowrap text-[clamp(2.25rem,8.8vw,8.75rem)] leading-[0.95] font-medium tracking-[0.03em]"
          >
            WILLOW MUN
          </span>
        </h1>

        <div className="mt-7 w-16 border-t border-[#ede6ca]/35" aria-hidden="true" />

        <p className="mun-hero-shadow mt-6 font-serif text-[clamp(1.1rem,3vw,1.6rem)] font-medium tracking-wide text-[#ede6ca] [text-wrap:balance]">
          {CONFERENCE_DATA.hero.fullTitle}
        </p>

        <p className="mun-hero-shadow mt-2 text-[clamp(0.875rem,2.4vw,1rem)] text-[#cfc8aa]">
          Tagline <TbaText text="TBA" className="text-lg sm:text-xl" />
        </p>

        <p className="mun-hero-shadow mt-2 text-[clamp(0.7rem,2.6vw,0.875rem)] uppercase tracking-[0.18em] text-[#cfc8aa]">
          Dates <TbaText text="TBA" className="normal-case text-base sm:text-lg" />
          <span className="mx-2.5 text-[#ede6ca]/45" aria-hidden="true">
            ·
          </span>
          Venue <TbaText text="TBA" className="normal-case text-base sm:text-lg" />
        </p>

        <div className="mt-8">
          <MagneticWrap>
            <a
              href={CONFERENCE_DATA.hero.ctaHref}
              onClick={handleCtaClick}
              className="mun-btn-interactive inline-flex items-center justify-center min-h-[44px] rounded-full bg-[#ede6ca] px-7 py-3 text-sm font-medium text-[#232814] hover:opacity-90 whitespace-nowrap"
            >
              {CONFERENCE_DATA.hero.ctaLabel}
            </a>
          </MagneticWrap>
        </div>
      </div>
    </section>
  );
}
