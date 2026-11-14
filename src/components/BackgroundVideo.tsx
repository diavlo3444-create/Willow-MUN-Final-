import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { CONFERENCE_DATA } from '../data/conference';
import {
  HERO_SCRIM_OPACITY,
  computeScrollMetrics,
  shouldRetryAutoplay,
} from '../utils/videoPlayback';

interface BackgroundVideoProps {
  hasAnnouncementBar: boolean;
  introPlaying: boolean;
}

/**
 * Fixed full-viewport background video (100vw x 100dvh, object-fit: cover, z-index: -2):
 * - Kept paused at currentTime = 0 behind #intro until finish() starts playback
 * - Readability overlay (#14180a, z-index: -1) sits at a constant 0.40 opacity from first paint
 *   (including during the intro) and only changes via scroll progress (0.40 -> 0.75) after intro ends
 * - 40px round icon-only play/pause button fixed bottom-right
 */
export function BackgroundVideo({
  hasAnnouncementBar,
  introPlaying,
}: BackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pausedByUserRef = useRef(false);
  const introPlayingRef = useRef(introPlaying);
  introPlayingRef.current = introPlaying;

  const [isPaused, setIsPaused] = useState(true);

  // Reset scroll metrics & user-pause state whenever the intro starts or replays
  useEffect(() => {
    if (!introPlaying) return;
    pausedByUserRef.current = false;
    const docEl = document.documentElement;
    docEl.style.setProperty('--scroll-progress', '0');
    docEl.style.setProperty('--scrim-opacity', String(HERO_SCRIM_OPACITY));
    docEl.style.setProperty('--video-scale', '1');
  }, [introPlaying]);

  // Shared single requestAnimationFrame scroll loop (does not run while intro is playing)
  useEffect(() => {
    if (introPlaying) return;
    let rafId = 0;

    const applyScrollMetrics = () => {
      rafId = 0;
      if (introPlayingRef.current || document.body.classList.contains('intro-on')) return;
      const docEl = document.documentElement;
      const { progress, videoScale, scrimOpacity } = computeScrollMetrics(
        window.scrollY,
        window.innerHeight,
        docEl.scrollHeight,
      );

      docEl.style.setProperty('--scroll-progress', String(progress));
      docEl.style.setProperty('--scrim-opacity', String(scrimOpacity));
      docEl.style.setProperty('--video-scale', String(videoScale));
    };

    const scheduleUpdate = () => {
      if (rafId !== 0 || introPlayingRef.current) return;
      rafId = window.requestAnimationFrame(applyScrollMetrics);
    };

    applyScrollMetrics();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });

    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [introPlaying]);

  // Sync play/pause UI state and post-intro autoplay recovery
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    setIsPaused(video.paused);

    const onVideoPlay = () => setIsPaused(false);
    const onVideoPause = () => setIsPaused(true);

    video.addEventListener('play', onVideoPlay);
    video.addEventListener('pause', onVideoPause);

    const retryIfNeeded = () => {
      if (introPlayingRef.current || document.body.classList.contains('intro-on')) return;
      const target = videoRef.current;
      if (!target) return;
      if (
        shouldRetryAutoplay({
          pausedByUser: pausedByUserRef.current,
          isVideoPaused: target.paused,
          isDocumentHidden: document.hidden,
        })
      ) {
        target.muted = true;
        const p = target.play();
        if (p !== undefined) {
          p.then(() => setIsPaused(false)).catch(() => setIsPaused(true));
        }
      }
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        retryIfNeeded();
      }
    };

    window.addEventListener('click', retryIfNeeded, { passive: true });
    window.addEventListener('touchstart', retryIfNeeded, { passive: true });
    window.addEventListener('scroll', retryIfNeeded, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      video.removeEventListener('play', onVideoPlay);
      video.removeEventListener('pause', onVideoPause);
      window.removeEventListener('click', retryIfNeeded);
      window.removeEventListener('touchstart', retryIfNeeded);
      window.removeEventListener('scroll', retryIfNeeded);
      document.removeEventListener('visibilitychange', onVisibilityChange);
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
        id="bgVideo"
        ref={videoRef}
        src={CONFERENCE_DATA.brand.videoSrc}
        poster={CONFERENCE_DATA.brand.posterSrc}
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
        disablePictureInPicture
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100dvh',
          objectFit: 'cover',
          objectPosition: 'center',
          zIndex: -2,
          pointerEvents: 'none',
          userSelect: 'none',
          transform: 'scale(var(--video-scale, 1))',
          transformOrigin: 'center center',
        }}
      />

      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          backgroundColor: '#14180a',
          opacity: `var(--scrim-opacity, ${HERO_SCRIM_OPACITY})`,
          pointerEvents: 'none',
        }}
      />

      <button
        type="button"
        onClick={handleTogglePlayback}
        aria-pressed={isPaused}
        aria-label={isPaused ? 'Play background video' : 'Pause background video'}
        title={isPaused ? 'Play background video' : 'Pause background video'}
        tabIndex={introPlaying ? -1 : 0}
        style={{
          bottom: hasAnnouncementBar
            ? 'max(3.5rem, calc(env(safe-area-inset-bottom) + 3.25rem))'
            : 'max(1rem, env(safe-area-inset-bottom))',
          right: 'max(1rem, env(safe-area-inset-right))',
          opacity: introPlaying ? 0 : 1,
          pointerEvents: introPlaying ? 'none' : 'auto',
          transition: 'opacity 600ms ease',
        }}
        className="mun-btn-interactive fixed z-40 flex h-10 w-10 items-center justify-center rounded-full border border-[#ede6ca]/35 bg-[#181c0d]/92 text-[#ede6ca] hover:border-[#ede6ca]/70 hover:bg-[#232814] cursor-pointer"
      >
        {isPaused ? (
          <Play className="h-4 w-4 translate-x-[1px]" aria-hidden="true" />
        ) : (
          <Pause className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </>
  );
}
