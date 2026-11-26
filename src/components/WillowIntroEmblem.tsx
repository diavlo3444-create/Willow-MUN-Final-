import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { CONFERENCE_DATA } from '../data/conference';
import {
  WILLOW_EMBLEM_VIEWBOX,
  WILLOW_TREE_PATH_D,
  WILLOW_WREATH_PATH_D,
} from '../utils/willowBackgroundSvg';
import {
  INTRO_AUTOPLAY_FALLBACK_MS,
  INTRO_FADE_OUT_MS,
  INTRO_WATCHDOG_TIMEOUT_MS,
  shouldFinishIntroAtTime,
  shouldSkipIntroOnKey,
  shouldSkipIntroOnLoad,
} from '../utils/willowIntro';

export interface WillowIntroEmblemHandle {
  replay: () => void;
}

interface WillowIntroEmblemProps {
  introPlaying: boolean;
  onIntroStateChange: (playing: boolean) => void;
}

/**
 * Full-screen growing Willow emblem video intro (`willow-intro-grow.mp4`):
 * - Compositor-only fade-out (`opacity` transition, zero mix-blend-mode, zero filter)
 * - Seamlessly matches the video's #121605 deep forest canvas across mobile & desktop
 * - Auto-unmounts the video element immediately after fade-out to keep scrolling at 60fps
 * - Skipped on `?autostart=1` or `prefers-reduced-motion: reduce`; supports Skip & Replay intro
 */
export const WillowIntroEmblem = forwardRef<
  WillowIntroEmblemHandle,
  WillowIntroEmblemProps
>(function WillowIntroEmblem({ onIntroStateChange }, ref) {
  const [mounted, setMounted] = useState<boolean>(true);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [showSvgFallback, setShowSvgFallback] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fadeTimerRef = useRef<number>(0);
  const fallbackTimerRef = useRef<number>(0);
  const watchdogTimerRef = useRef<number>(0);
  const rafPlayRef = useRef<number>(0);
  const finishedRef = useRef<boolean>(false);

  const clearTimers = useCallback(() => {
    if (fadeTimerRef.current !== 0) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = 0;
    }
    if (fallbackTimerRef.current !== 0) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = 0;
    }
    if (watchdogTimerRef.current !== 0) {
      window.clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = 0;
    }
    if (rafPlayRef.current !== 0) {
      window.cancelAnimationFrame(rafPlayRef.current);
      rafPlayRef.current = 0;
    }
  }, []);

  const finishIntro = useCallback(
    (immediate = false) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearTimers();

      document.body.classList.remove('intro-on');
      onIntroStateChange(false);

      if (immediate) {
        setIsActive(false);
        setMounted(false);
        return;
      }

      setIsActive(false);
      fadeTimerRef.current = window.setTimeout(() => {
        fadeTimerRef.current = 0;
        if (videoRef.current) {
          videoRef.current.pause();
        }
        setMounted(false);
      }, INTRO_FADE_OUT_MS + 40);
    },
    [clearTimers, onIntroStateChange],
  );

  const playIntroVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    try {
      video.currentTime = 0;
    } catch {
      // Ignore seek error before metadata loads
    }

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        if (finishedRef.current) return;
        setShowSvgFallback(true);
        fallbackTimerRef.current = window.setTimeout(() => {
          fallbackTimerRef.current = 0;
          finishIntro();
        }, INTRO_AUTOPLAY_FALLBACK_MS);
      });
    }
  }, [finishIntro]);

  const startIntro = useCallback(
    (isReplay: boolean) => {
      clearTimers();
      finishedRef.current = false;
      setShowSvgFallback(false);
      setMounted(true);
      setIsActive(true);
      onIntroStateChange(true);
      document.body.classList.add('intro-on');

      const docEl = document.documentElement;
      const prevScrollBehavior = docEl.style.scrollBehavior;
      docEl.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      docEl.style.scrollBehavior = prevScrollBehavior;

      watchdogTimerRef.current = window.setTimeout(() => {
        watchdogTimerRef.current = 0;
        finishIntro();
      }, INTRO_WATCHDOG_TIMEOUT_MS);

      const startDelay = isReplay ? 60 : 0;
      if (startDelay === 0) {
        rafPlayRef.current = window.requestAnimationFrame(() => {
          rafPlayRef.current = 0;
          playIntroVideo();
        });
      } else {
        fallbackTimerRef.current = window.setTimeout(() => {
          fallbackTimerRef.current = 0;
          playIntroVideo();
        }, startDelay);
      }
    },
    [clearTimers, finishIntro, onIntroStateChange, playIntroVideo],
  );

  useImperativeHandle(
    ref,
    () => ({
      replay: () => {
        startIntro(true);
      },
    }),
    [startIntro],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!finishedRef.current && shouldSkipIntroOnKey(event.key)) {
        event.preventDefault();
        finishIntro();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const skipImmediately = shouldSkipIntroOnLoad({
      search: window.location.search,
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)')
        .matches,
    });

    if (skipImmediately) {
      finishedRef.current = false;
      finishIntro(true);
    } else {
      startIntro(false);
    }

    return () => {
      clearTimers();
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [clearTimers, finishIntro, startIntro]);

  if (!mounted) return null;

  return (
    <div
      id="intro"
      onClick={() => finishIntro()}
      className={`willow-intro-backdrop ${isActive ? 'is-active' : ''} fixed inset-0 z-50 flex items-center justify-center bg-[#121605]`}
    >
      {!showSvgFallback ? (
        <video
          ref={videoRef}
          src={CONFERENCE_DATA.brand.introVideoSrc}
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          onTimeUpdate={(event) => {
            const vid = event.currentTarget;
            if (
              shouldFinishIntroAtTime({
                currentTime: vid.currentTime,
                duration: vid.duration,
                alreadyFinished: finishedRef.current,
              })
            ) {
              finishIntro();
            }
          }}
          onEnded={() => finishIntro()}
          onError={() => {
            if (finishedRef.current) return;
            setShowSvgFallback(true);
            clearTimers();
            fallbackTimerRef.current = window.setTimeout(() => {
              fallbackTimerRef.current = 0;
              finishIntro();
            }, INTRO_AUTOPLAY_FALLBACK_MS);
          }}
          className="pointer-events-none h-full w-full object-contain md:object-cover"
        />
      ) : (
        <div className="pointer-events-none flex flex-col items-center px-6 text-center">
          <div className="willow-intro-emblem-reveal h-[min(58vw,340px)] w-[min(68vw,400px)]">
            <svg
              viewBox={WILLOW_EMBLEM_VIEWBOX}
              aria-hidden="true"
              className="h-full w-full"
              fill="#ece5c8"
              fillRule="evenodd"
            >
              <path d={WILLOW_WREATH_PATH_D} />
              <path d={WILLOW_TREE_PATH_D} />
            </svg>
          </div>
          <p className="mt-4 font-serif text-xl tracking-[0.14em] text-[#ede6ca]">
            WILLOW MUN
          </p>
        </div>
      )}

      <button
        id="introSkip"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          finishIntro();
        }}
      >
        Skip
      </button>
    </div>
  );
});
