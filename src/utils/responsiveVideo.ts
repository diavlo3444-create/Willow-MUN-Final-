import { useEffect, useState } from 'react';
import { CONFERENCE_DATA } from '../data/conference';

const PORTRAIT_MOBILE_QUERY =
  '(max-width: 767px) and (orientation: portrait), (max-width: 639px)';

export function isPortraitMobileViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(PORTRAIT_MOBILE_QUERY).matches;
}

export interface ResponsiveVideoSources {
  isMobilePortrait: boolean;
  loopVideoSrc: string;
  introVideoSrc: string;
  posterSrc: string;
}

/**
 * Selects dedicated 9:16 portrait video assets on mobile phones and 16:9 widescreen
 * assets on tablet/desktop viewports so the browser downloads only the active source.
 */
export function useResponsiveVideoSources(): ResponsiveVideoSources {
  const [isMobilePortrait, setIsMobilePortrait] = useState<boolean>(() =>
    isPortraitMobileViewport(),
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia(PORTRAIT_MOBILE_QUERY);
    const update = () => setIsMobilePortrait(mq.matches);
    update();
    mq.addEventListener('change', update);
    window.addEventListener('orientationchange', update);
    return () => {
      mq.removeEventListener('change', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return {
    isMobilePortrait,
    loopVideoSrc: isMobilePortrait
      ? CONFERENCE_DATA.brand.mobileVideoSrc
      : CONFERENCE_DATA.brand.videoSrc,
    introVideoSrc: isMobilePortrait
      ? CONFERENCE_DATA.brand.mobileIntroVideoSrc
      : CONFERENCE_DATA.brand.introVideoSrc,
    posterSrc: isMobilePortrait
      ? CONFERENCE_DATA.brand.mobilePosterSrc
      : CONFERENCE_DATA.brand.posterSrc,
  };
}
