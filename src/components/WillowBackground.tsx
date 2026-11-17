import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Pause, Play } from 'lucide-react';
import { CONFERENCE_DATA } from '../data/conference';

interface WillowBackgroundProps {
  hasAnnouncementBar: boolean;
  introPlaying: boolean;
  paused: boolean;
  onTogglePause: () => void;
}

const LOOP_SKIP_START_SEC = 0.7;
const CROSSFADE_SEC = 1.0;
const REDUCED_MOTION_STILL_SEC = 1.5;

/**
 * Fixed full-screen looping background video using two stacked alternating <video> elements:
 * - No native `loop` attribute; first play may start at 0s, every subsequent playthrough
 *   starts at currentTime = 0.7s to skip the dim fade-in
 * - Starts incoming video ~1s before outgoing ends and crossfades smoothly over 1s
 * - Dark green overlay rgba(20, 28, 12, 0.55) on top for text readability
 * - Pause/play button, automatic pause when tab is hidden, still frame for prefers-reduced-motion
 */
export function WillowBackground({
  hasAnnouncementBar,
  introPlaying,
  paused,
  onTogglePause,
}: WillowBackgroundProps) {
  const videoRefs = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([
    null,
    null,
  ]);
  const activeSlotRef = useRef<0 | 1>(0);
  const crossfadingRef = useRef<boolean>(false);
  const crossfadeTimerRef = useRef<number | null>(null);
  const rafCheckRef = useRef<number>(0);

  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [incomingSlot, setIncomingSlot] = useState<0 | 1 | null>(null);
  const [incomingVisible, setIncomingVisible] = useState<boolean>(false);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const isUserPaused = paused;
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

  const shouldPlay = !introPlaying && !prefersReducedMotion && !isUserPaused && !isTabHidden;

  // The intro and the page background use the same source video. On handoff,
  // seek the background to the exact intro timestamp so the scene continues.
  useEffect(() => {
    const handleIntroFinished = (event: Event) => {
      const detail = (event as CustomEvent<{ currentTime?: number }>).detail;
      const targetTime = detail?.currentTime;
      const activeVideo = videoRefs.current[activeSlotRef.current];
      if (!activeVideo || !Number.isFinite(targetTime)) return;

      const syncPosition = () => {
        if (!Number.isFinite(activeVideo.duration) || activeVideo.duration <= 0) return;
        try {
          activeVideo.currentTime = Math.min(
            Math.max(0, targetTime as number),
            Math.max(0, activeVideo.duration - 0.08),
          );
        } catch {
          // Ignore a seek that the browser cannot apply yet.
        }
      };

      if (activeVideo.readyState >= 1) syncPosition();
      else activeVideo.addEventListener('loadedmetadata', syncPosition, { once: true });
    };

    window.addEventListener('willow-intro-finished', handleIntroFinished);
    return () => window.removeEventListener('willow-intro-finished', handleIntroFinished);
  }, []);

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

    // Wait one animation frame at opacity: 0 before fading to opacity: 1 over 1s
    rafCheckRef.current = window.requestAnimationFrame(() => {
      rafCheckRef.current = 0;
      setIncomingVisible(true);
    });

    crossfadeTimerRef.current = window.setTimeout(() => {
      crossfadeTimerRef.current = null;
      finishCrossfade(nextSlot);
    }, CROSSFADE_SEC * 1000);
  }, [clearCrossfadeTimer, finishCrossfade, shouldPlay]);

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

      // Pre-position standby slot at 0.7s so restart never shows the dim 0..0.7s fade-in
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
      // Cancel pending mid-crossfade timer cleanly so resuming doesn't jump
      if (crossfadingRef.current) {
        clearCrossfadeTimer();
        const target = incomingSlot ?? activeSlotRef.current;
        finishCrossfade(target);
      }
      v0?.pause();
      v1?.pause();
      return;
    }

    // Resume playback on the active video
    const activeVideo = videoRefs.current[activeSlotRef.current];
    if (activeVideo) {
      activeVideo.muted = true;
      activeVideo.defaultMuted = true;
      // If active video was parked at the end or before 0.7s after a prior cycle, ensure valid position
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

  const handleTogglePause = () => {
    const nextPaused = !isUserPaused;
    onTogglePause();

    if (nextPaused) {
      videoRefs.current[0]?.pause();
      videoRefs.current[1]?.pause();
    } else if (!isTabHidden && !prefersReducedMotion) {
      const activeVideo = videoRefs.current[activeSlotRef.current];
      if (activeVideo) {
        activeVideo.muted = true;
        activeVideo.defaultMuted = true;
        activeVideo.play().catch(() => {});
      }
    }
  };

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
      objectPosition: 'center',
      zIndex,
      pointerEvents: 'none',
      opacity,
      transition,
    };
  };

  return (
    <>
      {([0, 1] as const).map((slot) => (
        <video
          key={slot}
          ref={(el) => {
            videoRefs.current[slot] = el;
          }}
          src={CONFERENCE_DATA.brand.videoSrc}
          poster={CONFERENCE_DATA.brand.posterSrc}
          autoPlay={!introPlaying && !prefersReducedMotion && slot === 0}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          className="willow-background-video"
          style={getSlotStyle(slot)}
        />
      ))}

      {/* Dark green overlay for crisp text legibility */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(20, 28, 12, 0.55)',
          zIndex: -1,
          pointerEvents: 'none',
        }}
      />

      {/* Persistent Pause / Play background video button */}
      {!prefersReducedMotion && (
        <button
          type="button"
          onClick={handleTogglePause}
          aria-pressed={isUserPaused}
          aria-label={isUserPaused ? 'Play background video' : 'Pause background video'}
          title={isUserPaused ? 'Play background video' : 'Pause background video'}
          tabIndex={introPlaying ? -1 : 0}
          style={{
            bottom: hasAnnouncementBar
              ? 'max(4rem, calc(env(safe-area-inset-bottom) + 4rem))'
              : 'max(1rem, env(safe-area-inset-bottom))',
            right: 'max(1rem, env(safe-area-inset-right))',
            opacity: introPlaying ? 0 : 1,
            pointerEvents: introPlaying ? 'none' : 'auto',
            transition: 'opacity 300ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="mun-btn-interactive fixed z-40 flex h-10 w-10 items-center justify-center rounded-full border border-[#ede6ca]/35 bg-[#181c0d]/92 text-[#ede6ca] hover:bg-[#232814] cursor-pointer"
        >
          {isUserPaused ? (
            <Play className="h-4 w-4 translate-x-[1px]" aria-hidden="true" />
          ) : (
            <Pause className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      )}
    </>
  );
}
