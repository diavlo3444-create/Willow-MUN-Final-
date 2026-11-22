import type { MouseEvent } from 'react';
import { ArrowUpRight, Lock, RotateCcw } from 'lucide-react';
import { CONFERENCE_DATA } from '../data/conference';
import { WILLOW_INSTAGRAM_HANDLE, WILLOW_INSTAGRAM_URL } from '../utils/instagramFeed';
import { navigateTo } from '../utils/router';
import { usePublishedWebsite } from '../utils/usePublishedWebsite';
import { TbaText } from './TbaText';

interface FooterProps {
  onReplayIntro: () => void;
}

const FOOTER_PROSPECTUS_LINKS = [
  { href: '#about', label: 'Theme & Charter' },
  { href: '#committees', label: 'Committees' },
  { href: '#executive-board', label: 'Secretariat & EB' },
  { href: '#updates', label: 'Dispatches & Venue' },
  { href: '#instagram', label: 'Instagram (@willow.mun)' },
  { href: '#apply', label: 'Team Applications' },
];

/**
 * Multi-column institutional colophon at the conclusion of the prospectus,
 * combining conference identity, quick prospectus navigation, secretariat handles,
 * Replay Intro, and discreet Staff Portal entry.
 */
export function Footer({ onReplayIntro }: FooterProps) {
  const { published } = usePublishedWebsite();

  const handleAnchor = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = document.querySelector(href);
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const instagramHandle =
    published.footer.instagramHandle && published.footer.instagramHandle !== 'TBA'
      ? published.footer.instagramHandle
      : WILLOW_INSTAGRAM_HANDLE;

  return (
    <footer className="mun-footer-gradient mun-offscreen-section relative z-[1] border-t border-[#ede6ca]/18 px-[clamp(16px,4vw,48px)] pt-14 pb-24 sm:pb-28">
      <div className="mx-auto w-full max-w-[1200px] min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-[#ede6ca]/14">
          {/* Column 1: Institutional Identity */}
          <div className="md:col-span-5 space-y-4 min-w-0">
            <div className="flex items-start gap-3.5">
              <img
                src={CONFERENCE_DATA.brand.logoSrc}
                alt="Willow MUN willow and laurel wreath emblem"
                width={48}
                height={48}
                className="h-12 w-12 object-contain shrink-0 mt-0.5"
              />
              <div className="min-w-0">
                <p className="font-serif text-2xl sm:text-3xl font-medium text-[#ede6ca] leading-tight [text-wrap:balance]">
                  {published.footer.fullName || CONFERENCE_DATA.footer.fullName}
                </p>
                <p className="mt-1 font-mono text-xs tracking-[0.16em] text-[#a9b47e]">
                  {published.footer.editionText || CONFERENCE_DATA.footer.edition}
                </p>
              </div>
            </div>

            <p className="text-sm leading-[1.7] text-[#c9c2a6] max-w-[40ch]">
              A youth-led Model United Nations conference founded on principled diplomacy, cross-committee scholarship, and enduring consensus.
            </p>
          </div>

          {/* Column 2: Prospectus Index */}
          <div className="md:col-span-3 space-y-3 min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#a9b47e]">
              Prospectus Index
            </p>
            <nav aria-label="Footer prospectus navigation" className="grid grid-cols-2 md:grid-cols-1 gap-x-4 gap-y-2">
              {FOOTER_PROSPECTUS_LINKS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleAnchor(e, item.href)}
                  className="text-sm text-[#c9c2a6] hover:text-[#ede6ca] transition-colors duration-150"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Column 3: Secretariat Correspondence & Access */}
          <div className="md:col-span-4 space-y-4 min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#a9b47e]">
              Secretariat &amp; Access
            </p>

            <dl className="space-y-2 text-sm text-[#c9c2a6]">
              <div className="flex items-baseline justify-between gap-4 border-b border-[#ede6ca]/10 pb-2">
                <dt className="text-xs text-[#c9c2a6]/80">Instagram</dt>
                <dd className="text-[#ede6ca] truncate">
                  <a
                    href={WILLOW_INSTAGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mun-link-underline group inline-flex items-center gap-1 hover:text-[#a9b47e] transition-colors"
                  >
                    <span>{instagramHandle}</span>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                  </a>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-[#ede6ca]/10 pb-2">
                <dt className="text-xs text-[#c9c2a6]/80">Email</dt>
                <dd className="text-[#ede6ca] truncate">
                  {published.footer.contactEmail &&
                  published.footer.contactEmail !== 'TBA' ? (
                    published.footer.contactEmail
                  ) : (
                    <TbaText text="TBA" className="text-base" />
                  )}
                </dd>
              </div>
            </dl>

            <div className="pt-1 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onReplayIntro}
                className="mun-btn-interactive inline-flex items-center justify-center gap-2 min-h-[42px] rounded-[2px] border border-[#ede6ca]/35 bg-transparent px-4 py-2 text-xs font-medium text-[#ede6ca] hover:border-[#ede6ca] whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Replay intro</span>
              </button>

              <a
                href="/portal"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/portal');
                }}
                className="mun-btn-interactive inline-flex items-center justify-center gap-2 min-h-[42px] rounded-[2px] border border-[#ede6ca]/22 bg-[#191f0e]/85 px-4 py-2 text-xs font-medium text-[#c9c2a6] hover:text-[#ede6ca] hover:border-[#ede6ca]/45 whitespace-nowrap"
              >
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Staff Portal</span>
              </a>
            </div>
          </div>
        </div>

        <div className="pt-5 flex flex-wrap items-center justify-between gap-4 text-xs text-[#c9c2a6]">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p>{published.footer.copyrightText || CONFERENCE_DATA.footer.copyright}</p>
            <a href="/privacy" className="text-[#c9c2a6] underline underline-offset-4 hover:text-[#ede6ca]">Privacy</a>
            <a href="/terms" className="text-[#c9c2a6] underline underline-offset-4 hover:text-[#ede6ca]">Terms</a>
          </div>
          <p className="font-mono text-[11px] text-[#a9b47e]/85">
            Inaugural Session · Diplomatic Conference
          </p>
        </div>
      </div>
    </footer>
  );
}
