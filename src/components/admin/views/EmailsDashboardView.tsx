import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCode2,
  History,
  Info,
  Mail,
  Send,
  ShieldAlert,
  Users,
  XCircle,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { supabase } from '../../../lib/supabase';
import { createHrApplicantSignupInvite } from '../../../services/liveBackendService';
import type { AdminUser } from '../../../types/admin';
import { canAccessEmailsDashboard, canDispatchEmails } from '../../../utils/adminPermissions';
import {
  applySignupLinkToBody,
  buildFailedEmailKey,
  buildGmailComposeUrl,
  extractEdgeInvokeError,
  interpretSendResponse,
  loadLocalFailedEmails,
  loadManualGmailOpenedMap,
  mergeAndDeduplicateFailedEmails,
  recordManualGmailOpened,
  removeLocalFailedEmails,
  resolveEmailContent,
  sanitizeEmailError,
  upsertLocalFailedEmail,
  type LocalFailedEmailEntry,
} from '../../../utils/failedEmails';
import { ApplicantsBulkTab } from './emails/ApplicantsBulkTab';
import { BulkSendConfirmModal } from './emails/BulkSendConfirmModal';
import { EmailHistoryTab } from './emails/EmailHistoryTab';
import { EmailTemplatesTab } from './emails/EmailTemplatesTab';
import { FailedToSendTab } from './emails/FailedToSendTab';
import { SendingQueueTab } from './emails/SendingQueueTab';
import {
  DEFAULT_EMAIL_TEMPLATES,
  ESTIMATED_DAILY_CAPACITY,
} from './emails/sampleData';
import type {
  BulkSendConfirmState,
  EmailApplicantRecord,
  EmailDecisionType,
  EmailHistoryRecord,
  EmailQueueItem,
  EmailTemplateRecord,
  FailedEmailRecord,
} from './emails/types';

type Tab = 'applicants' | 'failed' | 'queue' | 'history' | 'templates';
type Row = Record<string, any>;

const deptLabel = (v: unknown) =>
  String(v || 'General')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const applicantMap = (r: Row): EmailApplicantRecord => ({
  id: String(r.id),
  applicationCode: String(r.application_code || r.id).slice(0, 8),
  applicantName: String(r.applicant_name || 'Applicant'),
  email: String(r.email || ''),
  department: deptLabel(r.department_id || r.application_type),
  departmentSlug: String(r.department_id || r.application_type || '').toLowerCase(),
  appliedPosition: String(r.position || r.application_type || 'Applicant'),
  applicationStatus:
    r.status === 'accepted' || r.status === 'rejected' ? r.status : 'pending',
  emailStatus: 'not_sent',
  applicationDate: String(r.created_at || ''),
  signupLink:
    typeof r.signup_link === 'string' && r.signup_link.trim()
      ? r.signup_link.trim()
      : undefined,
});

const historyMap = (
  r: Row,
  applicantLookup: Map<string, EmailApplicantRecord>,
): EmailHistoryRecord => {
  const applicantId = String(r.application_id || '');
  const matchedApplicant = applicantLookup.get(applicantId);
  const rawBody =
    typeof r.body_text === 'string'
      ? r.body_text
      : typeof r.message_body === 'string'
        ? r.message_body
        : typeof r.body === 'string'
          ? r.body
          : null;

  return {
    id: String(r.id),
    applicantId,
    recipientName: String(r.recipient_name || matchedApplicant?.applicantName || ''),
    recipientEmail: String(r.recipient_email || matchedApplicant?.email || ''),
    department: matchedApplicant?.department || deptLabel(r.department_id || 'General'),
    emailType: r.decision_status === 'rejected' ? 'rejected' : 'accepted',
    subject: String(r.subject || ''),
    bodyText: rawBody,
    status:
      r.status === 'sent' ? 'sent' : r.status === 'failed' ? 'failed' : 'pending',
    attemptCount: Number(r.attempts || 0),
    sentAt: r.sent_at || null,
    lastAttemptAt: String(r.updated_at || r.created_at || ''),
    errorDetails: r.error_message ? sanitizeEmailError(r.error_message) : null,
  };
};

const templateMap = (r: Row): EmailTemplateRecord => ({
  key: r.template_key,
  label: r.name || r.template_key,
  subject: String(r.subject || ''),
  body: String(r.body_text || ''),
  updatedAt: String(r.updated_at || ''),
});

export function EmailsDashboardView({
  actingUserOverride = null,
}: {
  actingUserOverride?: AdminUser | null;
}) {
  const { currentUser, testModeHeadUser, data, pushToast } = useAdminStore();
  const actor = actingUserOverride ?? testModeHeadUser ?? currentUser;
  const canAccessEmails = canAccessEmailsDashboard(actor, data.departments);
  const canDispatch = canDispatchEmails(actor, data.departments);

  const [rawApplicants, setRawApplicants] = useState<EmailApplicantRecord[]>([]);
  const [serverHistory, setServerHistory] = useState<EmailHistoryRecord[]>([]);
  const [localFailures, setLocalFailures] = useState<LocalFailedEmailEntry[]>(() =>
    loadLocalFailedEmails(),
  );
  const [manualOpenedMap, setManualOpenedMap] = useState<Record<string, string>>(() =>
    loadManualGmailOpenedMap(),
  );
  const [queue, setQueue] = useState<EmailQueueItem[]>([]);
  const [templates, setTemplates] = useState(DEFAULT_EMAIL_TEMPLATES);
  const [activeTab, setActiveTab] = useState<Tab>('applicants');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmState, setConfirmState] = useState<BulkSendConfirmState | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [retryingKey, setRetryingKey] = useState<string | null>(null);
  const [openingGmailKey, setOpeningGmailKey] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const inFlightKeysRef = useRef<Set<string>>(new Set());

  const { failedRecords, resolvedKeysToClear } = useMemo(
    () =>
      mergeAndDeduplicateFailedEmails({
        serverHistory,
        localFailures,
        applicants: rawApplicants,
        templates,
        manualOpenedMap,
      }),
    [serverHistory, localFailures, rawApplicants, templates, manualOpenedMap],
  );

  useEffect(() => {
    if (resolvedKeysToClear.length === 0) return;
    const nextLocal = removeLocalFailedEmails(resolvedKeysToClear);
    setLocalFailures(nextLocal);
  }, [resolvedKeysToClear]);

  const failedByKey = useMemo(() => {
    const map = new Map<string, FailedEmailRecord>();
    failedRecords.forEach((rec) => map.set(rec.key, rec));
    return map;
  }, [failedRecords]);

  const applicants = useMemo(() => {
    const latestServer = new Map<string, EmailHistoryRecord>();
    serverHistory.forEach((row) => {
      const k = buildFailedEmailKey(row.applicantId, row.recipientEmail, row.emailType);
      const prev = latestServer.get(k);
      if (!prev || row.lastAttemptAt >= prev.lastAttemptAt) {
        latestServer.set(k, row);
      }
    });

    return rawApplicants.map((app) => {
      const decisionKey: EmailDecisionType =
        app.applicationStatus === 'rejected' ? 'rejected' : 'accepted';
      const activeKey = buildFailedEmailKey(app.id, app.email, decisionKey);
      const altKey = buildFailedEmailKey(
        app.id,
        app.email,
        decisionKey === 'accepted' ? 'rejected' : 'accepted',
      );
      if (failedByKey.has(activeKey) || (app.applicationStatus === 'pending' && failedByKey.has(altKey))) {
        return { ...app, emailStatus: 'failed' as const };
      }

      const serverRec =
        app.applicationStatus === 'accepted' || app.applicationStatus === 'rejected'
          ? latestServer.get(activeKey)
          : latestServer.get(activeKey) || latestServer.get(altKey);

      return {
        ...app,
        emailStatus:
          serverRec?.status === 'sent'
            ? ('sent' as const)
            : serverRec?.status === 'failed'
              ? ('failed' as const)
              : ('not_sent' as const),
      };
    });
  }, [rawApplicants, serverHistory, failedByKey]);

  const history = useMemo<EmailHistoryRecord[]>(() => {
    const existingServerKeys = new Set(
      serverHistory
        .filter((h) => h.status === 'failed')
        .map((h) => buildFailedEmailKey(h.applicantId, h.recipientEmail, h.emailType)),
    );

    const localOnlyFailedRows: EmailHistoryRecord[] = failedRecords
      .filter((rec) => rec.source === 'local' && !existingServerKeys.has(rec.key))
      .map((rec) => ({
        id: rec.id,
        applicantId: rec.applicantId,
        recipientName: rec.recipientName,
        recipientEmail: rec.recipientEmail,
        department: rec.department,
        emailType: rec.emailType,
        subject: rec.subject,
        bodyText: rec.bodyText,
        status: 'failed',
        attemptCount: rec.attemptCount,
        sentAt: null,
        lastAttemptAt: rec.lastAttemptAt,
        errorDetails: rec.errorDetails,
      }));

    return [...localOnlyFailedRows, ...serverHistory];
  }, [serverHistory, failedRecords]);

  const refresh = useCallback(async () => {
    if (!canAccessEmails) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [a, d] = await Promise.all([
        supabase.functions.invoke('willow-applications', { body: { action: 'list' } }),
        supabase.functions.invoke('willow-email-management', {
          body: { action: 'dashboard' },
        }),
      ]);
      if (a.error) throw a.error;
      if (d.error) throw d.error;

      const apps = (a.data?.applications || []).map(applicantMap) as EmailApplicantRecord[];
      const appLookup = new Map<string, EmailApplicantRecord>();
      apps.forEach((app) => appLookup.set(app.id, app));

      const logs = (d.data?.deliveries || []).map((row: Row) =>
        historyMap(row, appLookup),
      ) as EmailHistoryRecord[];

      setRawApplicants(apps);
      setServerHistory(logs);

      const loadedTemplates = (d.data?.templates || []).map(templateMap) as EmailTemplateRecord[];
      setTemplates((prev) => {
        const next = { ...prev };
        loadedTemplates.forEach((item) => {
          if (item.key === 'accepted' || item.key === 'rejected') {
            next[item.key] = item;
          }
        });
        return next;
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Email dashboard load failed',
        description:
          err instanceof Error ? sanitizeEmailError(err.message) : 'Verify your HR/Admin login.',
      });
    } finally {
      setLoading(false);
    }
  }, [canAccessEmails, pushToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const total = applicants.length;
  const accepted = applicants.filter((a) => a.applicationStatus === 'accepted').length;
  const rejected = applicants.filter((a) => a.applicationStatus === 'rejected').length;
  const sent = serverHistory.filter((h) => h.status === 'sent').length;
  const failedCount = failedRecords.length;
  const remaining = Math.max(0, ESTIMATED_DAILY_CAPACITY - sent);
  const percent = Math.min(100, Math.round((sent / ESTIMATED_DAILY_CAPACITY) * 100));

  const acceptedPending = useMemo(
    () => applicants.filter((a) => a.applicationStatus === 'accepted' && a.emailStatus !== 'sent'),
    [applicants],
  );
  const rejectedPending = useMemo(
    () => applicants.filter((a) => a.applicationStatus === 'rejected' && a.emailStatus !== 'sent'),
    [applicants],
  );
  const selected = useMemo(
    () => applicants.filter((a) => selectedIds.includes(a.id)),
    [applicants, selectedIds],
  );
  const activeQueue = queue.filter(
    (q) => q.status === 'waiting' || q.status === 'processing',
  ).length;

  const recordFailedAttempt = useCallback(
    (params: {
      applicantId: string;
      recipientName: string;
      recipientEmail: string;
      department: string;
      appliedPosition: string;
      emailType: EmailDecisionType;
      subject: string;
      bodyText: string;
      errorDetails: string;
      serverDeliveryId?: string | null;
      signupLink?: string | null;
    }) => {
      const next = upsertLocalFailedEmail({
        id: `local-${Date.now()}-${params.applicantId || params.recipientEmail}`,
        serverDeliveryId: params.serverDeliveryId ?? null,
        applicantId: params.applicantId,
        recipientName: params.recipientName,
        recipientEmail: params.recipientEmail,
        department: params.department,
        appliedPosition: params.appliedPosition,
        emailType: params.emailType,
        subject: params.subject,
        bodyText: params.bodyText,
        errorDetails: params.errorDetails,
        lastAttemptAt: new Date().toISOString(),
        signupLink: params.signupLink ?? null,
      });
      setLocalFailures(next);
    },
    [],
  );

  const sendBatch = async (items: EmailQueueItem[]) => {
    if (!canDispatch || sending || !items.length) return;
    setSending(true);
    setProgress({ done: 0, total: items.length });

    let done = 0;
    let sentCount = 0;
    let failedInBatch = 0;
    const applicantMap = new Map(rawApplicants.map((a) => [a.id, a]));

    for (const item of items) {
      const key = buildFailedEmailKey(item.applicantId, item.recipientEmail, item.emailType);
      if (inFlightKeysRef.current.has(key)) {
        done += 1;
        setProgress({ done, total: items.length });
        continue;
      }

      inFlightKeysRef.current.add(key);
      setQueue((q) =>
        q.map((x) => (x.id === item.id ? { ...x, status: 'processing', errorDetails: null } : x)),
      );

      const applicant = applicantMap.get(item.applicantId);
      const rendered = resolveEmailContent({
        applicant: applicant ?? {
          id: item.applicantId,
          applicantName: item.recipientName,
          email: item.recipientEmail,
          department: item.department,
          appliedPosition: 'Team Member',
          applicationStatus: item.emailType,
        },
        emailType: item.emailType,
        templates,
        subjectOverride: item.subject,
        bodyOverride: item.bodyText,
      });

      try {
        const { data: resData, error } = await supabase.functions.invoke(
          'willow-application-email',
          {
            body: { application_id: item.applicantId, decision: item.emailType },
          },
        );
        const extractedError =
          error || resData?.error
            ? await extractEdgeInvokeError(error, resData)
            : null;
        const result = interpretSendResponse({
          data: resData,
          error,
          extractedError,
        });

        if (result.outcome === 'sent') {
          sentCount += 1;
          setLocalFailures(removeLocalFailedEmails([key]));
          setQueue((q) =>
            q.map((x) =>
              x.id === item.id ? { ...x, status: 'sent', errorDetails: null } : x,
            ),
          );
        } else {
          failedInBatch += 1;
          const deliveryId =
            resData && typeof resData === 'object' && typeof resData.delivery_id === 'string'
              ? resData.delivery_id
              : resData?.delivery && typeof resData.delivery.id === 'string'
                ? resData.delivery.id
                : null;
          const failureReason = result.errorDetails || 'Email delivery failed.';
          recordFailedAttempt({
            applicantId: item.applicantId,
            recipientName: item.recipientName,
            recipientEmail: item.recipientEmail,
            department: item.department,
            appliedPosition: applicant?.appliedPosition || 'Team Member',
            emailType: item.emailType,
            subject: rendered.subject,
            bodyText: rendered.bodyText,
            errorDetails: failureReason,
            serverDeliveryId: deliveryId,
            signupLink: applicant?.signupLink ?? null,
          });
          setQueue((q) =>
            q.map((x) =>
              x.id === item.id ? { ...x, status: 'failed', errorDetails: failureReason } : x,
            ),
          );
        }
      } catch (e) {
        failedInBatch += 1;
        const reason = sanitizeEmailError(
          e instanceof Error ? e.message : 'Network error while attempting to send email.',
        );
        recordFailedAttempt({
          applicantId: item.applicantId,
          recipientName: item.recipientName,
          recipientEmail: item.recipientEmail,
          department: item.department,
          appliedPosition: applicant?.appliedPosition || 'Team Member',
          emailType: item.emailType,
          subject: rendered.subject,
          bodyText: rendered.bodyText,
          errorDetails: reason,
          signupLink: applicant?.signupLink ?? null,
        });
        setQueue((q) =>
          q.map((x) =>
            x.id === item.id ? { ...x, status: 'failed', errorDetails: reason } : x,
          ),
        );
      } finally {
        inFlightKeysRef.current.delete(key);
      }

      done += 1;
      setProgress({ done, total: items.length });
    }

    setSending(false);
    await refresh();

    if (failedInBatch > 0) {
      pushToast({
        tone: 'warning',
        title: `${failedInBatch} email${failedInBatch === 1 ? '' : 's'} failed to send`,
        description: `${sentCount} confirmed sent. Failed deliveries are listed in "Failed to Send" for Gmail fallback or retry.`,
      });
    } else {
      pushToast({
        tone: 'success',
        title: 'Bulk send complete',
        description: `All ${sentCount} email${sentCount === 1 ? '' : 's'} confirmed delivered.`,
      });
    }
  };

  const stageQueueItem = (
    applicant: EmailApplicantRecord,
    type: EmailDecisionType,
    index: number,
  ): EmailQueueItem => {
    const content = resolveEmailContent({
      applicant,
      emailType: type,
      templates,
    });
    return {
      id: `q-${Date.now()}-${index}-${applicant.id}`,
      applicantId: applicant.id,
      recipientName: applicant.applicantName,
      recipientEmail: applicant.email,
      department: applicant.department,
      emailType: type,
      subject: content.subject,
      bodyText: content.bodyText,
      status: 'waiting',
      queuedAt: new Date().toISOString(),
    };
  };

  const openAll = (type: EmailDecisionType) => {
    if (!canDispatch) return;
    const eligible = type === 'accepted' ? acceptedPending : rejectedPending;
    const recipients = eligible.filter((a) => a.email.trim() && a.emailStatus !== 'sent');
    const staged = recipients.map((r, i) => stageQueueItem(r, type, i));
    setQueue((prev) => [...staged, ...prev]);
    void sendBatch(staged);
  };

  const openSelected = (list: EmailApplicantRecord[], type?: EmailDecisionType) => {
    if (!canDispatch || !list.length) return;
    setConfirmState({
      mode: 'selected',
      emailType:
        type || (list.every((a) => a.applicationStatus === 'rejected') ? 'rejected' : 'accepted'),
      recipients: list,
      skippedAlreadySentCount: 0,
      skippedIneligibleCount: 0,
    });
  };

  const confirmSend = (type: EmailDecisionType) => {
    if (!canDispatch || !confirmState || sending) return;
    const recipients = confirmState.recipients.filter(
      (a) => a.applicationStatus === type && a.email.trim() && a.emailStatus !== 'sent',
    );
    const staged = recipients.map((r, i) => stageQueueItem(r, type, i));
    setQueue((prev) => [...staged, ...prev]);
    if (confirmState.mode === 'selected') setSelectedIds([]);
    setConfirmState(null);
    void sendBatch(staged);
  };

  const sendQueue = async () => {
    const pending = queue.filter((q) => q.status === 'waiting');
    if (!pending.length || sending || !canDispatch) return;
    void sendBatch(pending);
  };

  const resendApplicant = async (applicant: EmailApplicantRecord) => {
    if (!canDispatch || sending) return;
    const decision = applicant.applicationStatus;
    if (decision !== 'accepted' && decision !== 'rejected') return;

    const key = buildFailedEmailKey(applicant.id, applicant.email, decision);
    if (inFlightKeysRef.current.has(key)) return;
    inFlightKeysRef.current.add(key);

    const content = resolveEmailContent({
      applicant,
      emailType: decision,
      templates,
    });

    try {
      const { data: resData, error } = await supabase.functions.invoke(
        'willow-application-email',
        {
          body: { application_id: applicant.id, decision, force_resend: true },
        },
      );
      const extractedError =
        error || resData?.error ? await extractEdgeInvokeError(error, resData) : null;
      const result = interpretSendResponse({
        data: resData,
        error,
        extractedError,
      });

      if (result.outcome === 'sent') {
        setLocalFailures(removeLocalFailedEmails([key]));
        pushToast({
          tone: 'success',
          title: 'Email resent',
          description: `A fresh ${decision} email was confirmed delivered to ${applicant.email}.`,
        });
        await refresh();
      } else {
        const reason = result.errorDetails || 'Email could not be delivered.';
        recordFailedAttempt({
          applicantId: applicant.id,
          recipientName: applicant.applicantName,
          recipientEmail: applicant.email,
          department: applicant.department,
          appliedPosition: applicant.appliedPosition,
          emailType: decision,
          subject: content.subject,
          bodyText: content.bodyText,
          errorDetails: reason,
          signupLink: applicant.signupLink ?? null,
        });
        pushToast({
          tone: 'error',
          title: 'Send failed · Saved to Failed to Send',
          description: `${reason} Open "Failed to Send" to retry or launch Gmail.`,
        });
        await refresh();
      }
    } catch (e) {
      const reason = sanitizeEmailError(
        e instanceof Error ? e.message : 'Email could not be sent.',
      );
      recordFailedAttempt({
        applicantId: applicant.id,
        recipientName: applicant.applicantName,
        recipientEmail: applicant.email,
        department: applicant.department,
        appliedPosition: applicant.appliedPosition,
        emailType: decision,
        subject: content.subject,
        bodyText: content.bodyText,
        errorDetails: reason,
        signupLink: applicant.signupLink ?? null,
      });
      pushToast({
        tone: 'error',
        title: 'Send failed · Saved to Failed to Send',
        description: `${reason} Open "Failed to Send" to retry or launch Gmail.`,
      });
    } finally {
      inFlightKeysRef.current.delete(key);
    }
  };

  const retryFailedRecord = async (record: FailedEmailRecord) => {
    if (!canDispatch || inFlightKeysRef.current.has(record.key)) return;
    inFlightKeysRef.current.add(record.key);
    setRetryingKey(record.key);

    try {
      const invokePromise = record.serverDeliveryId
        ? supabase.functions.invoke('willow-email-management', {
            body: { action: 'retry', delivery_id: record.serverDeliveryId },
          })
        : supabase.functions.invoke('willow-application-email', {
            body: {
              application_id: record.applicantId,
              decision: record.emailType,
              force_resend: true,
            },
          });

      const { data: resData, error } = await invokePromise;
      const extractedError =
        error || resData?.error ? await extractEdgeInvokeError(error, resData) : null;
      const result = interpretSendResponse({
        data: resData,
        error,
        extractedError,
      });

      if (result.outcome === 'sent') {
        setLocalFailures(removeLocalFailedEmails([record.key]));
        setQueue((q) =>
          q.map((x) =>
            x.applicantId === record.applicantId && x.emailType === record.emailType
              ? { ...x, status: 'sent', errorDetails: null }
              : x,
          ),
        );
        pushToast({
          tone: 'success',
          title: 'Retry succeeded',
          description: `Confirmed delivery to ${record.recipientEmail}.`,
        });
        await refresh();
      } else {
        const reason = result.errorDetails || 'Retry did not confirm delivery.';
        recordFailedAttempt({
          applicantId: record.applicantId,
          recipientName: record.recipientName,
          recipientEmail: record.recipientEmail,
          department: record.department,
          appliedPosition: record.appliedPosition,
          emailType: record.emailType,
          subject: record.subject,
          bodyText: record.bodyText,
          errorDetails: reason,
          serverDeliveryId: record.serverDeliveryId,
          signupLink: record.signupLink ?? null,
        });
        pushToast({
          tone: 'error',
          title: 'Retry failed',
          description: `${reason} You can open it directly in Gmail to send manually.`,
        });
        await refresh();
      }
    } catch (e) {
      const reason = sanitizeEmailError(
        e instanceof Error ? e.message : 'Retry request failed.',
      );
      recordFailedAttempt({
        applicantId: record.applicantId,
        recipientName: record.recipientName,
        recipientEmail: record.recipientEmail,
        department: record.department,
        appliedPosition: record.appliedPosition,
        emailType: record.emailType,
        subject: record.subject,
        bodyText: record.bodyText,
        errorDetails: reason,
        serverDeliveryId: record.serverDeliveryId,
        signupLink: record.signupLink ?? null,
      });
      pushToast({
        tone: 'error',
        title: 'Retry failed',
        description: reason,
      });
    } finally {
      inFlightKeysRef.current.delete(record.key);
      setRetryingKey(null);
    }
  };

  const retryByHistoryId = async (historyId: string) => {
    const matchedFailed = failedRecords.find(
      (r) => r.id === historyId || r.serverDeliveryId === historyId,
    );
    if (matchedFailed) {
      await retryFailedRecord(matchedFailed);
      return;
    }

    const row = serverHistory.find((h) => h.id === historyId);
    if (!row || !canDispatch) return;
    const key = buildFailedEmailKey(row.applicantId, row.recipientEmail, row.emailType);
    const content = resolveEmailContent({
      applicant: {
        id: row.applicantId,
        applicantName: row.recipientName,
        email: row.recipientEmail,
        department: row.department,
        appliedPosition: 'Team Member',
        applicationStatus: row.emailType,
      },
      emailType: row.emailType,
      templates,
      subjectOverride: row.subject,
      bodyOverride: row.bodyText,
    });
    await retryFailedRecord({
      key,
      id: row.id,
      serverDeliveryId: row.id,
      applicantId: row.applicantId,
      recipientName: row.recipientName,
      recipientEmail: row.recipientEmail,
      department: row.department,
      appliedPosition: 'Team Member',
      emailType: row.emailType,
      subject: content.subject,
      bodyText: content.bodyText,
      status: 'failed',
      errorDetails: row.errorDetails || 'Delivery failed.',
      attemptCount: Math.max(1, row.attemptCount),
      lastAttemptAt: row.lastAttemptAt,
      manualDraftOpenedAt: manualOpenedMap[key] ?? null,
      source: 'server',
    });
  };

  const openFailedInGmail = useCallback(
    async (record: FailedEmailRecord) => {
      if (!canAccessEmails) return;
      if (!record.recipientEmail.trim()) {
        pushToast({
          tone: 'error',
          title: 'Recipient email missing',
          description: 'Cannot open Gmail compose because this failed record has no recipient address.',
        });
        return;
      }

      const needsRealInviteLink =
        record.emailType === 'accepted' &&
        Boolean(record.applicantId) &&
        !record.bodyText.includes('/team-signup?token=');

      // Open the window synchronously inside the click gesture when we may need an async
      // invite lookup, so mobile/desktop popup blockers do not block the new Gmail tab.
      const popup = window.open('', '_blank');
      if (!popup) {
        pushToast({
          tone: 'warning',
          title: 'Popup blocked',
          description: 'Allow popups for this site to launch Gmail in a new tab.',
        });
        return;
      }
      popup.opener = null;

      let finalBody = record.bodyText;
      if (needsRealInviteLink) {
        setOpeningGmailKey(record.key);
        try {
          const invite = await createHrApplicantSignupInvite(record.applicantId);
          if (invite.url) {
            finalBody = applySignupLinkToBody(finalBody, invite.url);
          }
        } catch {
          // Keep reconstructed body if invite endpoint is unreachable
        } finally {
          setOpeningGmailKey(null);
        }
      }

      const composeUrl = buildGmailComposeUrl({
        to: record.recipientEmail,
        subject: record.subject,
        body: finalBody,
      });

      popup.location.href = composeUrl;
      // Preserve "Failed to Send" status and keep the record in the list;
      // only note that the operator opened it in Gmail for manual review.
      setManualOpenedMap(recordManualGmailOpened(record.key));
    },
    [canAccessEmails, pushToast],
  );

  const openHistoryFailedInGmail = useCallback(
    (item: EmailHistoryRecord) => {
      const key = buildFailedEmailKey(item.applicantId, item.recipientEmail, item.emailType);
      const existing = failedByKey.get(key);
      if (existing) {
        void openFailedInGmail(existing);
        return;
      }
      const content = resolveEmailContent({
        applicant: {
          id: item.applicantId,
          applicantName: item.recipientName,
          email: item.recipientEmail,
          department: item.department,
          appliedPosition: 'Team Member',
          applicationStatus: item.emailType,
        },
        emailType: item.emailType,
        templates,
        subjectOverride: item.subject,
        bodyOverride: item.bodyText,
      });
      void openFailedInGmail({
        key,
        id: item.id,
        serverDeliveryId: item.id.startsWith('local-') ? null : item.id,
        applicantId: item.applicantId,
        recipientName: item.recipientName,
        recipientEmail: item.recipientEmail,
        department: item.department,
        appliedPosition: 'Team Member',
        emailType: item.emailType,
        subject: content.subject,
        bodyText: content.bodyText,
        status: 'failed',
        errorDetails: item.errorDetails || 'Delivery failed.',
        attemptCount: Math.max(1, item.attemptCount),
        lastAttemptAt: item.lastAttemptAt,
        manualDraftOpenedAt: manualOpenedMap[key] ?? null,
        source: 'server',
      });
    },
    [failedByKey, manualOpenedMap, openFailedInGmail, templates],
  );

  const saveTemplate = async (key: EmailDecisionType, subject: string, body: string) => {
    if (!canDispatch) return;
    try {
      const { data: resData, error } = await supabase.functions.invoke(
        'willow-email-management',
        {
          body: {
            action: 'save_template',
            template_key: key,
            subject,
            body_text: body,
          },
        },
      );
      if (error || resData?.error) {
        const msg = await extractEdgeInvokeError(error, resData);
        throw new Error(msg || 'Request failed');
      }
      if (resData?.template) {
        setTemplates((p) => ({ ...p, [key]: templateMap(resData.template) }));
      }
      pushToast({ tone: 'success', title: 'Template saved to Supabase' });
    } catch (e) {
      pushToast({
        tone: 'error',
        title: 'Template save failed',
        description: e instanceof Error ? sanitizeEmailError(e.message) : 'Request failed',
      });
    }
  };

  const resetTemplate = (key: EmailDecisionType) =>
    void saveTemplate(
      key,
      DEFAULT_EMAIL_TEMPLATES[key].subject,
      DEFAULT_EMAIL_TEMPLATES[key].body,
    );

  const toggle = (id: string) =>
    setSelectedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  if (!canAccessEmails) {
    return (
      <div
        role="alert"
        className="wm-surface-panel border-rose-400/35 bg-rose-500/[0.06] p-8 text-center"
      >
        <ShieldAlert className="mx-auto h-9 w-9 text-rose-300" aria-hidden="true" />
        <h2 className="mt-3 text-base font-semibold text-rose-100">
          Email Center Restricted
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-xs text-[color:var(--wm-ink-secondary)]">
          Access to Email Management and Failed to Send recovery is restricted to authorized Admin and Human Resources (HR) accounts.
        </p>
      </div>
    );
  }

  const tabs: {
    id: Tab;
    label: string;
    Icon: typeof Users;
    badge?: number;
    tone?: 'danger';
  }[] = [
    { id: 'applicants', label: 'Applicants & Bulk Send', Icon: Users },
    {
      id: 'failed',
      label: 'Failed to Send',
      Icon: AlertTriangle,
      badge: failedCount || undefined,
      tone: 'danger',
    },
    {
      id: 'queue',
      label: 'Sending Queue',
      Icon: Clock3,
      badge: activeQueue || undefined,
    },
    { id: 'history', label: 'Email History', Icon: History },
    { id: 'templates', label: 'Templates', Icon: FileCode2 },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-[color:var(--wm-hairline)] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[color:var(--wm-accent)]">
            Admin &amp; HR Communications
          </p>
          <h1 className="wm-serif mt-1.5 text-3xl text-[color:var(--wm-ink)]">
            Email Management Center
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-[color:var(--wm-ink-secondary)]">
            Live applicant records, bulk decision mail, Failed to Send recovery with direct Gmail fallback, delivery tracking, and templates.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-[11px] text-[color:var(--wm-ink-secondary)]">
          <Info className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
          <span>Supabase connected · Gmail recovery ready</span>
        </div>
      </header>

      {/* KPI Strip */}
      <section className="wm-surface-panel overflow-hidden">
        <div className="grid grid-cols-2 divide-y sm:grid-cols-3 lg:grid-cols-6 sm:divide-y-0 sm:divide-x divide-[color:var(--wm-hairline)]">
          {(
            [
              { label: 'Applications', value: total, Icon: Users, isFailed: false },
              { label: 'Accepted', value: accepted, Icon: CheckCircle2, isFailed: false },
              { label: 'Rejected', value: rejected, Icon: XCircle, isFailed: false },
              { label: 'Emails Sent', value: sent, Icon: Mail, isFailed: false },
              { label: 'Capacity Left', value: remaining, Icon: Send, isFailed: false },
              { label: 'Failed to Send', value: failedCount, Icon: AlertTriangle, isFailed: true },
            ] as const
          ).map(({ label, value, Icon, isFailed }) =>
            isFailed ? (
              <button
                key={label}
                type="button"
                onClick={() => setActiveTab('failed')}
                className={`px-4 py-3 text-left transition-colors cursor-pointer hover:bg-rose-500/[0.08] ${
                  failedCount > 0 ? 'bg-rose-500/[0.06]' : ''
                }`}
              >
                <p className="text-[11px] text-rose-200 flex items-center justify-between gap-2 font-medium">
                  <span>{label}</span>
                  <Icon className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />
                </p>
                <p className="mt-1.5 text-2xl font-serif text-rose-100 tabular-nums">
                  {loading ? '…' : value}
                </p>
              </button>
            ) : (
              <div key={label} className="px-4 py-3">
                <p className="text-[11px] text-[color:var(--wm-ink-muted)] flex items-center justify-between gap-2">
                  <span>{label}</span>
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </p>
                <p className="mt-1.5 text-2xl font-serif tabular-nums">
                  {loading ? '…' : value}
                </p>
              </div>
            ),
          )}
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-[color:var(--wm-hairline)] px-4 py-2 text-[11px] text-[color:var(--wm-ink-muted)]">
          <span>
            Willow delivery estimate: {sent}/{ESTIMATED_DAILY_CAPACITY} logged ({percent}%)
          </span>
          <div className="h-1.5 w-full max-w-xs rounded-full bg-[color:var(--wm-canvas)]">
            <div
              className="h-full rounded-full bg-[color:var(--wm-accent)]"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </section>

      {/* Alert Strip when Failed Emails Exist */}
      {failedCount > 0 && activeTab !== 'failed' && (
        <section
          role="status"
          className="wm-surface-panel flex flex-col gap-3 border-rose-400/35 bg-rose-500/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-rose-300"
              aria-hidden="true"
            />
            <div>
              <p className="text-xs font-semibold text-rose-100">
                {failedCount} email{failedCount === 1 ? '' : 's'} failed to send
              </p>
              <p className="mt-0.5 text-[11px] text-rose-100/80">
                Open the Failed to Send tab to inspect failure reasons, retry automated delivery, or click any failed email to launch Gmail prefilled.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('failed')}
            className="inline-flex min-h-[34px] shrink-0 items-center justify-center gap-1.5 rounded-md border border-rose-300/35 bg-rose-500/20 px-3.5 text-xs font-semibold text-rose-50 hover:bg-rose-500/30 cursor-pointer"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Open Failed to Send ({failedCount})</span>
          </button>
        </section>
      )}

      {/* Bulk Dispatch Controls */}
      <section className="wm-surface-panel flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase">Bulk Dispatch</h2>
          <p className="text-[11px] text-[color:var(--wm-ink-muted)]">
            Verify the recipient batch before staging. Failed attempts are automatically saved under Failed to Send.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canDispatch || sending}
            onClick={() => openAll('accepted')}
            className="rounded-md bg-[color:var(--wm-emerald)] px-3 py-2 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] disabled:opacity-40 cursor-pointer"
          >
            Send All Accepted ({acceptedPending.length})
          </button>
          <button
            type="button"
            disabled={!canDispatch || sending}
            onClick={() => openAll('rejected')}
            className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100 hover:bg-rose-500/20 disabled:opacity-40 cursor-pointer"
          >
            Send All Rejected ({rejectedPending.length})
          </button>
          <button
            type="button"
            disabled={!canDispatch || !selected.length || sending}
            onClick={() => openSelected(selected)}
            className="rounded-md border border-[color:var(--wm-hairline-strong)] px-3 py-2 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-40 cursor-pointer"
          >
            Send Selected ({selected.length})
          </button>
        </div>
      </section>

      {/* Navigation Tabs */}
      <nav
        aria-label="Email management sections"
        className="flex flex-wrap gap-1.5 border-b border-[color:var(--wm-hairline)] pb-3"
      >
        {tabs.map((t) => {
          const Icon = t.Icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                isActive
                  ? t.tone === 'danger' && failedCount > 0
                    ? 'bg-rose-500/25 text-rose-50 border border-rose-400/45'
                    : 'bg-[color:var(--wm-focal)] text-[#12170c]'
                  : t.tone === 'danger' && failedCount > 0
                    ? 'border border-rose-400/40 bg-rose-500/[0.08] text-rose-100 hover:bg-rose-500/[0.14]'
                    : 'border border-[color:var(--wm-hairline)] bg-[color:var(--wm-surface)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t.label}</span>
              {t.badge ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono tabular-nums leading-none ${
                    t.tone === 'danger'
                      ? 'bg-rose-500 text-white'
                      : 'bg-black/20 text-current'
                  }`}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {loading && <div className="wm-surface-panel p-4 text-sm">Loading live records…</div>}

      {activeTab === 'applicants' && (
        <ApplicantsBulkTab
          applicants={applicants}
          selectedIds={selectedIds}
          onToggleOne={toggle}
          onSelectMany={setSelectedIds}
          onClearSelection={() => setSelectedIds([])}
          onRequestSendSelected={openSelected}
          onResend={resendApplicant}
        />
      )}

      {activeTab === 'failed' && (
        <FailedToSendTab
          failedRecords={failedRecords}
          canDispatch={canDispatch}
          retryingKey={retryingKey}
          openingGmailKey={openingGmailKey}
          onOpenInGmail={(rec) => void openFailedInGmail(rec)}
          onRetryFailedEmail={(rec) => void retryFailedRecord(rec)}
        />
      )}

      {activeTab === 'queue' && (
        <SendingQueueTab
          queue={queue}
          simulationRunning={sending}
          onStartSimulation={sendQueue}
          onPauseSimulation={() => {}}
          onRetryItem={(id) =>
            setQueue((q) =>
              q.map((x) =>
                x.id === id ? { ...x, status: 'waiting', errorDetails: null } : x,
              ),
            )
          }
          onRemoveItem={(id) => setQueue((q) => q.filter((x) => x.id !== id))}
          onClearCompleted={() => setQueue((q) => q.filter((x) => x.status !== 'sent'))}
        />
      )}

      {activeTab === 'history' && (
        <EmailHistoryTab
          history={history}
          onRetryHistoryItem={(id) => void retryByHistoryId(id)}
          onOpenFailedInGmail={openHistoryFailedInGmail}
        />
      )}

      {activeTab === 'templates' && (
        <EmailTemplatesTab
          templates={templates}
          applicants={applicants}
          onSaveTemplate={saveTemplate}
          onResetTemplate={resetTemplate}
        />
      )}

      {sending && (
        <div className="wm-surface-panel p-3 text-xs">
          Sending real email batch: {progress.done}/{progress.total}. Keep this page open until finished.
        </div>
      )}

      <BulkSendConfirmModal
        request={confirmState}
        templates={templates}
        onChangeType={(t) => setConfirmState((p) => (p ? { ...p, emailType: t } : null))}
        onConfirm={confirmSend}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}