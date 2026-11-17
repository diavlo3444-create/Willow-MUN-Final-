import { Lock, RotateCcw } from 'lucide-react';
import { CONFERENCE_DATA } from '../data/conference';
import { navigateTo } from '../utils/router';
import { usePublishedWebsite } from '../utils/usePublishedWebsite';
import { TbaText } from './TbaText';

interface FooterProps {
  onReplayIntro: () => void;
}

/**
 * Institutional architectural colophon resting transparently at the end of the prospectus,
 * preserving Replay Intro and Staff Portal navigation.
 */
export function Footer({ onReplayIntro }: FooterProps) {
  const { published } = usePublishedWebsite();

  return (
    <footer className="mun-footer-gradient mun-offscreen-section relative z-[1] border-t border-[#ede6ca]/16 px-[clamp(16px,4vw,48px)] pt-12 pb-20 sm:pb-24">
      <div className="mx-auto w-full max-w-[1200px] min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start pb-8 border-b border-[#ede6ca]/14">
          <div className="md:col-span-7 flex items-start gap-4 min-w-0">
            <img
              src={CONFERENCE_DATA.brand.logoSrc}
              alt="Willow MUN willow and laurel wreath emblem"
              width={48}
              height={48}
              className="h-12 w-12 object-contain shrink-0 mt-0.5"
            />
            <div className="min-w-0 space-y-1.5">
              <p className="font-serif text-2xl sm:text-3xl font-medium text-[#ede6ca] [text-wrap:balance]">
                {published.footer.fullName || CONFERENCE_DATA.footer.fullName}
              </p>
              <p className="font-mono text-xs tracking-[0.14em] text-[#a9b47e]">
                {published.footer.editionText || CONFERENCE_DATA.footer.edition}
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[#c9c2a6]">
                <span className="whitespace-nowrap">
                  Instagram:{' '}
                  {published.footer.instagramHandle &&
                  published.footer.instagramHandle !== 'TBA' ? (
                    <span className="text-[#ede6ca]">{published.footer.instagramHandle}</span>
                  ) : (
                    <TbaText text="TBA" className="text-base" />
                  )}
                </span>
                <span className="text-[#ede6ca]/30" aria-hidden="true">
                  /
                </span>
                <span className="whitespace-nowrap">
                  Email:{' '}
                  {published.footer.contactEmail &&
                  published.footer.contactEmail !== 'TBA' ? (
                    <span className="text-[#ede6ca]">{published.footer.contactEmail}</span>
                  ) : (
                    <TbaText text="TBA" className="text-base" />
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 flex flex-wrap md:justify-end items-center gap-3">
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
              className="mun-btn-interactive inline-flex items-center justify-center gap-2 min-h-[42px] rounded-[2px] border border-[#ede6ca]/22 bg-[#191f0e]/80 px-4 py-2 text-xs font-medium text-[#c9c2a6] hover:text-[#ede6ca] hover:border-[#ede6ca]/45 whitespace-nowrap"
            >
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Staff Portal</span>
            </a>
          </div>
        </div>

        <div className="pt-5 flex flex-wrap items-center justify-between gap-4 text-xs text-[#c9c2a6]">
          <p>{published.footer.copyrightText || CONFERENCE_DATA.footer.copyright}</p>
          <p className="font-mono text-[11px] text-[#a9b47e]/85">
            Inaugural Session · Diplomatic Conference
          </p>
        </div>
      </div>
    </footer>
  );
}
