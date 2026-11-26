import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  WILLOW_EMBLEM_VIEWBOX,
  WILLOW_TREE_PATH_D,
  WILLOW_WREATH_PATH_D,
} from '../utils/willowBackgroundSvg';

const INTRO_DURATION_MS = 2200;
const REPLAY_FADE_OUT_MS = 420;

export interface WillowIntroEmblemHandle {
  replay: () => void;
}

interface WillowIntroEmblemProps {
  introPlaying: boolean;
  onIntroStateChange: (playing: boolean) => void;
}

/**
 * Clean compositor-only Willow emblem opening reveal (transform + opacity only):
 * - Zero mix-blend-mode, zero CSS filter, zero video decoding overhead
 * - Skipped immediately on ?autostart=1 or prefers-reduced-motion: reduce
 * - Preserves Skip button & Footer "Replay intro" control
 */
export const WillowIntroEmblem = forwardRef<WillowIntroEmblemHandle, WillowIntroEmblemProps>(
  function WillowIntroEmblem({ introPlaying, onIntroStateChange }, ref) {
    const timerRef = useRef<number>(0);
    const replayTimerRef = useRef<number>(0);
    const finishedRef = useRef<boolean>(false);

    const clearTimers = useCallback(() => {
      if (timerRef.current !== 0) {
        window.clearTimeout(timerRef.current);
        timerRef.current = 0;
      }
      if (replayTimerRef.current !== 0) {
        window.clearTimeout(replayTimerRef.current);
        replayTimerRef.current = 0;
      }
    }, []);

    const finishIntro = useCallback(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearTimers();
      document.body.classList.remove('intro-on');
      onIntroStateChange(false);
    }, [clearTimers, onIntroStateChange]);

    const startIntro = useCallback(
      (isReplay: boolean) => {
        clearTimers();
        finishedRef.current = false;
        onIntroStateChange(true);
        document.body.classList.add('intro-on');

        const launchTimer = () => {
          const docEl = document.documentElement;
          const prevScrollBehavior = docEl.style.scrollBehavior;
          docEl.style.scrollBehavior = 'auto';
          window.scrollTo(0, 0);
          docEl.style.scrollBehavior = prevScrollBehavior;

          timerRef.current = window.setTimeout(() => {
            timerRef.current = 0;
            finishIntro();
          }, INTRO_DURATION_MS);
        };

        if (!isReplay) {
          launchTimer();
          return;
        }

        replayTimerRef.current = window.setTimeout(() => {
          replayTimerRef.current = 0;
          if (!finishedRef.current) launchTimer();
        }, REPLAY_FADE_OUT_MS);
      },
      [clearTimers, finishIntro, onIntroStateChange],
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

      const isAutostart =
        new URLSearchParams(window.location.search).get('autostart') === '1';

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || isAutostart) {
        finishedRef.current = false;
        finishIntro();
      } else {
        startIntro(false);
      }

      return () => {
        clearTimers();
        document.removeEventListener('keydown', onKeyDown);
      };
    }, [clearTimers, finishIntro, startIntro]);

    if (!introPlaying) return null;

    return (
      <div
        id="intro"
        onClick={() => finishIntro()}
        className="willow-intro-backdrop is-active fixed inset-0 z-50 flex items-center justify-center bg-[#393f24]"
      >
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
  },
);
