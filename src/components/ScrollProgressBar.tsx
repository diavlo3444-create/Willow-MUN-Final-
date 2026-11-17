/**
 * Fixed 2px cream scroll progress line at the very top of the viewport,
 * driven by pure CSS scroll-driven animation (transform: scaleX only, zero JS scroll listener).
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
