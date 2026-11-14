import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Menu, X } from 'lucide-react';
import { CONFERENCE_DATA } from '../data/conference';
import { MagneticWrap } from './MagneticWrap';

/**
 * Top navigation:
 * - Highlights active section via IntersectionObserver with a sliding cream underline (transform + opacity only)
 * - Smooth-scrolls to clicked section anchors
 * - Desktop: magnetic "Apply Now" pill with hover/press scale
 * - Mobile: full-screen menu whose links slide in 60ms apart; Escape or tap closes it
 */
export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);

  const navRef = useRef<HTMLElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

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

  // Track active section in viewport via IntersectionObserver
  useEffect(() => {
    const sectionIds = CONFERENCE_DATA.navLinks.map((link) => link.href.slice(1));
    const visibleRatios = new Map<string, number>();

    const pickActive = () => {
      let bestId: string | null = null;
      let bestRatio = 0;

      for (const id of sectionIds) {
        const ratio = visibleRatios.get(id) ?? 0;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestId = id;
        }
      }

      setActiveHref(bestId ? `#${bestId}` : null);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibleRatios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        pickActive();
      },
      {
        rootMargin: '-25% 0px -45% 0px',
        threshold: [0, 0.15, 0.35, 0.6],
      },
    );

    for (const id of sectionIds) {
      const target = document.getElementById(id);
      if (target) observer.observe(target);
    }

    return () => observer.disconnect();
  }, []);

  // Reposition sliding underline whenever activeHref or viewport size changes
  useEffect(() => {
    updateUnderlinePosition(activeHref);
    const onResize = () => updateUnderlinePosition(activeHref);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [activeHref, updateUnderlinePosition]);

  // Close mobile menu on Escape
  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
      <header className="chrome fixed top-0 inset-x-0 z-30 mun-nav-flat border-b border-[#ede6ca]/15 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-5 sm:px-8 md:px-12 py-3">
          {/* Zone 1: Logo + Willow MUN */}
          <a
            href="#top"
            onClick={(e) => handleAnchorClick(e, '#top')}
            className="flex items-center gap-2.5 text-[#ede6ca] whitespace-nowrap shrink-0 min-h-[44px]"
            aria-label="Willow MUN home"
          >
            <img
              src={CONFERENCE_DATA.brand.logoSrc}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 object-contain shrink-0"
            />
            <span className="font-serif text-xl sm:text-2xl font-medium tracking-[0.04em] text-[#ede6ca]">
              {CONFERENCE_DATA.brand.name}
            </span>
          </a>

          {/* Zone 2: Desktop Navigation Links + Sliding Cream Underline */}
          <nav
            ref={navRef}
            aria-label="Primary navigation"
            className="relative hidden md:flex items-center gap-7"
          >
            {CONFERENCE_DATA.navLinks.map((link) => {
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
                  className={`inline-flex items-center min-h-[44px] text-sm font-medium transition-colors duration-200 whitespace-nowrap shrink-0 ${
                    isActive ? 'text-[#ede6ca]' : 'text-[#cfc8aa] hover:text-[#ede6ca]'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}

            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[6px] left-0 h-[1.5px] w-px bg-[#ede6ca]"
              style={{
                transformOrigin: 'left center',
                transform: underline
                  ? `translate3d(${underline.left}px, 0, 0) scaleX(${underline.width})`
                  : 'translate3d(0, 0, 0) scaleX(0)',
                opacity: underline ? 1 : 0,
                transition:
                  'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease',
              }}
            />
          </nav>

          {/* Zone 3: Magnetic Cream Apply Now Pill + Mobile Hamburger */}
          <div className="flex items-center gap-3 shrink-0">
            <MagneticWrap className="hidden md:inline-block">
              <a
                href="#apply"
                onClick={(e) => handleAnchorClick(e, '#apply')}
                className="mun-btn-interactive inline-flex items-center justify-center rounded-full bg-[#ede6ca] px-5 py-2 text-xs sm:text-sm font-medium text-[#232814] hover:bg-[#cfc8aa] whitespace-nowrap shrink-0"
              >
                Apply Now
              </a>
            </MagneticWrap>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
              aria-label="Open navigation menu"
              className="mun-btn-interactive md:hidden inline-flex h-11 w-11 items-center justify-center rounded-sm border border-[#ede6ca]/25 text-[#ede6ca] hover:border-[#ede6ca]/60 cursor-pointer"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Full-Screen Menu */}
      {menuOpen && (
        <div
          id="mobile-nav-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className="fixed inset-0 z-50 flex flex-col justify-between bg-[#14180a]/96 px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] md:hidden"
        >
          <div className="flex items-center justify-between">
            <a
              href="#top"
              onClick={(e) => handleAnchorClick(e, '#top')}
              className="flex items-center gap-2.5 text-[#ede6ca] min-h-[44px]"
            >
              <img
                src={CONFERENCE_DATA.brand.logoSrc}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
              <span className="font-serif text-xl font-medium tracking-[0.04em]">
                {CONFERENCE_DATA.brand.name}
              </span>
            </a>

            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close navigation menu"
              className="mun-btn-interactive inline-flex h-11 w-11 items-center justify-center rounded-sm border border-[#ede6ca]/25 text-[#ede6ca] hover:border-[#ede6ca]/60 cursor-pointer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Mobile links" className="flex flex-col gap-2 my-auto py-8">
            {CONFERENCE_DATA.navLinks.map((link, idx) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleAnchorClick(e, link.href)}
                style={{ animationDelay: `${idx * 60}ms` }}
                className="mun-mobile-link-enter font-serif text-3xl font-medium text-[#ede6ca] hover:text-[#a9b47e] py-2.5 border-b border-[#ede6ca]/12 transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div
            style={{ animationDelay: `${CONFERENCE_DATA.navLinks.length * 60}ms` }}
            className="mun-mobile-link-enter"
          >
            <a
              href="#apply"
              onClick={(e) => handleAnchorClick(e, '#apply')}
              className="mun-btn-interactive flex w-full items-center justify-center rounded-full bg-[#ede6ca] px-6 py-3.5 text-sm font-medium text-[#232814] hover:bg-[#cfc8aa]"
            >
              Apply Now
            </a>
          </div>
        </div>
      )}
    </>
  );
}
