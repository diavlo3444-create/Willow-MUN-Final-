import type { ReactNode } from 'react';

interface PanelSectionProps {
  id: string;
  heading: string;
  children: ReactNode;
}

/**
 * Translucent dark-olive panel centered at max 1100px so the background video
 * remains visible around and behind every section below the hero.
 */
export function PanelSection({ id, heading, children }: PanelSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-24 px-4 sm:px-6 md:px-10"
    >
      <div className="mun-panel mx-auto w-full max-w-[1100px] px-6 py-9 sm:px-10 sm:py-12 md:px-14 md:py-14">
        <h2
          id={headingId}
          className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-[#ede6ca] mb-7 sm:mb-8"
        >
          {heading}
        </h2>
        {children}
      </div>
    </section>
  );
}
