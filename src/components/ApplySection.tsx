import { CONFERENCE_DATA } from '../data/conference';
import { InteractiveCard } from './InteractiveCard';
import { RevealSection, SectionHeading } from './RevealSection';
import { TbaText } from './TbaText';

/**
 * Applications anchor section: states that delegate and chair applications are TBA.
 */
export function ApplySection() {
  return (
    <RevealSection id="apply" ariaLabelledBy="apply-heading">
      <InteractiveCard className="p-7 sm:p-10 md:p-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="max-w-[60ch] space-y-4">
            <SectionHeading
              id="apply-heading"
              label={CONFERENCE_DATA.apply.label}
              prefix="DELEGATE"
              italicWord="APPLICATIONS"
              period
            />
            <p className="text-[clamp(0.95rem,2vw,1.0625rem)] leading-[1.7] text-[#cfc8aa]">
              Applications for delegates and chairs are not open yet. Opening dates, delegate fees,
              and eligibility details are <TbaText text="TBA" className="text-xl" />.
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="mun-btn-interactive inline-flex items-center justify-center min-h-[44px] rounded-full border border-[#ede6ca]/40 bg-transparent px-6 sm:px-7 py-3 text-xs sm:text-sm font-medium text-[#ede6ca]/85 cursor-not-allowed whitespace-nowrap"
            >
              {CONFERENCE_DATA.apply.buttonLabel}
            </button>
          </div>
        </div>
      </InteractiveCard>
    </RevealSection>
  );
}
