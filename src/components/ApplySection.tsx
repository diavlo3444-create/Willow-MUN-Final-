import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RevealSection, SectionHeading } from './RevealSection';

const tracks = [
  {
    id: 'volunteer',
    title: 'Volunteer',
    detail: 'Support registration desks, runner coordination, wayfinding, and conference logistics.',
  },
  {
    id: 'media',
    title: 'Media',
    detail: 'Photography, videography, editing, and documentary visual coverage of sessions.',
  },
  {
    id: 'press',
    title: 'Press',
    detail: 'Committee reporting, delegate interviews, writing, and daily conference dispatches.',
  },
  {
    id: 'security',
    title: 'Security',
    detail: 'Manage venue perimeter access, badge verification, and orderly committee transitions.',
  },
] as const;

type Track = (typeof tracks)[number]['id'];

const empty = {
  applicant_name: '',
  email: '',
  phone: '',
  school: '',
  age: '',
  availability: '',
  motivation: '',
  experience: '',
  portfolio_url: '',
};

/**
 * Unified Split Application Desk:
 * - Left: Single hairline-ruled track selector list (Volunteer, Media, Press, Security)
 * - Right: Live application form connected to the Supabase `willow-applications` Edge Function
 */
export function ApplySection() {
  const [track, setTrack] = useState<Track>('volunteer');
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const selectedTrack = tracks.find((t) => t.id === track) ?? tracks[0];

  const set = (key: keyof typeof empty, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!track) return;
    setBusy(true);
    setError('');

    const { data, error: invokeError } = await supabase.functions.invoke('willow-applications', {
      body: {
        action: 'submit',
        application_type: track,
        ...form,
        age: form.age || null,
      },
    });

    setBusy(false);
    if (invokeError || data?.error) {
      setError(data?.error || invokeError?.message || 'Could not submit application. Please try again.');
      return;
    }

    setSubmitted(true);
    setForm(empty);
  };

  return (
    <RevealSection id="apply" ariaLabelledBy="apply-heading">
      <div className="mb-8 sm:mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-[#ede6ca]/16 pb-6">
        <SectionHeading
          id="apply-heading"
          indexLabel="06"
          label="Join the organizing team"
          prefix="Team"
          italicWord="Applications"
        />
        <p className="text-sm text-[#c9c2a6] max-w-[46ch]">
          Select one of the four operational tracks below to open its dossier submission form.
        </p>
      </div>

      <div className="willow-folio rounded-[3px] overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#ede6ca]/14">
        {/* Left Track Selection List (4 cols) */}
        <div
          role="tablist"
          aria-label="Application tracks"
          className="lg:col-span-4 divide-y divide-[#ede6ca]/14 bg-[#191f0e]/60"
        >
          {tracks.map((item, index) => {
            const active = track === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTrack(item.id);
                  setSubmitted(false);
                  setError('');
                }}
                className={`w-full px-6 py-5 text-left transition-colors duration-150 cursor-pointer flex items-start justify-between gap-4 ${
                  active
                    ? 'bg-[#ede6ca]/[0.07] text-[#ede6ca]'
                    : 'text-[#c9c2a6] hover:bg-[#ede6ca]/[0.03] hover:text-[#ede6ca]'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[11px] text-[#a9b47e] tabular-nums">
                      0{index + 1}
                    </span>
                    <span className="font-serif text-xl sm:text-2xl font-medium">
                      {item.title}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#c9c2a6]/90">
                    {item.detail}
                  </p>
                </div>

                <ArrowRight
                  className={`h-4 w-4 shrink-0 mt-1.5 transition-opacity duration-150 ${
                    active ? 'opacity-100 text-[#ede6ca]' : 'opacity-30'
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>

        {/* Right Application Dossier Form (8 cols) */}
        <div className="lg:col-span-8 p-6 sm:p-8 lg:p-10">
          {submitted ? (
            <div className="py-12 text-center max-w-md mx-auto">
              <CheckCircle2 className="mx-auto h-9 w-9 text-[#a9b47e]" aria-hidden="true" />
              <h3 className="mt-4 font-serif text-3xl font-medium text-[#ede6ca]">
                Application received
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#c9c2a6]">
                Your {selectedTrack.title.toLowerCase()} dossier has been recorded for review by the
                Willow MUN Secretariat.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mun-btn-interactive mt-6 inline-flex min-h-[42px] items-center justify-center rounded-[2px] border border-[#ede6ca]/35 px-5 py-2 text-xs font-medium text-[#ede6ca] hover:border-[#ede6ca] cursor-pointer"
              >
                Submit another response
              </button>
            </div>
          ) : (
            <>
              <div className="border-b border-[#ede6ca]/14 pb-4 mb-6 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-xs font-medium tracking-[0.12em] text-[#a9b47e]">
                    Selected Track
                  </p>
                  <h3 className="mt-1 font-serif text-2xl sm:text-3xl font-medium text-[#ede6ca]">
                    {selectedTrack.title} Team Application
                  </h3>
                </div>
                <span className="text-xs text-[#c9c2a6]">Required fields marked *</span>
              </div>

              <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Full name"
                  value={form.applicant_name}
                  onChange={(v) => set('applicant_name', v)}
                  required
                />
                <Field
                  label="Email address"
                  type="email"
                  value={form.email}
                  onChange={(v) => set('email', v)}
                  required
                />
                <Field
                  label="Phone number"
                  value={form.phone}
                  onChange={(v) => set('phone', v)}
                  required
                />
                <Field
                  label="School / Institution"
                  value={form.school}
                  onChange={(v) => set('school', v)}
                />
                <Field
                  label="Age"
                  type="number"
                  value={form.age}
                  onChange={(v) => set('age', v)}
                />
                <Field
                  label="Availability"
                  value={form.availability}
                  onChange={(v) => set('availability', v)}
                  placeholder="Days / hours available"
                />

                <div className="sm:col-span-2">
                  <TextArea
                    label="Why do you want to join this team?"
                    value={form.motivation}
                    onChange={(v) => set('motivation', v)}
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <TextArea
                    label="Relevant experience"
                    value={form.experience}
                    onChange={(v) => set('experience', v)}
                  />
                </div>

                {(track === 'media' || track === 'press') && (
                  <div className="sm:col-span-2">
                    <Field
                      label="Portfolio / work samples link"
                      value={form.portfolio_url}
                      onChange={(v) => set('portfolio_url', v)}
                      placeholder="https://"
                    />
                  </div>
                )}

                {error && (
                  <p role="alert" className="sm:col-span-2 text-sm text-rose-300">
                    {error}
                  </p>
                )}

                <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-4 border-t border-[#ede6ca]/14 pt-5 mt-1">
                  <p className="text-xs text-[#c9c2a6]">
                    Your application is transmitted securely to the Willow MUN Secretariat.
                  </p>
                  <button
                    type="submit"
                    disabled={busy}
                    className="mun-btn-interactive inline-flex min-h-[44px] items-center justify-center rounded-[2px] bg-[#ede6ca] px-6 py-2.5 text-sm font-semibold text-[#181c0d] hover:bg-[#dad3b4] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    {busy ? 'Submitting…' : 'Submit application'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </RevealSection>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[#c9c2a6]">
        {label}
        {required ? ' *' : ''}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[2px] border border-[#ede6ca]/22 bg-[#0e1208] px-3.5 text-sm text-[#ede6ca] outline-none placeholder:text-[#8d8a73] focus:border-[#ede6ca]"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[#c9c2a6]">
        {label}
        {required ? ' *' : ''}
      </span>
      <textarea
        required={required}
        minLength={required ? 20 : undefined}
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[2px] border border-[#ede6ca]/22 bg-[#0e1208] px-3.5 py-2.5 text-sm text-[#ede6ca] outline-none focus:border-[#ede6ca]"
      />
    </label>
  );
}
