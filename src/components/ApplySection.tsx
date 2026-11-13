import { CONFERENCE_DATA } from '../data/conference';
import { PanelSection } from './PanelSection';
import { TbaText } from './TbaText';

/**
 * Section 5: Apply — notice that applications are not yet open,
 * an outlined non-clickable button, and three small contact placeholders.
 */
export function ApplySection() {
  return (
    <PanelSection id="apply" heading={CONFERENCE_DATA.apply.heading}>
      <div className="max-w-[64ch] space-y-7">
        <p className="text-base sm:text-[17px] leading-[1.7] text-[#c9c2a4]">
          Applications are not open yet. The opening date and application requirements are{' '}
          <TbaText className="text-xl" />.
        </p>

        <div>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="inline-flex items-center justify-center min-h-[44px] rounded-sm border border-[#ede6ca]/45 bg-transparent px-6 py-3 text-sm font-medium text-[#ede6ca]/85 cursor-not-allowed whitespace-nowrap"
          >
            {CONFERENCE_DATA.apply.buttonLabel}
          </button>
        </div>

        <dl className="pt-4 border-t border-[#ede6ca]/15 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#c9c2a4]">
          {CONFERENCE_DATA.apply.contacts.map((contact) => (
            <div key={contact.id} className="flex items-baseline gap-2">
              <dt className="text-[#c9c2a4]">{contact.label}:</dt>
              <dd>
                <TbaText text={contact.value} className="text-lg" />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </PanelSection>
  );
}
