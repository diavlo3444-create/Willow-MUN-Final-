import type {
  EmailApplicantRecord,
  EmailDecisionType,
  EmailHistoryRecord,
  EmailQueueItem,
  EmailTemplateRecord,
  PlaceholderTokenInfo,
} from './types';

export const ESTIMATED_DAILY_CAPACITY = 500;

export const EMAIL_TEMPLATE_PLACEHOLDERS: readonly PlaceholderTokenInfo[] = [
  {
    token: '{{applicant_name}}',
    description: 'Applicant full name (underscore format)',
  },
  {
    token: '{{name}}',
    description: 'Applicant full name (short alias)',
  },
  {
    token: '{{department}}',
    description: 'Assigned Willow MUN department',
  },
  {
    token: '{{position}}',
    description: 'Applied role or team position',
  },
  {
    token: '{{signup_link}}',
    description: 'Unique registration / onboarding URL (underscore format)',
  },
  {
    token: '{{signupUrl}}',
    description: 'Unique registration / onboarding URL (camelCase alias)',
  },
  {
    token: '{{decision}}',
    description: 'Formatted decision status (Accepted or Rejected)',
  },
] as const;

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailDecisionType, EmailTemplateRecord> = {
  accepted: {
    key: 'accepted',
    label: 'Acceptance Email',
    subject: 'Willow MUN 2027 — {{department}} Team Acceptance ({{applicant_name}})',
    body: `Dear {{applicant_name}},

Congratulations! Following careful review by the Secretariat and Human Resources, we are pleased to confirm your {{decision}} decision for the {{department}} team as {{position}} for Willow MUN 2027.

To complete your onboarding and activate your official Willow MUN staff portal account, please complete your registration using your dedicated link below:
{{signup_link}}

Important next steps:
- Complete onboarding within 48 hours using {{signupUrl}}
- Review your department briefing schedule upon sign-in
- Reply to this email if you need any assistance

We look forward to welcoming you to Willow MUN 2027.

Warm regards,
Willow MUN Secretariat & Human Resources`,
    updatedAt: '2027-11-18T09:30:00.000Z',
  },
  rejected: {
    key: 'rejected',
    label: 'Rejection Email',
    subject: 'Willow MUN 2027 — Application Update for {{department}}',
    body: `Dear {{name}},

Thank you for taking the time to apply for the {{position}} role within our {{department}} team for Willow MUN 2027.

After reviewing all dossiers submitted for this cycle, we regret to inform you that your application outcome is {{decision}}, as spaces within {{department}} were highly competitive this year.

We genuinely appreciate your interest in Willow MUN and encourage you to apply for upcoming conference opportunities.

Warm regards,
Willow MUN Secretariat & Human Resources`,
    updatedAt: '2027-11-18T09:30:00.000Z',
  },
};

export const SAMPLE_EMAIL_APPLICANTS: EmailApplicantRecord[] = [
  {
    id: 'sample-app-01',
    applicationCode: 'WM-27-101',
    applicantName: 'Layla Al-Mansoor',
    email: 'layla.mansoor@example.com',
    department: 'Media',
    departmentSlug: 'media',
    appliedPosition: 'Lead Event Photographer',
    applicationStatus: 'accepted',
    emailStatus: 'not_sent',
    applicationDate: '2026-11-12T10:15:00.000Z',
    signupLink: 'https://willowmun.org/hr-signup?token=sample-layla-101',
  },
  {
    id: 'sample-app-02',
    applicationCode: 'WM-27-102',
    applicantName: 'Omar Haddad',
    email: 'omar.haddad@example.com',
    department: 'Security',
    departmentSlug: 'security',
    appliedPosition: 'Floor Security Officer',
    applicationStatus: 'accepted',
    emailStatus: 'not_sent',
    applicationDate: '2026-11-12T11:40:00.000Z',
    signupLink: 'https://willowmun.org/hr-signup?token=sample-omar-102',
  },
  {
    id: 'sample-app-03',
    applicationCode: 'WM-27-103',
    applicantName: 'Noura Al-Qahtani',
    email: 'noura.qahtani@example.com',
    department: 'Press',
    departmentSlug: 'press',
    appliedPosition: 'Diplomatic Correspondent',
    applicationStatus: 'accepted',
    emailStatus: 'sent',
    applicationDate: '2026-11-11T16:20:00.000Z',
    signupLink: 'https://willowmun.org/hr-signup?token=sample-noura-103',
  },
  {
    id: 'sample-app-04',
    applicationCode: 'WM-27-104',
    applicantName: 'Zaid Farooq',
    email: 'zaid.farooq@example.com',
    department: 'Volunteers',
    departmentSlug: 'volunteers',
    appliedPosition: 'Delegate Affairs Runner',
    applicationStatus: 'rejected',
    emailStatus: 'not_sent',
    applicationDate: '2026-11-13T08:05:00.000Z',
  },
  {
    id: 'sample-app-05',
    applicationCode: 'WM-27-105',
    applicantName: 'Mariam Saleh',
    email: 'mariam.saleh@example.com',
    department: 'Volunteers',
    departmentSlug: 'volunteers',
    appliedPosition: 'Registration Desk Coordinator',
    applicationStatus: 'accepted',
    emailStatus: 'failed',
    applicationDate: '2026-11-13T14:50:00.000Z',
    signupLink: 'https://willowmun.org/hr-signup?token=sample-mariam-105',
  },
  {
    id: 'sample-app-06',
    applicationCode: 'WM-27-106',
    applicantName: 'Karim Darwish',
    email: 'karim.darwish@example.com',
    department: 'Press',
    departmentSlug: 'press',
    appliedPosition: 'Committee Editor',
    applicationStatus: 'rejected',
    emailStatus: 'not_sent',
    applicationDate: '2026-11-14T09:12:00.000Z',
  },
  {
    id: 'sample-app-07',
    applicationCode: 'WM-27-107',
    applicantName: 'Salma Al-Harbi',
    email: 'salma.harbi@example.com',
    department: 'Media',
    departmentSlug: 'media',
    appliedPosition: 'Reels & Video Editor',
    applicationStatus: 'pending',
    emailStatus: 'not_sent',
    applicationDate: '2026-11-14T15:35:00.000Z',
  },
  {
    id: 'sample-app-08',
    applicationCode: 'WM-27-108',
    applicantName: 'Youssef Nasser',
    email: 'youssef.nasser@example.com',
    department: 'Security',
    departmentSlug: 'security',
    appliedPosition: 'Access Gate Coordinator',
    applicationStatus: 'rejected',
    emailStatus: 'failed',
    applicationDate: '2026-11-15T12:18:00.000Z',
  },
  {
    id: 'sample-app-09',
    applicationCode: 'WM-27-109',
    applicantName: 'Hana El-Sayed',
    email: 'hana.elsayed@example.com',
    department: 'Volunteers',
    departmentSlug: 'volunteers',
    appliedPosition: 'Hall Logistics Volunteer',
    applicationStatus: 'accepted',
    emailStatus: 'not_sent',
    applicationDate: '2026-11-15T17:42:00.000Z',
    signupLink: 'https://willowmun.org/hr-signup?token=sample-hana-109',
  },
  {
    id: 'sample-app-10',
    applicationCode: 'WM-27-110',
    applicantName: 'Tariq Al-Otaibi',
    email: 'tariq.otaibi@example.com',
    department: 'Media',
    departmentSlug: 'media',
    appliedPosition: 'Session Photographer',
    applicationStatus: 'rejected',
    emailStatus: 'sent',
    applicationDate: '2026-11-16T09:00:00.000Z',
  },
  {
    id: 'sample-app-11',
    applicationCode: 'WM-27-111',
    applicantName: 'Amina Khalid',
    email: 'amina.khalid@example.com',
    department: 'Press',
    departmentSlug: 'press',
    appliedPosition: 'Feature Writer',
    applicationStatus: 'pending',
    emailStatus: 'not_sent',
    applicationDate: '2026-11-16T13:22:00.000Z',
  },
  {
    id: 'sample-app-12',
    applicationCode: 'WM-27-112',
    applicantName: 'Rami Khoury',
    email: 'rami.khoury@example.com',
    department: 'Security',
    departmentSlug: 'security',
    appliedPosition: 'VIP Escort & Perimeter',
    applicationStatus: 'accepted',
    emailStatus: 'sent',
    applicationDate: '2026-11-17T10:05:00.000Z',
    signupLink: 'https://willowmun.org/hr-signup?token=sample-rami-112',
  },
];

export const SAMPLE_EMAIL_HISTORY: EmailHistoryRecord[] = [
  {
    id: 'hist-01',
    applicantId: 'sample-app-03',
    recipientName: 'Noura Al-Qahtani',
    recipientEmail: 'noura.qahtani@example.com',
    department: 'Press',
    emailType: 'accepted',
    subject: 'Willow MUN 2027 — Press Team Acceptance (Noura Al-Qahtani)',
    status: 'sent',
    attemptCount: 1,
    sentAt: '2026-11-19T08:14:00.000Z',
    lastAttemptAt: '2026-11-19T08:14:00.000Z',
    errorDetails: null,
  },
  {
    id: 'hist-02',
    applicantId: 'sample-app-05',
    recipientName: 'Mariam Saleh',
    recipientEmail: 'mariam.saleh@example.com',
    department: 'Volunteers',
    emailType: 'accepted',
    subject: 'Willow MUN 2027 — Volunteers Team Acceptance (Mariam Saleh)',
    status: 'failed',
    attemptCount: 2,
    sentAt: null,
    lastAttemptAt: '2026-11-19T09:02:00.000Z',
    errorDetails: 'SMTP transient error 421: Temporary mailbox rate limit reached.',
  },
  {
    id: 'hist-03',
    applicantId: 'sample-app-10',
    recipientName: 'Tariq Al-Otaibi',
    recipientEmail: 'tariq.otaibi@example.com',
    department: 'Media',
    emailType: 'rejected',
    subject: 'Willow MUN 2027 — Application Update for Media',
    status: 'sent',
    attemptCount: 1,
    sentAt: '2026-11-19T09:40:00.000Z',
    lastAttemptAt: '2026-11-19T09:40:00.000Z',
    errorDetails: null,
  },
  {
    id: 'hist-04',
    applicantId: 'sample-app-08',
    recipientName: 'Youssef Nasser',
    recipientEmail: 'youssef.nasser@example.com',
    department: 'Security',
    emailType: 'rejected',
    subject: 'Willow MUN 2027 — Application Update for Security',
    status: 'failed',
    attemptCount: 1,
    sentAt: null,
    lastAttemptAt: '2026-11-19T10:15:00.000Z',
    errorDetails: 'Relay timeout after 10000ms while handshaking with mail server.',
  },
  {
    id: 'hist-05',
    applicantId: 'sample-app-12',
    recipientName: 'Rami Khoury',
    recipientEmail: 'rami.khoury@example.com',
    department: 'Security',
    emailType: 'accepted',
    subject: 'Willow MUN 2027 — Security Team Acceptance (Rami Khoury)',
    status: 'sent',
    attemptCount: 1,
    sentAt: '2026-11-18T18:25:00.000Z',
    lastAttemptAt: '2026-11-18T18:25:00.000Z',
    errorDetails: null,
  },
  {
    id: 'hist-06',
    applicantId: 'sample-app-01',
    recipientName: 'Layla Al-Mansoor',
    recipientEmail: 'layla.mansoor@example.com',
    department: 'Media',
    emailType: 'accepted',
    subject: 'Willow MUN 2027 — Media Team Acceptance (Layla Al-Mansoor)',
    status: 'pending',
    attemptCount: 0,
    sentAt: null,
    lastAttemptAt: '2026-11-19T11:30:00.000Z',
    errorDetails: null,
  },
];

export const SAMPLE_INITIAL_QUEUE: EmailQueueItem[] = [
  {
    id: 'q-01',
    applicantId: 'sample-app-01',
    recipientName: 'Layla Al-Mansoor',
    recipientEmail: 'layla.mansoor@example.com',
    department: 'Media',
    emailType: 'accepted',
    subject: 'Willow MUN 2027 — Media Team Acceptance (Layla Al-Mansoor)',
    status: 'waiting',
    queuedAt: '2026-11-19T11:30:00.000Z',
  },
  {
    id: 'q-02',
    applicantId: 'sample-app-05',
    recipientName: 'Mariam Saleh',
    recipientEmail: 'mariam.saleh@example.com',
    department: 'Volunteers',
    emailType: 'accepted',
    subject: 'Willow MUN 2027 — Volunteers Team Acceptance (Mariam Saleh)',
    status: 'failed',
    errorDetails: 'SMTP transient error 421: Temporary mailbox rate limit reached.',
    queuedAt: '2026-11-19T09:02:00.000Z',
  },
  {
    id: 'q-03',
    applicantId: 'sample-app-03',
    recipientName: 'Noura Al-Qahtani',
    recipientEmail: 'noura.qahtani@example.com',
    department: 'Press',
    emailType: 'accepted',
    subject: 'Willow MUN 2027 — Press Team Acceptance (Noura Al-Qahtani)',
    status: 'sent',
    queuedAt: '2026-11-19T08:14:00.000Z',
  },
];

export function renderEmailPreview(
  templateText: string,
  applicant: EmailApplicantRecord,
  decisionOverride?: EmailDecisionType,
): string {
  const effectiveDecision =
    decisionOverride ??
    (applicant.applicationStatus === 'rejected' ? 'rejected' : 'accepted');
  const decisionLabel = effectiveDecision === 'accepted' ? 'Accepted' : 'Rejected';
  const signupUrl =
    applicant.signupLink || `https://willowmun.org/hr-signup?token=${applicant.id}`;

  return templateText
    .replaceAll('{{applicant_name}}', applicant.applicantName)
    .replaceAll('{{name}}', applicant.applicantName)
    .replaceAll('{{department}}', applicant.department)
    .replaceAll('{{position}}', applicant.appliedPosition)
    .replaceAll('{{signup_link}}', signupUrl)
    .replaceAll('{{signupUrl}}', signupUrl)
    .replaceAll('{{decision}}', decisionLabel);
}
