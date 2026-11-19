import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { OrderedMember } from '../utils/familyTreeLayout';

interface MemberProfileModalProps {
  member: OrderedMember;
  activeIndex: number;
  totalCount: number;
  sourceRect: DOMRect | null;
  getTargetBoxRect: () => DOMRect | null;
  isClosing: boolean;
  prefersReducedMotion: boolean;
  onNavigate: (direction: -1 | 1) => void;
  onRequestClose: () => void;
  onCloseComplete: () => void;
}

interface LeafSpec {
  id: number;
  leftPct: number;
  size: number;
  dx: number;
  dy: number;
  rStart: number;
  rEnd: number;
  delayMs: number;
  durationMs: number;
}

const DRIFTING_LEAVES: LeafSpec[] = [
  { id: 0, leftPct: 12, size: 14, dx: 26, dy: 300, rStart: -18, rEnd: 48, delayMs: 80, durationMs: 2100 },
  { id: 1, leftPct: 28, size: 11, dx: -18, dy: 280, rStart: 12, rEnd: -34, delayMs: 240, durationMs: 2300 },
  { id: 2, leftPct: 48, size: 15, dx: 22, dy: 320, rStart: -8, rEnd: 56, delayMs: 150, durationMs: 2450 },
  { id: 3, leftPct: 68, size: 12, dx: -24, dy: 290, rStart: 20, rEnd: -42, delayMs: 320, durationMs: 2150 },
  { id: 4, leftPct: 84, size: 14, dx: -14, dy: 310, rStart: -22, rEnd: 36, delayMs: 110, durationMs: 2250 },
  { id: 5, leftPct: 37, size: 10, dx: 16, dy: 265, rStart: 14, rEnd: 62, delayMs: 420, durationMs: 2000 },
  { id: 6, leftPct: 75, size: 13, dx: 18, dy: 295, rStart: -12, rEnd: -48, delayMs: 360, durationMs: 2350 },
];

export function MemberProfileModal({
  member,
  activeIndex,
  totalCount,
  sourceRect,
  getTargetBoxRect,
  isClosing,
  prefersReducedMotion,
  onNavigate,
  onRequestClose,
  onCloseComplete,
}: MemberProfileModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasPlayedInitialFlipRef = useRef(false);

  const [backdropVisible, setBackdropVisible] = useState(false);
  const [contentVisible, setContentVisible] = useState(prefersReducedMotion);
  const [photoRevealed, setPhotoRevealed] = useState(prefersReducedMotion);
  const [revealedWords, setRevealedWords] = useState<number>(prefersReducedMotion ? 9999 : 0);
  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({});
  const [leafWaveKey] = useState(0);

  const words = useMemo(() => {
    const trimmed = member.quote.trim();
    return trimmed ? trimmed.split(/\s+/) : [];
  }, [member.quote]);

  // Initial FLIP open animation (runs once when modal opens) + move initial focus into dialog
  useLayoutEffect(() => {
    if (hasPlayedInitialFlipRef.current) return;
    hasPlayedInitialFlipRef.current = true;

    const card = cardRef.current;
    if (!card) return;

    if (prefersReducedMotion || !sourceRect) {
      card.style.transition = prefersReducedMotion ? 'opacity 160ms ease' : 'opacity 260ms ease';
      card.style.opacity = '0';
      card.style.transform = 'translate3d(0, 0, 0) scale(1)';
      void card.offsetWidth;
      const raf = window.requestAnimationFrame(() => {
        setBackdropVisible(true);
        card.style.opacity = '1';
      });
      return () => window.cancelAnimationFrame(raf);
    }

    const targetRect = card.getBoundingClientRect();
    const dx = sourceRect.left + sourceRect.width / 2 - (targetRect.left + targetRect.width / 2);
    const dy = sourceRect.top + sourceRect.height / 2 - (targetRect.top + targetRect.height / 2);
    const sx = Math.max(0.18, sourceRect.width / Math.max(1, targetRect.width));
    const sy = Math.max(0.14, sourceRect.height / Math.max(1, targetRect.height));

    card.style.transition = 'none';
    card.style.transformOrigin = 'center center';
    card.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
    card.style.opacity = '0.15';

    // Force synchronous layout before enabling transition
    void card.offsetWidth;

    const raf = window.requestAnimationFrame(() => {
      setBackdropVisible(true);
      card.style.transition =
        'transform 500ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 360ms ease';
      card.style.transform = 'translate3d(0, 0, 0) scale(1, 1)';
      card.style.opacity = '1';
    });

    return () => window.cancelAnimationFrame(raf);
  }, [prefersReducedMotion, sourceRect]);

  // Focus initial interactive button cleanly once opened
  useEffect(() => {
    const t = window.setTimeout(() => {
      closeBtnRef.current?.focus({ preventScroll: true });
    }, 40);
    return () => window.clearTimeout(t);
  }, []);

  // Reverse FLIP animation on close -> invokes onCloseComplete once finished
  useEffect(() => {
    if (!isClosing) return;

    const card = cardRef.current;
    setBackdropVisible(false);

    if (!card || prefersReducedMotion) {
      if (card) {
        card.style.transition = prefersReducedMotion ? 'opacity 150ms ease' : 'none';
        card.style.opacity = '0';
      }
      const timer = window.setTimeout(onCloseComplete, prefersReducedMotion ? 160 : 20);
      return () => window.clearTimeout(timer);
    }

    const targetBoxRect = getTargetBoxRect() ?? sourceRect;
    const currentRect = card.getBoundingClientRect();

    if (targetBoxRect && currentRect.width > 0 && currentRect.height > 0) {
      const dx =
        targetBoxRect.left +
        targetBoxRect.width / 2 -
        (currentRect.left + currentRect.width / 2);
      const dy =
        targetBoxRect.top +
        targetBoxRect.height / 2 -
        (currentRect.top + currentRect.height / 2);
      const sx = Math.max(0.18, targetBoxRect.width / currentRect.width);
      const sy = Math.max(0.14, targetBoxRect.height / currentRect.height);

      card.style.transition =
        'transform 380ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease';
      card.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
      card.style.opacity = '0';
    } else {
      card.style.transition = 'transform 280ms ease, opacity 260ms ease';
      card.style.transform = 'translate3d(0, 12px, 0) scale(0.92)';
      card.style.opacity = '0';
    }

    const doneTimer = window.setTimeout(onCloseComplete, 400);
    return () => window.clearTimeout(doneTimer);
  }, [getTargetBoxRect, isClosing, onCloseComplete, prefersReducedMotion, sourceRect]);

  // Choreography per member: photo bud clip-path -> name & role fade -> word-by-word quote (25ms/word)
  useEffect(() => {
    if (prefersReducedMotion) {
      setPhotoRevealed(true);
      setContentVisible(true);
      setRevealedWords(words.length);
      return;
    }

    setPhotoRevealed(false);
    setContentVisible(false);
    setRevealedWords(0);

    let wordIntervalId: number | null = null;
    const tPhoto = window.setTimeout(() => {
      setPhotoRevealed(true);
    }, 90);

    const tMeta = window.setTimeout(() => {
      setContentVisible(true);
    }, 170);

    const tWordsStart = window.setTimeout(() => {
      if (words.length === 0) return;
      let count = 0;
      wordIntervalId = window.setInterval(() => {
        count += 1;
        setRevealedWords(count);
        if (count >= words.length && wordIntervalId !== null) {
          window.clearInterval(wordIntervalId);
          wordIntervalId = null;
        }
      }, 25);
    }, 260);

    return () => {
      window.clearTimeout(tPhoto);
      window.clearTimeout(tMeta);
      window.clearTimeout(tWordsStart);
      if (wordIntervalId !== null) {
        window.clearInterval(wordIntervalId);
      }
    };
  }, [member.id, prefersReducedMotion, words]);

  // Strict keyboard handling: Escape, ArrowLeft, ArrowRight, and Tab/Shift+Tab focus trap
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onRequestClose();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onNavigate(-1);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNavigate(1);
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
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [onNavigate, onRequestClose]);

  const handleTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    touchStartRef.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  }, []);

  const handleTouchEnd = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (!touchStartRef.current || event.changedTouches.length !== 1) return;
      const dx = event.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = event.changedTouches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = null;
      if (Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        onNavigate(dx < 0 ? 1 : -1);
      }
    },
    [onNavigate],
  );

  const hasPhoto = Boolean(member.photo) && !failedPhotos[member.id];
  const clipStyle: CSSProperties = {
    clipPath: photoRevealed ? 'circle(100% at 50% 50%)' : 'circle(0% at 50% 50%)',
    transition: prefersReducedMotion
      ? 'none'
      : 'clip-path 560ms cubic-bezier(0.2, 0.8, 0.2, 1)',
  };

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-profile-name"
      onClick={onRequestClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        style={{
          opacity: backdropVisible ? 1 : 0,
          transition: prefersReducedMotion ? 'opacity 160ms ease' : 'opacity 380ms ease',
        }}
        className="pointer-events-none fixed inset-0 bg-[#0e1207]/78 backdrop-blur-[3px]"
      />

      {/* Profile Card (FLIP target) */}
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, calc(100vw - 24px))',
          maxHeight: 'min(90dvh, 720px)',
          willChange: 'transform, opacity',
        }}
        className="relative z-10 flex flex-col items-center overflow-y-auto rounded-[4px] border border-[#ede6ca]/35 bg-[#12160a]/98 px-6 py-8 sm:px-11 sm:py-10 text-center shadow-[0_28px_72px_rgba(0,0,0,0.7)]"
      >
        {/* Falling small SVG leaf shapes drifting down once across card */}
        {!prefersReducedMotion && (
          <div
            key={leafWaveKey}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
          >
            {DRIFTING_LEAVES.map((leaf) => (
              <svg
                key={leaf.id}
                viewBox="0 0 24 24"
                width={leaf.size}
                height={leaf.size}
                style={
                  {
                    position: 'absolute',
                    top: '-10px',
                    left: `${leaf.leftPct}%`,
                    '--dx': `${leaf.dx}px`,
                    '--dy': `${leaf.dy}px`,
                    '--r-start': `${leaf.rStart}deg`,
                    '--r-end': `${leaf.rEnd}deg`,
                    '--fall-delay': `${leaf.delayMs}ms`,
                    '--fall-dur': `${leaf.durationMs}ms`,
                  } as CSSProperties
                }
                className="ft-leaf-drift text-[#c9d98a]/65"
              >
                <path
                  fill="currentColor"
                  d="M12 2C7.5 6.4 5.5 11.4 6.5 16.5C7.1 19.3 9.2 21.2 12 22C14.8 21.2 16.9 19.3 17.5 16.5C18.5 11.4 16.5 6.4 12 2Z"
                />
              </svg>
            ))}
          </div>
        )}

        {/* Close Button (X) */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onRequestClose}
          aria-label="Close member profile"
          className="mun-btn-interactive absolute top-4 right-4 sm:top-5 sm:right-5 z-20 flex h-10 w-10 items-center justify-center rounded-[2px] border border-[#ede6ca]/28 bg-[#14180a]/95 text-[#ede6ca] hover:border-[#ede6ca]/65 cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Circular Photo (~156px) opening from bud via clip-path: circle(0% -> 100%) */}
        <div
          style={clipStyle}
          className="relative z-10 flex h-[148px] w-[148px] sm:h-[164px] sm:w-[164px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ede6ca]/70 bg-[#232814] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        >
          {hasPhoto && member.photo ? (
            <img
              key={member.id}
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
                className="h-16 w-16 object-contain opacity-85"
              />
              <span className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#cfc8aa]">
                Photo coming soon
              </span>
            </div>
          )}
        </div>

        {/* Member Name & Role */}
        <div
          style={{
            opacity: contentVisible ? 1 : 0,
            transform: contentVisible ? 'translate3d(0, 0, 0)' : 'translate3d(0, 8px, 0)',
            transition: prefersReducedMotion
              ? 'none'
              : 'opacity 320ms ease, transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
          className="relative z-10 mt-5 w-full min-w-0"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#a9b47e]">
            {member.groupLabel}
          </p>

          <h3
            id="member-profile-name"
            className="mt-1.5 font-serif text-3xl sm:text-4xl font-medium leading-[1.08] text-[#ede6ca] [text-wrap:balance]"
          >
            {member.name}
          </h3>

          <p
            style={{ fontVariantCaps: 'small-caps' }}
            className="mt-1.5 text-sm sm:text-[15px] font-medium tracking-[0.12em] text-[#cfc8aa]"
          >
            {member.displayRole}
          </p>
        </div>

        {/* Quote revealed word by word (25ms/word) inside large quotation marks */}
        {words.length > 0 && (
          <figure className="relative z-10 mt-5 w-full max-w-[44ch] px-3 sm:px-5">
            <blockquote className="relative font-serif text-lg sm:text-[1.35rem] italic leading-relaxed text-[#f2ecd4]">
              <span
                aria-hidden="true"
                className="mr-1.5 inline-block align-top font-serif text-3xl sm:text-4xl not-italic leading-none text-[#a9b47e]/85"
              >
                &ldquo;
              </span>
              {words.map((word, idx) => {
                const isShown = idx < revealedWords;
                return (
                  <span
                    key={`${member.id}-${idx}`}
                    style={{
                      opacity: isShown ? 1 : 0,
                      transition: prefersReducedMotion ? 'none' : 'opacity 140ms ease',
                    }}
                    className="inline-block"
                  >
                    {word}
                    {idx < words.length - 1 ? '\u00A0' : ''}
                  </span>
                );
              })}
              <span
                aria-hidden="true"
                className="ml-1 inline-block align-bottom font-serif text-3xl sm:text-4xl not-italic leading-none text-[#a9b47e]/85"
              >
                &rdquo;
              </span>
            </blockquote>

            {member.quoteBy && (
              <figcaption
                style={{
                  opacity:
                    prefersReducedMotion || revealedWords >= words.length ? 1 : 0,
                  transition: prefersReducedMotion ? 'none' : 'opacity 260ms ease',
                }}
                className="mt-2 text-xs font-medium tracking-[0.14em] text-[#cfc8aa]"
              >
                &mdash; {member.quoteBy}
              </figcaption>
            )}
          </figure>
        )}

        {/* Prev / Counter / Next Navigation Controls */}
        <div className="relative z-10 mt-7 flex w-full items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            aria-label="Previous Executive Board member"
            className="mun-btn-interactive flex h-11 w-11 items-center justify-center rounded-full border border-[#ede6ca]/35 bg-[#14180a] text-[#ede6ca] hover:border-[#ede6ca] cursor-pointer"
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
            className="mun-btn-interactive flex h-11 w-11 items-center justify-center rounded-full border border-[#ede6ca]/35 bg-[#14180a] text-[#ede6ca] hover:border-[#ede6ca] cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
