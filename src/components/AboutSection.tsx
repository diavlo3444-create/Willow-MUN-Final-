import { CONFERENCE_DATA } from '../data/conference';
import { PanelSection } from './PanelSection';
import { TbaText } from './TbaText';

/**
 * Section 1: About the conference.
 */
export function AboutSection() {
  return (
    <PanelSection id="about" heading={CONFERENCE_DATA.about.heading}>
      <div className="max-w-[68ch] space-y-5 text-base sm:text-[17px] leading-[1.7] text-[#c9c2a4]">
        <p>{CONFERENCE_DATA.about.paragraphs[0]}</p>
        <p>
          The official conference name, guiding theme, and full mission statement are currently{' '}
          <TbaText className="text-xl" /> and will be shared ahead of the opening of applications.
        </p>
      </div>
    </PanelSection>
  );
}
