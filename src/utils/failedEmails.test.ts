import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_EMAIL_TEMPLATES } from '../components/admin/views/emails/sampleData';
import type {
  EmailApplicantRecord,
  EmailHistoryRecord,
} from '../components/admin/views/emails/types';
import {
  applySignupLinkToBody,
  buildFailedEmailKey,
  buildGmailComposeUrl,
  interpretSendResponse,
  loadLocalFailedEmails,
  loadManualGmailOpenedMap,
  mergeAndDeduplicateFailedEmails,
  recordManualGmailOpened,
  removeLocalFailedEmails,
  resolveEmailContent,
  sanitizeEmailError,
  upsertLocalFailedEmail,
} from './failedEmails';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

test('interpretSendResponse only marks confirmed deliveries as sent and catches uncertain or error outcomes', () => {
  assert.deepEqual(
    interpretSendResponse({ data: { status: 'sent' }, error: null }),
    { outcome: 'sent', errorDetails: null },
  );
  assert.deepEqual(
    interpretSendResponse({ data: { sent: true }, error: null }),
    { outcome: 'sent', errorDetails: null },
  );
  assert.deepEqual(
    interpretSendResponse({ data: { delivery: { status: 'sent' } }, error: null }),
    { outcome: 'sent', errorDetails: null },
  );

  // Uncertain responses MUST NOT be marked as sent
  const pendingResult = interpretSendResponse({ data: { status: 'pending' }, error: null });
  assert.equal(pendingResult.outcome, 'failed');
  assert.match(pendingResult.errorDetails || '', /pending/i);

  const emptyResult = interpretSendResponse({ data: {}, error: null });
  assert.equal(emptyResult.outcome, 'failed');
  assert.match(emptyResult.errorDetails || '', /not confirm delivery/i);

  // Explicit error or HTTP error
  const failedStatusResult = interpretSendResponse({
    data: { status: 'failed', error: 'SMTP 550 mailbox unavailable' },
    error: null,
  });
  assert.equal(failedStatusResult.outcome, 'failed');
  assert.match(failedStatusResult.errorDetails || '', /SMTP 550/);

  const networkErrorResult = interpretSendResponse({
    data: null,
    error: new Error('FunctionsHttpError'),
    extractedError: 'Gmail relay returned 502 Bad Gateway',
  });
  assert.equal(networkErrorResult.outcome, 'failed');
  assert.equal(networkErrorResult.errorDetails, 'Gmail relay returned 502 Bad Gateway');
});

test('sanitizeEmailError redacts sensitive tokens, SMTP credentials, API keys, and stack traces', () => {
  const raw = `Authorization Bearer abcdef12345 failed for smtps://admin:supersecret@smtp.gmail.com:465 api_key=sk_live_999 token=eyJhbGciOiJIUzI1NiJ9.payloadpayload.sig
    at sendMail (/supabase/functions/index.ts:44:12)`;
  const sanitized = sanitizeEmailError(raw);

  assert.equal(sanitized.includes('abcdef12345'), false);
  assert.equal(sanitized.includes('supersecret'), false);
  assert.equal(sanitized.includes('sk_live_999'), false);
  assert.equal(sanitized.includes('payloadpayload'), false);
  assert.equal(sanitized.includes('index.ts:44'), false);
  assert.match(sanitized, /\[REDACTED\]/);
});

test('buildGmailComposeUrl populates recipient, subject, full body, line breaks, special characters, and long text accurately', () => {
  const longParagraph = 'This conference briefing covers delegate coordination, badge verification, & floor operations. '.repeat(20);
  const body = `Dear Layla & Team,\r\n\r\nWelcome to Willow MUN 2027 — Press & Media!\nURL: https://willowmun.org/team-signup?token=tok_123+abc&ref=hr\n\n${longParagraph}\nBest regards,\nHR & Secretariat`;
  const subject = 'Willow MUN 2027 — Acceptance & Onboarding (Layla + Press)';
  const to = 'layla.mansoor+mun@example.com';

  const urlStr = buildGmailComposeUrl({ to, subject, body });
  assert.equal(urlStr.startsWith('https://mail.google.com/mail/?view=cm&fs=1'), true);

  const parsed = new URL(urlStr);
  assert.equal(parsed.searchParams.get('view'), 'cm');
  assert.equal(parsed.searchParams.get('fs'), '1');
  assert.equal(parsed.searchParams.get('to'), to);
  assert.equal(parsed.searchParams.get('su'), subject);
  // \r\n normalized to \n while preserving exact multi-line content and special characters
  assert.equal(parsed.searchParams.get('body'), body.replace(/\r\n/g, '\n'));
});

test('mergeAndDeduplicateFailedEmails deduplicates server + local failures, preserves status on Gmail open, and resolves once sent', () => {
  const storage = createMemoryStorage();

  const applicants: EmailApplicantRecord[] = [
    {
      id: 'app-1',
      applicationCode: 'WM-001',
      applicantName: 'Omar Haddad',
      email: 'omar.haddad@example.com',
      department: 'Security',
      departmentSlug: 'security',
      appliedPosition: 'Floor Security Officer',
      applicationStatus: 'accepted',
      emailStatus: 'failed',
      applicationDate: '2026-11-18T10:00:00.000Z',
      signupLink: 'https://willowmun.org/team-signup?token=perm-omar-1',
    },
    {
      id: 'app-2',
      applicationCode: 'WM-002',
      applicantName: 'Noura Al-Qahtani',
      email: 'noura@example.com',
      department: 'Press',
      departmentSlug: 'press',
      appliedPosition: 'Reporter',
      applicationStatus: 'rejected',
      emailStatus: 'sent',
      applicationDate: '2026-11-18T11:00:00.000Z',
    },
  ];

  // Record 2 local attempts for Omar (should deduplicate to 1 entry with attemptCount = 2)
  upsertLocalFailedEmail(
    {
      id: 'local-1',
      serverDeliveryId: null,
      applicantId: 'app-1',
      recipientName: 'Omar Haddad',
      recipientEmail: 'omar.haddad@example.com',
      department: 'Security',
      appliedPosition: 'Floor Security Officer',
      emailType: 'accepted',
      subject: 'Willow MUN 2027 — Security Team Acceptance (Omar Haddad)',
      bodyText: 'Dear Omar,\nJoin here: https://willowmun.org/team-signup?token=perm-omar-1',
      errorDetails: 'First failure: timeout',
      lastAttemptAt: '2026-11-20T08:00:00.000Z',
    },
    storage,
  );
  upsertLocalFailedEmail(
    {
      id: 'local-2',
      serverDeliveryId: 'srv-deliv-1',
      applicantId: 'app-1',
      recipientName: 'Omar Haddad',
      recipientEmail: 'omar.haddad@example.com',
      department: 'Security',
      appliedPosition: 'Floor Security Officer',
      emailType: 'accepted',
      subject: 'Willow MUN 2027 — Security Team Acceptance (Omar Haddad)',
      bodyText: 'Dear Omar,\nJoin here: https://willowmun.org/team-signup?token=perm-omar-1',
      errorDetails: 'Second failure: SMTP 421 rate limit',
      lastAttemptAt: '2026-11-20T09:00:00.000Z',
    },
    storage,
  );

  // Persist local failure for Noura that is actually older than server 'sent'
  upsertLocalFailedEmail(
    {
      id: 'local-noura',
      serverDeliveryId: null,
      applicantId: 'app-2',
      recipientName: 'Noura Al-Qahtani',
      recipientEmail: 'noura@example.com',
      department: 'Press',
      appliedPosition: 'Reporter',
      emailType: 'rejected',
      subject: 'Willow MUN 2027 — Application Update for Press',
      bodyText: 'Thank you Noura.',
      errorDetails: 'Transient network error',
      lastAttemptAt: '2026-11-20T07:00:00.000Z',
    },
    storage,
  );

  const serverHistory: EmailHistoryRecord[] = [
    {
      id: 'srv-deliv-1',
      applicantId: 'app-1',
      recipientName: 'Omar Haddad',
      recipientEmail: 'omar.haddad@example.com',
      department: 'Security',
      emailType: 'accepted',
      subject: 'Willow MUN 2027 — Security Team Acceptance (Omar Haddad)',
      status: 'failed',
      attemptCount: 2,
      sentAt: null,
      lastAttemptAt: '2026-11-20T08:30:00.000Z',
      errorDetails: 'Old server failure',
    },
    {
      id: 'srv-deliv-noura',
      applicantId: 'app-2',
      recipientName: 'Noura Al-Qahtani',
      recipientEmail: 'noura@example.com',
      department: 'Press',
      emailType: 'rejected',
      subject: 'Willow MUN 2027 — Application Update for Press',
      status: 'sent',
      attemptCount: 2,
      sentAt: '2026-11-20T09:15:00.000Z',
      lastAttemptAt: '2026-11-20T09:15:00.000Z',
      errorDetails: null,
    },
  ];

  // Mark Omar's failed email as opened in Gmail — must NOT remove it or mark it sent
  const omarKey = buildFailedEmailKey('app-1', 'omar.haddad@example.com', 'accepted');
  recordManualGmailOpened(omarKey, '2026-11-20T09:05:00.000Z', storage);

  const persistedLocal = loadLocalFailedEmails(storage);
  const manualMap = loadManualGmailOpenedMap(storage);

  const merged = mergeAndDeduplicateFailedEmails({
    serverHistory,
    localFailures: persistedLocal,
    applicants,
    templates: DEFAULT_EMAIL_TEMPLATES,
    manualOpenedMap: manualMap,
  });

  // Deduplicated: only 1 record for Omar; Noura was confirmed sent later so excluded & queued for cleanup
  assert.equal(merged.failedRecords.length, 1);
  assert.equal(merged.failedRecords[0].key, omarKey);
  assert.equal(merged.failedRecords[0].status, 'failed');
  assert.equal(merged.failedRecords[0].attemptCount, 2);
  assert.equal(merged.failedRecords[0].serverDeliveryId, 'srv-deliv-1');
  assert.equal(merged.failedRecords[0].errorDetails, 'Second failure: SMTP 421 rate limit');
  assert.equal(merged.failedRecords[0].manualDraftOpenedAt, '2026-11-20T09:05:00.000Z');
  assert.deepEqual(merged.resolvedKeysToClear, ['app-2|rejected']);

  // Pruning resolved keys leaves Omar persisted across sessions
  const afterPrune = removeLocalFailedEmails(merged.resolvedKeysToClear, storage);
  assert.equal(afterPrune.length, 1);
  assert.equal(afterPrune[0].key, omarKey);
});

test('resolveEmailContent and applySignupLinkToBody replace placeholder signup links cleanly', () => {
  const content = resolveEmailContent({
    applicant: {
      id: 'app-99',
      applicantName: 'Hana Tariq',
      email: 'hana@example.com',
      department: 'Volunteers',
      appliedPosition: 'Logistics Volunteer',
      applicationStatus: 'accepted',
      signupLink: 'https://willowmun.org/team-signup?token=perm-hana-99',
    },
    emailType: 'accepted',
    templates: DEFAULT_EMAIL_TEMPLATES,
  });

  assert.match(content.subject, /Volunteers/);
  assert.match(content.subject, /Hana Tariq/);
  assert.match(content.bodyText, /https:\/\/willowmun\.org\/team-signup\?token=perm-hana-99/);
  assert.equal(content.bodyText.includes('{{signup_link}}'), false);

  const upgraded = applySignupLinkToBody(
    'Click https://willowmun.org/hr-signup?token=app-99 to register.',
    'https://willowmun.org/team-signup?token=real-token',
  );
  assert.equal(
    upgraded,
    'Click https://willowmun.org/team-signup?token=real-token to register.',
  );
});
