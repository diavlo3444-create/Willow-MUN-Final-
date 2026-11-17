import { useState, type FormEvent } from 'react';
import { CheckCircle2, ArrowRight, Camera, FileText, ShieldCheck, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { InteractiveCard } from './InteractiveCard';
import { RevealSection, SectionHeading } from './RevealSection';

const tracks = [
  { id: 'volunteer', title: 'Volunteer', detail: 'Support registration, wayfinding, and conference operations.', icon: Users },
  { id: 'media', title: 'Media', detail: 'Photography, videography, editing, and visual coverage.', icon: Camera },
  { id: 'press', title: 'Press', detail: 'Reporting, interviews, writing, and conference journalism.', icon: FileText },
  { id: 'security', title: 'Security', detail: 'Help manage venue access and keep sessions orderly.', icon: ShieldCheck },
] as const;
type Track = typeof tracks[number]['id'];
const empty = { applicant_name: '', email: '', phone: '', school: '', age: '', availability: '', motivation: '', experience: '', portfolio_url: '' };

export function ApplySection() {
  const [track, setTrack] = useState<Track | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const set = (key: keyof typeof empty, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!track) return;
    setBusy(true); setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('willow-applications', { body: { action: 'submit', application_type: track, ...form, age: form.age || null } });
    setBusy(false);
    if (invokeError || data?.error) { setError(data?.error || invokeError?.message || 'Could not submit. Please try again.'); return; }
    setSubmitted(true); setForm(empty);
  };
  return (
    <RevealSection id="apply" ariaLabelledBy="apply-heading">
      <div className="space-y-7">
        <div className="max-w-3xl">
          <SectionHeading id="apply-heading" label="Join the Willow team" prefix="APPLICATIONS" italicWord="OPEN" period />
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#cfc8aa] sm:text-base">Choose one of the four teams below and submit your application to Willow MUN.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tracks.map(({ id, title, detail, icon: Icon }) => (
            <button key={id} type="button" onClick={() => { setTrack(id); setSubmitted(false); setError(''); }} className={`rounded-lg border p-5 text-left transition-all ${track === id ? 'border-[#c8b77b] bg-[#c8b77b]/10' : 'border-[#ede6ca]/15 bg-[#10140d]/70 hover:border-[#c8b77b]/60'}`}>
              <Icon className="mb-5 h-5 w-5 text-[#c8b77b]" />
              <span className="block text-base font-semibold text-[#ede6ca]">{title}</span>
              <span className="mt-2 block text-xs leading-5 text-[#b9b29a]">{detail}</span>
              <span className="mt-5 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#c8b77b]">Apply <ArrowRight className="h-3 w-3" /></span>
            </button>
          ))}
        </div>
        {track && <InteractiveCard className="mx-auto w-full max-w-3xl p-5 sm:p-8">
          {submitted ? <div className="py-8 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-[#c8b77b]" /><h3 className="mt-4 text-xl font-semibold text-[#ede6ca]">Application received</h3><p className="mt-2 text-sm text-[#cfc8aa]">Your application has been sent to the Willow MUN team.</p><button type="button" onClick={() => { setSubmitted(false); setTrack(null); }} className="mt-6 rounded-full border border-[#ede6ca]/30 px-5 py-2.5 text-xs text-[#ede6ca]">Close</button></div> : <>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#c8b77b]">Willow MUN · {track} application</p>
            <h3 className="mt-2 text-2xl font-semibold capitalize text-[#ede6ca]">{track} team</h3>
            <form onSubmit={submit} className="mt-7 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" value={form.applicant_name} onChange={(v) => set('applicant_name',v)} required />
              <Field label="Email address" type="email" value={form.email} onChange={(v) => set('email',v)} required />
              <Field label="Phone number" value={form.phone} onChange={(v) => set('phone',v)} required />
              <Field label="School" value={form.school} onChange={(v) => set('school',v)} />
              <Field label="Age" type="number" value={form.age} onChange={(v) => set('age',v)} />
              <Field label="Availability" value={form.availability} onChange={(v) => set('availability',v)} placeholder="Days / hours available" />
              <div className="sm:col-span-2"><TextArea label="Why do you want to join this team?" value={form.motivation} onChange={(v) => set('motivation',v)} required /></div>
              <div className="sm:col-span-2"><TextArea label="Relevant experience" value={form.experience} onChange={(v) => set('experience',v)} /></div>
              {(track === 'media' || track === 'press') && <div className="sm:col-span-2"><Field label="Portfolio / work samples link" value={form.portfolio_url} onChange={(v) => set('portfolio_url',v)} placeholder="https://" /></div>}
              {error && <p role="alert" className="sm:col-span-2 text-sm text-rose-300">{error}</p>}
              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#ede6ca]/10 pt-5"><p className="text-[11px] text-[#a9a28b]">Your details are sent securely to the Willow MUN team.</p><button disabled={busy} className="rounded-full bg-[#c8b77b] px-6 py-3 text-xs font-semibold text-[#11150c] disabled:opacity-50">{busy ? 'Submitting…' : 'Submit application'}</button></div>
            </form>
          </>}
        </InteractiveCard>}
      </div>
    </RevealSection>
  );
}
function Field({ label, value, onChange, type = 'text', required = false, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return <label className="block"><span className="mb-2 block text-xs text-[#cfc8aa]">{label}{required ? ' *' : ''}</span><input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-md border border-[#ede6ca]/20 bg-[#0d110b] px-3 text-sm text-[#ede6ca] outline-none placeholder:text-[#77735f] focus:border-[#c8b77b]" /></label>;
}
function TextArea({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="block"><span className="mb-2 block text-xs text-[#cfc8aa]">{label}{required ? ' *' : ''}</span><textarea required={required} minLength={required ? 20 : undefined} rows={4} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-[#ede6ca]/20 bg-[#0d110b] px-3 py-3 text-sm text-[#ede6ca] outline-none focus:border-[#c8b77b]" /></label>;
}
