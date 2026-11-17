import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Menu, X } from 'lucide-react';
import { CONFERENCE_DATA } from '../data/conference';
import { MagneticWrap } from './MagneticWrap';

/**
 * Top navigation:
 * - Collapses below 768px into a hamburger button opening a full-screen overlay menu
 * - Keeps the "Apply Now" pill CTA always visible across desktop and mobile
 * - Highlights exactly one active nav link in view via IntersectionObserver
 */
export function Navbar() {
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

  // Track single most-prominent section in viewport via IntersectionObserver
  useEffect(() => {
    const sectionIds = CONFERENCE_DATA.navLinks.map((link) => link.href.slice(1));
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
  }, []);

  // Reposition sliding underline whenever activeHref or viewport size changes
  useEffect(() => {
    updateUnderlinePosition(activeHref);
    const onResize = () => updateUnderlinePosition(activeHref);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [activeHref, updateUnderlinePosition]);

  // Close mobile menu on Escape and lock background scroll while open
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
        className="chrome fixed top-0 inset-x-0 z-30 mun-nav-flat border-b border-[#ede6ca]/15 pt-[env(safe-area-inset-top)]"
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 sm:gap-6 px-[clamp(16px,4vw,48px)] py-3">
          {/* Zone 1: Logo + Willow MUN */}
          <a
            href="#top"
            onClick={(e) => handleAnchorClick(e, '#top')}
            className="flex items-center gap-2 sm:gap-2.5 text-[#ede6ca] whitespace-nowrap shrink-0 min-h-[44px]"
            aria-label="Willow MUN home"
          >
            <img
              src={CONFERENCE_DATA.brand.logoSrc}
              alt=""
              width={32}
              height={32}
              className="h-7 w-7 sm:h-8 sm:w-8 object-contain shrink-0"
            />
            <span className="font-serif text-[clamp(1.1rem,4vw,1.5rem)] font-medium tracking-[0.04em] text-[#ede6ca]">
              {CONFERENCE_DATA.brand.name}
            </span>
          </a>

          {/* Zone 2: Desktop Navigation Links (768px+) + Sliding Cream Underline */}
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
                  className={`inline-flex items-center min-h-[44px] text-sm font-medium transition-opacity duration-200 whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#ede6ca] opacity-100'
                      : 'text-[#ede6ca] opacity-70 hover:opacity-100'
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
                  'transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease',
              }}
            />
          </nav>

          {/* Zone 3: Always-Visible Apply Now Pill + Mobile Hamburger (<768px) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <MagneticWrap>
              <a
                href="#apply"
                onClick={(e) => handleAnchorClick(e, '#apply')}
                className="mun-btn-interactive inline-flex items-center justify-center min-h-[40px] sm:min-h-[44px] rounded-full bg-[#ede6ca] px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-medium text-[#232814] hover:opacity-90 whitespace-nowrap shrink-0"
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
              className="mun-btn-interactive md:hidden inline-flex h-10 w-10 items-center justify-center rounded-sm border border-[#ede6ca]/25 text-[#ede6ca] cursor-pointer"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Full-Screen Overlay Menu (<768px) */}
      {menuOpen && (
        <div
          id="mobile-nav-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className="fixed inset-0 z-50 flex flex-col justify-between bg-[#14180a]/96 px-[clamp(16px,4vw,48px)] pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] md:hidden"
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
              className="mun-btn-interactive inline-flex h-11 w-11 items-center justify-center rounded-sm border border-[#ede6ca]/25 text-[#ede6ca] cursor-pointer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Mobile links" className="flex flex-col gap-2 my-auto py-8">
            {CONFERENCE_DATA.navLinks.map((link, idx) => {
              const isActive = activeHref === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleAnchorClick(e, link.href)}
                  aria-current={isActive ? 'location' : undefined}
                  style={{ animationDelay: `${idx * 45}ms` }}
                  className={`mun-mobile-link-enter font-serif text-3xl font-medium py-2.5 border-b border-[#ede6ca]/12 transition-opacity duration-200 ${
                    isActive
                      ? 'text-[#a9b47e] opacity-100'
                      : 'text-[#ede6ca] opacity-85 hover:opacity-100'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          <div
            style={{ animationDelay: `${CONFERENCE_DATA.navLinks.length * 45}ms` }}
            className="mun-mobile-link-enter"
          >
            <a
              href="#apply"
              onClick={(e) => handleAnchorClick(e, '#apply')}
              className="mun-btn-interactive flex w-full items-center justify-center min-h-[44px] rounded-full bg-[#ede6ca] px-6 py-3.5 text-sm font-medium text-[#232814] hover:opacity-90"
            >
              Apply Now
            </a>
          </div>
        </div>
      )}
    </>
  );
}
