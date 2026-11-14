import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CONFERENCE_DATA } from '../data/conference';
import { InteractiveCard } from './InteractiveCard';
import { RevealSection, SectionHeading } from './RevealSection';

type InquiryType = (typeof CONFERENCE_DATA.suggestions.types)[number];

/**
 * Suggestions section: "Have something to say?" / "SUGGESTIONS." with floating labels,
 * cream focus outline, and "Sent ✓" submit feedback for 2 seconds + thank-you message.
 */
export function SuggestionsSection() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<InquiryType>('Suggestion');
  const [message, setMessage] = useState('');

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);
  const [submittedNotice, setSubmittedNotice] = useState(false);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !message.trim()) return;

    setJustSent(true);
    setSubmittedNotice(true);

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      setJustSent(false);
      setName('');
      setEmail('');
      setType('Suggestion');
      setMessage('');
      timerRef.current = null;
    }, 2000);
  };

  const isFloated = (field: string, value: string) =>
    focusedField === field || value.length > 0;

  return (
    <RevealSection id="suggestions" ariaLabelledBy="suggestions-heading">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        <div className="lg:col-span-5 space-y-5">
          <SectionHeading
            id="suggestions-heading"
            label={CONFERENCE_DATA.suggestions.label}
            prefix=""
            italicWord="SUGGESTIONS"
            period
          />
          <p className="mun-heading-reveal max-w-[46ch] text-base sm:text-[17px] leading-[1.7] text-[#cfc8aa]">
            {CONFERENCE_DATA.suggestions.description}
          </p>
        </div>

        <div className="lg:col-span-7">
          <InteractiveCard className="p-6 sm:p-8 md:p-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Floating-label Name */}
                <div className="relative">
                  <label
                    htmlFor="suggestion-name"
                    style={{
                      transformOrigin: 'left top',
                      transform: isFloated('name', name)
                        ? 'translate3d(0, -10px, 0) scale(0.76)'
                        : 'translate3d(0, 0, 0) scale(1)',
                    }}
                    className={`pointer-events-none absolute left-4 top-[18px] text-sm uppercase tracking-[0.14em] transition-[transform,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      focusedField === 'name' ? 'text-[#ede6ca]' : 'text-[#cfc8aa]'
                    }`}
                  >
                    Name
                  </label>
                  <input
                    id="suggestion-name"
                    name="name"
                    type="text"
                    required
                    value={name}
                    onFocus={() => {
                      setFocusedField('name');
                      setSubmittedNotice(false);
                    }}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full min-h-[56px] rounded-sm border border-[#ede6ca]/25 bg-[#14180a] px-4 pt-6 pb-2 text-sm text-[#ede6ca] focus:border-[#ede6ca] focus:outline-2 focus:outline-[#ede6ca] focus:outline-offset-0 transition-colors duration-200"
                  />
                </div>

                {/* Floating-label Optional Email */}
                <div className="relative">
                  <label
                    htmlFor="suggestion-email"
                    style={{
                      transformOrigin: 'left top',
                      transform: isFloated('email', email)
                        ? 'translate3d(0, -10px, 0) scale(0.76)'
                        : 'translate3d(0, 0, 0) scale(1)',
                    }}
                    className={`pointer-events-none absolute left-4 top-[18px] text-sm uppercase tracking-[0.14em] transition-[transform,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      focusedField === 'email' ? 'text-[#ede6ca]' : 'text-[#cfc8aa]'
                    }`}
                  >
                    Email <span className="normal-case tracking-normal opacity-75">(optional)</span>
                  </label>
                  <input
                    id="suggestion-email"
                    name="email"
                    type="email"
                    value={email}
                    onFocus={() => {
                      setFocusedField('email');
                      setSubmittedNotice(false);
                    }}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full min-h-[56px] rounded-sm border border-[#ede6ca]/25 bg-[#14180a] px-4 pt-6 pb-2 text-sm text-[#ede6ca] focus:border-[#ede6ca] focus:outline-2 focus:outline-[#ede6ca] focus:outline-offset-0 transition-colors duration-200"
                  />
                </div>
              </div>

              {/* Floating-label Type Dropdown */}
              <div className="relative">
                <label
                  htmlFor="suggestion-type"
                  style={{
                    transformOrigin: 'left top',
                    transform: 'translate3d(0, -10px, 0) scale(0.76)',
                  }}
                  className={`pointer-events-none absolute left-4 top-[18px] text-sm uppercase tracking-[0.14em] transition-colors duration-200 ${
                    focusedField === 'type' ? 'text-[#ede6ca]' : 'text-[#cfc8aa]'
                  }`}
                >
                  Type
                </label>
                <select
                  id="suggestion-type"
                  name="type"
                  value={type}
                  onFocus={() => setFocusedField('type')}
                  onBlur={() => setFocusedField(null)}
                  onChange={(e) => setType(e.target.value as InquiryType)}
                  className="w-full min-h-[56px] rounded-sm border border-[#ede6ca]/25 bg-[#14180a] px-4 pt-6 pb-2 text-sm text-[#ede6ca] focus:border-[#ede6ca] focus:outline-2 focus:outline-[#ede6ca] focus:outline-offset-0 transition-colors duration-200"
                >
                  {CONFERENCE_DATA.suggestions.types.map((option) => (
                    <option key={option} value={option} className="bg-[#181c0d] text-[#ede6ca]">
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Floating-label Message */}
              <div className="relative">
                <label
                  htmlFor="suggestion-message"
                  style={{
                    transformOrigin: 'left top',
                    transform: isFloated('message', message)
                      ? 'translate3d(0, -10px, 0) scale(0.76)'
                      : 'translate3d(0, 0, 0) scale(1)',
                  }}
                  className={`pointer-events-none absolute left-4 top-[18px] text-sm uppercase tracking-[0.14em] transition-[transform,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    focusedField === 'message' ? 'text-[#ede6ca]' : 'text-[#cfc8aa]'
                  }`}
                >
                  Message
                </label>
                <textarea
                  id="suggestion-message"
                  name="message"
                  required
                  rows={4}
                  value={message}
                  onFocus={() => {
                    setFocusedField('message');
                    setSubmittedNotice(false);
                  }}
                  onBlur={() => setFocusedField(null)}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-sm border border-[#ede6ca]/25 bg-[#14180a] px-4 pt-7 pb-3 text-sm text-[#ede6ca] focus:border-[#ede6ca] focus:outline-2 focus:outline-[#ede6ca] focus:outline-offset-0 transition-colors duration-200 resize-y"
                />
              </div>

              <div className="pt-1 flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  className="mun-btn-interactive inline-flex items-center justify-center min-h-[44px] min-w-[148px] rounded-full bg-[#ede6ca] px-7 py-3 text-sm font-medium text-[#232814] hover:bg-[#cfc8aa] cursor-pointer whitespace-nowrap"
                >
                  {justSent ? 'Sent ✓' : 'Send Message'}
                </button>

                {submittedNotice && (
                  <p role="status" aria-live="polite" className="text-sm text-[#a9b47e]">
                    ✦ Thank you for writing to Willow MUN. Your message has been noted.
                  </p>
                )}
              </div>
            </form>
          </InteractiveCard>
        </div>
      </div>
    </RevealSection>
  );
}
