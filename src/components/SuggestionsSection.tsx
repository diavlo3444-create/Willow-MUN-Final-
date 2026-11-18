import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CONFERENCE_DATA } from '../data/conference';
import { conferenceDataService } from '../services/mockDataService';
import { isValidEmail } from '../utils/applicationForm';
import { RevealSection, SectionHeading } from './RevealSection';

type InquiryType = (typeof CONFERENCE_DATA.suggestions.types)[number];

interface InquiryErrors {
  name?: string;
  email?: string;
  message?: string;
}

/**
 * Secretariat Correspondence & Accessibility Inquiries section.
 * Clean labeled fields and segmented category buttons over a calm archival folio surface.
 */
export function SuggestionsSection() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<InquiryType>('Suggestion');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<InquiryErrors>({});

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
    const nextErrors: InquiryErrors = {};

    if (name.trim().length < 2) {
      nextErrors.name = 'Please enter your name (at least 2 characters).';
    }
    if (email.trim() && !isValidEmail(email)) {
      nextErrors.email = 'Please enter a valid email address or leave this field blank.';
    }
    if (message.trim().length < 5) {
      nextErrors.message = 'Please enter a short message (at least 5 characters).';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

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
    }, 2200);
  };

  return (
    <RevealSection id="suggestions" ariaLabelledBy="suggestions-heading">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <div className="lg:col-span-5 space-y-5">
          <SectionHeading
            id="suggestions-heading"
            indexLabel="06"
            label={CONFERENCE_DATA.suggestions.label}
            prefix="Direct"
            italicWord="Correspondence"
          />
          <p className="max-w-[44ch] text-base leading-[1.7] text-[#c9c2a6]">
            {CONFERENCE_DATA.suggestions.description}
          </p>
          <div className="border-t border-[#ede6ca]/14 pt-4 text-xs text-[#c9c2a6]/85 space-y-1">
            <p className="font-mono uppercase tracking-[0.14em] text-[#a9b47e]">
              Secretariat Desk
            </p>
            <p>
              Accessibility notes, advisor questions, and logistics feedback are reviewed directly by conference leadership.
            </p>
          </div>
        </div>

        <div className="lg:col-span-7 willow-folio rounded-[3px] p-6 sm:p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder="Your full name"
                  className="h-11 w-full rounded-[2px] border border-[#ede6ca]/22 bg-[#0e1208] px-3.5 text-sm text-[#ede6ca] outline-none placeholder:text-[#8d8a73] focus:border-[#ede6ca]"
                />
                {errors.name && (
                  <p className="mt-1.5 text-xs text-rose-300">{errors.name}</p>
                )}
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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="name@example.com"
                  className="h-11 w-full rounded-[2px] border border-[#ede6ca]/22 bg-[#0e1208] px-3.5 text-sm text-[#ede6ca] outline-none placeholder:text-[#8d8a73] focus:border-[#ede6ca]"
                />
                {errors.email && (
                  <p className="mt-1.5 text-xs text-rose-300">{errors.email}</p>
                )}
              </div>
            </div>

            <div>
              <span
                id="suggestion-type-label"
                className="mb-1.5 block text-xs font-medium text-[#c9c2a6]"
              >
                Inquiry Type
              </span>
              <div
                role="radiogroup"
                aria-labelledby="suggestion-type-label"
                className="grid grid-cols-3 gap-2"
              >
                {CONFERENCE_DATA.suggestions.types.map((option) => {
                  const active = type === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setType(option)}
                      className={`min-h-[40px] rounded-[2px] border px-3 py-2 text-xs font-medium transition-colors duration-150 cursor-pointer ${
                        active
                          ? 'border-[#ede6ca] bg-[#ede6ca] text-[#181c0d] font-semibold'
                          : 'border-[#ede6ca]/22 bg-[#0e1208] text-[#c9c2a6] hover:border-[#ede6ca]/45 hover:text-[#ede6ca]'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
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
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (errors.message) setErrors((prev) => ({ ...prev, message: undefined }));
                }}
                placeholder="Write your suggestion, question, or accessibility request…"
                className="w-full rounded-[2px] border border-[#ede6ca]/22 bg-[#0e1208] px-3.5 py-2.5 text-sm text-[#ede6ca] outline-none placeholder:text-[#8d8a73] focus:border-[#ede6ca] resize-y"
              />
              {errors.message && (
                <p className="mt-1.5 text-xs text-rose-300">{errors.message}</p>
              )}
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="submit"
                className="mun-btn-interactive inline-flex items-center justify-center min-h-[44px] min-w-[152px] rounded-[2px] bg-[#ede6ca] px-6 py-2.5 text-sm font-semibold text-[#181c0d] hover:bg-[#dad3b4] cursor-pointer whitespace-nowrap"
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
