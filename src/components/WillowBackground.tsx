import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useResponsiveVideoSources } from '../utils/responsiveVideo';
import {
  computeScrollMetrics,
  HERO_SCRIM_OPACITY,
  VIDEO_BASE_SCALE,
} from '../utils/videoPlayback';

interface WillowBackgroundProps {
  hasAnnouncementBar?: boolean;
  introPlaying?: boolean;
}

const LOOP_SKIP_START_SEC = 0.7;
const CROSSFADE_SEC = 1.0;
const REDUCED_MOTION_STILL_SEC = 1.5;

/**
 * Responsive full-screen looping background video using two stacked alternating <video> slots:
 * - Portrait mobile uses dedicated 9:16 composed video & poster (`willow-loop-mobile.mp4`)
 * - Desktop & tablet retain original widescreen video & poster
 * - Switching happens via React `src` so only the active viewport asset is downloaded
 * - Preserves seamless 0.7s crossfade loop, scroll-driven overlay readability scrim, and pause/reduced-motion controls
 */
export function WillowBackground(_props: WillowBackgroundProps) {
  const { isMobilePortrait, loopVideoSrc, posterSrc } = useResponsiveVideoSources();

  const videoRefs = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([
    null,
    null,
  ]);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const activeSlotRef = useRef<0 | 1>(0);
  const crossfadingRef = useRef<boolean>(false);
  const crossfadeTimerRef = useRef<number | null>(null);
  const rafCheckRef = useRef<number>(0);

  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [incomingSlot, setIncomingSlot] = useState<0 | 1 | null>(null);
  const [incomingVisible, setIncomingVisible] = useState<boolean>(false);
  const scrollScaleRef = useRef<number>(VIDEO_BASE_SCALE);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [isTabHidden, setIsTabHidden] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.hidden;
  });

  const clearCrossfadeTimer = useCallback(() => {
    if (crossfadeTimerRef.current !== null) {
      window.clearTimeout(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
    if (rafCheckRef.current !== 0) {
      window.cancelAnimationFrame(rafCheckRef.current);
      rafCheckRef.current = 0;
    }
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      setIsTabHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const shouldPlay = !prefersReducedMotion && !isTabHidden;

  // Scroll-controlled scrim readability depth & restrained scale (direct compositor DOM writes in rAF)
  useEffect(() => {
    let rafId = 0;

    const updateScrollBackdrop = () => {
      rafId = 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const vh = window.innerHeight || 1;
      const docH = document.documentElement.scrollHeight || vh;
      const metrics = computeScrollMetrics(scrollY, vh, docH);

      if (scrimRef.current) {
        scrimRef.current.style.opacity = String(metrics.scrimOpacity);
      }

      const maxScaleDelta = isMobilePortrait ? 0.025 : 0.06;
      const clamped = prefersReducedMotion
        ? VIDEO_BASE_SCALE
        : Number((VIDEO_BASE_SCALE + metrics.progress * maxScaleDelta).toFixed(4));
      scrollScaleRef.current = clamped;

      for (const vid of videoRefs.current) {
        if (vid) {
          vid.style.transform = `translate3d(0, 0, 0) scale(${clamped})`;
        }
      }
    };

    const onScrollOrResize = () => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(updateScrollBackdrop);
    };

    updateScrollBackdrop();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    return () => {
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [isMobilePortrait, prefersReducedMotion]);

  // Complete crossfade handoff cleanly
  const finishCrossfade = useCallback((nextSlot: 0 | 1) => {
    const prevSlot: 0 | 1 = nextSlot === 0 ? 1 : 0;
    const prevVideo = videoRefs.current[prevSlot];

    if (prevVideo) {
      prevVideo.pause();
      if (prevVideo.readyState >= 1) {
        try {
          prevVideo.currentTime = LOOP_SKIP_START_SEC;
        } catch {
          // Ignore seek errors before metadata is ready
        }
      }
    }

    activeSlotRef.current = nextSlot;
    crossfadingRef.current = false;
    setActiveSlot(nextSlot);
    setIncomingSlot(null);
    setIncomingVisible(false);
  }, []);

  // Begin crossfade from current activeSlot to the alternate slot at currentTime = 0.7
  const beginCrossfade = useCallback(() => {
    if (crossfadingRef.current || !shouldPlay) return;

    const currentSlot = activeSlotRef.current;
    const nextSlot: 0 | 1 = currentSlot === 0 ? 1 : 0;
    const nextVideo = videoRefs.current[nextSlot];
    if (!nextVideo) return;

    crossfadingRef.current = true;
    clearCrossfadeTimer();

    nextVideo.muted = true;
    nextVideo.defaultMuted = true;
    try {
      nextVideo.currentTime = LOOP_SKIP_START_SEC;
    } catch {
      // Ignore seek error if metadata isn't ready
    }

    const playPromise = nextVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }

    setIncomingSlot(nextSlot);
    setIncomingVisible(false);

    rafCheckRef.current = window.requestAnimationFrame(() => {
      rafCheckRef.current = 0;
      setIncomingVisible(true);
    });

    crossfadeTimerRef.current = window.setTimeout(() => {
      crossfadeTimerRef.current = null;
      finishCrossfade(nextSlot);
    }, CROSSFADE_SEC * 1000);
  }, [clearCrossfadeTimer, finishCrossfade, shouldPlay]);

  // Re-initialize active video cleanly if source changes between mobile portrait and desktop
  useEffect(() => {
    clearCrossfadeTimer();
    crossfadingRef.current = false;
    setIncomingSlot(null);
    setIncomingVisible(false);

    const activeVideo = videoRefs.current[activeSlotRef.current];
    if (activeVideo) {
      activeVideo.load();
      if (shouldPlay) {
        activeVideo.muted = true;
        activeVideo.defaultMuted = true;
        activeVideo.play().catch(() => {});
      }
    }
    const standbyVideo = videoRefs.current[activeSlotRef.current === 0 ? 1 : 0];
    if (standbyVideo) {
      standbyVideo.load();
    }
  }, [loopVideoSrc, clearCrossfadeTimer, shouldPlay]);

  // Monitor playback progress and start next video ~1s before current one ends
  useEffect(() => {
    const v0 = videoRefs.current[0];
    const v1 = videoRefs.current[1];

    const onLoadedMetadata = (slot: 0 | 1) => {
      const video = videoRefs.current[slot];
      if (!video) return;

      if (prefersReducedMotion && slot === activeSlotRef.current) {
        video.pause();
        try {
          video.currentTime = REDUCED_MOTION_STILL_SEC;
        } catch {
          // Ignore
        }
        return;
      }

      if (slot !== activeSlotRef.current && !crossfadingRef.current) {
        try {
          video.currentTime = LOOP_SKIP_START_SEC;
        } catch {
          // Ignore
        }
      }
    };

    const onTimeUpdate = (slot: 0 | 1) => {
      if (!shouldPlay || slot !== activeSlotRef.current || crossfadingRef.current) return;
      const video = videoRefs.current[slot];
      if (!video || !Number.isFinite(video.duration) || video.duration <= 2.2) return;

      const remaining = video.duration - video.currentTime;
      if (remaining <= CROSSFADE_SEC + 0.06) {
        beginCrossfade();
      }
    };

    const onEnded = (slot: 0 | 1) => {
      if (!shouldPlay || slot !== activeSlotRef.current) return;
      if (!crossfadingRef.current) {
        beginCrossfade();
      }
    };

    const handleMeta0 = () => onLoadedMetadata(0);
    const handleMeta1 = () => onLoadedMetadata(1);
    const handleTime0 = () => onTimeUpdate(0);
    const handleTime1 = () => onTimeUpdate(1);
    const handleEnd0 = () => onEnded(0);
    const handleEnd1 = () => onEnded(1);

    if (v0) {
      v0.addEventListener('loadedmetadata', handleMeta0);
      v0.addEventListener('timeupdate', handleTime0);
      v0.addEventListener('ended', handleEnd0);
    }
    if (v1) {
      v1.addEventListener('loadedmetadata', handleMeta1);
      v1.addEventListener('timeupdate', handleTime1);
      v1.addEventListener('ended', handleEnd1);
    }

    return () => {
      if (v0) {
        v0.removeEventListener('loadedmetadata', handleMeta0);
        v0.removeEventListener('timeupdate', handleTime0);
        v0.removeEventListener('ended', handleEnd0);
      }
      if (v1) {
        v1.removeEventListener('loadedmetadata', handleMeta1);
        v1.removeEventListener('timeupdate', handleTime1);
        v1.removeEventListener('ended', handleEnd1);
      }
    };
  }, [beginCrossfade, prefersReducedMotion, shouldPlay]);

  // Play, pause, tab-visibility, and reduced-motion enforcement
  useEffect(() => {
    const v0 = videoRefs.current[0];
    const v1 = videoRefs.current[1];

    if (prefersReducedMotion) {
      clearCrossfadeTimer();
      crossfadingRef.current = false;
      setIncomingSlot(null);
      setIncomingVisible(false);

      [v0, v1].forEach((video, idx) => {
        if (!video) return;
        video.pause();
        if (idx === activeSlotRef.current && video.readyState >= 1) {
          try {
            video.currentTime = REDUCED_MOTION_STILL_SEC;
          } catch {
            // Ignore
          }
        }
      });
      return;
    }

    if (!shouldPlay) {
      if (crossfadingRef.current) {
        clearCrossfadeTimer();
        const target = incomingSlot ?? activeSlotRef.current;
        finishCrossfade(target);
      }
      v0?.pause();
      v1?.pause();
      return;
    }

    const activeVideo = videoRefs.current[activeSlotRef.current];
    if (activeVideo) {
      activeVideo.muted = true;
      activeVideo.defaultMuted = true;
      if (
        Number.isFinite(activeVideo.duration) &&
        activeVideo.duration > 2.2 &&
        activeVideo.currentTime >= activeVideo.duration - 0.15
      ) {
        try {
          activeVideo.currentTime = LOOP_SKIP_START_SEC;
        } catch {
          // Ignore
        }
      }
      const playPromise = activeVideo.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    }
  }, [
    clearCrossfadeTimer,
    finishCrossfade,
    incomingSlot,
    prefersReducedMotion,
    shouldPlay,
  ]);

  useEffect(() => {
    return () => clearCrossfadeTimer();
  }, [clearCrossfadeTimer]);

  const getSlotStyle = (slot: 0 | 1): CSSProperties => {
    const isActive = activeSlot === slot;
    const isIncoming = incomingSlot === slot;

    let opacity = 0;
    let zIndex = -2;
    let transition = 'none';

    if (isIncoming) {
      opacity = incomingVisible ? 1 : 0;
      zIndex = -1;
      transition = `opacity ${CROSSFADE_SEC}s ease-in-out`;
    } else if (isActive) {
      opacity = 1;
      zIndex = -2;
      transition = 'none';
    }

    return {
      position: 'fixed',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: isMobilePortrait ? '50% 18%' : '50% 45%',
      transform: `translate3d(0, 0, 0) scale(${scrollScaleRef.current})`,
      transformOrigin: isMobilePortrait ? '50% 34%' : '50% 48%',
      zIndex,
      pointerEvents: 'none',
      opacity,
      transition,
    };
  };

  return (
    <>
      {/* Fixed base olive canvas matching video edge luminance across all aspect ratios */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#393f24',
          zIndex: -3,
          pointerEvents: 'none',
        }}
      />

      {([0, 1] as const).map((slot) => (
        <video
          key={slot}
          ref={(el) => {
            videoRefs.current[slot] = el;
          }}
          src={loopVideoSrc}
          poster={posterSrc}
          autoPlay={!prefersReducedMotion && slot === 0}
          muted
          playsInline
          preload={slot === 0 ? 'auto' : 'metadata'}
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          style={getSlotStyle(slot)}
        />
      ))}

      {/* Scroll-controlled readability veil: gentler over Hero canopy, deeper through editorial sections */}
      <div
        ref={scrimRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          backgroundColor: '#14180a',
          opacity: HERO_SCRIM_OPACITY,
          zIndex: -1,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
