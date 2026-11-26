/**
 * Pure CSS scroll progress bar (no JS scroll listener, no motion/react).
 * Driven via native CSS animation-timeline: scroll(root) when supported.
 */
export function ScrollProgressBar() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 inset-x-0 z-40 h-[2px]"
    >
      <div className="mun-scroll-progress-bar h-full w-full bg-[#ede6ca]" />
    </div>
  );
}
