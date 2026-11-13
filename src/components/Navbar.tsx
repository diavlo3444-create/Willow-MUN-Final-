import { CONFERENCE_DATA } from '../data/conference';

/**
 * Fixed top navigation bar with a subtle top-down fade into the background video.
 * Desktop displays all section anchor links; mobile displays only the Apply link.
 */
export function Navbar() {
  return (
    <header className="fixed top-0 inset-x-0 z-30 mun-nav-fade pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-5 sm:px-8 md:px-12 py-4">
        <a
          href="#top"
          className="flex items-center gap-3 text-[#ede6ca] whitespace-nowrap shrink-0 min-h-[44px]"
          aria-label="Model United Nations home"
        >
          <img
            src={CONFERENCE_DATA.brand.logoSrc}
            alt=""
            width={34}
            height={34}
            className="h-8 w-8 sm:h-9 sm:w-9 object-contain shrink-0"
          />
          <span className="font-serif text-xl sm:text-2xl font-medium tracking-[0.06em] text-[#ede6ca]">
            {CONFERENCE_DATA.brand.shortTitle}
          </span>
        </a>

        <nav aria-label="Primary navigation" className="flex items-center">
          <ul className="hidden md:flex items-center gap-7 text-sm font-medium text-[#c9c2a4]">
            {CONFERENCE_DATA.navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="inline-flex items-center min-h-[44px] hover:text-[#ede6ca] underline-offset-4 hover:underline transition-colors whitespace-nowrap shrink-0"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <a
            href="#apply"
            className="md:hidden inline-flex items-center min-h-[44px] px-2 text-sm font-medium text-[#ede6ca] underline-offset-4 hover:underline whitespace-nowrap shrink-0"
          >
            Apply
          </a>
        </nav>
      </div>
    </header>
  );
}
