import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CONFERENCE_DATA } from '../data/conference';
import { conferenceDataService } from '../services/mockDataService';
import { RevealSection, SectionHeading } from './RevealSection';

type InquiryType = (typeof CONFERENCE_DATA.suggestions.types)[number];

/**
 * Secretariat Correspondence & Accessibility Inquiries section.
 * Clean labeled fields over a calm archival folio surface (zero decorative stars).
 */
export function SuggestionsSection() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<InquiryType>('Suggestion');
  const [message, setMessage] = useState('');

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

    conferenceDataService.submitPublicInquiry({
      name: name.trim(),
      email: email.trim() || 'no-email@visitor.willowmun.org',
      type,
      message: message.trim(),
    });

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

  return (
    <RevealSection id="suggestions" ariaLabelledBy="suggestions-heading">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <div className="lg:col-span-5 space-y-5">
          <SectionHeading
            id="suggestions-heading"
            indexLabel="07"
            label={CONFERENCE_DATA.suggestions.label}
            prefix="Direct"
            italicWord="Correspondence"
          />
          <p className="max-w-[44ch] text-base leading-[1.7] text-[#c9c2a6]">
            {CONFERENCE_DATA.suggestions.description}
          </p>
        </div>

        <div className="lg:col-span-7 willow-folio rounded-[3px] p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="suggestion-name"
                  className="mb-1.5 block text-xs font-medium text-[#c9c2a6]"
                >
                  Name *
                </label>
                <input
                  id="suggestion-name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onFocus={() => setSubmittedNotice(false)}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 w-full rounded-[2px] border border-[#ede6ca]/22 bg-[#0e1208] px-3.5 text-sm text-[#ede6ca] outline-none focus:border-[#ede6ca]"
                />
              </div>

              <div>
                <label
                  htmlFor="suggestion-email"
                  className="mb-1.5 block text-xs font-medium text-[#c9c2a6]"
                >
                  Email <span className="opacity-70">(optional)</span>
                </label>
                <input
                  id="suggestion-email"
                  name="email"
                  type="email"
                  value={email}
                  onFocus={() => setSubmittedNotice(false)}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 w-full rounded-[2px] border border-[#ede6ca]/22 bg-[#0e1208] px-3.5 text-sm text-[#ede6ca] outline-none focus:border-[#ede6ca]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="suggestion-type"
                className="mb-1.5 block text-xs font-medium text-[#c9c2a6]"
              >
                Inquiry Type
              </label>
              <select
                id="suggestion-type"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as InquiryType)}
                className="h-11 w-full rounded-[2px] border border-[#ede6ca]/22 bg-[#0e1208] px-3.5 text-sm text-[#ede6ca] outline-none focus:border-[#ede6ca]"
              >
                {CONFERENCE_DATA.suggestions.types.map((option) => (
                  <option key={option} value={option} className="bg-[#12160a] text-[#ede6ca]">
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="suggestion-message"
                className="mb-1.5 block text-xs font-medium text-[#c9c2a6]"
              >
                Message *
              </label>
              <textarea
                id="suggestion-message"
                name="message"
                required
                rows={4}
                value={message}
                onFocus={() => setSubmittedNotice(false)}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-[2px] border border-[#ede6ca]/22 bg-[#0e1208] px-3.5 py-2.5 text-sm text-[#ede6ca] outline-none focus:border-[#ede6ca] resize-y"
              />
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="submit"
                className="mun-btn-interactive inline-flex items-center justify-center min-h-[44px] min-w-[148px] rounded-[2px] bg-[#ede6ca] px-6 py-2.5 text-sm font-semibold text-[#181c0d] hover:bg-[#dad3b4] cursor-pointer whitespace-nowrap"
              >
                {justSent ? 'Sent ✓' : 'Send Message'}
              </button>

              {submittedNotice && (
                <p role="status" aria-live="polite" className="text-sm text-[#a9b47e]">
                  Thank you for writing to Willow MUN. Your message has been noted.
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </RevealSection>
  );
}
