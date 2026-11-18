import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';

/**
 * Fixed 2px cream scroll progress line at the very top of the viewport.
 * Driven smoothly in both scroll directions via compositor-only `scaleX` with `useSpring`.
 */
export function ScrollProgressBar() {
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 34,
    restDelta: 0.001,
  });

  if (prefersReduced) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 inset-x-0 z-40 h-[2px]"
    >
      <motion.div
        style={{ scaleX, transformOrigin: 'left center' }}
        className="h-full w-full bg-[#ede6ca]"
      />
    </div>
  );
}
