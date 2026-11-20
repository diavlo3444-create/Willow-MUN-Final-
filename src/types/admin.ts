/**
 * Centralized domain types for the Willow MUN Administration & Conference Management Platform.
 * Strictly supports three roles: Super Admin, Admin, and Department Head (no IT role).
 * Structured so Supabase PostgreSQL tables, RLS policies, and Edge Functions map 1:1 later.
 */

export type RoleType = 'super_admin' | 'admin' | 'department_head' | 'executive_board' | 'staff';

export type PortalKey = 'super_admin' | 'admin' | 'department_head' | 'executive_board' | 'security' | 'staff';

export type PermissionKey =
  | 'applications.view'
  | 'applications.view_confidential'
  | 'applications.review'
  | 'applications.recommend'
  | 'applications.bulk_actions'
  | 'applications.notes'
  | 'applications.export'
  | 'applications.signup_links'
  | 'forms.manage'
  | 'departments.view_all'
  | 'departments.manage'
  | 'departments.assign_head'
  | 'departments.toggle_registration'
  | 'departments.workspace'
  | 'committees.manage'
  | 'secretariat.view'
  | 'secretariat.manage'
  | 'executive_board.manage'
  | 'sponsors.manage'
  | 'schedule.manage'
  | 'content.conference_assets'
  | 'operations.teams'
  | 'operations.shifts'
  | 'operations.deployment'
  | 'qr.view_pass'
  | 'qr.scan'
  | 'qr.manage'
  | 'website.view'
  | 'website.edit'
  | 'website.publish'
  | 'media.manage'
  | 'registration.view'
  | 'registration.manage'
  | 'accounts.view'
  | 'accounts.manage_admins'
  | 'accounts.manage_heads'
  | 'roles.manage'
  | 'permissions.manage'
  | 'email.view'
  | 'email.send'
  | 'email.bulk_send'
  | 'inquiries.manage'
  | 'reports.view'
  | 'reports.export'
  | 'logs.view'
  | 'system.settings'
  | 'system.monitoring'
  | 'testing.impersonate_head';

export type PermissionMap = Record<PermissionKey, boolean>;

export interface RoleDefinition {
  id: string;
  key: RoleType | string;
  name: string;
  description: string;
  isSystem: boolean;
  defaultPermissions: PermissionMap;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  category:
    | 'Applications & Forms'
    | 'Conference Content'
    | 'Department & Operations'
    | 'Website CMS'
    | 'Communication'
    | 'Administration & Reports'
    | 'Super Admin Security';
  description: string;
  superAdminOnly?: boolean;
}

export type AccountStatus = 'active' | 'suspended' | 'invited';
export type InvitationStatus = 'accepted' | 'pending' | 'revoked' | 'none';

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  password?: string;
  role: RoleType;
  roleDefinitionId: string;
  title: string;
  departmentId: string | null;
  departmentSlug?: string | null;
  division: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  status: AccountStatus;
  invitationStatus: InvitationStatus;
  invitationToken: string | null;
  lastPasswordResetAt: string | null;
  permissions: PermissionMap;
  ebPermissions?: Record<string, boolean>;
  ebRank?: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface Department {
  id: string;
  slug: string;
  name: string;
  cluster:
    | 'Delegate Affairs & Operations'
    | 'Communications & Creative'
    | 'Logistics & Administration';
  description: string;
  headUserIds: string[];
  registrationOpen: boolean;
  capacity: number;
  positions: string[];
  instructions: string;
  updatedAt: string;
}

export type ApplicationCategory =
  | 'delegate'
  | 'staff'
  | 'security'
  | 'media'
  | 'press'
  | 'volunteer';

export type ApplicationStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'waitlisted'
  | 'withdrawn';

export type RecommendationDecision = 'none' | 'recommend_accept' | 'recommend_reject';

export interface ApplicationAnswer {
  questionId: string;
  section: string;
  label: string;
  answer: string;
}

export interface UploadedDocument {
  id: string;
  name: string;
  category: 'photo' | 'cv' | 'portfolio' | 'id_document' | 'other';
  fileType: string;
  sizeLabel: string;
  previewUrl: string;
  storageBucket?: string;
  storagePath?: string;
  uploadedAt: string;
}

export interface InternalNote {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: RoleType;
  content: string;
  createdAt: string;
}

export interface ApplicationHistoryEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: RoleType;
  summary: string;
}

export interface Application {
  id: string;
  applicationCode: string;
  applicationType?: string | null;
  category: ApplicationCategory;
  applicantName: string;
  gender?: 'male' | 'female' | null;
  email: string;
  phone: string;
  schoolOrUniversity: string;
  gradeOrYear: string;
  city: string;
  country: string;
  age: number;
  departmentId: string;
  position: string;
  secondChoiceDepartmentId: string | null;
  status: ApplicationStatus;
  submittedAt: string;
  updatedAt: string;
  // Stage 1: Department Head recommendation
  headRecommendation: RecommendationDecision;
  headNotes: string;
  recommendedBy: string | null;
  recommendedByName?: string | null;
  recommendedAt: string | null;
  // Stage 2: Admin / Super Admin final decision
  finalDecisionBy: string | null;
  finalDecisionAt: string | null;
  adminDecisionNotes: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  // Signup link for accepted applicants
  signupLinkToken: string | null;
  signupLinkStatus: 'none' | 'active' | 'revoked' | 'used';
  signupLinkGeneratedAt: string | null;
  emergencyContact: string;
  guardianPhone?: string;
  cameraModel?: string | null;
  attendsAllDays?: boolean | null;
  absenceReason?: string | null;
  medicalInfo?: {
    hasConditions: boolean | null;
    details: string | null;
    restricted: boolean;
  };
  experienceLevel: string;
  answers: ApplicationAnswer[];
  documents: UploadedDocument[];
  notes: InternalNote[];
  history: ApplicationHistoryEntry[];
}

export type FormQuestionType =
  | 'short_text'
  | 'long_text'
  | 'multiple_choice'
  | 'dropdown'
  | 'file_upload'
  | 'conditional';

export interface FormQuestion {
  id: string;
  section: string;
  label: string;
  helpText: string;
  type: FormQuestionType;
  required: boolean;
  options: string[];
  conditionalParentId: string | null;
  conditionalExpectedValue: string | null;
  order: number;
}

export interface ApplicationFormDefinition {
  id: string;
  title: string;
  category: ApplicationCategory;
  departmentId: string | null;
  description: string;
  isOpen: boolean;
  deadline: string;
  questions: FormQuestion[];
  updatedAt: string;
}

export interface CommitteeRecord {
  id: string;
  chamber: string;
  name: string;
  abbreviation: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Crisis';
  description: string;
  topics: string[];
  chairName: string;
  viceChairName: string;
  logoUrl: string | null;
  imageUrl: string | null;
  capacity: number;
  published: boolean;
  order: number;
}

export type SecretariatCategory =
  | 'secretariat'
  | 'communications'
  | 'operations'
  | 'logistics';

export interface SecretariatMember {
  id: string;
  name: string;
  role: string;
  category: SecretariatCategory;
  groupLabel: string;
  bio: string;
  quote: string;
  quoteBy: string | null;
  photoUrl: string | null;
  email: string;
  visible: boolean;
  order: number;
}

export interface ExecutiveBoardMember {
  id: string;
  name: string;
  position: string;
  groupId: string;
  groupLabel: string;
  side: 'center' | 'left' | 'right';
  cluster: string | null;
  bio: string;
  quote: string;
  quoteBy: string | null;
  photoUrl: string | null;
  visible: boolean;
  order: number;
}

export interface SponsorRecord {
  id: string;
  name: string;
  tier: 'Title' | 'Gold' | 'Silver' | 'Community Partner';
  description: string;
  logoUrl: string | null;
  websiteUrl: string;
  visible: boolean;
  order: number;
}

export interface AnnouncementRecord {
  id: string;
  title: string;
  summary: string;
  badgeText: string;
  imageUrl: string | null;
  publishDate: string;
  published: boolean;
  featuredInBanner: boolean;
  order: number;
}

export interface ScheduleEventRecord {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  category: 'Ceremony' | 'Committee Session' | 'Social' | 'Briefing' | 'Logistics';
  description: string;
  visible: boolean;
}

export interface ConferenceDocumentRecord {
  id: string;
  title: string;
  category: 'Study Guide' | 'Rules of Procedure' | 'Delegate Handbook' | 'Policy' | 'Schedule';
  url: string;
  sizeLabel: string;
  visible: boolean;
  updatedAt: string;
}

export interface FaqRecord {
  id: string;
  category: string;
  question: string;
  answer: string;
  visible: boolean;
  order: number;
}

export interface GalleryItemRecord {
  id: string;
  title: string;
  caption: string;
  imageUrl: string;
  folder: string;
  visible: boolean;
  order: number;
}

export interface MediaAssetRecord {
  id: string;
  fileName: string;
  folder: 'Portraits' | 'Branding' | 'Committees' | 'Sponsors' | 'Banners' | 'Gallery';
  url: string;
  mimeType: string;
  sizeLabel: string;
  usedIn: string[];
  uploadedAt: string;
}

export interface WebsiteNavLink {
  id: string;
  label: string;
  href: string;
  visible: boolean;
  order: number;
  children: Array<{ id: string; label: string; href: string }>;
}

export interface WebsitePageRecord {
  id: string;
  title: string;
  slug: string;
  description: string;
  published: boolean;
  visibleInNav: boolean;
  order: number;
  seoTitle: string;
  seoDescription: string;
  seoImageUrl: string;
  noIndex: boolean;
  updatedAt: string;
}

export interface WebsiteSectionRecord {
  id: string;
  pageId: string;
  sectionKey:
    | 'hero'
    | 'about'
    | 'global_stage'
    | 'committees'
    | 'executive_board'
    | 'team'
    | 'updates'
    | 'apply'
    | 'suggestions'
    | 'sponsors'
    | 'custom';
  label: string;
  heading: string;
  subheading: string;
  bodyText: string;
  buttonLabel: string;
  buttonHref: string;
  imageUrl: string;
  backgroundStyle: string;
  published: boolean;
  order: number;
}

export interface WebsiteFooterConfig {
  fullName: string;
  editionText: string;
  instagramHandle: string;
  contactEmail: string;
  contactPhone: string;
  copyrightText: string;
  links: Array<{ id: string; label: string; href: string }>;
}

export interface WebsiteContentSnapshot {
  pages: WebsitePageRecord[];
  sections: WebsiteSectionRecord[];
  navigation: WebsiteNavLink[];
  footer: WebsiteFooterConfig;
  bannerEnabled: boolean;
  bannerText: string;
  bannerLinkLabel: string;
  bannerLinkHref: string;
}

export interface WebsiteVersionRecord {
  id: string;
  versionNumber: number;
  summary: string;
  publishedBy: string;
  publishedAt: string;
  snapshot: WebsiteContentSnapshot;
}

export type WorkspaceModuleType =
  | 'tasks'
  | 'campaigns'
  | 'coverage'
  | 'incidents'
  | 'rosters'
  | 'shifts'
  | 'sponsor_tasks'
  | 'venue_planning'
  | 'run_of_show'
  | 'directives'
  | 'support_tickets'
  | 'announcements'
  | 'internal_notes';

export interface WorkspaceRecord {
  id: string;
  departmentId: string;
  module: WorkspaceModuleType;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: string;
  assignedTo: string;
  internalNotes: string;
  createdBy: string;
  updatedAt: string;
}

export interface TeamGroupRecord {
  id: string;
  departmentId: string;
  name: string;
  supervisorName: string;
  responsibility: string;
  customPositions: string[];
  memberAssignments: Array<{
    id: string;
    memberName: string;
    email: string;
    position: string;
    applicationId: string | null;
  }>;
}

export interface ShiftRecord {
  id: string;
  departmentId: string;
  title: string;
  dutyDescription: string;
  location: string;
  station: string;
  sectionLabel: string;
  supervisorName: string;
  startTime: string;
  endTime: string;
  assignedPersonnel: string[];
  requiredHeadcount: number;
  status: 'scheduled' | 'active' | 'completed' | 'needs_cover';
}

export interface QrPassRecord {
  id: string;
  userId?: string | null;
  applicationId?: string | null;
  token: string;
  holderName: string;
  roleLabel: string;
  departmentId: string | null;
  category: 'Staff' | 'Department Head' | 'Executive' | 'Delegate' | 'Security';
  active: boolean;
  checkedIn: boolean;
  lastScannedAt: string | null;
}

export interface AttendanceScanRecord {
  id: string;
  passId: string | null;
  tokenScanned: string;
  holderName: string;
  departmentId: string | null;
  roleLabel: string;
  result:
    | 'valid_checkin'
    | 'already_checked_in'
    | 'duplicate_recent'
    | 'invalid_token'
    | 'revoked_pass'
    | 'not_eligible';
  scannedBy: string;
  gateLocation: string;
  scannedAt: string;
}

export type ActivityCategory =
  | 'application'
  | 'account'
  | 'role'
  | 'department'
  | 'registration'
  | 'committee'
  | 'secretariat'
  | 'operations'
  | 'qr'
  | 'email'
  | 'website'
  | 'system'
  | 'security';

export interface ActivityLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: RoleType;
  action: string;
  category: ActivityCategory;
  targetType: string;
  targetId: string;
  targetLabel: string;
  details: string;
  departmentId: string | null;
  timestamp: string;
}

export type EmailTemplateType = 'acceptance' | 'rejection' | 'shortlist' | 'announcement' | 'custom';

export interface EmailTemplate {
  id: string;
  name: string;
  type: EmailTemplateType;
  subject: string;
  body: string;
  updatedAt: string;
}

export interface SentEmailRecord {
  id: string;
  templateId: string | null;
  recipientEmail: string;
  recipientName: string;
  applicationId: string | null;
  subject: string;
  body: string;
  status: 'sent' | 'queued';
  sentBy: string;
  sentAt: string;
}

export interface EmailConnectionStatus {
  provider: string;
  senderName: string;
  senderAddress: string;
  connected: boolean;
  dailyQuotaUsed: number;
  dailyQuotaLimit: number;
  lastVerifiedAt: string;
}

export interface InquiryRecord {
  id: string;
  name: string;
  email: string;
  type: 'Suggestion' | 'Requirement' | 'General';
  message: string;
  status: 'new' | 'in_review' | 'resolved';
  internalNotes: string;
  submittedAt: string;
  resolvedBy: string | null;
}

export interface ConferenceSettings {
  conferenceName: string;
  editionYear: string;
  datesText: string;
  venueText: string;
  organizerName: string;
  contactEmail: string;
  contactPhone: string;
  delegateFeeText: string;
  termsText: string;
  privacyPolicyText: string;
  globalRegistrationOpen: boolean;
  registrationWindowStart: string;
  registrationDeadline: string;
  maxApplicationsPerApplicant: number;
  autoConfirmEmailOnSubmit: boolean;
  maintenanceMode: boolean;
}

export interface SystemServiceCheck {
  id: string;
  name: string;
  endpoint: string;
  status: 'operational' | 'degraded' | 'maintenance';
  latencyMs: number;
  uptimePercent: number;
  lastCheckedAt: string;
}

export interface SystemErrorLog {
  id: string;
  code: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  message: string;
  occurrences: number;
  lastSeenAt: string;
  resolved: boolean;
}

export interface TechnicalConfig {
  environmentLabel: string;
  rateLimitPerMinute: number;
  maxUploadSizeMb: number;
  allowedFileTypes: string[];
  sessionTimeoutMinutes: number;
  strictDepartmentIsolation: boolean;
  auditLoggingEnabled: boolean;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  category: ActivityCategory;
  createdAt: string;
  read: boolean;
  departmentId: string | null;
}

export interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
}
