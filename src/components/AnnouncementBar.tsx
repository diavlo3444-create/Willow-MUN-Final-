import { useState, type MouseEvent } from 'react';
import { X } from 'lucide-react';
import { usePublishedWebsite } from '../utils/usePublishedWebsite';
import { TbaText } from './TbaText';

interface AnnouncementBarProps {
  visible: boolean;
  onDismiss: () => void;
}

const DEFAULT_BANNER_TEXT = 'Willow MUN 2027 · March 18, 19 & 20 · Riyadh';

/**
 * Slim dismissible conference notice bar pinned to bottom edge,
 * keeping mobile sticky footer budget well below 15% of viewport height.
 */
export function AnnouncementBar({ visible, onDismiss }: AnnouncementBarProps) {
  const [isClosing, setIsClosing] = useState(false);
  const { published } = usePublishedWebsite();

  if (!visible || !published.bannerEnabled) return null;

  const isDefaultText = published.bannerText === DEFAULT_BANNER_TEXT;
  const linkHref = published.bannerLinkHref || '#committees';
  const linkLabel = published.bannerLinkLabel || 'View Committees';

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    window.setTimeout(() => {
      onDismiss();
    }, 220);
  };

  const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (linkHref.startsWith('#')) {
      const target = document.querySelector(linkHref);
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <div
      role="region"
      aria-label="Conference announcement"
      style={
        isClosing
          ? {
              transform: 'translate3d(0, 100%, 0)',
              opacity: 0,
              pointerEvents: 'none',
              transition:
                'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease',
            }
          : undefined
      }
      className="chrome mun-announcement-bg fixed bottom-0 inset-x-0 z-30 border-t border-[#ede6ca]/15 px-[clamp(16px,4vw,48px)] py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 text-xs text-[#c9c2a6]">
        <div className="flex flex-1 flex-nowrap items-center gap-2.5 min-w-0 overflow-hidden whitespace-nowrap">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#a9b47e] shrink-0">
            Notice
          </span>
          <span aria-hidden="true" className="text-[#ede6ca]/30 shrink-0">
            /
          </span>
          {isDefaultText ? (
            <span className="truncate">
              Willow MUN 2027 <span aria-hidden="true">·</span> March 18, 19 & 20 <span className="hidden sm:inline"><span aria-hidden="true">·</span> Riyadh</span>
            </span>
          ) : (
            <span className="truncate">{published.bannerText}</span>
          )}
          <span className="shrink-0 text-[#ede6ca]/35" aria-hidden="true">
            ·
          </span>
          <a
            href={linkHref}
            onClick={handleLinkClick}
            className="mun-link-underline font-medium text-[#ede6ca] hover:opacity-85 transition-opacity duration-150 whitespace-nowrap shrink-0"
          >
            {linkLabel}
          </a>
        </div>

        <button
          type="button"
          onClick={handleClose}
          aria-label="Dismiss announcement"
          className="mun-btn-interactive inline-flex h-8 w-8 items-center justify-center rounded-[2px] text-[#c9c2a6] hover:text-[#ede6ca] shrink-0 cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
