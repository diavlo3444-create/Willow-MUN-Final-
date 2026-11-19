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

export interface EmailHistoryRecord {
  id: string;
  applicantId: string;
  recipientName: string;
  recipientEmail: string;
  department: string;
  emailType: EmailDecisionType;
  subject: string;
  status: HistoryDeliveryStatus;
  attemptCount: number;
  sentAt: string | null;
  lastAttemptAt: string;
  errorDetails: string | null;
}

export interface EmailQueueItem {
  id: string;
  applicantId: string;
  recipientName: string;
  recipientEmail: string;
  department: string;
  emailType: EmailDecisionType;
  subject: string;
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
