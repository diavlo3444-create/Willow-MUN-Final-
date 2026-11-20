import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
  type Variants,
} from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  computeModalClipOrigin,
  generateLaurelWreathData,
  type OrderedMember,
} from '../utils/familyTreeLayout';
import { WILLOW_EASE } from './MotionPrimitives';

interface MemberProfileModalProps {
  member: OrderedMember;
  activeIndex: number;
  totalCount: number;
  navDirection: -1 | 1;
  navStep: number;
  openClickPoint: { x: number; y: number };
  closeTargetPoint: { x: number; y: number };
  onNavigate: (direction: -1 | 1) => void;
  onRequestClose: () => void;
}

const UNFURL_EASE = [0.22, 1, 0.36, 1] as const;

const IDLE_LEAVES = [
  { id: 'idle-1', left: '9%', top: '16%', size: 15, xDrift: 8, yDrift: 12, rot: 14, dur: 9.5, delay: 0 },
  { id: 'idle-2', left: '84%', top: '24%', size: 13, xDrift: -9, yDrift: 10, rot: -18, dur: 11, delay: 1.4 },
  { id: 'idle-3', left: '14%', top: '66%', size: 12, xDrift: 7, yDrift: -10, rot: 22, dur: 10.5, delay: 0.7 },
  { id: 'idle-4', left: '86%', top: '68%', size: 16, xDrift: -7, yDrift: -12, rot: -14, dur: 12, delay: 2.1 },
  { id: 'idle-5', left: '52%', top: '12%', size: 11, xDrift: 6, yDrift: 9, rot: 12, dur: 8.8, delay: 1.1 },
];

const slideMemberVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 44 : -44,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.28, ease: UNFURL_EASE },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -44 : 44,
    opacity: 0,
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
  }),
};

const reducedSlideVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

function LaurelWreathSvg({
  memberId,
  baseDelay,
  prefersReduced,
}: {
  memberId: string;
  baseDelay: number;
  prefersReduced: boolean;
}) {
  const wreath = useMemo(() => generateLaurelWreathData(10), []);

  const renderLeaf = (
    leaf: { id: string; x: number; y: number; rotate: number; scale: number; orderIndex: number },
    branchPrefix: string,
  ) => (
    <g
      key={`${memberId}-${branchPrefix}-${leaf.id}`}
      transform={`translate(${leaf.x}, ${leaf.y}) rotate(${leaf.rotate}) scale(${leaf.scale})`}
    >
      <motion.path
        d="M 0 0 C -3.8 -3.6 -4.2 -9.4 0 -13.5 C 4.2 -9.4 3.8 -3.6 0 0 Z"
        fill="#c9d98a"
        stroke="#d4bc74"
        strokeWidth="0.7"
        style={{ transformOrigin: '0px 0px', willChange: 'transform, opacity' }}
        initial={prefersReduced ? { scale: 1, opacity: 0.9 } : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.92 }}
        exit={
          prefersReduced
            ? { opacity: 0, transition: { duration: 0.15 } }
            : {
                scale: 0,
                opacity: 0,
                transition: { duration: 0.14, delay: (9 - leaf.orderIndex) * 0.012 },
              }
        }
        transition={
          prefersReduced
            ? { duration: 0.2 }
            : {
                type: 'spring',
                stiffness: 340,
                damping: 18,
                delay: baseDelay + 0.14 + leaf.orderIndex * 0.04,
              }
        }
      />
    </g>
  );

  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      className="pointer-events-none absolute -inset-[20px] h-[calc(100%+40px)] w-[calc(100%+40px)] overflow-visible"
    >
      {/* Left curved olive branch */}
      <motion.path
        d={wreath.leftBranchPath}
        fill="none"
        stroke="#d4bc74"
        strokeWidth="1.75"
        strokeLinecap="round"
        initial={prefersReduced ? { pathLength: 1, opacity: 0.85 } : { pathLength: 0, opacity: 0.2 }}
        animate={{ pathLength: 1, opacity: 0.9 }}
        exit={
          prefersReduced
            ? { opacity: 0, transition: { duration: 0.15 } }
            : { pathLength: 0, opacity: 0, transition: { duration: 0.22, ease: 'easeIn' } }
        }
        transition={
          prefersReduced
            ? { duration: 0.2 }
            : {
                pathLength: { duration: 0.9, delay: baseDelay, ease: UNFURL_EASE },
                opacity: { duration: 0.2, delay: baseDelay },
              }
        }
      />

      {/* Right curved olive branch */}
      <motion.path
        d={wreath.rightBranchPath}
        fill="none"
        stroke="#d4bc74"
        strokeWidth="1.75"
        strokeLinecap="round"
        initial={prefersReduced ? { pathLength: 1, opacity: 0.85 } : { pathLength: 0, opacity: 0.2 }}
        animate={{ pathLength: 1, opacity: 0.9 }}
        exit={
          prefersReduced
            ? { opacity: 0, transition: { duration: 0.15 } }
            : { pathLength: 0, opacity: 0, transition: { duration: 0.22, ease: 'easeIn' } }
        }
        transition={
          prefersReduced
            ? { duration: 0.2 }
            : {
                pathLength: { duration: 0.9, delay: baseDelay, ease: UNFURL_EASE },
                opacity: { duration: 0.2, delay: baseDelay },
              }
        }
      />

      {/* 10 staggered olive leaves along each branch */}
      {wreath.leftLeaves.map((leaf) => renderLeaf(leaf, 'L'))}
      {wreath.rightLeaves.map((leaf) => renderLeaf(leaf, 'R'))}
    </svg>
  );
}

export function MemberProfileModal({
  member,
  activeIndex,
  totalCount,
  navDirection,
  navStep,
  openClickPoint,
  closeTargetPoint,
  onNavigate,
  onRequestClose,
}: MemberProfileModalProps) {
  const prefersReduced = useReducedMotion() ?? false;
  const isPresent = useIsPresent();

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({});

  const isPresentRef = useRef(isPresent);
  const onNavigateRef = useRef(onNavigate);
  const onRequestCloseRef = useRef(onRequestClose);
  isPresentRef.current = isPresent;
  onNavigateRef.current = onNavigate;
  onRequestCloseRef.current = onRequestClose;

  // Focus close button on open without scrolling viewport
  useEffect(() => {
    const t = window.setTimeout(() => {
      closeBtnRef.current?.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(t);
  }, []);

  // Fixed scroll-position lock (preserves exact scrollY with zero shift on open/close)
  useEffect(() => {
    const savedScrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const prevStyle = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };

    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      body.style.position = prevStyle.position;
      body.style.top = prevStyle.top;
      body.style.left = prevStyle.left;
      body.style.right = prevStyle.right;
      body.style.width = prevStyle.width;

      const prevBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      window.scrollTo(0, savedScrollY);
      html.style.scrollBehavior = prevBehavior;
    };
  }, []);

  // Keyboard navigation (Escape, Arrows, Tab focus trap)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPresentRef.current) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onRequestCloseRef.current();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onNavigateRef.current(-1);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNavigateRef.current(1);
        return;
      }

      if (event.key === 'Tab') {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (!active || !root.contains(active)) {
          event.preventDefault();
          first.focus();
          return;
        }

        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);

  const handleTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    touchStartRef.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  }, []);

  const handleTouchEnd = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (!isPresentRef.current || !touchStartRef.current || event.changedTouches.length !== 1) return;
      const dx = event.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = event.changedTouches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = null;
      if (Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        onNavigateRef.current(dx < 0 ? 1 : -1);
      }
    },
    [],
  );

  // Modal-local clip-path coordinates captured for open & close
  const clipCoords = useMemo(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    return {
      open: computeModalClipOrigin(openClickPoint, vw, vh),
      close: computeModalClipOrigin(closeTargetPoint, vw, vh),
    };
  }, [openClickPoint, closeTargetPoint]);

  const hasPhoto = Boolean(member.photo) && !failedPhotos[member.id];
  const quoteText = member.quote.trim();
  const isInitialOpen = navStep === 0;
  const wreathDelay = isInitialOpen ? 0.16 : 0.04;
  const textBaseDelay = isInitialOpen ? 0.24 : 0.05;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-profile-name"
      onClick={() => {
        if (isPresent) onRequestClose();
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`fixed inset-0 z-[80] flex items-center justify-center p-4 ${
        isPresent ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      {/* Backdrop with animated 0px -> 8px blur */}
      <motion.div
        aria-hidden="true"
        initial={
          prefersReduced
            ? { opacity: 0 }
            : { opacity: 0, backdropFilter: 'blur(0px)' }
        }
        animate={
          prefersReduced
            ? { opacity: 1 }
            : { opacity: 1, backdropFilter: 'blur(8px)' }
        }
        exit={
          prefersReduced
            ? { opacity: 0, transition: { duration: 0.2 } }
            : {
                opacity: 0,
                backdropFilter: 'blur(0px)',
                transition: { duration: 0.42, delay: 0.1, ease: UNFURL_EASE },
              }
        }
        transition={{ duration: prefersReduced ? 0.2 : 0.48, ease: UNFURL_EASE }}
        className="pointer-events-none fixed inset-0 bg-[#0e1207]/78"
      />

      {/* Fixed-Size Modal Shell with Willow Unfurl Circular Clip-Path */}
      <motion.div
        data-testid="member-profile-shell"
        onClick={(e) => e.stopPropagation()}
        initial={
          prefersReduced
            ? { opacity: 0 }
            : {
                clipPath: `circle(0px at ${clipCoords.open.x}px ${clipCoords.open.y}px)`,
                opacity: 1,
              }
        }
        animate={
          prefersReduced
            ? { opacity: 1 }
            : {
                clipPath: `circle(${clipCoords.open.fullRadiusPx}px at ${clipCoords.open.x}px ${clipCoords.open.y}px)`,
                opacity: 1,
              }
        }
        exit={
          prefersReduced
            ? { opacity: 0, transition: { duration: 0.2 } }
            : {
                clipPath: `circle(0px at ${clipCoords.close.x}px ${clipCoords.close.y}px)`,
                opacity: 1,
                transition: { duration: 0.48, delay: 0.12, ease: UNFURL_EASE },
              }
        }
        transition={
          prefersReduced
            ? { duration: 0.2 }
            : { duration: 0.6, ease: UNFURL_EASE }
        }
        style={{
          width: 'min(92vw, 460px)',
          height: 'min(86dvh, 620px)',
          willChange: prefersReduced ? 'opacity' : 'clip-path',
        }}
        className="relative z-10 flex flex-col overflow-hidden rounded-[4px] border border-[#ede6ca]/35 bg-[#12160a]/98 text-center shadow-[0_28px_72px_rgba(0,0,0,0.72)]"
      >
        {/* Subtle Idle Olive-Leaf Background Drift (decorative, pointer-events: none) */}
        {!prefersReduced && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            {IDLE_LEAVES.map((leaf) => (
              <motion.svg
                key={leaf.id}
                viewBox="0 0 16 20"
                style={{
                  position: 'absolute',
                  left: leaf.left,
                  top: leaf.top,
                  width: `${leaf.size}px`,
                  height: `${Math.round(leaf.size * 1.25)}px`,
                  willChange: 'transform, opacity',
                }}
                initial={{ opacity: 0.08, x: 0, y: 0, rotate: leaf.rot }}
                animate={{
                  x: [0, leaf.xDrift, -leaf.xDrift * 0.5, 0],
                  y: [0, leaf.yDrift, -leaf.yDrift * 0.4, 0],
                  rotate: [leaf.rot, leaf.rot + 12, leaf.rot - 8, leaf.rot],
                  opacity: [0.07, 0.13, 0.08, 0.07],
                }}
                transition={{
                  duration: leaf.dur,
                  delay: leaf.delay,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <path
                  d="M8 1C4.4 4.8 3 9.4 3.9 14.1C4.5 16.7 6.3 18.4 8 19C9.7 18.4 11.5 16.7 12.1 14.1C13 9.4 11.6 4.8 8 1Z"
                  fill="#a9b47e"
                />
              </motion.svg>
            ))}
          </div>
        )}

        {/* Close Button (Bug 5: no flicker, only 150ms background/border transition) */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onRequestClose}
          aria-label="Close member profile"
          className="absolute top-3.5 right-3.5 z-30 flex h-10 w-10 items-center justify-center rounded-[2px] border border-[#ede6ca]/28 bg-[#14180a]/95 text-[#ede6ca] transition-[background-color,border-color] duration-150 hover:border-[#ede6ca]/65 hover:bg-[#1e2410] cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Main Content Viewport (flex-1 min-h-0 flex column; only quote area scrolls) */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-6 pt-8 sm:px-9 sm:pt-9">
          <AnimatePresence mode="wait" custom={navDirection} initial={false}>
            <motion.div
              key={member.id}
              custom={navDirection}
              variants={prefersReduced ? reducedSlideVariants : slideMemberVariants}
              initial="enter"
              animate="center"
              exit={
                isPresent
                  ? 'exit'
                  : prefersReduced
                    ? { opacity: 0, transition: { duration: 0.2 } }
                    : { opacity: 0, transition: { duration: 0.18, ease: 'easeOut' } }
              }
              style={{ willChange: 'transform, opacity' }}
              className="flex min-h-0 flex-1 flex-col items-center overflow-hidden"
            >
              {/* Fixed Avatar + Laurel Wreath */}
              <div className="relative z-10 mt-2 flex h-[126px] w-[126px] sm:h-[136px] sm:w-[136px] shrink-0 items-center justify-center">
                <LaurelWreathSvg
                  memberId={member.id}
                  baseDelay={wreathDelay}
                  prefersReduced={prefersReduced}
                />

                <motion.div
                  initial={prefersReduced ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
                  animate={prefersReduced ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                  exit={
                    prefersReduced
                      ? { opacity: 0, transition: { duration: 0.15 } }
                      : { scale: 0.88, opacity: 0, transition: { duration: 0.18 } }
                  }
                  transition={{
                    duration: prefersReduced ? 0.2 : 0.46,
                    delay: prefersReduced ? 0 : wreathDelay * 0.4,
                    ease: UNFURL_EASE,
                  }}
                  style={{ willChange: 'transform, opacity' }}
                  className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-[#ede6ca]/45 bg-[#232814] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                >
                  {hasPhoto && member.photo ? (
                    <img
                      src={member.photo.startsWith('/') ? member.photo : `/${member.photo}`}
                      alt={member.name}
                      style={{ objectPosition: member.objectPosition }}
                      onError={() =>
                        setFailedPhotos((prev) => ({
                          ...prev,
                          [member.id]: true,
                        }))
                      }
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center px-4 text-center">
                      <img
                        src="willow-tree-only.svg"
                        alt=""
                        aria-hidden="true"
                        className="h-14 w-14 object-contain opacity-85"
                      />
                      <span className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#cfc8aa]">
                        Photo coming soon
                      </span>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Staggered Header Identity (0.07s stagger: Role -> Name -> Title) */}
              <div className="mt-6 flex w-full shrink-0 flex-col items-center">
                <motion.p
                  initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: prefersReduced ? 0.2 : 0.34,
                    delay: prefersReduced ? 0 : textBaseDelay,
                    ease: UNFURL_EASE,
                  }}
                  className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#a9b47e]"
                >
                  {member.groupLabel}
                </motion.p>

                <motion.h3
                  id="member-profile-name"
                  initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: prefersReduced ? 0.2 : 0.36,
                    delay: prefersReduced ? 0 : textBaseDelay + 0.07,
                    ease: UNFURL_EASE,
                  }}
                  className="mt-1.5 font-serif text-[1.75rem] sm:text-[2.1rem] font-medium leading-[1.08] text-[#ede6ca] [text-wrap:balance]"
                >
                  {member.name}
                </motion.h3>

                <motion.p
                  initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: prefersReduced ? 0.2 : 0.36,
                    delay: prefersReduced ? 0 : textBaseDelay + 0.14,
                    ease: UNFURL_EASE,
                  }}
                  style={{ fontVariantCaps: 'small-caps' }}
                  className="mt-1 text-sm font-medium tracking-[0.12em] text-[#cfc8aa]"
                >
                  {member.displayRole}
                </motion.p>
              </div>

              {/* Quote Area (ONLY area allowed to scroll; scrollbar hidden) */}
              <div
                data-testid="member-quote-scroll"
                className="mun-no-scrollbar mt-4 flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto px-1 pb-3"
              >
                {quoteText.length > 0 && (
                  <motion.figure
                    initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: prefersReduced ? 0.2 : 0.38,
                      delay: prefersReduced ? 0 : textBaseDelay + 0.21,
                      ease: UNFURL_EASE,
                    }}
                    className="my-auto w-full max-w-[38ch] py-1"
                  >
                    <div
                      dir="ltr"
                      className="text-center font-serif text-[1.12rem] sm:text-[1.24rem] italic leading-relaxed text-[#f2ecd4]"
                    >
                      <span
                        aria-hidden="true"
                        style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
                        className="mr-1 inline-block align-baseline font-serif text-2xl sm:text-[1.7rem] not-italic leading-none text-[#d4bc74]/85 select-none"
                      >
                        &ldquo;
                      </span>
                      <blockquote dir="auto" className="inline">
                        {quoteText}
                      </blockquote>
                      <span
                        aria-hidden="true"
                        style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
                        className="ml-1 inline-block align-baseline font-serif text-2xl sm:text-[1.7rem] not-italic leading-none text-[#d4bc74]/85 select-none"
                      >
                        &rdquo;
                      </span>
                    </div>

                    {member.quoteBy && (
                      <figcaption className="mt-2 text-xs font-medium tracking-[0.14em] text-[#cfc8aa]">
                        &mdash; {member.quoteBy}
                      </figcaption>
                    )}
                  </motion.figure>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Fixed Bottom Controls (Prev / Counter / Next always visible) */}
        <motion.div
          data-testid="member-modal-footer"
          initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={
            prefersReduced
              ? { opacity: 0, transition: { duration: 0.16 } }
              : { opacity: 0, transition: { duration: 0.16, ease: WILLOW_EASE } }
          }
          transition={{
            duration: prefersReduced ? 0.2 : 0.34,
            delay: prefersReduced ? 0 : 0.28,
            ease: UNFURL_EASE,
          }}
          className="relative z-20 flex w-full shrink-0 items-center justify-center gap-4 border-t border-[#ede6ca]/10 bg-[#12160a]/98 px-6 py-4"
        >
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            aria-label="Previous Executive Board member"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ede6ca]/35 bg-[#14180a] text-[#ede6ca] transition-[background-color,border-color] duration-150 hover:border-[#ede6ca] hover:bg-[#1e2410] cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          <span
            data-testid="member-modal-counter"
            className="min-w-[60px] text-center text-xs font-medium tracking-[0.2em] text-[#cfc8aa] tabular-nums"
          >
            {activeIndex + 1} / {totalCount}
          </span>

          <button
            type="button"
            onClick={() => onNavigate(1)}
            aria-label="Next Executive Board member"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ede6ca]/35 bg-[#14180a] text-[#ede6ca] transition-[background-color,border-color] duration-150 hover:border-[#ede6ca] hover:bg-[#1e2410] cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </motion.div>
      </motion.div>
    </div>,
    document.body,
  );
}
