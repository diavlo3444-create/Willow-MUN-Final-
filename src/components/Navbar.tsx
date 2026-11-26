import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Menu, X } from 'lucide-react';
import { CONFERENCE_DATA } from '../data/conference';
import { usePublishedWebsite } from '../utils/usePublishedWebsite';

/**
 * Three-zone institutional header:
 * - Zone 1: Willow MUN single-line conference lockup
 * - Zone 2: Typographic navigation links with sliding baseline indicator
 * - Zone 3: Single rectangular institutional CTA + full-screen mobile index drawer trigger
 */
export function Navbar() {
  const { published } = usePublishedWebsite();
  const navLinks = useMemo(
    () =>
      published.navigation.filter((n) => n.visible).length > 0
        ? [...published.navigation].filter((n) => n.visible).sort((a, b) => a.order - b.order)
        : CONFERENCE_DATA.navLinks,
    [published.navigation],
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);

  const headerRef = useRef<HTMLElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const syncNavHeight = () => {
      const h = Math.ceil(header.getBoundingClientRect().height);
      if (h > 0) {
        document.documentElement.style.setProperty('--nav-height', `${h}px`);
      }
    };
    syncNavHeight();
    const ro = new ResizeObserver(syncNavHeight);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  const updateUnderlinePosition = useCallback((href: string | null) => {
    if (!href || !navRef.current) {
      setUnderline(null);
      return;
    }
    const linkEl = linkRefs.current[href];
    if (!linkEl) {
      setUnderline(null);
      return;
    }
    setUnderline({
      left: linkEl.offsetLeft,
      width: linkEl.offsetWidth,
    });
  }, []);

  useEffect(() => {
    const sectionIds = navLinks.map((link) => link.href.replace(/^#/, ''));
    const intersectingIds = new Set<string>();

    const pickActive = () => {
      const vh = window.innerHeight || 1;
      let bestId: string | null = null;
      let bestScore = 0;

      for (const id of sectionIds) {
        if (!intersectingIds.has(id)) continue;
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const visibleHeight = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
        if (visibleHeight > bestScore) {
          bestScore = visibleHeight;
          bestId = id;
        }
      }

      setActiveHref(bestId ? `#${bestId}` : null);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            intersectingIds.add(entry.target.id);
          } else {
            intersectingIds.delete(entry.target.id);
          }
        }
        pickActive();
      },
      {
        rootMargin: '-20% 0px -35% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75],
      },
    );

    for (const id of sectionIds) {
      const target = document.getElementById(id);
      if (target) observer.observe(target);
    }

    return () => observer.disconnect();
  }, [navLinks]);

  useEffect(() => {
    updateUnderlinePosition(activeHref);
    const onResize = () => updateUnderlinePosition(activeHref);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [activeHref, updateUnderlinePosition]);

  useEffect(() => {
    if (!menuOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleAnchorClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = document.querySelector(href);
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setMenuOpen(false);
  };

  return (
    <>
      <header
        ref={headerRef}
        className="chrome mun-nav-flat fixed top-0 inset-x-0 z-30 border-b border-[#ede6ca]/16 pt-[env(safe-area-inset-top)]"
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 sm:gap-8 px-[clamp(16px,4vw,48px)] py-2.5">
          {/* Zone 1: Single-line conference wordmark */}
          <a
            href="#top"
            onClick={(e) => handleAnchorClick(e, '#top')}
            className="flex items-center gap-2.5 text-[#ede6ca] whitespace-nowrap shrink-0 min-h-[40px]"
            aria-label="Willow MUN home"
          >
            <img
              src={CONFERENCE_DATA.brand.logoSrc}
              alt=""
              width={26}
              height={26}
              className="h-[26px] w-[26px] object-contain shrink-0"
            />
            <span className="font-serif text-[clamp(1.15rem,3vw,1.42rem)] font-medium tracking-[0.02em] text-[#ede6ca]">
              {CONFERENCE_DATA.brand.name}
            </span>
          </a>

          {/* Zone 2: Desktop Navigation Links */}
          <nav
            ref={navRef}
            aria-label="Primary navigation"
            className="relative hidden md:flex items-center gap-7"
          >
            {navLinks.map((link) => {
              const isActive = activeHref === link.href;
              return (
                <a
                  key={link.href}
                  ref={(el) => {
                    linkRefs.current[link.href] = el;
                  }}
                  href={link.href}
                  onClick={(e) => handleAnchorClick(e, link.href)}
                  aria-current={isActive ? 'location' : undefined}
                  className={`inline-flex items-center min-h-[40px] text-[13px] font-medium tracking-[0.025em] transition-opacity duration-150 whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#ede6ca] opacity-100'
                      : 'text-[#cfc8aa] opacity-85 hover:text-[#ede6ca] hover:opacity-100'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}

            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[4px] left-0 h-[1.5px] w-px bg-[#a9b47e]"
              style={{
                transformOrigin: 'left center',
                transform: underline
                  ? `translate3d(${underline.left}px, 0, 0) scaleX(${underline.width})`
                  : 'translate3d(0, 0, 0) scaleX(0)',
                opacity: underline ? 1 : 0,
                transition:
                  'transform 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease',
              }}
            />
          </nav>

          {/* Zone 3: Single crisp primary action + Mobile Drawer Trigger */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a
              href="#apply"
              onClick={(e) => handleAnchorClick(e, '#apply')}
              className="mun-btn-interactive inline-flex items-center justify-center min-h-[38px] sm:min-h-[40px] rounded-[2px] bg-[#ede6ca] px-4 py-2 text-xs sm:text-[13px] font-semibold text-[#181c0d] hover:bg-[#dad3b4] whitespace-nowrap shrink-0"
            >
              Apply Now
            </a>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
              aria-label="Open navigation menu"
              className="mun-btn-interactive md:hidden inline-flex h-10 w-10 items-center justify-center rounded-[2px] border border-[#ede6ca]/25 text-[#ede6ca] cursor-pointer"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Full-Screen Editorial Index Drawer (<768px) */}
      {menuOpen && (
        <div
          id="mobile-nav-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className="fixed inset-0 z-50 flex flex-col justify-between bg-[#111508]/98 px-[clamp(16px,5vw,32px)] pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] md:hidden"
        >
          <div className="flex items-center justify-between border-b border-[#ede6ca]/16 pb-3.5">
            <a
              href="#top"
              onClick={(e) => handleAnchorClick(e, '#top')}
              className="flex items-center gap-2.5 text-[#ede6ca] min-h-[44px]"
            >
              <img
                src={CONFERENCE_DATA.brand.logoSrc}
                alt=""
                width={26}
                height={26}
                className="h-[26px] w-[26px] object-contain"
              />
              <span className="font-serif text-xl font-medium tracking-[0.02em]">
                {CONFERENCE_DATA.brand.name}
              </span>
            </a>

            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close navigation menu"
              className="mun-btn-interactive inline-flex h-11 w-11 items-center justify-center rounded-[2px] border border-[#ede6ca]/25 text-[#ede6ca] cursor-pointer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="my-auto py-4">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[#a9b47e]">
              Conference Prospectus
            </p>
            <nav aria-label="Mobile links" className="flex flex-col divide-y divide-[#ede6ca]/14 border-y border-[#ede6ca]/14">
              {navLinks.map((link, idx) => {
                const isActive = activeHref === link.href;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleAnchorClick(e, link.href)}
                    aria-current={isActive ? 'location' : undefined}
                    style={{ animationDelay: `${idx * 35}ms` }}
                    className={`mun-mobile-link-enter flex items-baseline justify-between font-serif text-[28px] font-medium py-3.5 transition-opacity duration-150 ${
                      isActive
                        ? 'text-[#a9b47e] opacity-100'
                        : 'text-[#ede6ca] opacity-90 hover:opacity-100'
                    }`}
                  >
                    <span>{link.label}</span>
                    <span className="font-mono text-xs text-[#cfc8aa]/70 tabular-nums">
                      0{idx + 1}
                    </span>
                  </a>
                );
              })}
            </nav>
          </div>

          <div className="space-y-3 border-t border-[#ede6ca]/14 pt-4">
            <p className="text-xs text-[#cfc8aa]">
              Inaugural Youth Diplomatic Assembly · {CONFERENCE_DATA.brand.year}
            </p>
            <a
              href="#apply"
              onClick={(e) => handleAnchorClick(e, '#apply')}
              className="mun-btn-interactive flex w-full items-center justify-center min-h-[46px] rounded-[2px] bg-[#ede6ca] px-6 py-3.5 text-sm font-semibold text-[#181c0d] hover:bg-[#dad3b4]"
            >
              Apply to Join
            </a>
          </div>
        </div>
      )}
    </>
  );
}
