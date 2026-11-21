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
import {
  computeFlipCardToPanel,
  resolveMemberFallbackSrc,
  resolveMemberPortraitSrc,
  resolveMemberThumbSrc,
  type OrderedMember,
} from '../utils/familyTreeLayout';

export interface ModalRectSnapshot {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface MemberProfileModalProps {
  member: OrderedMember;
  activeIndex: number;
  totalCount: number;
  flipCardRect: ModalRectSnapshot | null;
  isReducedMotion: boolean;
  getActiveCardRect: () => ModalRectSnapshot | null;
  onStartClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
  onCloseComplete: () => void;
}

interface OutgoingMemberState {
  member: OrderedMember;
  direction: -1 | 1;
  key: number;
}

const EASE_OUT_EXPO = 'cubic-bezier(0.22, 1, 0.36, 1)';

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Member profile modal driven purely by Web Animations API (`transform` & `opacity` only):
 * - Opens via FLIP from a fixed-position card clone into the fixed centered panel (150-900ms)
 * - Staggers quote + prev/counter/next reveal by 60ms (700-1000ms)
 * - Crossfades + slides 24px on Prev/Next (200ms)
 * - Reverses smoothly back into the active card on close
 */
export function MemberProfileModal({
  member,
  activeIndex,
  totalCount,
  flipCardRect,
  isReducedMotion,
  getActiveCardRect,
  onStartClose,
  onNavigate,
  onCloseComplete,
}: MemberProfileModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const avatarWrapRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const outgoingRef = useRef<HTMLDivElement | null>(null);
  const quoteWrapRef = useRef<HTMLDivElement | null>(null);
  const prevBtnRef = useRef<HTMLButtonElement | null>(null);
  const counterRef = useRef<HTMLSpanElement | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const activeCloneRef = useRef<HTMLDivElement | null>(null);
  const isOpeningRef = useRef(!isReducedMotion && Boolean(flipCardRect));
  const isClosingRef = useRef(false);
  const navDirectionRef = useRef<-1 | 1>(1);
  const prevMemberRef = useRef<OrderedMember>(member);
  const navSeqRef = useRef(0);
  const activeAnimsRef = useRef<Animation[]>([]);

  const [fallbackPhotos, setFallbackPhotos] = useState<Record<string, boolean>>({});
  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({});
  const [outgoing, setOutgoing] = useState<OutgoingMemberState | null>(null);

  const onNavigateRef = useRef(onNavigate);
  const onStartCloseRef = useRef(onStartClose);
  const onCloseCompleteRef = useRef(onCloseComplete);
  const getActiveCardRectRef = useRef(getActiveCardRect);
  onNavigateRef.current = onNavigate;
  onStartCloseRef.current = onStartClose;
  onCloseCompleteRef.current = onCloseComplete;
  getActiveCardRectRef.current = getActiveCardRect;

  const trackAnim = (anim: Animation): Animation => {
    activeAnimsRef.current.push(anim);
    return anim;
  };

  // Initial FLIP expand (150-900ms relative to click, or 150ms fade in reduced-motion)
  useLayoutEffect(() => {
    const backdrop = backdropRef.current;
    const shell = shellRef.current;
    const avatarWrap = avatarWrapRef.current;
    const quoteWrap = quoteWrapRef.current;
    const prevBtn = prevBtnRef.current;
    const counterEl = counterRef.current;
    const nextBtn = nextBtnRef.current;

    if (isReducedMotion || !flipCardRect || !shell) {
      isOpeningRef.current = false;
      const anims: Animation[] = [];
      if (backdrop) {
        anims.push(
          backdrop.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 150,
            easing: 'ease-out',
            fill: 'forwards',
          }),
        );
      }
      if (shell) {
        anims.push(
          shell.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 150,
            easing: 'ease-out',
            fill: 'forwards',
          }),
        );
      }
      const focusTimer = window.setTimeout(() => {
        closeBtnRef.current?.focus({ preventScroll: true });
      }, 60);
      return () => {
        window.clearTimeout(focusTimer);
        for (const a of anims) a.cancel();
      };
    }

    const panelRect = shell.getBoundingClientRect();
    const flip = computeFlipCardToPanel(flipCardRect, panelRect);

    shell.style.willChange = 'transform, opacity';
    if (avatarWrap) avatarWrap.style.willChange = 'transform, opacity';
    if (quoteWrap) quoteWrap.style.willChange = 'transform, opacity';
    if (prevBtn) prevBtn.style.willChange = 'transform, opacity';
    if (counterEl) counterEl.style.willChange = 'transform, opacity';
    if (nextBtn) nextBtn.style.willChange = 'transform, opacity';

    // Fixed-position card clone at exact on-screen rect -> expands/crossfades into panel
    const dialogEl = dialogRef.current;
    let cloneEl: HTMLDivElement | null = null;
    if (dialogEl) {
      cloneEl = document.createElement('div');
      cloneEl.setAttribute('aria-hidden', 'true');
      cloneEl.style.position = 'fixed';
      cloneEl.style.left = `${flipCardRect.left}px`;
      cloneEl.style.top = `${flipCardRect.top}px`;
      cloneEl.style.width = `${flipCardRect.width}px`;
      cloneEl.style.height = `${flipCardRect.height}px`;
      cloneEl.style.zIndex = '90';
      cloneEl.style.pointerEvents = 'none';
      cloneEl.style.willChange = 'transform, opacity';
      cloneEl.style.display = 'flex';
      cloneEl.style.alignItems = 'center';
      cloneEl.style.gap = '12px';
      cloneEl.style.padding = '10px 14px';
      cloneEl.style.borderRadius = '3px';
      cloneEl.style.backgroundColor = 'rgba(23, 28, 12, 0.96)';
      cloneEl.style.border = '1px solid rgba(212, 188, 116, 0.72)';
      cloneEl.style.boxSizing = 'border-box';
      cloneEl.style.overflow = 'hidden';

      const thumbSrc = resolveMemberThumbSrc(member.photo);
      const thumbSize = member.side === 'center' ? 44 : 40;
      const avatarHtml = thumbSrc
        ? `<img src="${escapeHtml(thumbSrc)}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:${escapeHtml(member.objectPosition)};border-radius:9999px;" />`
        : `<svg viewBox="0 0 20 20" style="width:14px;height:14px;color:#c9d98a;"><path fill="currentColor" d="M10 1.8C6.3 5.5 4.7 9.7 5.5 14C6 16.4 7.8 18 10 18.6C12.2 18 14 16.4 14.5 14C15.3 9.7 13.7 5.5 10 1.8Z"/></svg>`;

      cloneEl.innerHTML = `
        <span style="display:flex;flex-shrink:0;align-items:center;justify-content:center;overflow:hidden;border-radius:9999px;width:${thumbSize}px;height:${thumbSize}px;background:#202414;border:1px solid rgba(212,188,116,0.55);">${avatarHtml}</span>
        <span style="min-width:0;flex:1;text-align:left;">
          <span style="display:block;font-family:var(--font-serif);font-size:1.08rem;font-weight:500;line-height:1.15;color:#ede6ca;">${escapeHtml(member.name)}</span>
          <span style="display:block;margin-top:2px;font-size:11px;font-weight:500;letter-spacing:0.11em;font-variant-caps:small-caps;color:#cfc8aa;">${escapeHtml(member.displayRole)}</span>
        </span>
      `;
      dialogEl.appendChild(cloneEl);
      activeCloneRef.current = cloneEl;

      const cloneAnim = trackAnim(
        cloneEl.animate(
          [
            { transform: 'translate3d(0, 0, 0) scale(1, 1)', opacity: 1 },
            { transform: flip.cloneToTransform, opacity: 0 },
          ],
          { duration: 280, easing: EASE_OUT_EXPO, fill: 'forwards' },
        ),
      );
      cloneAnim.finished
        .catch(() => {})
        .finally(() => {
          cloneEl?.remove();
          if (activeCloneRef.current === cloneEl) activeCloneRef.current = null;
        });
    }

    if (backdrop) {
      trackAnim(
        backdrop.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 420,
          easing: EASE_OUT_EXPO,
          fill: 'forwards',
        }),
      );
    }

    const shellAnim = trackAnim(
      shell.animate(
        [
          { offset: 0, transform: flip.panelFromTransform, opacity: 0 },
          { offset: 0.16, opacity: 1 },
          { offset: 1, transform: flip.panelToTransform, opacity: 1 },
        ],
        { duration: 750, easing: EASE_OUT_EXPO, fill: 'forwards' },
      ),
    );

    if (avatarWrap) {
      trackAnim(
        avatarWrap.animate(
          [
            { transform: 'scale(0.34)', opacity: 0.72 },
            { transform: 'scale(1)', opacity: 1 },
          ],
          { duration: 750, easing: EASE_OUT_EXPO, fill: 'forwards' },
        ),
      );
    }

    // REVEAL (700-1000ms relative to initial click => 550ms+ after t=150ms mount, 60ms stagger)
    const revealItems: Array<{ el: HTMLElement | null; delay: number; duration: number }> = [
      { el: quoteWrap, delay: 550, duration: 240 },
      { el: prevBtn, delay: 610, duration: 220 },
      { el: counterEl, delay: 670, duration: 200 },
      { el: nextBtn, delay: 730, duration: 180 },
    ];
    let lastRevealAnim: Animation | null = null;
    for (const item of revealItems) {
      if (!item.el) continue;
      lastRevealAnim = trackAnim(
        item.el.animate(
          [
            { opacity: 0, transform: 'translate3d(0, 12px, 0)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0)' },
          ],
          {
            delay: item.delay,
            duration: item.duration,
            easing: EASE_OUT_EXPO,
            fill: 'both',
          },
        ),
      );
    }

    const clearWillChange = () => {
      shell.style.willChange = 'auto';
      if (avatarWrap) avatarWrap.style.willChange = 'auto';
      if (quoteWrap) quoteWrap.style.willChange = 'auto';
      if (prevBtn) prevBtn.style.willChange = 'auto';
      if (counterEl) counterEl.style.willChange = 'auto';
      if (nextBtn) nextBtn.style.willChange = 'auto';
    };

    const unlockTimer = window.setTimeout(() => {
      isOpeningRef.current = false;
      closeBtnRef.current?.focus({ preventScroll: true });
    }, 760);

    shellAnim.finished.catch(() => {}).finally(() => {
      if (!isClosingRef.current) {
        isOpeningRef.current = false;
      }
    });
    (lastRevealAnim ?? shellAnim).finished.catch(() => {}).finally(clearWillChange);

    return () => {
      window.clearTimeout(unlockTimer);
      cloneEl?.remove();
      for (const a of activeAnimsRef.current) a.cancel();
      activeAnimsRef.current = [];
    };
    // Mount-only entrance sequence tied to initial flipCardRect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prev/Next crossfade + 24px directional slide (200ms)
  useLayoutEffect(() => {
    const prev = prevMemberRef.current;
    if (prev.id === member.id) return;
    prevMemberRef.current = member;

    const content = contentRef.current;
    if (!content) return;

    const dir = navDirectionRef.current;
    if (isReducedMotion) {
      const anim = content.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 150,
        easing: 'ease-out',
      });
      return () => anim.cancel();
    }

    content.style.willChange = 'transform, opacity';
    const inAnim = content.animate(
      [
        { opacity: 0, transform: `translate3d(${dir * 24}px, 0, 0)` },
        { opacity: 1, transform: 'translate3d(0, 0, 0)' },
      ],
      {
        duration: 200,
        easing: EASE_OUT_EXPO,
        fill: 'forwards',
      },
    );

    const outEl = outgoingRef.current;
    let outAnim: Animation | null = null;
    if (outEl) {
      outEl.style.willChange = 'transform, opacity';
      outAnim = outEl.animate(
        [
          { opacity: 1, transform: 'translate3d(0, 0, 0)' },
          { opacity: 0, transform: `translate3d(${-dir * 24}px, 0, 0)` },
        ],
        {
          duration: 200,
          easing: EASE_OUT_EXPO,
          fill: 'forwards',
        },
      );
    }

    const doneTimer = window.setTimeout(() => {
      setOutgoing(null);
      content.style.willChange = 'auto';
    }, 215);

    inAnim.finished.catch(() => {}).finally(() => {
      content.style.willChange = 'auto';
    });

    return () => {
      window.clearTimeout(doneTimer);
      inAnim.cancel();
      outAnim?.cancel();
      content.style.willChange = 'auto';
    };
  }, [isReducedMotion, member]);

  const requestAnimatedClose = useCallback(() => {
    if (isClosingRef.current || isOpeningRef.current) return;
    isClosingRef.current = true;

    activeCloneRef.current?.remove();
    activeCloneRef.current = null;
    for (const a of activeAnimsRef.current) a.cancel();
    activeAnimsRef.current = [];

    if (dialogRef.current) {
      dialogRef.current.style.pointerEvents = 'none';
    }

    onStartCloseRef.current();

    const backdrop = backdropRef.current;
    const shell = shellRef.current;
    const avatarWrap = avatarWrapRef.current;
    const quoteWrap = quoteWrapRef.current;
    const prevBtn = prevBtnRef.current;
    const counterEl = counterRef.current;
    const nextBtn = nextBtnRef.current;

    if (isReducedMotion || (!backdrop && !shell)) {
      const anims: Animation[] = [];
      if (backdrop) {
        anims.push(
          backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 150,
            easing: 'ease-out',
            fill: 'forwards',
          }),
        );
      }
      if (shell) {
        anims.push(
          shell.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 150,
            easing: 'ease-out',
            fill: 'forwards',
          }),
        );
      }
      const primary = anims[anims.length - 1];
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(t);
        onCloseCompleteRef.current();
      };
      const t = window.setTimeout(finish, 175);
      primary?.finished.catch(() => {}).finally(finish);
      return;
    }

    const cardRect = getActiveCardRectRef.current();
    const panelRect = shell?.getBoundingClientRect() ?? null;
    const flip = cardRect && panelRect ? computeFlipCardToPanel(cardRect, panelRect) : null;

    if (shell) shell.style.willChange = 'transform, opacity';
    if (avatarWrap) avatarWrap.style.willChange = 'transform, opacity';

    // Reverse content/controls quickly
    for (const el of [quoteWrap, prevBtn, counterEl, nextBtn]) {
      if (!el) continue;
      el.animate(
        [
          { opacity: 1, transform: 'translate3d(0, 0, 0)' },
          { opacity: 0, transform: 'translate3d(0, 12px, 0)' },
        ],
        { duration: 150, easing: EASE_OUT_EXPO, fill: 'forwards' },
      );
    }

    if (shell) {
      shell.animate(
        [
          { offset: 0, transform: 'translate3d(0, 0, 0) scale(1, 1)', opacity: 1 },
          { offset: 0.78, opacity: 0.9 },
          {
            offset: 1,
            transform: flip ? flip.panelFromTransform : 'translate3d(0, 0, 0) scale(0.85, 0.85)',
            opacity: 0,
          },
        ],
        { duration: 500, easing: EASE_OUT_EXPO, fill: 'forwards' },
      );
    }

    if (avatarWrap) {
      avatarWrap.animate(
        [
          { transform: 'scale(1)', opacity: 1 },
          { transform: 'scale(0.34)', opacity: 0.72 },
        ],
        { duration: 500, easing: EASE_OUT_EXPO, fill: 'forwards' },
      );
    }

    if (backdrop) {
      backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 500,
        delay: 80,
        easing: EASE_OUT_EXPO,
        fill: 'forwards',
      });
    }

    const finishTimer = window.setTimeout(() => {
      if (shell) shell.style.willChange = 'auto';
      if (avatarWrap) avatarWrap.style.willChange = 'auto';
      onCloseCompleteRef.current();
    }, 660);

    return () => window.clearTimeout(finishTimer);
  }, [isReducedMotion]);

  const triggerNavigate = useCallback(
    (direction: -1 | 1) => {
      if (isClosingRef.current || isOpeningRef.current) return;
      navDirectionRef.current = direction;
      navSeqRef.current += 1;
      setOutgoing({
        member: prevMemberRef.current,
        direction,
        key: navSeqRef.current,
      });
      onNavigateRef.current(direction);
    },
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isClosingRef.current || isOpeningRef.current) return;

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
      if (
        isClosingRef.current ||
        isOpeningRef.current ||
        !touchStartRef.current ||
        event.changedTouches.length !== 1
      ) {
        return;
      }
      const dx = event.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = event.changedTouches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = null;
      if (Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        triggerNavigate(dx < 0 ? 1 : -1);
      }
    },
    [triggerNavigate],
  );

  const renderMemberIdentityAndQuote = (target: OrderedMember, isIncoming: boolean) => {
    const useFallback = fallbackPhotos[target.id];
    const portraitSrc = useFallback
      ? resolveMemberFallbackSrc(target.photo)
      : resolveMemberPortraitSrc(target.photo);
    const hasPhoto = Boolean(portraitSrc) && !failedPhotos[target.id];
    const quoteText = target.quote.trim();

    return (
      <>
        {/* Circular Portrait (scales up inside panel on FLIP open) */}
        <div
          ref={isIncoming ? avatarWrapRef : undefined}
          className="relative z-10 mt-2 flex h-[126px] w-[126px] sm:h-[136px] sm:w-[136px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#d4bc74]/65 bg-[#232814]"
        >
          {hasPhoto && portraitSrc ? (
            <img
              src={portraitSrc}
              alt={isIncoming ? target.name : ''}
              width={240}
              height={240}
              decoding="async"
              style={{ objectPosition: useFallback ? target.objectPosition : '50% 50%' }}
              onError={() => {
                if (!useFallback) {
                  setFallbackPhotos((prev) => ({ ...prev, [target.id]: true }));
                } else {
                  setFailedPhotos((prev) => ({ ...prev, [target.id]: true }));
                }
              }}
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

        {/* Header Identity (name and role stay anchored) */}
        <div className="mt-6 flex w-full shrink-0 flex-col items-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#a9b47e]">
            {target.groupLabel}
          </p>

          <h3
            id={isIncoming ? 'member-profile-name' : undefined}
            className="mt-1.5 font-serif text-[1.75rem] sm:text-[2.1rem] font-medium leading-[1.08] text-[#ede6ca] [text-wrap:balance]"
          >
            {target.name}
          </h3>

          <p
            style={{ fontVariantCaps: 'small-caps' }}
            className="mt-1 text-sm font-medium tracking-[0.12em] text-[#cfc8aa]"
          >
            {target.displayRole}
          </p>
        </div>

        {/* Quote Area (ONLY area allowed to scroll; scrollbar hidden) */}
        <div
          ref={isIncoming ? quoteWrapRef : undefined}
          data-testid={isIncoming ? 'member-quote-scroll' : undefined}
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

              {target.quoteBy && (
                <figcaption className="mt-2 text-xs font-medium tracking-[0.14em] text-[#cfc8aa]">
                  &mdash; {target.quoteBy}
                </figcaption>
              )}
            </figure>
          )}
        </div>
      </>
    );
  };

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

      {/* Fixed-size modal shell (rendered at FINAL size; FLIP animated with transform & opacity only) */}
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
        {/* Close Button (transform & opacity transitions only) */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={requestAnimatedClose}
          aria-label="Close member profile"
          className="absolute top-3.5 right-3.5 z-30 flex h-10 w-10 items-center justify-center rounded-[2px] border border-[#ede6ca]/28 bg-[#14180a] text-[#ede6ca] opacity-90 transition-[transform,opacity] duration-150 hover:opacity-100 hover:border-[#ede6ca]/65 hover:bg-[#1e2410] active:scale-95 cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Main Content Viewport (overlapping grid for 200ms Prev/Next crossfade) */}
        <div className="relative z-10 grid min-h-0 flex-1 overflow-hidden px-6 pt-8 sm:px-9 sm:pt-9">
          {outgoing && (
            <div
              key={`out-${outgoing.key}`}
              ref={outgoingRef}
              aria-hidden="true"
              style={{ gridArea: '1 / 1' }}
              className="pointer-events-none flex min-h-0 flex-col items-center overflow-hidden"
            >
              {renderMemberIdentityAndQuote(outgoing.member, false)}
            </div>
          )}

          <div
            ref={contentRef}
            style={{ gridArea: '1 / 1' }}
            className="flex min-h-0 flex-col items-center overflow-hidden"
          >
            {renderMemberIdentityAndQuote(member, true)}
          </div>
        </div>

        {/* Fixed Bottom Controls (Prev / Counter / Next always visible) */}
        <div
          data-testid="member-modal-footer"
          className="relative z-20 flex w-full shrink-0 items-center justify-center gap-4 border-t border-[#ede6ca]/10 bg-[#12160a] px-6 py-4"
        >
          <button
            ref={prevBtnRef}
            type="button"
            onClick={() => triggerNavigate(-1)}
            aria-label="Previous Executive Board member"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ede6ca]/35 bg-[#14180a] text-[#ede6ca] opacity-90 transition-[transform,opacity] duration-150 hover:opacity-100 hover:border-[#ede6ca] hover:bg-[#1e2410] active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          <span
            ref={counterRef}
            data-testid="member-modal-counter"
            className="min-w-[60px] text-center text-xs font-medium tracking-[0.2em] text-[#cfc8aa] tabular-nums"
          >
            {activeIndex + 1} / {totalCount}
          </span>

          <button
            ref={nextBtnRef}
            type="button"
            onClick={() => triggerNavigate(1)}
            aria-label="Next Executive Board member"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ede6ca]/35 bg-[#14180a] text-[#ede6ca] opacity-90 transition-[transform,opacity] duration-150 hover:opacity-100 hover:border-[#ede6ca] hover:bg-[#1e2410] active:scale-95 cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
