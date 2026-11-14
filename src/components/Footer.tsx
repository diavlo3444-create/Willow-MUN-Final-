import { RotateCcw } from 'lucide-react';
import { CONFERENCE_DATA } from '../data/conference';
import { TbaText } from './TbaText';

interface FooterProps {
  onReplayIntro: () => void;
}

/**
 * Editorial footer with transparent-to-dark gradient so the background video
 * remains visible behind it, plus an outlined cream "Replay intro" pill.
 */
export function Footer({ onReplayIntro }: FooterProps) {
  return (
    <footer className="mun-footer-gradient relative z-10 border-t border-[#ede6ca]/15 px-5 sm:px-8 md:px-12 pt-14 pb-24 sm:pb-20">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center text-center gap-5">
        <img
          src={CONFERENCE_DATA.brand.logoSrc}
          alt="Willow MUN willow and laurel wreath emblem"
          width={64}
          height={64}
          className="h-14 w-14 sm:h-16 sm:w-16 object-contain"
        />

        <div className="space-y-1.5">
          <p className="font-serif text-[clamp(1.35rem,4vw,1.875rem)] font-medium text-[#ede6ca] whitespace-nowrap">
            {CONFERENCE_DATA.footer.fullName}
          </p>
          <p className="text-xs uppercase tracking-[0.24em] text-[#cfc8aa] whitespace-nowrap">
            {CONFERENCE_DATA.footer.edition}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#cfc8aa]">
          <span className="whitespace-nowrap">
            Instagram: <TbaText text="TBA" className="text-lg" />
          </span>
          <span className="text-[#ede6ca]/35" aria-hidden="true">
            ·
          </span>
          <span className="whitespace-nowrap">
            Email: <TbaText text="TBA" className="text-lg" />
          </span>
        </div>

        <button
          type="button"
          onClick={onReplayIntro}
          className="mun-btn-interactive mt-1 inline-flex items-center justify-center gap-2 min-h-[44px] rounded-full border border-[#ede6ca]/45 bg-transparent px-6 py-2.5 text-xs sm:text-sm font-medium text-[#ede6ca] hover:border-[#ede6ca] hover:bg-[#ede6ca]/10 whitespace-nowrap cursor-pointer"
        >
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Replay intro</span>
        </button>

        <p className="pt-4 border-t border-[#ede6ca]/12 w-full max-w-md text-xs tracking-wider text-[#cfc8aa] whitespace-nowrap">
          {CONFERENCE_DATA.footer.copyright}
        </p>
      </div>
    </footer>
  );
}
