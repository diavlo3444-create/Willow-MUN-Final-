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
      className="relative min-h-[100dvh] flex items-center justify-center px-3 sm:px-8 md:px-12 pt-24 pb-20"
    >
      <div className="chrome mun-hero-scrim relative mx-auto flex w-full max-w-[1280px] flex-col items-center text-center px-2 py-12 sm:px-8 sm:py-16">
        <p className="mun-hero-shadow text-[clamp(10px,2.8vw,12px)] font-medium uppercase tracking-[0.26em] text-[#cfc8aa] mb-5 whitespace-nowrap">
          ✦ <span className="mx-2">{CONFERENCE_DATA.brand.year} Edition</span> ✦
        </p>

        <h1 className="mun-hero-shadow font-serif uppercase text-[#ede6ca] select-none w-full flex justify-center">
          <span
            ref={titleRef}
            className="block will-change-transform whitespace-nowrap text-[clamp(2.4rem,10vw,9.5rem)] leading-[0.95] font-medium tracking-[0.03em]"
          >
            WILLOW MUN
          </span>
        </h1>

        <div className="mt-7 w-16 border-t border-[#ede6ca]/35" aria-hidden="true" />

        <p className="mun-hero-shadow mt-6 font-serif text-[clamp(1.15rem,3vw,1.6rem)] font-medium tracking-wide text-[#ede6ca] whitespace-nowrap">
          {CONFERENCE_DATA.hero.fullTitle}
        </p>

        <p className="mun-hero-shadow mt-2 text-sm sm:text-base text-[#cfc8aa] whitespace-nowrap">
          Tagline <TbaText text="TBA" className="text-lg sm:text-xl" />
        </p>

        <p className="mun-hero-shadow mt-2 text-[clamp(11px,2.8vw,14px)] uppercase tracking-[0.18em] text-[#cfc8aa] whitespace-nowrap">
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
              className="mun-btn-interactive inline-flex items-center justify-center min-h-[44px] rounded-full bg-[#ede6ca] px-7 py-3 text-sm font-medium text-[#232814] hover:bg-[#cfc8aa] whitespace-nowrap"
            >
              {CONFERENCE_DATA.hero.ctaLabel}
            </a>
          </MagneticWrap>
        </div>
      </div>
    </section>
  );
}
