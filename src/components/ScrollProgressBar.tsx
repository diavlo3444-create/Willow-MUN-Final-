/**
 * Fixed 2px cream scroll progress line at the very top of the viewport,
 * driven by --scroll-progress (transform: scaleX only, zero layout reflow).
 */
export function ScrollProgressBar() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 inset-x-0 z-40 h-[2px]"
    >
      <div
        className="h-full w-full bg-[#ede6ca]"
        style={{
          transformOrigin: 'left center',
          transform: 'scaleX(var(--scroll-progress, 0))',
        }}
      />
    </div>
  );
}
