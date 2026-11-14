import { useEffect, useState } from 'react';

/**
 * Returns true only on desktop devices with a fine mouse pointer and hover capability,
 * and when prefers-reduced-motion is not active.
 * Used to disable tilt, spotlight, magnetic pull, and parallax on touch devices or reduced motion.
 */
export function useDesktopPointerEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  });

  useEffect(() => {
    const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => {
      setEnabled(hoverQuery.matches && !motionQuery.matches);
    };

    update();
    hoverQuery.addEventListener('change', update);
    motionQuery.addEventListener('change', update);

    return () => {
      hoverQuery.removeEventListener('change', update);
      motionQuery.removeEventListener('change', update);
    };
  }, []);

  return enabled;
}
