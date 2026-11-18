import type {
  ActivityLogEntry,
  AdminNotification,
  AdminUser,
  AnnouncementRecord,
  Application,
  ApplicationFormDefinition,
  ApplicationStatus,
  AttendanceScanRecord,
  CommitteeRecord,
  ConferenceDocumentRecord,
  ConferenceSettings,
  Department,
  EmailConnectionStatus,
  EmailTemplate,
  ExecutiveBoardMember,
  FaqRecord,
  GalleryItemRecord,
  InquiryRecord,
  MediaAssetRecord,
  PermissionDefinition,
  PermissionKey,
  PermissionMap,
  PortalKey,
  QrPassRecord,
  RecommendationDecision,
  RoleDefinition,
  RoleType,
  ScheduleEventRecord,
  SecretariatMember,
  SentEmailRecord,
  ShiftRecord,
  SponsorRecord,
  SystemErrorLog,
  SystemServiceCheck,
  TeamGroupRecord,
  TechnicalConfig,
  WebsiteContentSnapshot,
  WebsiteVersionRecord,
  WorkspaceRecord,
} from '../types/admin';

/**
 * Clean service interfaces designed for direct Supabase replacement later.
 * All UI views and contexts interact strictly through IConferenceAdminRepository.
 */

export interface AuthSession {
  user: AdminUser;
  authenticatedAt: string;
}

export interface CreateAccountInput {
  fullName: string;
  email: string;
  password: string;
  role: RoleType;
  roleDefinitionId: string;
  title: string;
  departmentId: string | null;
  division: string | null;
  isActive: boolean;
  sendInvitation: boolean;
  permissions: PermissionMap;
}

export interface UpdateAccountInput {
  fullName?: string;
  email?: string;
  role?: RoleType;
  roleDefinitionId?: string;
  title?: string;
  departmentId?: string | null;
  division?: string | null;
  isActive?: boolean;
  status?: AdminUser['status'];
  permissions?: PermissionMap;
}

export interface CreateDepartmentInput {
  slug: string;
  name: string;
  cluster: Department['cluster'];
  description: string;
  capacity: number;
  positions: string[];
  registrationOpen: boolean;
  instructions: string;
}

export interface SendEmailPayload {
  templateId: string | null;
  applicationIds: string[];
  customRecipientEmail?: string;
  customRecipientName?: string;
  subject: string;
  body: string;
}

export interface PublicInquiryInput {
  name: string;
  email: string;
  type: InquiryRecord['type'];
  message: string;
}

export interface ServiceResult<T> {
  ok: boolean;
  data?: T;
  warning?: string;
  error?: string;
}

export interface ConferenceDataSnapshot {
  users: AdminUser[];
  roleDefinitions: RoleDefinition[];
  permissionDefinitions: PermissionDefinition[];
  departments: Department[];
  applications: Application[];
  applicationForms: ApplicationFormDefinition[];
  committees: CommitteeRecord[];
  secretariat: SecretariatMember[];
  executiveBoard: ExecutiveBoardMember[];
  sponsors: SponsorRecord[];
  announcements: AnnouncementRecord[];
  scheduleEvents: ScheduleEventRecord[];
  conferenceDocuments: ConferenceDocumentRecord[];
  faqs: FaqRecord[];
  galleryItems: GalleryItemRecord[];
  mediaLibrary: MediaAssetRecord[];
  websiteDraft: WebsiteContentSnapshot;
  websitePublished: WebsiteContentSnapshot;
  websiteVersions: WebsiteVersionRecord[];
  workspaceRecords: WorkspaceRecord[];
  teamGroups: TeamGroupRecord[];
  shifts: ShiftRecord[];
  qrPasses: QrPassRecord[];
  attendanceScans: AttendanceScanRecord[];
  logs: ActivityLogEntry[];
  emailConnection: EmailConnectionStatus;
  emailTemplates: EmailTemplate[];
  sentEmails: SentEmailRecord[];
  inquiries: InquiryRecord[];
  settings: ConferenceSettings;
  serviceChecks: SystemServiceCheck[];
  errorLogs: SystemErrorLog[];
  technicalConfig: TechnicalConfig;
  notifications: AdminNotification[];
}

export interface IConferenceAdminRepository {
  getSnapshot(): ConferenceDataSnapshot;
  resetDemoData(): ConferenceDataSnapshot;

  authenticate(
    email: string,
    password: string,
    expectedPortal?: PortalKey,
  ): ServiceResult<AuthSession>;
  signInDemoUser(userId: string): ServiceResult<AuthSession>;

  // Applications & Two-Stage Review
  updateApplicationStatus(
    actor: AdminUser,
    applicationId: string,
    status: ApplicationStatus,
    decisionNotes?: string,
  ): ServiceResult<Application>;
  submitHeadRecommendation(
    actor: AdminUser,
    applicationId: string,
    recommendation: RecommendationDecision,
    notes: string,
  ): ServiceResult<Application>;
  bulkUpdateApplicationStatus(
    actor: AdminUser,
    applicationIds: string[],
    status: ApplicationStatus,
  ): ServiceResult<Application[]>;
  bulkApproveRecommended(actor: AdminUser, departmentId?: string): ServiceResult<Application[]>;
  addApplicationNote(
    actor: AdminUser,
    applicationId: string,
    content: string,
  ): ServiceResult<Application>;
  generateSignupLink(actor: AdminUser, applicationId: string): ServiceResult<Application>;
  bulkGenerateSignupLinks(actor: AdminUser, applicationIds: string[]): ServiceResult<Application[]>;
  revokeSignupLink(actor: AdminUser, applicationId: string): ServiceResult<Application>;

  // Application Forms Builder
  saveApplicationForm(
    actor: AdminUser,
    form: ApplicationFormDefinition,
  ): ServiceResult<ApplicationFormDefinition>;
  deleteApplicationForm(actor: AdminUser, formId: string): ServiceResult<boolean>;

  // Departments
  createDepartment(actor: AdminUser, input: CreateDepartmentInput): ServiceResult<Department>;
  updateDepartment(
    actor: AdminUser,
    departmentId: string,
    patch: Partial<Department>,
  ): ServiceResult<Department>;
  assignDepartmentHead(
    actor: AdminUser,
    departmentId: string,
    headUserId: string,
    assigned: boolean,
  ): ServiceResult<Department>;

  // Super Admin Only: Accounts, Roles & Permission Definitions
  createAccount(actor: AdminUser, input: CreateAccountInput): ServiceResult<AdminUser>;
  updateAccount(
    actor: AdminUser,
    userId: string,
    patch: UpdateAccountInput,
  ): ServiceResult<AdminUser>;
  suspendAccount(actor: AdminUser, userId: string): ServiceResult<AdminUser>;
  reactivateAccount(actor: AdminUser, userId: string): ServiceResult<AdminUser>;
  resetAccountPassword(
    actor: AdminUser,
    userId: string,
    newPassword: string,
  ): ServiceResult<AdminUser>;
  manageAccountInvitation(
    actor: AdminUser,
    userId: string,
    action: 'generate' | 'revoke',
  ): ServiceResult<AdminUser>;
  deleteAccount(actor: AdminUser, userId: string): ServiceResult<boolean>;
  retryDepartmentAssignment(
    actor: AdminUser,
    userId: string,
    departmentId: string,
  ): ServiceResult<AdminUser>;

  saveRoleDefinition(actor: AdminUser, role: RoleDefinition): ServiceResult<RoleDefinition>;
  deleteRoleDefinition(actor: AdminUser, roleId: string): ServiceResult<boolean>;
  updatePermissionDefinition(
    actor: AdminUser,
    key: PermissionKey,
    patch: Partial<PermissionDefinition>,
  ): ServiceResult<PermissionDefinition>;

  // Conference Content CMS
  saveCommittee(actor: AdminUser, item: CommitteeRecord): ServiceResult<CommitteeRecord>;
  deleteCommittee(actor: AdminUser, committeeId: string): ServiceResult<boolean>;

  saveSecretariatMember(
    actor: AdminUser,
    member: SecretariatMember,
  ): ServiceResult<SecretariatMember>;
  deleteSecretariatMember(actor: AdminUser, memberId: string): ServiceResult<boolean>;

  saveExecutiveBoardMember(
    actor: AdminUser,
    member: ExecutiveBoardMember,
  ): ServiceResult<ExecutiveBoardMember>;
  deleteExecutiveBoardMember(actor: AdminUser, memberId: string): ServiceResult<boolean>;

  saveSponsor(actor: AdminUser, sponsor: SponsorRecord): ServiceResult<SponsorRecord>;
  deleteSponsor(actor: AdminUser, sponsorId: string): ServiceResult<boolean>;

  saveAnnouncement(
    actor: AdminUser,
    announcement: AnnouncementRecord,
  ): ServiceResult<AnnouncementRecord>;
  deleteAnnouncement(actor: AdminUser, announcementId: string): ServiceResult<boolean>;

  saveScheduleEvent(actor: AdminUser, event: ScheduleEventRecord): ServiceResult<ScheduleEventRecord>;
  deleteScheduleEvent(actor: AdminUser, eventId: string): ServiceResult<boolean>;

  saveConferenceDocument(
    actor: AdminUser,
    doc: ConferenceDocumentRecord,
  ): ServiceResult<ConferenceDocumentRecord>;
  deleteConferenceDocument(actor: AdminUser, docId: string): ServiceResult<boolean>;

  saveFaq(actor: AdminUser, faq: FaqRecord): ServiceResult<FaqRecord>;
  deleteFaq(actor: AdminUser, faqId: string): ServiceResult<boolean>;

  saveGalleryItem(actor: AdminUser, item: GalleryItemRecord): ServiceResult<GalleryItemRecord>;
  deleteGalleryItem(actor: AdminUser, itemId: string): ServiceResult<boolean>;

  // Operations, Teams, Shifts & Department Workspace
  saveWorkspaceRecord(actor: AdminUser, record: WorkspaceRecord): ServiceResult<WorkspaceRecord>;
  deleteWorkspaceRecord(actor: AdminUser, recordId: string): ServiceResult<boolean>;
  saveTeamGroup(actor: AdminUser, group: TeamGroupRecord): ServiceResult<TeamGroupRecord>;
  deleteTeamGroup(actor: AdminUser, groupId: string): ServiceResult<boolean>;
  saveShift(actor: AdminUser, shift: ShiftRecord): ServiceResult<ShiftRecord>;
  deleteShift(actor: AdminUser, shiftId: string): ServiceResult<boolean>;

  // QR Passes & Attendance
  ensurePersonalQrPass(actor: AdminUser): QrPassRecord;
  saveQrPass(actor: AdminUser, pass: QrPassRecord): ServiceResult<QrPassRecord>;
  scanQrToken(
    actor: AdminUser,
    token: string,
    gateLocation: string,
  ): ServiceResult<AttendanceScanRecord>;

  // Website CMS & Media Library
  updateWebsiteDraft(
    actor: AdminUser,
    updater: (draft: WebsiteContentSnapshot) => WebsiteContentSnapshot,
    summary: string,
  ): ServiceResult<WebsiteContentSnapshot>;
  publishWebsiteChanges(actor: AdminUser, summary: string): ServiceResult<WebsiteVersionRecord>;
  restoreWebsiteVersion(
    actor: AdminUser,
    versionId: string,
    publishImmediately?: boolean,
  ): ServiceResult<WebsiteContentSnapshot>;
  saveMediaAsset(actor: AdminUser, asset: MediaAssetRecord): ServiceResult<MediaAssetRecord>;
  deleteMediaAsset(actor: AdminUser, assetId: string): ServiceResult<boolean>;

  // Communication & Inquiries
  saveEmailTemplate(actor: AdminUser, template: EmailTemplate): ServiceResult<EmailTemplate>;
  sendEmails(actor: AdminUser, payload: SendEmailPayload): ServiceResult<SentEmailRecord[]>;
  submitPublicInquiry(input: PublicInquiryInput): ServiceResult<InquiryRecord>;
  updateInquiry(
    actor: AdminUser,
    inquiryId: string,
    patch: Partial<InquiryRecord>,
  ): ServiceResult<InquiryRecord>;

  // Conference Settings, Monitoring & Auditing
  updateSettings(
    actor: AdminUser,
    patch: Partial<ConferenceSettings>,
  ): ServiceResult<ConferenceSettings>;
  resolveErrorLog(actor: AdminUser, errorId: string): ServiceResult<SystemErrorLog>;
  updateTechnicalConfig(
    actor: AdminUser,
    patch: Partial<TechnicalConfig>,
  ): ServiceResult<TechnicalConfig>;
  runHealthChecks(actor: AdminUser): ServiceResult<SystemServiceCheck[]>;
  markAllNotificationsRead(): AdminNotification[];
  recordSecurityAttempt(
    actor: AdminUser,
    targetType: string,
    targetId: string,
    details: string,
  ): ActivityLogEntry;
}
