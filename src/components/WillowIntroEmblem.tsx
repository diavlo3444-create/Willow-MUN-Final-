import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { useResponsiveVideoSources } from '../utils/responsiveVideo';

const INTRO_TRANSITION_TIME_S = 7.9;
const INTRO_TREE_BLEND_START_S = 7.7;
const INTRO_FALLBACK_TIMEOUT_MS = 12000;
const INTRO_WATERMARK_FALLBACK_DURATION_S = 8.4;
const REPLAY_FADE_OUT_MS = 560;

export interface WillowIntroEmblemHandle {
  replay: () => void;
}

interface WillowIntroEmblemProps {
  introPlaying: boolean;
  onIntroStateChange: (playing: boolean) => void;
}

/**
 * Full-bleed intro <video> (desktop widescreen vs dedicated portrait mobile asset) with mix-blend-mode: screen:
 * - Plays at full opacity (scale 1, z-index 50) over the olive backdrop
 * - At 7.9s (or on Skip), smoothly dissolves into the background loop video
 *   while revealing the conference frontispiece
 */
export const WillowIntroEmblem = forwardRef<WillowIntroEmblemHandle, WillowIntroEmblemProps>(
  function WillowIntroEmblem({ introPlaying, onIntroStateChange }, ref) {
    const { isMobilePortrait, introVideoSrc } = useResponsiveVideoSources();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const rafIdRef = useRef<number>(0);
    const fallbackTimerRef = useRef<number>(0);
    const replayTimerRef = useRef<number>(0);
    const finishedRef = useRef<boolean>(false);
    const pendingWatermarkSeekRef = useRef<boolean>(false);

    const clearTimers = useCallback(() => {
      if (rafIdRef.current !== 0) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
      if (fallbackTimerRef.current !== 0) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = 0;
      }
      if (replayTimerRef.current !== 0) {
        window.clearTimeout(replayTimerRef.current);
        replayTimerRef.current = 0;
      }
    }, []);

    const seekToWatermarkFrame = useCallback((video: HTMLVideoElement) => {
      const duration =
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : INTRO_WATERMARK_FALLBACK_DURATION_S;
      const targetTime = Math.max(INTRO_TRANSITION_TIME_S, duration - 0.05);

      video.pause();
      if (video.readyState >= 1) {
        try {
          video.currentTime = targetTime;
          pendingWatermarkSeekRef.current = false;
        } catch {
          pendingWatermarkSeekRef.current = true;
        }
      } else {
        pendingWatermarkSeekRef.current = true;
      }
    }, []);

    const finishIntro = useCallback(
      (options?: { seekToEnd?: boolean }) => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        clearTimers();

        document.body.classList.add('intro-transitioning');
        window.setTimeout(() => {
          document.body.classList.remove('intro-transitioning');
        }, 2200);

        const video = videoRef.current;
        if (video) {
          if (options?.seekToEnd) {
            seekToWatermarkFrame(video);
          } else {
            window.setTimeout(() => {
              if (finishedRef.current && videoRef.current) {
                videoRef.current.pause();
              }
            }, 1850);
          }
        }

        document.body.classList.remove('intro-on');
        onIntroStateChange(false);
      },
      [clearTimers, onIntroStateChange, seekToWatermarkFrame],
    );

    const beginVideoPlayback = useCallback(() => {
      const video = videoRef.current;
      if (video) {
        video.muted = true;
        video.defaultMuted = true;
        try {
          video.currentTime = 0;
        } catch {
          // Ignore seek error prior to metadata
        }
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Autoplay fallback timer/user click will handle transition if blocked
          });
        }
      }

      const checkPlayback = () => {
        if (document.hidden) {
          rafIdRef.current = 0;
          return;
        }
        if (finishedRef.current) return;
        const currentVideo = videoRef.current;
        if (currentVideo && currentVideo.currentTime >= INTRO_TREE_BLEND_START_S) {
          document.body.classList.add('intro-transitioning');
        }
        if (currentVideo && currentVideo.currentTime >= INTRO_TRANSITION_TIME_S) {
          rafIdRef.current = 0;
          finishIntro();
          return;
        }
        rafIdRef.current = window.requestAnimationFrame(checkPlayback);
      };

      rafIdRef.current = window.requestAnimationFrame(checkPlayback);
      fallbackTimerRef.current = window.setTimeout(() => {
        finishIntro();
      }, INTRO_FALLBACK_TIMEOUT_MS);
    }, [finishIntro]);

    const startIntro = useCallback(
      (isReplay: boolean) => {
        clearTimers();
        finishedRef.current = false;
        pendingWatermarkSeekRef.current = false;
        onIntroStateChange(true);

        document.body.classList.remove('intro-transitioning');
        document.body.classList.add('intro-on');

        if (!isReplay) {
          const docEl = document.documentElement;
          const prevScrollBehavior = docEl.style.scrollBehavior;
          docEl.style.scrollBehavior = 'auto';
          window.scrollTo(0, 0);
          docEl.style.scrollBehavior = prevScrollBehavior;

          beginVideoPlayback();
          return;
        }

        // Smooth replay: let text fade out & intro dissolve back in before resetting scroll & playing from 0
        replayTimerRef.current = window.setTimeout(() => {
          replayTimerRef.current = 0;
          if (finishedRef.current) return;

          const docEl = document.documentElement;
          const prevScrollBehavior = docEl.style.scrollBehavior;
          docEl.style.scrollBehavior = 'auto';
          window.scrollTo(0, 0);
          docEl.style.scrollBehavior = prevScrollBehavior;

          beginVideoPlayback();
        }, REPLAY_FADE_OUT_MS);
      },
      [beginVideoPlayback, clearTimers, onIntroStateChange],
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
      const video = videoRef.current;

      const handleLoadedMetadata = () => {
        if (!video) return;
        if (pendingWatermarkSeekRef.current) {
          seekToWatermarkFrame(video);
        }
      };

      const handleCanPlay = () => {
        if (!video || finishedRef.current || replayTimerRef.current !== 0 || !video.paused) {
          return;
        }
        video.muted = true;
        video.play().catch(() => {});
      };

      const handleTimeUpdate = () => {
        if (!video || finishedRef.current || replayTimerRef.current !== 0) return;
        if (video.currentTime >= INTRO_TREE_BLEND_START_S) {
          document.body.classList.add('intro-transitioning');
        }
        if (video.currentTime >= INTRO_TRANSITION_TIME_S) {
          finishIntro();
        }
      };

      const handleEnded = () => {
        if (!finishedRef.current && replayTimerRef.current === 0) {
          finishIntro();
        }
      };

      const handleError = () => {
        finishIntro();
      };

      if (video) {
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('error', handleError);
      }

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

      const onVisibilityChange = () => {
        if (document.hidden || finishedRef.current || replayTimerRef.current !== 0) return;
        if (video && video.currentTime >= INTRO_TRANSITION_TIME_S) {
          finishIntro();
          return;
        }
        if (video && video.paused) {
          video.muted = true;
          video.play().catch(() => {});
        }
        if (rafIdRef.current === 0) {
          const resumeCheck = () => {
            if (document.hidden) {
              rafIdRef.current = 0;
              return;
            }
            if (finishedRef.current) return;
            const currentVideo = videoRef.current;
            if (currentVideo && currentVideo.currentTime >= INTRO_TREE_BLEND_START_S) {
              document.body.classList.add('intro-transitioning');
            }
            if (currentVideo && currentVideo.currentTime >= INTRO_TRANSITION_TIME_S) {
              rafIdRef.current = 0;
              finishIntro();
              return;
            }
            rafIdRef.current = window.requestAnimationFrame(resumeCheck);
          };
          rafIdRef.current = window.requestAnimationFrame(resumeCheck);
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);

      const isAutostart =
        new URLSearchParams(window.location.search).get('autostart') === '1';

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || isAutostart) {
        finishedRef.current = false;
        finishIntro({ seekToEnd: true });
      } else {
        startIntro(false);
      }

      return () => {
        clearTimers();
        if (video) {
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
          video.removeEventListener('canplay', handleCanPlay);
          video.removeEventListener('timeupdate', handleTimeUpdate);
          video.removeEventListener('ended', handleEnded);
          video.removeEventListener('error', handleError);
        }
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };
    }, [clearTimers, finishIntro, seekToWatermarkFrame, startIntro]);

    return (
      <>
        {/* Olive gradient backdrop during the intro (cross-dissolves into #bgVideo + scrim at handoff) */}
        <div className="willow-intro-backdrop" aria-hidden="true" />

        {/* Full-bleed seamless <video> with mix-blend-mode: screen */}
        <video
          ref={videoRef}
          src={introVideoSrc}
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          style={{
            objectPosition: isMobilePortrait ? '50% 18%' : '50% 45%',
          }}
          className="willow-intro-video select-none"
        />

        {/* Click/Skip interaction layer active only while intro is playing */}
        <div
          id="intro"
          aria-hidden={!introPlaying}
          onClick={introPlaying ? () => finishIntro() : undefined}
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
