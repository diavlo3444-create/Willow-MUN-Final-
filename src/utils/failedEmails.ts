import {
  DEFAULT_EMAIL_TEMPLATES,
  renderEmailPreview,
} from '../components/admin/views/emails/sampleData';
import type {
  EmailApplicantRecord,
  EmailDecisionType,
  EmailHistoryRecord,
  EmailTemplateRecord,
  FailedEmailRecord,
  ManualEmailConfirmationRecord,
} from '../components/admin/views/emails/types';

export const FAILED_EMAILS_STORAGE_KEY = 'wm_failed_emails_v1';
export const FAILED_EMAILS_GMAIL_OPENED_KEY = 'wm_failed_email_gmail_opened_v1';

export interface LocalFailedEmailEntry {
  key: string;
  id: string;
  serverDeliveryId: string | null;
  applicantId: string;
  recipientName: string;
  recipientEmail: string;
  department: string;
  appliedPosition: string;
  emailType: EmailDecisionType;
  subject: string;
  bodyText: string;
  errorDetails: string;
  attemptCount: number;
  lastAttemptAt: string;
  signupLink?: string | null;
}

export interface SendInterpretation {
  outcome: 'sent' | 'failed';
  errorDetails: string | null;
}

export function buildFailedEmailKey(
  applicantId: string | null | undefined,
  recipientEmail: string,
  emailType: EmailDecisionType,
): string {
  const normalizedId = String(applicantId ?? '').trim();
  if (normalizedId) {
    return `${normalizedId}|${emailType}`;
  }
  return `email:${recipientEmail.trim().toLowerCase()}|${emailType}`;
}

export function sanitizeEmailError(raw: unknown): string {
  const text = String(raw ?? '').trim();
  if (!text) return 'Email delivery failed. Retry or send manually via Gmail.';

  let cleaned = text
    // Redact Bearer / JWT / API tokens
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+)?\b/g, '[REDACTED_TOKEN]')
    // Redact credentialed URLs like smtps://user:pass@host
    .replace(/([a-z]+:\/\/)([^:\s/@]+):([^@\s]+)@/gi, '$1[REDACTED]:[REDACTED]@')
    // Redact key=value secret patterns
    .replace(
      /(api[_-]?key|apikey|secret|password|passwd|smtp_pass|access_token|refresh_token|authorization)\s*[:=]\s*([^\s,;]+)/gi,
      '$1=[REDACTED]',
    )
    // Strip JS/Deno stack trace lines
    .split(/\r?\n/)
    .filter((line) => !/^\s*at\s+\S+/.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    cleaned = 'Email delivery failed on the mail relay.';
  }
  if (cleaned.length > 320) {
    cleaned = `${cleaned.slice(0, 317)}...`;
  }
  return cleaned;
}

export async function extractEdgeInvokeError(
  error: unknown,
  data: unknown,
): Promise<string | null> {
  const payload = (data && typeof data === 'object' ? data : null) as Record<string, unknown> | null;
  if (payload) {
    const payloadErr = payload.error ?? payload.message ?? payload.details;
    if (typeof payloadErr === 'string' && payloadErr.trim()) {
      return sanitizeEmailError(payloadErr);
    }
  }

  if (error && typeof error === 'object') {
    const errObj = error as { message?: unknown; context?: unknown };
    const ctx = errObj.context as
      | { clone?: () => Response; json?: () => Promise<unknown>; text?: () => Promise<string>; status?: number }
      | undefined;

    if (ctx && typeof ctx.json === 'function') {
      try {
        const readable = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
        if (typeof readable.json === 'function') {
          const body = (await readable.json()) as Record<string, unknown> | null;
          const serverMsg = body?.error ?? body?.message ?? body?.msg;
          if (typeof serverMsg === 'string' && serverMsg.trim()) {
            return sanitizeEmailError(serverMsg);
          }
        }
      } catch {
        if (typeof ctx.text === 'function') {
          try {
            const readableText = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
            if (typeof readableText.text === 'function') {
              const rawText = await readableText.text();
              if (rawText.trim()) {
                return sanitizeEmailError(rawText);
              }
            }
          } catch {
            // Fall through to error.message
          }
        }
      }
    }

    if (typeof errObj.message === 'string' && errObj.message.trim()) {
      return sanitizeEmailError(errObj.message);
    }
  }

  if (typeof error === 'string' && error.trim()) {
    return sanitizeEmailError(error);
  }
  return null;
}

export function interpretSendResponse(params: {
  data: unknown;
  error: unknown;
  extractedError?: string | null;
}): SendInterpretation {
  const { data, error, extractedError } = params;
  const payload = (data && typeof data === 'object' ? data : null) as Record<string, unknown> | null;
  const delivery =
    payload?.delivery && typeof payload.delivery === 'object'
      ? (payload.delivery as Record<string, unknown>)
      : null;

  const hasExplicitFailure =
    Boolean(error) ||
    Boolean(payload?.error) ||
    payload?.ok === false ||
    payload?.success === false ||
    payload?.sent === false ||
    payload?.status === 'failed' ||
    delivery?.status === 'failed';

  if (hasExplicitFailure) {
    const rawReason =
      extractedError ||
      payload?.error ||
      delivery?.error_message ||
      payload?.message ||
      (error instanceof Error ? error.message : null) ||
      'Mail server rejected or failed to deliver this email.';
    return {
      outcome: 'failed',
      errorDetails: sanitizeEmailError(rawReason),
    };
  }

  const explicitSent =
    payload?.status === 'sent' ||
    payload?.sent === true ||
    payload?.success === true ||
    delivery?.status === 'sent';

  if (!explicitSent) {
    const statusLabel = typeof payload?.status === 'string' ? payload.status : null;
    return {
      outcome: 'failed',
      errorDetails:
        statusLabel === 'pending'
          ? 'Delivery status remained pending without server confirmation; recorded as Failed to Send so it is not missed.'
          : 'Server response did not confirm delivery; recorded as Failed to Send.',
    };
  }

  return { outcome: 'sent', errorDetails: null };
}

export function hasValidRecipientEmail(email: string | null | undefined): boolean {
  const clean = String(email ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean);
}

export function buildGmailComposeUrl(params: {
  to: string;
  subject: string;
  body: string;
}): string {
  const to = params.to.trim();
  const subject = params.subject.replace(/\r\n?/g, '\n');
  const body = params.body.replace(/\r\n?/g, '\n');

  return (
    'https://mail.google.com/mail/?view=cm&fs=1' +
    `&to=${encodeURIComponent(to)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`
  );
}

export function applySignupLinkToBody(
  body: string,
  signupUrl: string | null | undefined,
): string {
  if (!signupUrl) return body;
  const trimmed = signupUrl.trim();
  if (!trimmed) return body;

  let updated = body
    .replaceAll('{{signup_link}}', trimmed)
    .replaceAll('{{signupUrl}}', trimmed);

  updated = updated.replace(/https?:\/\/willowmun\.org\/hr-signup\?token=[^\s)]+/gi, trimmed);
  return updated;
}

export function resolveEmailContent(params: {
  applicant: Pick<
    EmailApplicantRecord,
    'id' | 'applicantName' | 'email' | 'department' | 'appliedPosition' | 'applicationStatus' | 'signupLink'
  >;
  emailType: EmailDecisionType;
  templates: Record<EmailDecisionType, EmailTemplateRecord>;
  subjectOverride?: string | null;
  bodyOverride?: string | null;
}): { subject: string; bodyText: string } {
  const { applicant, emailType, templates, subjectOverride, bodyOverride } = params;
  const template = templates[emailType] ?? DEFAULT_EMAIL_TEMPLATES[emailType];

  const applicantForRender: EmailApplicantRecord = {
    id: applicant.id,
    applicationCode: applicant.id.slice(0, 8),
    applicantName: applicant.applicantName || 'Applicant',
    email: applicant.email || '',
    department: applicant.department || 'General',
    departmentSlug: (applicant.department || 'general').toLowerCase(),
    appliedPosition: applicant.appliedPosition || 'Team Member',
    applicationStatus: applicant.applicationStatus || emailType,
    emailStatus: 'failed',
    applicationDate: '',
    signupLink: applicant.signupLink,
  };

  const renderedSubject = renderEmailPreview(template.subject, applicantForRender, emailType);
  const renderedBody = renderEmailPreview(template.body, applicantForRender, emailType);

  const subject =
    typeof subjectOverride === 'string' && subjectOverride.trim()
      ? subjectOverride.trim()
      : renderedSubject;

  const rawBody =
    typeof bodyOverride === 'string' && bodyOverride.trim()
      ? bodyOverride
      : renderedBody;

  return {
    subject,
    bodyText: applySignupLinkToBody(rawBody, applicant.signupLink),
  };
}

export function mergeAndDeduplicateFailedEmails(params: {
  serverHistory: EmailHistoryRecord[];
  localFailures: LocalFailedEmailEntry[];
  applicants: EmailApplicantRecord[];
  templates: Record<EmailDecisionType, EmailTemplateRecord>;
  manualOpenedMap?: Record<string, string>;
}): {
  failedRecords: FailedEmailRecord[];
  resolvedKeysToClear: string[];
} {
  const {
    serverHistory,
    localFailures,
    applicants,
    templates,
    manualOpenedMap = {},
  } = params;

  const applicantById = new Map<string, EmailApplicantRecord>();
  applicants.forEach((a) => applicantById.set(a.id, a));

  interface GroupAccumulator {
    key: string;
    latestSentAtMs: number;
    latestFailedAtMs: number;
    latestServerRow: EmailHistoryRecord | null;
    latestServerFailedRow: EmailHistoryRecord | null;
    latestLocalEntry: LocalFailedEmailEntry | null;
    maxServerAttempts: number;
    maxLocalAttempts: number;
  }

  const groups = new Map<string, GroupAccumulator>();

  const ensureGroup = (key: string): GroupAccumulator => {
    const existing = groups.get(key);
    if (existing) return existing;
    const created: GroupAccumulator = {
      key,
      latestSentAtMs: -1,
      latestFailedAtMs: -1,
      latestServerRow: null,
      latestServerFailedRow: null,
      latestLocalEntry: null,
      maxServerAttempts: 0,
      maxLocalAttempts: 0,
    };
    groups.set(key, created);
    return created;
  };

  const toMs = (iso: string | null | undefined): number => {
    if (!iso) return 0;
    const parsed = Date.parse(iso);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  for (const row of serverHistory) {
    const key = buildFailedEmailKey(row.applicantId, row.recipientEmail, row.emailType);
    const group = ensureGroup(key);
    group.maxServerAttempts = Math.max(group.maxServerAttempts, Number(row.attemptCount || 0));

    const rowMs = toMs(row.sentAt || row.lastAttemptAt);
    if (!group.latestServerRow || rowMs >= toMs(group.latestServerRow.sentAt || group.latestServerRow.lastAttemptAt)) {
      group.latestServerRow = row;
    }

    if (row.status === 'sent') {
      if (rowMs >= group.latestSentAtMs) {
        group.latestSentAtMs = rowMs;
      }
    } else if (row.status === 'failed') {
      if (rowMs >= group.latestFailedAtMs) {
        group.latestFailedAtMs = rowMs;
      }
      if (
        !group.latestServerFailedRow ||
        rowMs >= toMs(group.latestServerFailedRow.lastAttemptAt)
      ) {
        group.latestServerFailedRow = row;
      }
    }
  }

  for (const local of localFailures) {
    const key = buildFailedEmailKey(local.applicantId, local.recipientEmail, local.emailType);
    const group = ensureGroup(key);
    group.maxLocalAttempts = Math.max(group.maxLocalAttempts, Number(local.attemptCount || 1));

    const localMs = toMs(local.lastAttemptAt);
    if (!group.latestLocalEntry || localMs >= toMs(group.latestLocalEntry.lastAttemptAt)) {
      group.latestLocalEntry = local;
    }
    if (localMs >= group.latestFailedAtMs) {
      group.latestFailedAtMs = localMs;
    }
  }

  const failedRecords: FailedEmailRecord[] = [];
  const resolvedKeysToClear: string[] = [];

  for (const group of groups.values()) {
    const latestServerIsSent = group.latestServerRow?.status === 'sent';
    const sentIsUpToDate =
      group.latestSentAtMs >= 0 &&
      (latestServerIsSent || group.latestSentAtMs >= group.latestFailedAtMs);

    // If the latest authoritative server record for (applicantId, emailType) is sent,
    // or a confirmed sent occurred at/after the most recent failure, clear it from Failed to Send.
    if (sentIsUpToDate && (!group.latestLocalEntry || group.latestSentAtMs >= toMs(group.latestLocalEntry.lastAttemptAt))) {
      if (group.latestLocalEntry) {
        resolvedKeysToClear.push(group.key);
      }
      continue;
    }

    const serverFailed = group.latestServerFailedRow;
    const localEntry = group.latestLocalEntry;

    if (!serverFailed && !localEntry) {
      continue;
    }

    const serverMs = serverFailed ? toMs(serverFailed.lastAttemptAt) : -1;
    const localMs = localEntry ? toMs(localEntry.lastAttemptAt) : -1;
    const useLocalPrimary = Boolean(localEntry && (!serverFailed || localMs >= serverMs));

    const applicantId =
      serverFailed?.applicantId || localEntry?.applicantId || '';
    const applicant = applicantId ? applicantById.get(applicantId) : undefined;
    const emailType =
      serverFailed?.emailType || localEntry?.emailType || 'accepted';
    const recipientEmail =
      applicant?.email ||
      serverFailed?.recipientEmail ||
      localEntry?.recipientEmail ||
      '';
    const recipientName =
      applicant?.applicantName ||
      serverFailed?.recipientName ||
      localEntry?.recipientName ||
      'Applicant';
    const department =
      applicant?.department ||
      (serverFailed?.department && serverFailed.department !== '—'
        ? serverFailed.department
        : localEntry?.department) ||
      'General';
    const appliedPosition =
      applicant?.appliedPosition ||
      localEntry?.appliedPosition ||
      'Team Member';
    const signupLink = applicant?.signupLink || localEntry?.signupLink || null;

    const preferredSubject = useLocalPrimary
      ? localEntry?.subject || serverFailed?.subject
      : serverFailed?.subject || localEntry?.subject;

    const preferredBody =
      serverFailed?.bodyText && serverFailed.bodyText.trim()
        ? serverFailed.bodyText
        : localEntry?.bodyText && localEntry.bodyText.trim()
          ? localEntry.bodyText
          : null;

    const resolvedContent = resolveEmailContent({
      applicant: {
        id: applicantId || group.key,
        applicantName: recipientName,
        email: recipientEmail,
        department,
        appliedPosition,
        applicationStatus: emailType,
        signupLink: signupLink ?? undefined,
      },
      emailType,
      templates,
      subjectOverride: preferredSubject,
      bodyOverride: preferredBody,
    });

    const rawError = useLocalPrimary
      ? localEntry?.errorDetails || serverFailed?.errorDetails
      : serverFailed?.errorDetails || localEntry?.errorDetails;

    failedRecords.push({
      key: group.key,
      id: serverFailed?.id || localEntry?.id || group.key,
      serverDeliveryId: serverFailed?.id || localEntry?.serverDeliveryId || null,
      applicantId,
      recipientName,
      recipientEmail,
      department,
      appliedPosition,
      emailType,
      subject: resolvedContent.subject,
      bodyText: resolvedContent.bodyText,
      status: 'failed',
      errorDetails: sanitizeEmailError(rawError),
      attemptCount: Math.max(1, group.maxServerAttempts, group.maxLocalAttempts),
      lastAttemptAt: useLocalPrimary
        ? localEntry?.lastAttemptAt || serverFailed?.lastAttemptAt || new Date().toISOString()
        : serverFailed?.lastAttemptAt || localEntry?.lastAttemptAt || new Date().toISOString(),
      manualDraftOpenedAt: manualOpenedMap[group.key] ?? null,
      source: serverFailed ? 'server' : 'local',
      signupLink,
    });
  }

  failedRecords.sort((a, b) => toMs(b.lastAttemptAt) - toMs(a.lastAttemptAt));
  return { failedRecords, resolvedKeysToClear };
}

export function mergeEmailHistoryWithManualConfirmations(params: {
  serverHistory: EmailHistoryRecord[];
  manualConfirmations: ManualEmailConfirmationRecord[];
  applicants?: EmailApplicantRecord[];
  templates?: Record<EmailDecisionType, EmailTemplateRecord>;
}): EmailHistoryRecord[] {
  const {
    serverHistory,
    manualConfirmations,
    applicants = [],
    templates = DEFAULT_EMAIL_TEMPLATES,
  } = params;

  const toMs = (iso: string | null | undefined): number => {
    if (!iso) return 0;
    const parsed = Date.parse(iso);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const applicantById = new Map<string, EmailApplicantRecord>();
  applicants.forEach((a) => applicantById.set(a.id, a));

  const confirmationByKey = new Map<string, ManualEmailConfirmationRecord>();
  const confirmationByDeliveryId = new Map<string, ManualEmailConfirmationRecord>();

  for (const conf of manualConfirmations) {
    const key = buildFailedEmailKey(conf.applicationId, conf.recipientEmail, conf.decisionStatus);
    const prev = confirmationByKey.get(key);
    if (!prev || toMs(conf.sentAt) >= toMs(prev.sentAt)) {
      confirmationByKey.set(key, conf);
    }
    if (conf.serverDeliveryId) {
      confirmationByDeliveryId.set(conf.serverDeliveryId, conf);
    }
  }

  const consumedKeys = new Set<string>();
  const mergedRows: EmailHistoryRecord[] = [];
  const seenKeyForDedupe = new Set<string>();

  for (const row of serverHistory) {
    const key = buildFailedEmailKey(row.applicantId, row.recipientEmail, row.emailType);
    const matchedConf =
      confirmationByDeliveryId.get(row.id) ?? confirmationByKey.get(key);

    if (matchedConf) {
      consumedKeys.add(
        buildFailedEmailKey(
          matchedConf.applicationId,
          matchedConf.recipientEmail,
          matchedConf.decisionStatus,
        ),
      );
      const confMs = toMs(matchedConf.sentAt);
      const rowMs = toMs(row.sentAt || row.lastAttemptAt);
      const isSameDelivery = Boolean(
        matchedConf.serverDeliveryId && matchedConf.serverDeliveryId === row.id,
      );

      // If this manual confirmation applies to this delivery or happened at/after it,
      // upgrade the row in-place to Successfully Sent (Manual via Gmail) without duplicating.
      if (isSameDelivery || confMs >= rowMs) {
        if (seenKeyForDedupe.has(key) && row.status !== 'sent') {
          continue;
        }
        seenKeyForDedupe.add(key);

        const applicant = row.applicantId ? applicantById.get(row.applicantId) : undefined;
        const resolved = resolveEmailContent({
          applicant: {
            id: row.applicantId || matchedConf.applicationId || key,
            applicantName: row.recipientName || matchedConf.recipientName || 'Applicant',
            email: row.recipientEmail || matchedConf.recipientEmail,
            department: row.department || matchedConf.department || 'General',
            appliedPosition: applicant?.appliedPosition || 'Team Member',
            applicationStatus: row.emailType,
            signupLink: applicant?.signupLink,
          },
          emailType: row.emailType,
          templates,
          subjectOverride: row.subject || matchedConf.subject,
          bodyOverride: row.bodyText || matchedConf.bodyText,
        });

        mergedRows.push({
          ...row,
          recipientName: row.recipientName || matchedConf.recipientName || applicant?.applicantName || 'Applicant',
          recipientEmail: row.recipientEmail || matchedConf.recipientEmail || applicant?.email || '',
          department: row.department || matchedConf.department || applicant?.department || 'General',
          subject: resolved.subject,
          bodyText: resolved.bodyText,
          status: 'sent',
          attemptCount: Math.max(1, row.attemptCount, matchedConf.attemptCount),
          sentAt: matchedConf.sentAt,
          lastAttemptAt: matchedConf.sentAt,
          errorDetails: null,
          deliveryMethod: 'manual_gmail',
          manuallyConfirmedAt: matchedConf.sentAt,
          manuallyConfirmedByName: matchedConf.confirmedByName ?? row.manuallyConfirmedByName ?? null,
          manuallyConfirmedByEmail: matchedConf.confirmedByEmail ?? row.manuallyConfirmedByEmail ?? null,
        });
        continue;
      }
    }

    mergedRows.push(row);
  }

  for (const conf of confirmationByKey.values()) {
    const key = buildFailedEmailKey(conf.applicationId, conf.recipientEmail, conf.decisionStatus);
    if (consumedKeys.has(key) || seenKeyForDedupe.has(key)) continue;
    seenKeyForDedupe.add(key);

    const applicant = conf.applicationId ? applicantById.get(conf.applicationId) : undefined;
    const resolved = resolveEmailContent({
      applicant: {
        id: conf.applicationId || key,
        applicantName: conf.recipientName || applicant?.applicantName || 'Applicant',
        email: conf.recipientEmail || applicant?.email || '',
        department: conf.department || applicant?.department || 'General',
        appliedPosition: applicant?.appliedPosition || 'Team Member',
        applicationStatus: conf.decisionStatus,
        signupLink: applicant?.signupLink,
      },
      emailType: conf.decisionStatus,
      templates,
      subjectOverride: conf.subject,
      bodyOverride: conf.bodyText,
    });

    mergedRows.push({
      id: conf.serverDeliveryId || `manual-${conf.id}`,
      applicantId: conf.applicationId,
      recipientName: conf.recipientName || applicant?.applicantName || 'Applicant',
      recipientEmail: conf.recipientEmail || applicant?.email || '',
      department: conf.department || applicant?.department || 'General',
      emailType: conf.decisionStatus,
      subject: resolved.subject,
      bodyText: resolved.bodyText,
      status: 'sent',
      attemptCount: Math.max(1, conf.attemptCount),
      sentAt: conf.sentAt,
      lastAttemptAt: conf.sentAt,
      errorDetails: null,
      deliveryMethod: 'manual_gmail',
      manuallyConfirmedAt: conf.sentAt,
      manuallyConfirmedByName: conf.confirmedByName,
      manuallyConfirmedByEmail: conf.confirmedByEmail,
    });
  }

  mergedRows.sort((a, b) => toMs(b.sentAt || b.lastAttemptAt) - toMs(a.sentAt || a.lastAttemptAt));
  return mergedRows;
}

function getStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadLocalFailedEmails(storage?: Storage | null): LocalFailedEmailEntry[] {
  const target = getStorage(storage);
  if (!target) return [];
  try {
    const raw = target.getItem(FAILED_EMAILS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LocalFailedEmailEntry =>
        Boolean(item && typeof item === 'object' && typeof item.key === 'string' && typeof item.recipientEmail === 'string'),
    );
  } catch {
    return [];
  }
}

export function upsertLocalFailedEmail(
  entry: Omit<LocalFailedEmailEntry, 'key' | 'attemptCount'> & { attemptCount?: number },
  storage?: Storage | null,
): LocalFailedEmailEntry[] {
  const key = buildFailedEmailKey(entry.applicantId, entry.recipientEmail, entry.emailType);
  const existing = loadLocalFailedEmails(storage);
  const previous = existing.find((item) => item.key === key);

  const nextEntry: LocalFailedEmailEntry = {
    ...entry,
    key,
    serverDeliveryId: entry.serverDeliveryId ?? previous?.serverDeliveryId ?? null,
    errorDetails: sanitizeEmailError(entry.errorDetails),
    attemptCount: Math.max(entry.attemptCount ?? (previous ? previous.attemptCount + 1 : 1), 1),
    signupLink: entry.signupLink ?? previous?.signupLink ?? null,
  };

  const nextList = [nextEntry, ...existing.filter((item) => item.key !== key)];
  const target = getStorage(storage);
  if (target) {
    try {
      target.setItem(FAILED_EMAILS_STORAGE_KEY, JSON.stringify(nextList));
    } catch {
      // Ignore quota errors
    }
  }
  return nextList;
}

export function removeLocalFailedEmails(
  keysToRemove: string[],
  storage?: Storage | null,
): LocalFailedEmailEntry[] {
  if (!keysToRemove.length) return loadLocalFailedEmails(storage);
  const removeSet = new Set(keysToRemove);
  const existing = loadLocalFailedEmails(storage);
  const nextList = existing.filter((item) => !removeSet.has(item.key));
  const target = getStorage(storage);
  if (target) {
    try {
      target.setItem(FAILED_EMAILS_STORAGE_KEY, JSON.stringify(nextList));
    } catch {
      // Ignore storage errors
    }
  }
  return nextList;
}

export function loadManualGmailOpenedMap(storage?: Storage | null): Record<string, string> {
  const target = getStorage(storage);
  if (!target) return {};
  try {
    const raw = target.getItem(FAILED_EMAILS_GMAIL_OPENED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function recordManualGmailOpened(
  key: string,
  openedAt = new Date().toISOString(),
  storage?: Storage | null,
): Record<string, string> {
  const existing = loadManualGmailOpenedMap(storage);
  const next = { ...existing, [key]: openedAt };
  const target = getStorage(storage);
  if (target) {
    try {
      target.setItem(FAILED_EMAILS_GMAIL_OPENED_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}

export function removeManualGmailOpened(
  keysToRemove: string[],
  storage?: Storage | null,
): Record<string, string> {
  const existing = loadManualGmailOpenedMap(storage);
  if (!keysToRemove.length) return existing;
  const next = { ...existing };
  for (const key of keysToRemove) {
    delete next[key];
  }
  const target = getStorage(storage);
  if (target) {
    try {
      target.setItem(FAILED_EMAILS_GMAIL_OPENED_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}
