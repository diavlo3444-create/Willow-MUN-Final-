import { CONFERENCE_DATA } from '../data/conference';
import { TbaText } from './TbaText';

/**
 * Centered diplomatic footer inside the scroll canvas, leaving generous bottom
 * padding so the fixed bottom-right video toggle never crowds footer text on mobile.
 */
export function Footer() {
  return (
    <footer className="relative z-10 px-5 pt-10 pb-24 sm:pb-20">
      <div className="mun-panel mx-auto flex max-w-[1100px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <img
          src={CONFERENCE_DATA.brand.logoSrc}
          alt="Model United Nations willow and laurel wreath emblem"
          width={64}
          height={64}
          className="h-14 w-14 sm:h-16 sm:w-16 object-contain"
        />
        <p className="text-sm sm:text-base text-[#c9c2a4] tracking-wide">
          Model United Nations <span aria-hidden="true">·</span> Name, dates and venue{' '}
          <TbaText className="text-lg sm:text-xl" />
        </p>
      </div>
    </footer>
  );
}
