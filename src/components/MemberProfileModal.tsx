import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { OrderedMember } from '../utils/familyTreeLayout';

interface MemberProfileModalProps {
  member: OrderedMember;
  activeIndex: number;
  totalCount: number;
  onNavigate: (direction: -1 | 1) => void;
  onClose: () => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function MemberProfileModal({
  member,
  activeIndex,
  totalCount,
  onNavigate,
  onClose,
}: MemberProfileModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({});
  const isClosingRef = useRef(false);
  const hasMountedRef = useRef(false);
  const navDirectionRef = useRef<-1 | 1>(1);
  const prevMemberIdRef = useRef(member.id);

  const onNavigateRef = useRef(onNavigate);
  const onCloseRef = useRef(onClose);
  onNavigateRef.current = onNavigate;
  onCloseRef.current = onClose;

  // Synchronous layout scroll lock (zero page shift on open or close)
  useLayoutEffect(() => {
    const savedScrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const prevStyle = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      htmlOverflowY: html.style.overflowY,
    };

    html.style.overflowY = 'scroll';
    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      html.style.overflowY = prevStyle.htmlOverflowY;
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

  // Simple 250ms transform + opacity entrance via Web Animations API
  useLayoutEffect(() => {
    const backdrop = backdropRef.current;
    const shell = shellRef.current;
    const reduced = prefersReducedMotion();
    const duration = reduced ? 120 : 250;

    const anims: Animation[] = [];
    if (backdrop) {
      anims.push(
        backdrop.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration,
          easing: 'ease-out',
          fill: 'backwards',
        }),
      );
    }
    if (shell) {
      anims.push(
        shell.animate(
          reduced
            ? [{ opacity: 0 }, { opacity: 1 }]
            : [
                { opacity: 0, transform: 'scale(0.9)' },
                { opacity: 1, transform: 'scale(1)' },
              ],
          {
            duration,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'backwards',
          },
        ),
      );
    }

    hasMountedRef.current = true;
    return () => {
      for (const anim of anims) {
        anim.cancel();
      }
    };
  }, []);

  // Simple opacity + subtle transform fade when switching Prev/Next inside modal
  useLayoutEffect(() => {
    if (!hasMountedRef.current || prevMemberIdRef.current === member.id) {
      prevMemberIdRef.current = member.id;
      return;
    }
    prevMemberIdRef.current = member.id;
    const content = contentRef.current;
    if (!content) return;

    const reduced = prefersReducedMotion();
    const offset = navDirectionRef.current > 0 ? 14 : -14;
    const anim = content.animate(
      reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: `translate3d(${offset}px, 0, 0)` },
            { opacity: 1, transform: 'translate3d(0, 0, 0)' },
          ],
      {
        duration: reduced ? 100 : 180,
        easing: 'ease-out',
      },
    );
    return () => anim.cancel();
  }, [member.id]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      closeBtnRef.current?.focus({ preventScroll: true });
    }, 40);
    return () => window.clearTimeout(t);
  }, []);

  const requestAnimatedClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    const backdrop = backdropRef.current;
    const shell = shellRef.current;
    const reduced = prefersReducedMotion();

    if (reduced || (!backdrop && !shell)) {
      onCloseRef.current();
      return;
    }

    const duration = 180;
    const anims: Animation[] = [];
    if (backdrop) {
      anims.push(
        backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration,
          easing: 'ease-in',
          fill: 'forwards',
        }),
      );
    }
    if (shell) {
      anims.push(
        shell.animate(
          [
            { opacity: 1, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(0.92)' },
          ],
          {
            duration,
            easing: 'ease-in',
            fill: 'forwards',
          },
        ),
      );
    }

    const primary = anims[anims.length - 1];
    if (!primary) {
      onCloseRef.current();
      return;
    }

    let finished = false;
    const finishClose = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(fallbackTimer);
      onCloseRef.current();
    };

    const fallbackTimer = window.setTimeout(finishClose, duration + 35);
    primary.finished.catch(() => {}).finally(finishClose);
  }, []);

  const triggerNavigate = useCallback((direction: -1 | 1) => {
    if (isClosingRef.current) return;
    navDirectionRef.current = direction;
    onNavigateRef.current(direction);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isClosingRef.current) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        requestAnimatedClose();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        triggerNavigate(-1);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        triggerNavigate(1);
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
  }, [requestAnimatedClose, triggerNavigate]);

  const handleTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    touchStartRef.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  }, []);

  const handleTouchEnd = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (isClosingRef.current || !touchStartRef.current || event.changedTouches.length !== 1) return;
      const dx = event.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = event.changedTouches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = null;
      if (Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        triggerNavigate(dx < 0 ? 1 : -1);
      }
    },
    [triggerNavigate],
  );

  const hasPhoto = Boolean(member.photo) && !failedPhotos[member.id];
  const quoteText = member.quote.trim();

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-profile-name"
      onClick={requestAnimatedClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
    >
      {/* Plain dark overlay: rgba(0, 0, 0, 0.7), zero blur / backdrop-filter */}
      <div
        ref={backdropRef}
        aria-hidden="true"
        data-testid="member-modal-backdrop"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
        className="pointer-events-none fixed inset-0"
      />

      {/* Fixed-size modal shell (transform & opacity only) */}
      <div
        ref={shellRef}
        data-testid="member-profile-shell"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(92vw, 460px)',
          height: 'min(86dvh, 620px)',
        }}
        className="relative z-10 flex flex-col overflow-hidden rounded-[4px] border border-[#ede6ca]/35 bg-[#12160a] text-center"
      >
        {/* Close Button (no flicker; 150ms background/border-color only) */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={requestAnimatedClose}
          aria-label="Close member profile"
          className="absolute top-3.5 right-3.5 z-30 flex h-10 w-10 items-center justify-center rounded-[2px] border border-[#ede6ca]/28 bg-[#14180a] text-[#ede6ca] transition-[background-color,border-color] duration-150 hover:border-[#ede6ca]/65 hover:bg-[#1e2410] cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Main Content Viewport (only quote area scrolls; no visible scrollbar) */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-6 pt-8 sm:px-9 sm:pt-9">
          <div
            ref={contentRef}
            className="flex min-h-0 flex-1 flex-col items-center overflow-hidden"
          >
            {/* Circular Portrait */}
            <div className="relative z-10 mt-2 flex h-[126px] w-[126px] sm:h-[136px] sm:w-[136px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#d4bc74]/65 bg-[#232814]">
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
            </div>

            {/* Header Identity */}
            <div className="mt-6 flex w-full shrink-0 flex-col items-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#a9b47e]">
                {member.groupLabel}
              </p>

              <h3
                id="member-profile-name"
                className="mt-1.5 font-serif text-[1.75rem] sm:text-[2.1rem] font-medium leading-[1.08] text-[#ede6ca] [text-wrap:balance]"
              >
                {member.name}
              </h3>

              <p
                style={{ fontVariantCaps: 'small-caps' }}
                className="mt-1 text-sm font-medium tracking-[0.12em] text-[#cfc8aa]"
              >
                {member.displayRole}
              </p>
            </div>

            {/* Quote Area (ONLY area allowed to scroll; scrollbar hidden) */}
            <div
              data-testid="member-quote-scroll"
              className="mun-no-scrollbar mt-4 flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto px-1 pb-3"
            >
              {quoteText.length > 0 && (
                <figure className="my-auto w-full max-w-[38ch] py-1">
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
                </figure>
              )}
            </div>
          </div>
        </div>

        {/* Fixed Bottom Controls (Prev / Counter / Next always visible) */}
        <div
          data-testid="member-modal-footer"
          className="relative z-20 flex w-full shrink-0 items-center justify-center gap-4 border-t border-[#ede6ca]/10 bg-[#12160a] px-6 py-4"
        >
          <button
            type="button"
            onClick={() => triggerNavigate(-1)}
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
            onClick={() => triggerNavigate(1)}
            aria-label="Next Executive Board member"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ede6ca]/35 bg-[#14180a] text-[#ede6ca] transition-[background-color,border-color] duration-150 hover:border-[#ede6ca] hover:bg-[#1e2410] cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
