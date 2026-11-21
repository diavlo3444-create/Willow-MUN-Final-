export type EmailDecisionType = 'accepted' | 'rejected';

export type ApplicantDecisionStatus = 'pending' | 'accepted' | 'rejected';

export type ApplicantEmailStatus = 'not_sent' | 'sent' | 'failed';

export type HistoryDeliveryStatus = 'sent' | 'failed' | 'pending';

export type QueueItemStatus = 'waiting' | 'processing' | 'sent' | 'failed';

export interface EmailApplicantRecord {
  id: string;
  applicationCode: string;
  applicantName: string;
  email: string;
  department: string;
  departmentSlug: string;
  appliedPosition: string;
  applicationStatus: ApplicantDecisionStatus;
  emailStatus: ApplicantEmailStatus;
  applicationDate: string;
  signupLink?: string;
}

export type DeliveryMethod = 'automated' | 'manual_gmail';

export interface EmailHistoryRecord {
  id: string;
  applicantId: string;
  recipientName: string;
  recipientEmail: string;
  department: string;
  emailType: EmailDecisionType;
  subject: string;
  bodyText?: string | null;
  status: HistoryDeliveryStatus;
  attemptCount: number;
  sentAt: string | null;
  lastAttemptAt: string;
  errorDetails: string | null;
  deliveryMethod?: DeliveryMethod;
  manuallyConfirmedAt?: string | null;
  manuallyConfirmedByName?: string | null;
  manuallyConfirmedByEmail?: string | null;
}

export interface ManualEmailConfirmationRecord {
  id: string;
  applicationId: string;
  decisionStatus: EmailDecisionType;
  serverDeliveryId: string | null;
  recipientName: string;
  recipientEmail: string;
  department: string;
  subject: string;
  bodyText: string;
  attemptCount: number;
  sentAt: string;
  confirmedByName: string | null;
  confirmedByEmail: string | null;
}

export interface FailedEmailRecord {
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
  status: 'failed';
  errorDetails: string;
  attemptCount: number;
  lastAttemptAt: string;
  manualDraftOpenedAt: string | null;
  source: 'server' | 'local';
  signupLink?: string | null;
}

export interface EmailQueueItem {
  id: string;
  applicantId: string;
  recipientName: string;
  recipientEmail: string;
  department: string;
  emailType: EmailDecisionType;
  subject: string;
  bodyText?: string;
  status: QueueItemStatus;
  errorDetails?: string | null;
  queuedAt: string;
}

export interface EmailTemplateRecord {
  key: EmailDecisionType;
  label: string;
  subject: string;
  body: string;
  updatedAt: string;
}

export interface PlaceholderTokenInfo {
  token: string;
  description: string;
}

export interface BulkSendConfirmState {
  mode: 'all_accepted' | 'all_rejected' | 'selected';
  emailType: EmailDecisionType;
  recipients: EmailApplicantRecord[];
  skippedAlreadySentCount: number;
  skippedIneligibleCount: number;
}
