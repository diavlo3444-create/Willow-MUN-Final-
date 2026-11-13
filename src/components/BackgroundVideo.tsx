import { useEffect, useRef, useState } from 'react';
import { CONFERENCE_DATA } from '../data/conference';
import {
  HERO_SCRIM_OPACITY,
  computeOverlayOpacity,
  getInitialVideoPaused,
  shouldRetryAutoplay,
} from '../utils/videoPlayback';

/**
 * Fixed full-viewport background video with:
 * - autoplay, muted, loop, playsinline, preload="auto", poster frame, and zero controls
 * - automatic retry on first user interaction and when the tab becomes visible
 * - prefers-reduced-motion support (starts paused on the poster frame)
 * - scroll-responsive scrim (light in the hero, darker once scrolled past the hero)
 * - bottom-right Pause/Play background toggle for accessibility
 */
export function BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const pausedByUserRef = useRef(false);
  const reducedMotionRef = useRef(false);

  const [isPaused, setIsPaused] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return getInitialVideoPaused(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  });

  // Scroll-responsive scrim darkening: stays light over the hero so the video logo is clear.
  useEffect(() => {
    const updateScrim = () => {
      if (!overlayRef.current) return;
      const opacity = computeOverlayOpacity(window.scrollY, window.innerHeight);
      overlayRef.current.style.opacity = String(opacity);
    };

    updateScrim();
    window.addEventListener('scroll', updateScrim, { passive: true });
    window.addEventListener('resize', updateScrim, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateScrim);
      window.removeEventListener('resize', updateScrim);
    };
  }, []);

  // Video autoplay management, reduced-motion handling, and interaction/visibility retries.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mediaQuery.matches;

    const attemptPlay = () => {
      const target = videoRef.current;
      if (!target) return;
      target.muted = true;
      const playPromise = target.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPaused(false);
          })
          .catch(() => {
            setIsPaused(true);
          });
      }
    };

    if (getInitialVideoPaused(mediaQuery.matches)) {
      video.pause();
      setIsPaused(true);
    } else {
      attemptPlay();
    }

    const onVideoPlay = () => setIsPaused(false);
    const onVideoPause = () => setIsPaused(true);

    video.addEventListener('play', onVideoPlay);
    video.addEventListener('pause', onVideoPause);

    const retryIfNeeded = () => {
      const target = videoRef.current;
      if (!target) return;
      if (
        shouldRetryAutoplay({
          pausedByUser: pausedByUserRef.current,
          prefersReducedMotion: reducedMotionRef.current,
          isVideoPaused: target.paused,
          isDocumentHidden: document.hidden,
        })
      ) {
        attemptPlay();
      }
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        retryIfNeeded();
      }
    };

    const onMotionPrefChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
      if (event.matches && !pausedByUserRef.current) {
        video.pause();
        setIsPaused(true);
      } else if (!event.matches && !pausedByUserRef.current && video.paused) {
        attemptPlay();
      }
    };

    window.addEventListener('click', retryIfNeeded, { passive: true });
    window.addEventListener('touchstart', retryIfNeeded, { passive: true });
    window.addEventListener('scroll', retryIfNeeded, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    mediaQuery.addEventListener('change', onMotionPrefChange);

    return () => {
      video.removeEventListener('play', onVideoPlay);
      video.removeEventListener('pause', onVideoPause);
      window.removeEventListener('click', retryIfNeeded);
      window.removeEventListener('touchstart', retryIfNeeded);
      window.removeEventListener('scroll', retryIfNeeded);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      mediaQuery.removeEventListener('change', onMotionPrefChange);
    };
  }, []);

  const handleTogglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      pausedByUserRef.current = false;
      video.muted = true;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPaused(false))
          .catch(() => setIsPaused(true));
      } else {
        setIsPaused(false);
      }
    } else {
      pausedByUserRef.current = true;
      video.pause();
      setIsPaused(true);
    }
  };

  return (
    <>
      <video
        ref={videoRef}
        className="fixed inset-0 z-0 h-full w-full object-cover pointer-events-none select-none"
        src={CONFERENCE_DATA.brand.videoSrc}
        poster={CONFERENCE_DATA.brand.posterSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
        disablePictureInPicture
      />

      <div
        ref={overlayRef}
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-[#232814] pointer-events-none transition-opacity duration-300"
        style={{ opacity: HERO_SCRIM_OPACITY }}
      />

      <button
        type="button"
        onClick={handleTogglePlayback}
        aria-pressed={isPaused}
        className="fixed z-40 bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] min-h-[40px] px-3 py-1.5 rounded-sm bg-[#1e2311]/90 border border-[#ede6ca]/25 text-[11px] sm:text-xs font-medium text-[#ede6ca] hover:bg-[#232814] hover:border-[#ede6ca]/50 transition-colors backdrop-blur-sm cursor-pointer whitespace-nowrap"
      >
        {isPaused ? 'Play background' : 'Pause background'}
      </button>
    </>
  );
}
