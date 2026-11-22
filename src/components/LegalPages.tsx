import { ArrowLeft } from 'lucide-react';
import { navigateTo } from '../utils/router';

type LegalPageKind = 'privacy' | 'terms';

interface LegalPagesProps {
  page: LegalPageKind;
}

const pageShell = 'min-h-screen bg-[#101408] text-[#ede6ca] px-5 py-12 sm:px-8';
const heading = 'font-serif text-3xl sm:text-4xl font-medium text-[#ede6ca]';
const subheading = 'mt-8 font-serif text-xl text-[#ede6ca]';
const paragraph = 'mt-3 max-w-3xl text-sm leading-7 text-[#c9c2a6]';

export function LegalPages({ page }: LegalPagesProps) {
  const isPrivacy = page === 'privacy';
  return (
    <main className={pageShell}>
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() => navigateTo('/')}
          className="mb-10 inline-flex min-h-10 items-center gap-2 text-sm text-[#a9b47e] hover:text-[#ede6ca]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Willow MUN
        </button>

        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#a9b47e]">
          Willow MUN · Riyadh · 18–20 March 2027
        </p>
        <h1 className={heading}>{isPrivacy ? 'Privacy Notice' : 'Website & Application Terms'}</h1>
        <p className="mt-3 text-xs text-[#a9b47e]">Last updated: 22 November 2026</p>

        <div className="mt-7 border border-[#c9a85b]/40 bg-[#211d10] p-4 sm:p-5">
          <p className="text-sm font-semibold text-[#ede6ca]">Important information</p>
          <p className="mt-2 text-sm leading-6 text-[#c9c2a6]">
            Willow MUN is an independent, student-led conference. These pages explain the website's current practices; they do not establish that the event has every required approval or that the arrangements have been legally reviewed. The responsible adult organizer, formal contact details, data-storage locations, and deletion schedule still need to be confirmed before personal or sensitive information is collected. Do not submit medical details or identity documents through this form until the organizers have confirmed that they are necessary and have appropriate safeguards in place.
          </p>
        </div>

        {isPrivacy ? (
          <>
            <section>
              <h2 className={subheading}>1. Who operates this website</h2>
              <p className={paragraph}>
                The website is operated by the Willow MUN student organizing team as an independent conference project. Willow MUN is not presented as a school, government body, or registered organization, and no such affiliation or endorsement is implied. The identity and contact details of the adult or legal entity responsible for the event and for decisions about personal-data processing have not yet been confirmed. This information must be completed before applications open.
              </p>
            </section>
            <section>
              <h2 className={subheading}>2. Information the application form requests</h2>
              <p className={paragraph}>
                Depending on the application track, the form requests an applicant's full name, email address, gender, grade, school or institution, applicant phone number, parent or guardian phone number, answers about medical conditions or regular medication (and optional explanatory details), previous experience, availability and absence reasons, camera/equipment details, portfolio links, role-question answers, and uploaded samples or proof of experience. Uploaded files may include photographs, CVs, portfolios, writing samples, and other supporting documents. Do not upload passports, national IDs, or other identity documents unless the organizers separately explain why they are essential and how they will be protected.
              </p>
            </section>
            <section>
              <h2 className={subheading}>3. Why information is requested</h2>
              <p className={paragraph}>
                The stated purposes are to review and manage organizing-team applications, contact applicants, assess relevant experience and work samples, coordinate role assignments and availability, and consider information voluntarily provided for event-safety planning. Information must not be reused for unrelated purposes or publicized without an appropriate separate basis.
              </p>
            </section>
            <section>
              <h2 className={subheading}>4. Storage, service providers, and transfers</h2>
              <p className={paragraph}>
                The website uses Supabase services for application processing and related data storage, and is hosted through Vercel. These providers may process information on infrastructure in different countries depending on the project configuration. The exact storage regions, enabled services, access permissions, and any transfers outside Saudi Arabia have not yet been independently verified. The organizers must verify and disclose those details before collecting applications; this notice does not claim that applicant data remains in Saudi Arabia.
              </p>
            </section>
            <section>
              <h2 className={subheading}>5. Access, sharing, and security</h2>
              <p className={paragraph}>
                Application information should be accessible only to team members who need it to review or administer the relevant application. It should not be sold or posted publicly. No website can guarantee absolute security. The organizers must configure access controls, protect staff accounts, restrict file access, and respond appropriately to suspected unauthorized access or disclosure. Do not send passwords, payment-card details, or unrelated sensitive information through the application form.
              </p>
            </section>
            <section>
              <h2 className={subheading}>6. Retention and deletion</h2>
              <p className={paragraph}>
                Application data should be kept only for as long as it is needed for the stated application and event-administration purposes or as required by applicable law. A fixed retention period and verified deletion procedure have not yet been set out here. The responsible organizer must define and publish them before applications open, including how uploaded files, backups, and records are handled.
              </p>
            </section>
            <section>
              <h2 className={subheading}>7. Your data rights and requests</h2>
              <p className={paragraph}>
                Subject to applicable Saudi law, individuals may have rights to be informed about processing, access their personal data, request a readable copy, correct or complete inaccurate data, and request destruction when the data is no longer needed, subject to legal exceptions. To raise a privacy question or request, contact the official Willow MUN account at{' '}
                <a className="text-[#a9b47e] underline underline-offset-4" href="https://www.instagram.com/willow.mun/" target="_blank" rel="noopener noreferrer">@willow.mun</a>.
                A verified responsible data-controller contact must be added before applications open.
              </p>
            </section>
            <section>
              <h2 className={subheading}>8. Minors</h2>
              <p className={paragraph}>
                Willow MUN may receive applications from people under 18. Applicants should involve a parent or legal guardian before providing personal information. A guardian phone-number field is not, by itself, proof of guardian consent. The organizers must establish an appropriate consent and safeguarding process before collecting information from minors.
              </p>
            </section>
            <section>
              <h2 className={subheading}>9. Changes</h2>
              <p className={paragraph}>
                This notice may be updated when the actual data practices, responsible organizer, providers, or retention arrangements are confirmed. The version displayed on this page is the current website notice.
              </p>
            </section>
          </>
        ) : (
          <>
            <section>
              <h2 className={subheading}>1. Independent student-led project</h2>
              <p className={paragraph}>
                Willow MUN is an independent, student-led Model United Nations conference planned for 18–20 March 2027 in Riyadh, Saudi Arabia. Unless expressly confirmed in writing, it is not affiliated with or endorsed by a school, university, government authority, venue, sponsor, or other organization. Do not rely on the website as proof of any permit, approval, partnership, or venue booking.
              </p>
            </section>
            <section>
              <h2 className={subheading}>2. Website information</h2>
              <p className={paragraph}>
                Website content is provided for general conference information and may change. The organizers will make reasonable efforts to correct inaccurate information, but schedules, committee details, staffing, venue information, and other arrangements are not final unless clearly confirmed. Contact the official account before relying on an important detail.
              </p>
            </section>
            <section>
              <h2 className={subheading}>3. Applications</h2>
              <p className={paragraph}>
                Submitting an application does not guarantee acceptance, a role, attendance, or participation. Applicants must provide accurate information and submit only work they are entitled to share. Do not upload another person's personal information or work without permission. The organizing team may contact applicants about their submission and may reject incomplete, misleading, or inappropriate applications.
              </p>
            </section>
            <section>
              <h2 className={subheading}>4. Minors and conduct</h2>
              <p className={paragraph}>
                Applicants and participants under 18 should involve a parent or legal guardian in decisions about applying and attending. Any event-specific safeguarding, supervision, attendance, and conduct rules must be provided separately before participation. Nothing on this website replaces required guardian permission or event approvals.
              </p>
            </section>
            <section>
              <h2 className={subheading}>5. Fees, cancellation, and refunds</h2>
              <p className={paragraph}>
                This website does not establish a fee, payment method, refund entitlement, or cancellation policy. If any fee is introduced, the amount, recipient, payment process, cancellation terms, and refund rules must be clearly disclosed before payment is requested. Do not send money to an individual based solely on an informal message.
              </p>
            </section>
            <section>
              <h2 className={subheading}>6. Photos, video, and intellectual property</h2>
              <p className={paragraph}>
                Do not assume that submitting an application grants permission to publish an applicant's image, voice, writing, or portfolio. Any event photography or video intended for public use should be handled through a separate, clear permission process, with appropriate arrangements for minors. Willow MUN branding and original website materials may not be copied or reused without permission. Applicants remain responsible for having the rights to material they submit.
              </p>
            </section>
            <section>
              <h2 className={subheading}>7. Acceptable use</h2>
              <p className={paragraph}>
                Do not misuse the website, interfere with its operation, submit false or unlawful material, attempt to access another person's account or application, or upload content that infringes another person's rights. Access to staff portals is limited to people who have been authorized by the organizers.
              </p>
            </section>
            <section>
              <h2 className={subheading}>8. Contact and legal effect</h2>
              <p className={paragraph}>
                Questions about this website may be sent through the official{' '}
                <a className="text-[#a9b47e] underline underline-offset-4" href="https://www.instagram.com/willow.mun/" target="_blank" rel="noopener noreferrer">Willow MUN Instagram account</a>.
                These terms do not waive rights that cannot legally be waived, do not exclude liability where exclusion is unlawful, and do not replace applicable law or professional legal advice.
              </p>
            </section>
          </>
        )}

        <div className="mt-12 border-t border-[#ede6ca]/15 pt-6 text-sm text-[#a9b47e]">
          <a href={isPrivacy ? '/terms' : '/privacy'} className="underline underline-offset-4">
            {isPrivacy ? 'Read Website & Application Terms' : 'Read Privacy Notice'}
          </a>
        </div>
      </div>
    </main>
  );
}
