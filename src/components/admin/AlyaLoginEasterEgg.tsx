import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowRight, X } from 'lucide-react';
import type { AdminUser } from '../../types/admin';
import {
  ALYA_DIALOGUE_BEATS,
  ALYA_EASTER_EGG_IMAGE_URL,
  type AlyaBeatMood,
} from '../../utils/alyaEasterEgg';

interface AlyaLoginEasterEggProps {
  user: AdminUser;
  onComplete: () => void;
}

const MOOD_MOTION: Record<
  AlyaBeatMood,
  { rotate: number | number[]; y: number | number[]; scale: number | number[] }
> = {
  peek: { rotate: [0, -2, 0], y: [8, 0], scale: [0.94, 1] },
  nervous: { rotate: [0, -2.5, 2.2, -1.5, 0], y: [0, -3, 0], scale: 1 },
  flustered: { rotate: [0, 3, -3, 2, 0], y: [0, 3, -2, 0], scale: [1, 1.02, 0.99, 1] },
  shy: { rotate: [0, -1.5, 1.5, 0], y: [0, -4, 0], scale: [1, 1.015, 1] },
};

const ALYA_LEAF_PARTICLES = [
  { x: -116, y: -36, rotate: -34, delay: 0.08 },
  { x: 108, y: -62, rotate: 48, delay: 0.22 },
  { x: -140, y: 58, rotate: 22, delay: 0.36 },
  { x: 134, y: 38, rotate: -52, delay: 0.5 },
  { x: 4, y: -142, rotate: 16, delay: 0.64 },
];

export function AlyaLoginEasterEgg({ user, onComplete }: AlyaLoginEasterEggProps) {
  const prefersReducedMotion = useReducedMotion();
  const [beatIndex, setBeatIndex] = useState(0);
  const [typedCount, setTypedCount] = useState(0);
  const [allComplete, setAllComplete] = useState(false);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finishedRef = useRef(false);
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCompleteRef.current();
  }, []);

  const currentBeat = ALYA_DIALOGUE_BEATS[beatIndex] ?? ALYA_DIALOGUE_BEATS[ALYA_DIALOGUE_BEATS.length - 1];
  const isFinalBeat = beatIndex >= ALYA_DIALOGUE_BEATS.length - 1;
  const fullCurrentText = currentBeat.text;
  const isCurrentBeatFullyTyped = typedCount >= fullCurrentText.length;

  // Initial reveal or immediate full render under reduced motion
  useEffect(() => {
    if (prefersReducedMotion) {
      setBeatIndex(ALYA_DIALOGUE_BEATS.length - 1);
      setTypedCount(ALYA_DIALOGUE_BEATS[ALYA_DIALOGUE_BEATS.length - 1].text.length);
      setAllComplete(true);
    }
  }, [prefersReducedMotion]);

  // Progressive character typing for active beat
  useEffect(() => {
    if (prefersReducedMotion || allComplete) return;
    const beat = ALYA_DIALOGUE_BEATS[beatIndex];
    if (!beat) return;

    if (typedCount >= beat.text.length) return;

    const initialDelay = typedCount === 0 && beatIndex === 0 ? 340 : beat.charIntervalMs;
    const timer = window.setTimeout(() => {
      setTypedCount((count) => Math.min(beat.text.length, count + 1));
    }, initialDelay);

    return () => window.clearTimeout(timer);
  }, [allComplete, beatIndex, prefersReducedMotion, typedCount]);

  // Beat pause and advancement once current line finishes typing
  useEffect(() => {
    if (prefersReducedMotion || allComplete) return;
    const beat = ALYA_DIALOGUE_BEATS[beatIndex];
    if (!beat || typedCount < beat.text.length) return;

    if (isFinalBeat) {
      setAllComplete(true);
      return;
    }

    const pauseTimer = window.setTimeout(() => {
      setBeatIndex((idx) => Math.min(ALYA_DIALOGUE_BEATS.length - 1, idx + 1));
      setTypedCount(0);
    }, beat.pauseAfterMs);

    return () => window.clearTimeout(pauseTimer);
  }, [allComplete, beatIndex, isFinalBeat, prefersReducedMotion, typedCount]);

  // Auto-proceed cleanly shortly after the final beat finishes (unless user prefers reduced motion)
  useEffect(() => {
    if (!allComplete || prefersReducedMotion) return;
    const autoTimer = window.setTimeout(() => {
      finish();
    }, ALYA_DIALOGUE_BEATS[ALYA_DIALOGUE_BEATS.length - 1].pauseAfterMs);
    return () => window.clearTimeout(autoTimer);
  }, [allComplete, finish, prefersReducedMotion]);

  // Keyboard shortcuts: Escape skips anytime, Space/Enter advances or enters dashboard
  const handleAdvance = useCallback(() => {
    if (allComplete) {
      finish();
      return;
    }
    const beat = ALYA_DIALOGUE_BEATS[beatIndex];
    if (!beat) {
      finish();
      return;
    }
    if (typedCount < beat.text.length) {
      setTypedCount(beat.text.length);
      return;
    }
    if (!isFinalBeat) {
      setBeatIndex((idx) => idx + 1);
      setTypedCount(0);
    } else {
      setAllComplete(true);
      finish();
    }
  }, [allComplete, beatIndex, finish, isFinalBeat, typedCount]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
      } else if (event.key === 'Enter' || event.key === ' ') {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === 'BUTTON') return;
        event.preventDefault();
        handleAdvance();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finish, handleAdvance]);

  const previousBeats = useMemo(
    () => ALYA_DIALOGUE_BEATS.slice(0, beatIndex),
    [beatIndex],
  );
  const activeMoodMotion = MOOD_MOTION[currentBeat.mood];
  const firstName = user.fullName.split(/\s+/)[0] || 'Alya';

  return (
    <div
      className="wm-admin relative flex min-h-[100dvh] w-full flex-col justify-between overflow-hidden bg-[color:var(--wm-canvas)] px-4 py-5 text-[color:var(--wm-ink)] sm:px-8 sm:py-7"
      role="region"
      aria-label={`Welcome intro for ${firstName}`}
    >
      {/* Clean solid canvas background */}

      {/* Top minimal bar with Willow wordmark & immediate Skip button */}
      <header className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] p-1">
            <img src="/assets/logo-transparent.png" alt="" className="h-full w-full object-contain" />
          </span>
          <span className="font-serif text-[13px] tracking-[0.14em] text-[#ede6ca]">
            WILLOW MUN <span className="text-[color:var(--wm-accent)]">· MEDIA</span>
          </span>
        </div>

        <button
          type="button"
          onClick={finish}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)]/85 px-3.5 text-[11px] font-medium text-[color:var(--wm-ink-secondary)] transition-colors hover:border-[color:var(--wm-focal)]/60 hover:text-[color:var(--wm-ink)] cursor-pointer"
        >
          <span>Skip</span>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </header>

      {/* Centerpiece character + progressive dialogue */}
      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center py-6">
        {!prefersReducedMotion && ALYA_LEAF_PARTICLES.map((leaf, index) => (
          <motion.span
            key={index}
            aria-hidden="true"
            className="pointer-events-none absolute h-2.5 w-5 rounded-full bg-[#a6bd86]/70 shadow-[0_0_16px_rgba(166,189,134,0.22)]"
            initial={{ opacity: 0, x: 0, y: 12, scale: 0.3, rotate: leaf.rotate }}
            animate={{ opacity: [0, 0.85, 0.45], x: leaf.x, y: leaf.y, scale: [0.3, 1, 0.7], rotate: leaf.rotate + 26 }}
            transition={{ duration: 1.15, delay: leaf.delay, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 150, damping: 16, mass: 0.8, delay: 0.12 }}
          className="relative z-10 flex flex-col items-center"
        >
          {/* Editorial cream medallion keeping uploaded character pristine */}
          <motion.div
            animate={
              prefersReducedMotion
                ? undefined
                : {
                    rotate: activeMoodMotion.rotate,
                    y: activeMoodMotion.y,
                    scale: activeMoodMotion.scale,
                  }
            }
            transition={{
              duration: 0.65,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative rounded-full border border-[#ede6ca]/35 bg-[#f4efe0] p-2.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]"
          >
            <div className="relative h-44 w-44 overflow-hidden rounded-full border border-[#393f24]/15 bg-[#f4efe0] sm:h-56 sm:w-56">
              <motion.img
                src={ALYA_EASTER_EGG_IMAGE_URL}
                alt="Alya's welcome character"
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.72 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.45, duration: 0.55 }}
                className="h-full w-full select-none object-contain p-2"
                draggable={false}
/>
            </div>
          </motion.div>
        </motion.div>

        {/* Dialogue parchment card */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.52 }}
          className="mt-7 w-full rounded-xl border border-[#ede6ca]/25 bg-[color:var(--wm-surface)]/95 p-5 shadow-[0_24px_56px_-24px_rgba(0,0,0,0.75)] sm:p-7"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] pb-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[color:var(--wm-accent)]">
              Private Reception · {firstName}
            </p>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {ALYA_DIALOGUE_BEATS.map((beat, idx) => (
                <span
                  key={beat.id}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === beatIndex
                      ? 'w-5 bg-[#ede6ca]'
                      : idx < beatIndex
                        ? 'w-1.5 bg-[color:var(--wm-accent)]/70'
                        : 'w-1.5 bg-[color:var(--wm-hairline-strong)]'
                  }`}
                />
              ))}
            </div>
          </div>

          <div
            aria-live="polite"
            onClick={!allComplete ? handleAdvance : undefined}
            className={`mt-4 min-h-[124px] space-y-2.5 sm:min-h-[132px] ${
              !allComplete ? 'cursor-pointer' : ''
            }`}
          >
            <AnimatePresence initial={false}>
              {previousBeats.map((beat) => (
                <motion.p
                  key={beat.id}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 0.58, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="font-serif text-[18px] leading-snug text-[#ede6ca] sm:text-[20px]"
                >
                  “{beat.text}”
                </motion.p>
              ))}
            </AnimatePresence>

            <p className="font-serif text-[23px] leading-snug text-[#ede6ca] sm:text-[27px]">
              “{fullCurrentText.slice(0, typedCount)}
              {!isCurrentBeatFullyTyped && !prefersReducedMotion ? (
                <span
                  aria-hidden="true"
                  className="ml-0.5 inline-block h-[0.85em] w-[2px] translate-y-[2px] bg-[color:var(--wm-focal)]/80"
                />
              ) : isCurrentBeatFullyTyped ? (
                '”'
              ) : null}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--wm-hairline)] pt-4">
            <span className="text-[11px] text-[color:var(--wm-ink-muted)]">
              {allComplete
                ? 'Your Media workspace is ready.'
                : 'Tap dialogue to continue faster'}
            </span>

            {allComplete ? (
              <button
                type="button"
                onClick={finish}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] transition-colors hover:bg-[#357a5b] cursor-pointer"
              >
                <span>Open Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAdvance}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded border border-[color:var(--wm-hairline)] px-2.5 text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)] transition-colors hover:border-[color:var(--wm-hairline-strong)] hover:text-[color:var(--wm-ink)] cursor-pointer"
              >
                <span>Next</span>
                <span>{beatIndex + 1}/{ALYA_DIALOGUE_BEATS.length}</span>
              </button>
            )}
          </div>
        </motion.div>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-3xl text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-ink-muted)]">
          Willow MUN 2027 · Executive Board Entrance
        </p>
      </footer>
    </div>
  );
}
