import { useState, type MouseEvent } from 'react';
import { X } from 'lucide-react';
import { TbaText } from './TbaText';

interface AnnouncementBarProps {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * Slim dismissible announcement bar pinned to the bottom edge:
 * - Animated underline on "View Committees" and smooth scroll on click
 * - Slides down and fades out when closed with ✕, staying closed
 */
export function AnnouncementBar({
  visible,
  onDismiss,
}: AnnouncementBarProps) {
  const [isClosing, setIsClosing] = useState(false);

  if (!visible) return null;

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    window.setTimeout(() => {
      onDismiss();
    }, 260);
  };

  const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.querySelector('#committees');
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                'transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 260ms ease',
            }
          : undefined
      }
      className="chrome mun-announcement-bg fixed bottom-0 inset-x-0 z-30 border-t border-[#ede6ca]/15 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 text-[11px] sm:text-xs text-[#cfc8aa]">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
          <span className="text-[#a9b47e]" aria-hidden="true">
            ✦
          </span>
          <span className="truncate">
            Committees Announced Soon <span aria-hidden="true">·</span> Willow MUN 2026{' '}
            <span className="hidden sm:inline">
              <span aria-hidden="true">·</span> Details <TbaText text="TBA" className="text-sm" />
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <a
            href="#committees"
            onClick={handleLinkClick}
            className="mun-link-underline font-medium text-[#ede6ca] hover:text-[#a9b47e] transition-colors duration-200 whitespace-nowrap shrink-0"
          >
            View Committees
          </a>
        </div>

        <button
          type="button"
          onClick={handleClose}
          aria-label="Dismiss announcement"
          className="mun-btn-interactive inline-flex h-8 w-8 items-center justify-center rounded-sm text-[#cfc8aa] hover:text-[#ede6ca] shrink-0 cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
