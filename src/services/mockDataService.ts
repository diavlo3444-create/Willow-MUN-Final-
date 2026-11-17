import type {
  ActivityCategory,
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
  EmailTemplate,
  ExecutiveBoardMember,
  FaqRecord,
  GalleryItemRecord,
  InquiryRecord,
  MediaAssetRecord,
  PermissionDefinition,
  PermissionKey,
  PortalKey,
  QrPassRecord,
  RecommendationDecision,
  RoleDefinition,
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
import {
  canAccessApplication,
  canAccessDepartment,
  canAccessPortal,
  canManageAccountsOrRoles,
  canReviewFinalDecision,
  canSubmitRecommendation,
  hasPermission,
  SUPER_ADMIN_PERMISSIONS,
} from '../utils/adminPermissions';
import { renderEmailTemplateText, validateEmailDraft } from '../utils/emailTemplates';
import { evaluateQrScan } from '../utils/qrAttendance';
import type {
  AuthSession,
  ConferenceDataSnapshot,
  CreateAccountInput,
  CreateDepartmentInput,
  IConferenceAdminRepository,
  PublicInquiryInput,
  SendEmailPayload,
  ServiceResult,
  UpdateAccountInput,
} from './interfaces';
import { createInitialSnapshot } from './mockDatabase';

const STORAGE_KEY = 'willow_mun_platform_snapshot_v4';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function loadPersistedSnapshot(): ConferenceDataSnapshot {
  if (typeof window === 'undefined') {
    return createInitialSnapshot();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = createInitialSnapshot();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<ConferenceDataSnapshot>;
    if (!parsed || !Array.isArray(parsed.users) || !parsed.websitePublished) {
      return createInitialSnapshot();
    }
    const base = createInitialSnapshot();
    return {
      ...base,
      ...parsed,
    };
  } catch {
    return createInitialSnapshot();
  }
}

class MockConferenceAdminService implements IConferenceAdminRepository {
  private snapshot: ConferenceDataSnapshot;

  constructor() {
    this.snapshot = loadPersistedSnapshot();
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot));
    } catch {
      // Ignore quota errors in sandboxed iframes
    }
  }

  private appendLog(
    actor: AdminUser,
    action: string,
    category: ActivityCategory,
    targetType: string,
    targetId: string,
    targetLabel: string,
    details: string,
    departmentId: string | null = null,
  ): ActivityLogEntry {
    const entry: ActivityLogEntry = {
      id: makeId('log'),
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      action,
      category,
      targetType,
      targetId,
      targetLabel,
      details,
      departmentId,
      timestamp: nowIso(),
    };
    this.snapshot.logs = [entry, ...this.snapshot.logs].slice(0, 400);
    return entry;
  }

  public getSnapshot(): ConferenceDataSnapshot {
    return structuredClone(this.snapshot);
  }

  public resetDemoData(): ConferenceDataSnapshot {
    this.snapshot = createInitialSnapshot();
    this.persist();
    return this.getSnapshot();
  }

  public authenticate(
    email: string,
    password: string,
    expectedPortal?: PortalKey,
  ): ServiceResult<AuthSession> {
    const normalized = email.trim().toLowerCase();
    const user = this.snapshot.users.find((u) => u.email.toLowerCase() === normalized);
    if (!user || user.password !== password) {
      return { ok: false, error: 'Invalid email or password.' };
    }
    if (!user.isActive || user.status !== 'active') {
      return {
        ok: false,
        error:
          user.status === 'invited'
            ? 'Your account invitation is still pending activation by a Super Admin.'
            : 'This account has been suspended. Contact a Super Admin.',
      };
    }
    if (expectedPortal && !canAccessPortal(user, expectedPortal)) {
      return {
        ok: false,
        error: `Your role (${user.title}) does not have access to the selected portal.`,
      };
    }
    user.lastActiveAt = nowIso();
    this.appendLog(
      user,
      'Signed In',
      'account',
      'session',
      user.id,
      user.fullName,
      `Authenticated to ${expectedPortal ?? user.role} portal.`,
      user.departmentId,
    );
    this.persist();
    return {
      ok: true,
      data: { user: structuredClone(user), authenticatedAt: nowIso() },
    };
  }

  public signInDemoUser(userId: string): ServiceResult<AuthSession> {
    const user = this.snapshot.users.find((u) => u.id === userId);
    if (!user) return { ok: false, error: 'Account not found.' };
    if (!user.isActive || user.status !== 'active') {
      return {
        ok: false,
        error: 'Suspended or unaccepted invited accounts cannot sign in.',
      };
    }
    user.lastActiveAt = nowIso();
    this.appendLog(
      user,
      'Demo Portal Sign-In',
      'account',
      'session',
      user.id,
      user.fullName,
      `Entered ${user.role} workspace.`,
      user.departmentId,
    );
    this.persist();
    return {
      ok: true,
      data: { user: structuredClone(user), authenticatedAt: nowIso() },
    };
  }

  // =========================================================
  // APPLICATIONS & TWO-STAGE APPROVAL WORKFLOW
  // =========================================================

  public updateApplicationStatus(
    actor: AdminUser,
    applicationId: string,
    status: ApplicationStatus,
    decisionNotes?: string,
  ): ServiceResult<Application> {
    const app = this.snapshot.applications.find((a) => a.id === applicationId);
    if (!app) return { ok: false, error: 'Application not found.' };

    if (!canReviewFinalDecision(actor, app)) {
      this.appendLog(
        actor,
        'Unauthorized Final Decision Blocked',
        'security',
        'application',
        app.id,
        app.applicantName,
        'Department Heads submit Stage 1 recommendations only; final status reserved for Admins/Super Admins.',
        app.departmentId,
      );
      this.persist();
      return {
        ok: false,
        error: 'Final acceptance/rejection requires Admin or Super Admin authority (Stage 2).',
      };
    }

    const previous = app.status;
    const timestamp = nowIso();
    app.status = status;
    app.updatedAt = timestamp;
    app.finalDecisionBy = actor.fullName;
    app.finalDecisionAt = timestamp;
    app.reviewedBy = actor.fullName;
    app.reviewedAt = timestamp;
    if (decisionNotes !== undefined) {
      app.adminDecisionNotes = decisionNotes;
    }

    app.history.unshift({
      id: makeId('hist'),
      timestamp,
      actorName: actor.fullName,
      actorRole: actor.role,
      summary: `Stage 2 Final Decision: ${previous.toUpperCase()} -> ${status.toUpperCase()}${
        decisionNotes ? ` (${decisionNotes})` : ''
      }`,
    });

    this.appendLog(
      actor,
      `Final Decision: ${status.toUpperCase()}`,
      'application',
      'application',
      app.id,
      `${app.applicationCode} · ${app.applicantName}`,
      `Changed status from ${previous} to ${status}.`,
      app.departmentId,
    );
    this.persist();
    return { ok: true, data: structuredClone(app) };
  }

  public submitHeadRecommendation(
    actor: AdminUser,
    applicationId: string,
    recommendation: RecommendationDecision,
    notes: string,
  ): ServiceResult<Application> {
    const app = this.snapshot.applications.find((a) => a.id === applicationId);
    if (!app) return { ok: false, error: 'Application not found.' };

    if (!canSubmitRecommendation(actor, app)) {
      this.appendLog(
        actor,
        'Unauthorized Department Recommendation Blocked',
        'security',
        'application',
        app.id,
        app.applicantName,
        'Attempted recommendation outside authorized department.',
        app.departmentId,
      );
      this.persist();
      return { ok: false, error: 'Not authorized to submit recommendations for this application.' };
    }

    const timestamp = nowIso();
    app.headRecommendation = recommendation;
    app.headNotes = notes.trim();
    app.recommendedBy = actor.fullName;
    app.recommendedAt = timestamp;
    app.updatedAt = timestamp;

    // Crucial: Stage 1 Recommendation NEVER auto-accepts the application status.
    const label =
      recommendation === 'recommend_accept'
        ? 'Recommend Accept'
        : recommendation === 'recommend_reject'
          ? 'Recommend Reject'
          : 'Cleared Recommendation';

    app.history.unshift({
      id: makeId('hist'),
      timestamp,
      actorName: actor.fullName,
      actorRole: actor.role,
      summary: `Stage 1 Recommendation: ${label}${app.headNotes ? ` — "${app.headNotes}"` : ''}`,
    });

    this.appendLog(
      actor,
      `Stage 1: ${label}`,
      'application',
      'application',
      app.id,
      `${app.applicationCode} · ${app.applicantName}`,
      'Submitted departmental Stage 1 recommendation for Stage 2 Admin confirmation.',
      app.departmentId,
    );
    this.persist();
    return { ok: true, data: structuredClone(app) };
  }

  public bulkUpdateApplicationStatus(
    actor: AdminUser,
    applicationIds: string[],
    status: ApplicationStatus,
  ): ServiceResult<Application[]> {
    if (actor.role === 'department_head' || !hasPermission(actor, 'applications.bulk_actions')) {
      return { ok: false, error: 'You do not have permission for bulk final decisions.' };
    }
    const updated: Application[] = [];
    const timestamp = nowIso();

    for (const id of applicationIds) {
      const app = this.snapshot.applications.find((a) => a.id === id);
      if (!app || !canReviewFinalDecision(actor, app)) continue;
      app.status = status;
      app.updatedAt = timestamp;
      app.finalDecisionBy = actor.fullName;
      app.finalDecisionAt = timestamp;
      app.reviewedBy = actor.fullName;
      app.reviewedAt = timestamp;
      app.history.unshift({
        id: makeId('hist'),
        timestamp,
        actorName: actor.fullName,
        actorRole: actor.role,
        summary: `Bulk Final Decision -> ${status.toUpperCase()}`,
      });
      updated.push(structuredClone(app));
    }

    this.appendLog(
      actor,
      `Bulk ${status.toUpperCase()} (${updated.length})`,
      'application',
      'application_batch',
      applicationIds.join(','),
      `${updated.length} Applications`,
      `Applied bulk Stage 2 decision: ${status}.`,
    );
    this.persist();
    return { ok: true, data: updated };
  }

  public bulkApproveRecommended(actor: AdminUser, departmentId?: string): ServiceResult<Application[]> {
    if (actor.role === 'department_head' || !hasPermission(actor, 'applications.bulk_actions')) {
      return { ok: false, error: 'Only Admin or Super Admin can finalize Stage 1 recommendations.' };
    }
    const candidates = this.snapshot.applications.filter(
      (a) =>
        a.status === 'pending' &&
        a.headRecommendation === 'recommend_accept' &&
        (!departmentId || departmentId === 'all' || a.departmentId === departmentId),
    );
    if (candidates.length === 0) {
      return { ok: false, error: 'No pending Stage 1 "Recommend Accept" applications matched.' };
    }
    return this.bulkUpdateApplicationStatus(
      actor,
      candidates.map((c) => c.id),
      'accepted',
    );
  }

  public addApplicationNote(
    actor: AdminUser,
    applicationId: string,
    content: string,
  ): ServiceResult<Application> {
    const trimmed = content.trim();
    if (!trimmed) return { ok: false, error: 'Note cannot be empty.' };
    const app = this.snapshot.applications.find((a) => a.id === applicationId);
    if (!app) return { ok: false, error: 'Application not found.' };

    if (!canAccessApplication(actor, app) || !hasPermission(actor, 'applications.notes')) {
      return { ok: false, error: 'Not authorized to add notes to this application.' };
    }

    const timestamp = nowIso();
    app.notes.unshift({
      id: makeId('note'),
      authorId: actor.id,
      authorName: actor.fullName,
      authorRole: actor.role,
      content: trimmed,
      createdAt: timestamp,
    });
    app.updatedAt = timestamp;
    this.appendLog(
      actor,
      'Added Evaluation Note',
      'application',
      'application',
      app.id,
      `${app.applicationCode} · ${app.applicantName}`,
      trimmed.slice(0, 120),
      app.departmentId,
    );
    this.persist();
    return { ok: true, data: structuredClone(app) };
  }

  public generateSignupLink(actor: AdminUser, applicationId: string): ServiceResult<Application> {
    if (!hasPermission(actor, 'applications.signup_links') || actor.role === 'department_head') {
      return { ok: false, error: 'Signup link management requires Admin or Super Admin access.' };
    }
    const app = this.snapshot.applications.find((a) => a.id === applicationId);
    if (!app) return { ok: false, error: 'Application not found.' };
    if (app.status !== 'accepted') {
      return { ok: false, error: 'Signup links can only be generated for Accepted applicants.' };
    }

    const firstToken = app.applicantName.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase() || 'DELEG';
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const timestamp = nowIso();
    app.signupLinkToken = `SIGNUP-WM26-${firstToken}-${rand}`;
    app.signupLinkStatus = 'active';
    app.signupLinkGeneratedAt = timestamp;
    app.updatedAt = timestamp;
    app.history.unshift({
      id: makeId('hist'),
      timestamp,
      actorName: actor.fullName,
      actorRole: actor.role,
      summary: `Generated onboarding signup link (${app.signupLinkToken}).`,
    });

    this.appendLog(
      actor,
      'Generated Signup Link',
      'application',
      'application',
      app.id,
      `${app.applicationCode} · ${app.applicantName}`,
      `Token ${app.signupLinkToken} active.`,
      app.departmentId,
    );
    this.persist();
    return { ok: true, data: structuredClone(app) };
  }

  public bulkGenerateSignupLinks(
    actor: AdminUser,
    applicationIds: string[],
  ): ServiceResult<Application[]> {
    if (!hasPermission(actor, 'applications.signup_links') || actor.role === 'department_head') {
      return { ok: false, error: 'Not authorized to bulk generate signup links.' };
    }
    const generated: Application[] = [];
    for (const id of applicationIds) {
      const res = this.generateSignupLink(actor, id);
      if (res.ok && res.data) generated.push(res.data);
    }
    if (generated.length === 0) {
      return { ok: false, error: 'No accepted applications matched selection.' };
    }
    return { ok: true, data: generated };
  }

  public revokeSignupLink(actor: AdminUser, applicationId: string): ServiceResult<Application> {
    if (!hasPermission(actor, 'applications.signup_links') || actor.role === 'department_head') {
      return { ok: false, error: 'Not authorized to revoke signup links.' };
    }
    const app = this.snapshot.applications.find((a) => a.id === applicationId);
    if (!app) return { ok: false, error: 'Application not found.' };
    const timestamp = nowIso();
    app.signupLinkStatus = 'revoked';
    app.updatedAt = timestamp;
    app.history.unshift({
      id: makeId('hist'),
      timestamp,
      actorName: actor.fullName,
      actorRole: actor.role,
      summary: 'Revoked active onboarding signup link.',
    });
    this.appendLog(
      actor,
      'Revoked Signup Link',
      'application',
      'application',
      app.id,
      `${app.applicationCode} · ${app.applicantName}`,
      'Signup link revoked cleanly.',
      app.departmentId,
    );
    this.persist();
    return { ok: true, data: structuredClone(app) };
  }

  // =========================================================
  // APPLICATION FORMS BUILDER (Preserves historical answers)
  // =========================================================

  public saveApplicationForm(
    actor: AdminUser,
    form: ApplicationFormDefinition,
  ): ServiceResult<ApplicationFormDefinition> {
    if (!hasPermission(actor, 'forms.manage')) {
      return { ok: false, error: 'Not authorized to modify application forms.' };
    }
    const cleanForm: ApplicationFormDefinition = {
      ...structuredClone(form),
      id: form.id || makeId('form'),
      questions: [...form.questions]
        .sort((a, b) => a.order - b.order)
        .map((q, idx) => ({ ...q, order: idx + 1 })),
      updatedAt: nowIso(),
    };
    const existsIdx = this.snapshot.applicationForms.findIndex((f) => f.id === cleanForm.id);
    if (existsIdx >= 0) {
      this.snapshot.applicationForms[existsIdx] = cleanForm;
    } else {
      this.snapshot.applicationForms.push(cleanForm);
    }
    this.appendLog(
      actor,
      existsIdx >= 0 ? 'Updated Application Form' : 'Created Application Form',
      'registration',
      'application_form',
      cleanForm.id,
      cleanForm.title,
      `${cleanForm.questions.length} question(s); historical submissions preserved untouched.`,
      cleanForm.departmentId,
    );
    this.persist();
    return { ok: true, data: structuredClone(cleanForm) };
  }

  public deleteApplicationForm(actor: AdminUser, formId: string): ServiceResult<boolean> {
    if (!hasPermission(actor, 'forms.manage')) {
      return { ok: false, error: 'Not authorized to delete application forms.' };
    }
    const target = this.snapshot.applicationForms.find((f) => f.id === formId);
    if (!target) return { ok: false, error: 'Form not found.' };
    this.snapshot.applicationForms = this.snapshot.applicationForms.filter((f) => f.id !== formId);
    this.appendLog(
      actor,
      'Deleted Application Form',
      'registration',
      'application_form',
      formId,
      target.title,
      'Removed form template without deleting prior applicant submissions.',
    );
    this.persist();
    return { ok: true, data: true };
  }

  // =========================================================
  // DEPARTMENTS
  // =========================================================

  public createDepartment(actor: AdminUser, input: CreateDepartmentInput): ServiceResult<Department> {
    if (!hasPermission(actor, 'departments.manage')) {
      return { ok: false, error: 'You do not have permission to create departments.' };
    }
    const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    if (!slug || !input.name.trim()) {
      return { ok: false, error: 'Department name and slug are required.' };
    }
    if (this.snapshot.departments.some((d) => d.id === slug || d.slug === slug)) {
      return { ok: false, error: `A department with identifier "${slug}" already exists.` };
    }
    const dept: Department = {
      id: slug,
      slug,
      name: input.name.trim(),
      cluster: input.cluster,
      description: input.description.trim(),
      headUserIds: [],
      registrationOpen: input.registrationOpen,
      capacity: Math.max(1, input.capacity),
      positions: input.positions.map((p) => p.trim()).filter(Boolean),
      instructions: input.instructions.trim(),
      updatedAt: nowIso(),
    };
    this.snapshot.departments.push(dept);
    this.appendLog(
      actor,
      'Created Department',
      'department',
      'department',
      dept.id,
      dept.name,
      `Cluster ${dept.cluster}, capacity ${dept.capacity}.`,
      dept.id,
    );
    this.persist();
    return { ok: true, data: structuredClone(dept) };
  }

  public updateDepartment(
    actor: AdminUser,
    departmentId: string,
    patch: Partial<Department>,
  ): ServiceResult<Department> {
    const dept = this.snapshot.departments.find((d) => d.id === departmentId);
    if (!dept) return { ok: false, error: 'Department not found.' };

    const isHeadUpdatingOwn =
      actor.role === 'department_head' &&
      canAccessDepartment(actor, departmentId) &&
      Object.keys(patch).every((k) => ['description', 'instructions', 'positions'].includes(k));

    const isRegistrationOnly =
      Object.keys(patch).length === 1 &&
      'registrationOpen' in patch &&
      hasPermission(actor, 'departments.toggle_registration');

    if (!hasPermission(actor, 'departments.manage') && !isHeadUpdatingOwn && !isRegistrationOnly) {
      return { ok: false, error: 'Not authorized to modify this department configuration.' };
    }

    Object.assign(dept, patch, { id: dept.id, slug: dept.slug, updatedAt: nowIso() });
    this.appendLog(
      actor,
      isRegistrationOnly
        ? `${dept.registrationOpen ? 'Opened' : 'Closed'} Dept Registration`
        : 'Updated Department Configuration',
      isRegistrationOnly ? 'registration' : 'department',
      'department',
      dept.id,
      dept.name,
      `Updated ${Object.keys(patch).join(', ')}.`,
      dept.id,
    );
    this.persist();
    return { ok: true, data: structuredClone(dept) };
  }

  public assignDepartmentHead(
    actor: AdminUser,
    departmentId: string,
    headUserId: string,
    assigned: boolean,
  ): ServiceResult<Department> {
    if (!canManageAccountsOrRoles(actor)) {
      this.appendLog(
        actor,
        'Unauthorized Dept Head Assignment Blocked',
        'security',
        'department',
        departmentId,
        headUserId,
        'Only Super Admins can assign or modify Department Head accounts.',
        departmentId,
      );
      this.persist();
      return {
        ok: false,
        error: 'Strict Account Security: Only Super Admins can assign Department Head accounts.',
      };
    }

    const dept = this.snapshot.departments.find((d) => d.id === departmentId);
    const user = this.snapshot.users.find((u) => u.id === headUserId);
    if (!dept || !user) return { ok: false, error: 'Department or user not found.' };

    if (assigned) {
      if (!dept.headUserIds.includes(user.id)) dept.headUserIds.push(user.id);
      if (user.role === 'department_head') {
        user.departmentId = dept.id;
      }
    } else {
      dept.headUserIds = dept.headUserIds.filter((id) => id !== user.id);
      if (user.role === 'department_head' && user.departmentId === dept.id) {
        user.departmentId = null;
      }
    }
    dept.updatedAt = nowIso();
    this.appendLog(
      actor,
      assigned ? 'Assigned Department Head' : 'Unassigned Department Head',
      'department',
      'department',
      dept.id,
      dept.name,
      `${user.fullName} ${assigned ? 'linked to' : 'removed from'} ${dept.name}.`,
      dept.id,
    );
    this.persist();
    return { ok: true, data: structuredClone(dept) };
  }

  // =========================================================
  // SUPER ADMIN ONLY: ACCOUNTS, ROLES & PERMISSION DEFINITIONS
  // =========================================================

  public createAccount(actor: AdminUser, input: CreateAccountInput): ServiceResult<AdminUser> {
    if (!canManageAccountsOrRoles(actor)) {
      this.appendLog(
        actor,
        'Blocked Non-SuperAdmin Account Create',
        'security',
        'account',
        input.email,
        input.fullName,
        'Admin attempted to create an account. Blocked by Super Admin Security Guard.',
      );
      this.persist();
      return {
        ok: false,
        error: 'Security Violation: Only Super Admins may create administrator or department head accounts.',
      };
    }

    const email = input.email.trim().toLowerCase();
    if (!email || !input.fullName.trim()) {
      return { ok: false, error: 'Full name and email are required.' };
    }
    if (this.snapshot.users.some((u) => u.email.toLowerCase() === email)) {
      return { ok: false, error: `Duplicate account: "${email}" is already registered.` };
    }

    const userId = makeId('usr');
    let deptWarning: string | undefined;
    let resolvedDepartmentId: string | null = input.role === 'department_head' ? input.departmentId : null;

    if (input.role === 'department_head' && input.departmentId) {
      const dept = this.snapshot.departments.find((d) => d.id === input.departmentId);
      if (dept) {
        if (!dept.headUserIds.includes(userId)) dept.headUserIds.push(userId);
      } else {
        resolvedDepartmentId = null;
        deptWarning = 'Account created cleanly, but selected department could not be linked. Retry assignment from Department list.';
      }
    }

    const timestamp = nowIso();
    const invitationToken = input.sendInvitation
      ? `INV-WMUN-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
      : null;

    const newUser: AdminUser = {
      id: userId,
      fullName: input.fullName.trim(),
      email,
      password: input.password || 'willow-2026',
      role: input.role,
      roleDefinitionId: input.roleDefinitionId || `role-${input.role.replace('_', '-')}`,
      title: input.title.trim() || input.role,
      departmentId: resolvedDepartmentId,
      division: input.division,
      avatarUrl: null,
      isActive: input.isActive,
      status: input.isActive ? 'active' : input.sendInvitation ? 'invited' : 'suspended',
      invitationStatus: input.sendInvitation ? 'pending' : 'accepted',
      invitationToken,
      lastPasswordResetAt: null,
      permissions:
        input.role === 'super_admin'
          ? { ...SUPER_ADMIN_PERMISSIONS }
          : { ...input.permissions },
      createdAt: timestamp,
      lastActiveAt: timestamp,
    };

    this.snapshot.users.push(newUser);
    this.appendLog(
      actor,
      'Created Staff Account',
      'account',
      'account',
      newUser.id,
      `${newUser.fullName} (${newUser.role})`,
      `${newUser.email}${invitationToken ? ` · Invite token ${invitationToken}` : ''}`,
      newUser.departmentId,
    );
    this.persist();
    return { ok: true, data: structuredClone(newUser), warning: deptWarning };
  }

  public updateAccount(
    actor: AdminUser,
    userId: string,
    patch: UpdateAccountInput,
  ): ServiceResult<AdminUser> {
    if (!canManageAccountsOrRoles(actor)) {
      this.appendLog(
        actor,
        'Blocked Non-SuperAdmin Account Edit',
        'security',
        'account',
        userId,
        userId,
        'Non-Super Admin attempted to modify an account or permission matrix.',
      );
      this.persist();
      return {
        ok: false,
        error: 'Security Violation: Only Super Admins may edit accounts, emails, roles, or permissions.',
      };
    }

    const target = this.snapshot.users.find((u) => u.id === userId);
    if (!target) return { ok: false, error: 'Account not found.' };

    if (patch.email !== undefined) {
      const cleanEmail = patch.email.trim().toLowerCase();
      if (!cleanEmail) return { ok: false, error: 'Email cannot be empty.' };
      if (this.snapshot.users.some((u) => u.id !== target.id && u.email.toLowerCase() === cleanEmail)) {
        return { ok: false, error: `Email "${cleanEmail}" belongs to another account.` };
      }
      target.email = cleanEmail;
    }

    // Never leave platform with zero active Super Admins
    if (target.role === 'super_admin') {
      const otherActiveSupers = this.snapshot.users.filter(
        (u) => u.id !== target.id && u.role === 'super_admin' && u.isActive && u.status === 'active',
      );
      const losingSuper =
        (patch.role && patch.role !== 'super_admin') ||
        patch.isActive === false ||
        patch.status === 'suspended';
      if (otherActiveSupers.length === 0 && losingSuper) {
        return {
          ok: false,
          error: 'At least one active Super Admin must always remain on the platform.',
        };
      }
    }

    const prevDept = target.departmentId;
    if (patch.fullName !== undefined) target.fullName = patch.fullName.trim();
    if (patch.role !== undefined) target.role = patch.role;
    if (patch.roleDefinitionId !== undefined) target.roleDefinitionId = patch.roleDefinitionId;
    if (patch.title !== undefined) target.title = patch.title.trim();
    if (patch.division !== undefined) target.division = patch.division;
    if (patch.isActive !== undefined) {
      target.isActive = patch.isActive;
      target.status = patch.isActive ? 'active' : 'suspended';
    }
    if (patch.status !== undefined) {
      target.status = patch.status;
      target.isActive = patch.status === 'active';
    }
    if (patch.permissions !== undefined) {
      target.permissions =
        target.role === 'super_admin' ? { ...SUPER_ADMIN_PERMISSIONS } : { ...patch.permissions };
    }
    if (patch.departmentId !== undefined) {
      const nextDept = target.role === 'department_head' ? patch.departmentId : null;
      if (prevDept && prevDept !== nextDept) {
        const oldDept = this.snapshot.departments.find((d) => d.id === prevDept);
        if (oldDept) oldDept.headUserIds = oldDept.headUserIds.filter((id) => id !== target.id);
      }
      if (nextDept) {
        const newDept = this.snapshot.departments.find((d) => d.id === nextDept);
        if (newDept && !newDept.headUserIds.includes(target.id)) {
          newDept.headUserIds.push(target.id);
        }
      }
      target.departmentId = nextDept;
    }

    this.appendLog(
      actor,
      'Updated Staff Account',
      'account',
      'account',
      target.id,
      target.fullName,
      `Modified ${Object.keys(patch).join(', ')}.`,
      target.departmentId,
    );
    this.persist();
    return { ok: true, data: structuredClone(target) };
  }

  public suspendAccount(actor: AdminUser, userId: string): ServiceResult<AdminUser> {
    return this.updateAccount(actor, userId, { isActive: false, status: 'suspended' });
  }

  public reactivateAccount(actor: AdminUser, userId: string): ServiceResult<AdminUser> {
    const target = this.snapshot.users.find((u) => u.id === userId);
    if (target && target.invitationStatus === 'pending') {
      target.invitationStatus = 'accepted';
    }
    return this.updateAccount(actor, userId, { isActive: true, status: 'active' });
  }

  public resetAccountPassword(
    actor: AdminUser,
    userId: string,
    newPassword: string,
  ): ServiceResult<AdminUser> {
    if (!canManageAccountsOrRoles(actor)) {
      return { ok: false, error: 'Only Super Admins can trigger password resets.' };
    }
    const target = this.snapshot.users.find((u) => u.id === userId);
    if (!target) return { ok: false, error: 'Account not found.' };
    if (newPassword.trim().length < 6) {
      return { ok: false, error: 'Temporary password must be at least 6 characters.' };
    }
    target.password = newPassword.trim();
    target.lastPasswordResetAt = nowIso();
    this.appendLog(
      actor,
      'Issued Password Reset',
      'account',
      'account',
      target.id,
      target.fullName,
      `Password reset completed for ${target.email}.`,
      target.departmentId,
    );
    this.persist();
    return { ok: true, data: structuredClone(target) };
  }

  public manageAccountInvitation(
    actor: AdminUser,
    userId: string,
    action: 'generate' | 'revoke',
  ): ServiceResult<AdminUser> {
    if (!canManageAccountsOrRoles(actor)) {
      return { ok: false, error: 'Only Super Admins can manage onboarding invitations.' };
    }
    const target = this.snapshot.users.find((u) => u.id === userId);
    if (!target) return { ok: false, error: 'Account not found.' };

    if (action === 'generate') {
      target.invitationToken = `INV-WMUN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      target.invitationStatus = 'pending';
    } else {
      target.invitationToken = null;
      target.invitationStatus = 'revoked';
    }
    this.appendLog(
      actor,
      action === 'generate' ? 'Generated Account Invitation' : 'Revoked Account Invitation',
      'account',
      'account',
      target.id,
      target.fullName,
      target.invitationToken ? `Token ${target.invitationToken}` : 'Invitation token revoked.',
      target.departmentId,
    );
    this.persist();
    return { ok: true, data: structuredClone(target) };
  }

  public deleteAccount(actor: AdminUser, userId: string): ServiceResult<boolean> {
    if (!canManageAccountsOrRoles(actor)) {
      this.appendLog(
        actor,
        'Blocked Non-SuperAdmin Account Delete',
        'security',
        'account',
        userId,
        userId,
        'Non-Super Admin attempted to delete a staff account.',
      );
      this.persist();
      return { ok: false, error: 'Only Super Admins can remove accounts.' };
    }
    if (actor.id === userId) {
      return { ok: false, error: 'You cannot delete your own active Super Admin session.' };
    }
    const target = this.snapshot.users.find((u) => u.id === userId);
    if (!target) return { ok: false, error: 'Account not found.' };

    this.snapshot.users = this.snapshot.users.filter((u) => u.id !== userId);
    for (const dept of this.snapshot.departments) {
      dept.headUserIds = dept.headUserIds.filter((id) => id !== userId);
    }
    this.appendLog(
      actor,
      'Deleted Staff Account',
      'account',
      'account',
      userId,
      target.fullName,
      `Removed ${target.email} (${target.role}).`,
      target.departmentId,
    );
    this.persist();
    return { ok: true, data: true };
  }

  public retryDepartmentAssignment(
    actor: AdminUser,
    userId: string,
    departmentId: string,
  ): ServiceResult<AdminUser> {
    return this.updateAccount(actor, userId, { departmentId });
  }

  public saveRoleDefinition(
    actor: AdminUser,
    roleDef: RoleDefinition,
  ): ServiceResult<RoleDefinition> {
    if (!canManageAccountsOrRoles(actor)) {
      this.appendLog(
        actor,
        'Blocked Non-SuperAdmin Role Edit',
        'security',
        'role',
        roleDef.id,
        roleDef.name,
        'Admins are strictly blocked from editing or creating role definitions.',
      );
      this.persist();
      return {
        ok: false,
        error: 'Security Violation: Only Super Admins may create or edit Role Definitions.',
      };
    }

    const timestamp = nowIso();
    const clean: RoleDefinition = {
      ...structuredClone(roleDef),
      id: roleDef.id || makeId('role'),
      updatedAt: timestamp,
      createdAt: roleDef.createdAt || timestamp,
    };
    const idx = this.snapshot.roleDefinitions.findIndex((r) => r.id === clean.id);
    if (idx >= 0) {
      this.snapshot.roleDefinitions[idx] = clean;
    } else {
      this.snapshot.roleDefinitions.push(clean);
    }

    this.appendLog(
      actor,
      idx >= 0 ? 'Updated Role Definition' : 'Created Role Definition',
      'role',
      'role',
      clean.id,
      clean.name,
      clean.description,
    );
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public deleteRoleDefinition(actor: AdminUser, roleId: string): ServiceResult<boolean> {
    if (!canManageAccountsOrRoles(actor)) {
      return { ok: false, error: 'Only Super Admins can delete role definitions.' };
    }
    const target = this.snapshot.roleDefinitions.find((r) => r.id === roleId);
    if (!target) return { ok: false, error: 'Role definition not found.' };
    if (target.isSystem) {
      return { ok: false, error: 'Core system roles (Super Admin, Admin, Department Head) cannot be deleted.' };
    }
    this.snapshot.roleDefinitions = this.snapshot.roleDefinitions.filter((r) => r.id !== roleId);
    this.appendLog(
      actor,
      'Deleted Role Definition',
      'role',
      'role',
      roleId,
      target.name,
      'Removed custom role definition.',
    );
    this.persist();
    return { ok: true, data: true };
  }

  public updatePermissionDefinition(
    actor: AdminUser,
    key: PermissionKey,
    patch: Partial<PermissionDefinition>,
  ): ServiceResult<PermissionDefinition> {
    if (!canManageAccountsOrRoles(actor)) {
      return { ok: false, error: 'Only Super Admins can edit global permission definitions.' };
    }
    const target = this.snapshot.permissionDefinitions.find((p) => p.key === key);
    if (!target) return { ok: false, error: 'Permission key not found.' };
    Object.assign(target, patch, { key });
    this.appendLog(
      actor,
      'Updated Permission Definition',
      'role',
      'permission',
      key,
      target.label,
      target.description,
    );
    this.persist();
    return { ok: true, data: structuredClone(target) };
  }

  // =========================================================
  // CONFERENCE CONTENT CMS
  // =========================================================

  public saveCommittee(actor: AdminUser, item: CommitteeRecord): ServiceResult<CommitteeRecord> {
    if (!hasPermission(actor, 'committees.manage')) {
      return { ok: false, error: 'Not authorized to manage committees.' };
    }
    const clean = { ...structuredClone(item), id: item.id || makeId('chamber') };
    const idx = this.snapshot.committees.findIndex((c) => c.id === clean.id);
    if (idx >= 0) this.snapshot.committees[idx] = clean;
    else this.snapshot.committees.push(clean);
    this.appendLog(
      actor,
      idx >= 0 ? 'Updated Committee' : 'Created Committee',
      'committee',
      'committee',
      clean.id,
      `${clean.chamber} · ${clean.name}`,
      `Published: ${clean.published ? 'Yes' : 'Draft'}`,
    );
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public deleteCommittee(actor: AdminUser, committeeId: string): ServiceResult<boolean> {
    if (!hasPermission(actor, 'committees.manage')) {
      return { ok: false, error: 'Not authorized to remove committees.' };
    }
    const target = this.snapshot.committees.find((c) => c.id === committeeId);
    if (!target) return { ok: false, error: 'Committee not found.' };
    this.snapshot.committees = this.snapshot.committees.filter((c) => c.id !== committeeId);
    this.appendLog(
      actor,
      'Deleted Committee',
      'committee',
      'committee',
      committeeId,
      `${target.chamber} · ${target.name}`,
      'Removed committee from roster.',
    );
    this.persist();
    return { ok: true, data: true };
  }

  public saveSecretariatMember(
    actor: AdminUser,
    member: SecretariatMember,
  ): ServiceResult<SecretariatMember> {
    if (!hasPermission(actor, 'secretariat.manage')) {
      return { ok: false, error: 'Not authorized to manage the Secretariat roster.' };
    }
    const clean = { ...structuredClone(member), id: member.id || makeId('sec') };
    const idx = this.snapshot.secretariat.findIndex((m) => m.id === clean.id);
    if (idx >= 0) this.snapshot.secretariat[idx] = clean;
    else this.snapshot.secretariat.push(clean);
    this.appendLog(
      actor,
      idx >= 0 ? 'Updated Secretariat Member' : 'Added Secretariat Member',
      'secretariat',
      'secretariat',
      clean.id,
      clean.name,
      clean.role,
    );
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public deleteSecretariatMember(actor: AdminUser, memberId: string): ServiceResult<boolean> {
    if (!hasPermission(actor, 'secretariat.manage')) {
      return { ok: false, error: 'Not authorized to remove Secretariat members.' };
    }
    const target = this.snapshot.secretariat.find((m) => m.id === memberId);
    if (!target) return { ok: false, error: 'Member not found.' };
    this.snapshot.secretariat = this.snapshot.secretariat.filter((m) => m.id !== memberId);
    this.appendLog(
      actor,
      'Removed Secretariat Member',
      'secretariat',
      'secretariat',
      memberId,
      target.name,
      target.role,
    );
    this.persist();
    return { ok: true, data: true };
  }

  public saveExecutiveBoardMember(
    actor: AdminUser,
    member: ExecutiveBoardMember,
  ): ServiceResult<ExecutiveBoardMember> {
    if (!hasPermission(actor, 'executive_board.manage')) {
      return { ok: false, error: 'Not authorized to manage Executive Board.' };
    }
    const clean = { ...structuredClone(member), id: member.id || makeId('eb') };
    const idx = this.snapshot.executiveBoard.findIndex((m) => m.id === clean.id);
    if (idx >= 0) this.snapshot.executiveBoard[idx] = clean;
    else this.snapshot.executiveBoard.push(clean);
    this.appendLog(
      actor,
      idx >= 0 ? 'Updated Executive Board Member' : 'Added Executive Board Member',
      'secretariat',
      'executive_board',
      clean.id,
      clean.name,
      `${clean.groupLabel} · ${clean.position}`,
    );
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public deleteExecutiveBoardMember(actor: AdminUser, memberId: string): ServiceResult<boolean> {
    if (!hasPermission(actor, 'executive_board.manage')) {
      return { ok: false, error: 'Not authorized to remove Executive Board members.' };
    }
    const target = this.snapshot.executiveBoard.find((m) => m.id === memberId);
    if (!target) return { ok: false, error: 'Member not found.' };
    this.snapshot.executiveBoard = this.snapshot.executiveBoard.filter((m) => m.id !== memberId);
    this.appendLog(
      actor,
      'Removed Executive Board Member',
      'secretariat',
      'executive_board',
      memberId,
      target.name,
      target.position,
    );
    this.persist();
    return { ok: true, data: true };
  }

  public saveSponsor(actor: AdminUser, sponsor: SponsorRecord): ServiceResult<SponsorRecord> {
    if (!hasPermission(actor, 'sponsors.manage')) {
      return { ok: false, error: 'Not authorized to manage sponsors.' };
    }
    const clean = { ...structuredClone(sponsor), id: sponsor.id || makeId('sp') };
    const idx = this.snapshot.sponsors.findIndex((s) => s.id === clean.id);
    if (idx >= 0) this.snapshot.sponsors[idx] = clean;
    else this.snapshot.sponsors.push(clean);
    this.appendLog(
      actor,
      idx >= 0 ? 'Updated Sponsor' : 'Added Sponsor',
      'website',
      'sponsor',
      clean.id,
      clean.name,
      `${clean.tier} tier · Visible: ${clean.visible ? 'Yes' : 'Hidden'}`,
    );
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public deleteSponsor(actor: AdminUser, sponsorId: string): ServiceResult<boolean> {
    if (!hasPermission(actor, 'sponsors.manage')) {
      return { ok: false, error: 'Not authorized to remove sponsors.' };
    }
    const target = this.snapshot.sponsors.find((s) => s.id === sponsorId);
    if (!target) return { ok: false, error: 'Sponsor not found.' };
    this.snapshot.sponsors = this.snapshot.sponsors.filter((s) => s.id !== sponsorId);
    this.appendLog(actor, 'Deleted Sponsor', 'website', 'sponsor', sponsorId, target.name, 'Removed sponsor.');
    this.persist();
    return { ok: true, data: true };
  }

  public saveAnnouncement(
    actor: AdminUser,
    announcement: AnnouncementRecord,
  ): ServiceResult<AnnouncementRecord> {
    if (!hasPermission(actor, 'website.edit')) {
      return { ok: false, error: 'Not authorized to edit announcements.' };
    }
    const clean = { ...structuredClone(announcement), id: announcement.id || makeId('ann') };
    const idx = this.snapshot.announcements.findIndex((a) => a.id === clean.id);
    if (idx >= 0) this.snapshot.announcements[idx] = clean;
    else this.snapshot.announcements.push(clean);
    this.appendLog(
      actor,
      idx >= 0 ? 'Updated Announcement' : 'Created Announcement',
      'website',
      'announcement',
      clean.id,
      clean.title,
      `Published: ${clean.published ? 'Yes' : 'Draft'}`,
    );
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public deleteAnnouncement(actor: AdminUser, announcementId: string): ServiceResult<boolean> {
    if (!hasPermission(actor, 'website.edit')) {
      return { ok: false, error: 'Not authorized to remove announcements.' };
    }
    const target = this.snapshot.announcements.find((a) => a.id === announcementId);
    if (!target) return { ok: false, error: 'Announcement not found.' };
    this.snapshot.announcements = this.snapshot.announcements.filter((a) => a.id !== announcementId);
    this.appendLog(
      actor,
      'Deleted Announcement',
      'website',
      'announcement',
      announcementId,
      target.title,
      'Removed announcement.',
    );
    this.persist();
    return { ok: true, data: true };
  }

  public saveScheduleEvent(
    actor: AdminUser,
    event: ScheduleEventRecord,
  ): ServiceResult<ScheduleEventRecord> {
    if (!hasPermission(actor, 'schedule.manage')) {
      return { ok: false, error: 'Not authorized to edit schedule.' };
    }
    const clean = { ...structuredClone(event), id: event.id || makeId('sch') };
    const idx = this.snapshot.scheduleEvents.findIndex((e) => e.id === clean.id);
    if (idx >= 0) this.snapshot.scheduleEvents[idx] = clean;
    else this.snapshot.scheduleEvents.push(clean);
    this.appendLog(
      actor,
      idx >= 0 ? 'Updated Schedule Event' : 'Created Schedule Event',
      'website',
      'schedule_event',
      clean.id,
      clean.title,
      `${clean.date} · ${clean.startTime}-${clean.endTime}`,
    );
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public deleteScheduleEvent(actor: AdminUser, eventId: string): ServiceResult<boolean> {
    if (!hasPermission(actor, 'schedule.manage')) {
      return { ok: false, error: 'Not authorized to delete schedule events.' };
    }
    const target = this.snapshot.scheduleEvents.find((e) => e.id === eventId);
    if (!target) return { ok: false, error: 'Event not found.' };
    this.snapshot.scheduleEvents = this.snapshot.scheduleEvents.filter((e) => e.id !== eventId);
    this.appendLog(
      actor,
      'Deleted Schedule Event',
      'website',
      'schedule_event',
      eventId,
      target.title,
      'Removed schedule block.',
    );
    this.persist();
    return { ok: true, data: true };
  }

  public saveConferenceDocument(
    actor: AdminUser,
    doc: ConferenceDocumentRecord,
  ): ServiceResult<ConferenceDocumentRecord> {
    if (!hasPermission(actor, 'content.conference_assets')) {
      return { ok: false, error: 'Not authorized to manage conference documents.' };
    }
    const clean = { ...structuredClone(doc), id: doc.id || makeId('cdoc'), updatedAt: nowIso() };
    const idx = this.snapshot.conferenceDocuments.findIndex((d) => d.id === clean.id);
    if (idx >= 0) this.snapshot.conferenceDocuments[idx] = clean;
    else this.snapshot.conferenceDocuments.push(clean);
    this.appendLog(actor, 'Saved Document', 'website', 'document', clean.id, clean.title, clean.category);
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public deleteConferenceDocument(actor: AdminUser, docId: string): ServiceResult<boolean> {
    if (!hasPermission(actor, 'content.conference_assets')) {
      return { ok: false, error: 'Not authorized to delete conference documents.' };
    }
    this.snapshot.conferenceDocuments = this.snapshot.conferenceDocuments.filter((d) => d.id !== docId);
    this.appendLog(actor, 'Deleted Document', 'website', 'document', docId, docId, 'Removed document.');
    this.persist();
    return { ok: true, data: true };
  }

  public saveFaq(actor: AdminUser, faq: FaqRecord): ServiceResult<FaqRecord> {
    if (!hasPermission(actor, 'content.conference_assets')) {
      return { ok: false, error: 'Not authorized to manage FAQs.' };
    }
    const clean = { ...structuredClone(faq), id: faq.id || makeId('faq') };
    const idx = this.snapshot.faqs.findIndex((f) => f.id === clean.id);
    if (idx >= 0) this.snapshot.faqs[idx] = clean;
    else this.snapshot.faqs.push(clean);
    this.appendLog(actor, 'Saved FAQ Item', 'website', 'faq', clean.id, clean.question, clean.category);
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public deleteFaq(actor: AdminUser, faqId: string): ServiceResult<boolean> {
    if (!hasPermission(actor, 'content.conference_assets')) {
      return { ok: false, error: 'Not authorized to delete FAQs.' };
    }
    this.snapshot.faqs = this.snapshot.faqs.filter((f) => f.id !== faqId);
    this.appendLog(actor, 'Deleted FAQ Item', 'website', 'faq', faqId, faqId, 'Removed FAQ.');
    this.persist();
    return { ok: true, data: true };
  }

  public saveGalleryItem(actor: AdminUser, item: GalleryItemRecord): ServiceResult<GalleryItemRecord> {
    if (!hasPermission(actor, 'content.conference_assets')) {
      return { ok: false, error: 'Not authorized to manage gallery.' };
    }
    const clean = { ...structuredClone(item), id: item.id || makeId('gal') };
    const idx = this.snapshot.galleryItems.findIndex((g) => g.id === clean.id);
    if (idx >= 0) this.snapshot.galleryItems[idx] = clean;
    else this.snapshot.galleryItems.push(clean);
    this.appendLog(actor, 'Saved Gallery Item', 'website', 'gallery', clean.id, clean.title, clean.folder);
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public deleteGalleryItem(actor: AdminUser, itemId: string): ServiceResult<boolean> {
    if (!hasPermission(actor, 'content.conference_assets')) {
      return { ok: false, error: 'Not authorized to delete gallery items.' };
    }
    this.snapshot.galleryItems = this.snapshot.galleryItems.filter((g) => g.id !== itemId);
    this.appendLog(actor, 'Deleted Gallery Item', 'website', 'gallery', itemId, itemId, 'Removed gallery photo.');
    this.persist();
    return { ok: true, data: true };
  }

  // =========================================================
  // DEPARTMENT WORKSPACE, TEAMS, SHIFTS & DEPLOYMENT
  // =========================================================

  public saveWorkspaceRecord(
    actor: AdminUser,
    record: WorkspaceRecord,
  ): ServiceResult<WorkspaceRecord> {
    if (!hasPermission(actor, 'departments.workspace') || !canAccessDepartment(actor, record.departmentId)) {
      return { ok: false, error: 'Not authorized to edit workspace records for this department.' };
    }
    const clean = {
      ...structuredClone(record),
      id: record.id || makeId('ws'),
      createdBy: record.createdBy || actor.fullName,
      updatedAt: nowIso(),
    };
    const idx = this.snapshot.workspaceRecords.findIndex((r) => r.id === clean.id);
    if (idx >= 0) this.snapshot.workspaceRecords[idx] = clean;
    else this.snapshot.workspaceRecords.unshift(clean);
    this.appendLog(
      actor,
      idx >= 0 ? `Updated ${clean.module}` : `Created ${clean.module}`,
      'operations',
      'workspace_record',
      clean.id,
      clean.title,
      `Status: ${clean.status} · Priority: ${clean.priority}`,
      clean.departmentId,
    );
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public deleteWorkspaceRecord(actor: AdminUser, recordId: string): ServiceResult<boolean> {
    const existing = this.snapshot.workspaceRecords.find((r) => r.id === recordId);
    if (!existing) return { ok: false, error: 'Record not found.' };
    if (!hasPermission(actor, 'departments.workspace') || !canAccessDepartment(actor, existing.departmentId)) {
      return { ok: false, error: 'Not authorized to delete this workspace record.' };
    }
    this.snapshot.workspaceRecords = this.snapshot.workspaceRecords.filter((r) => r.id !== recordId);
    this.appendLog(
      actor,
      `Deleted ${existing.module}`,
      'operations',
      'workspace_record',
      recordId,
      existing.title,
      'Removed workspace record.',
      existing.departmentId,
    );
    this.persist();
    return { ok: true, data: true };
  }

  public saveTeamGroup(actor: AdminUser, group: TeamGroupRecord): ServiceResult<TeamGroupRecord> {
    if (!hasPermission(actor, 'operations.teams') || !canAccessDepartment(actor, group.departmentId)) {
      return { ok: false, error: 'Not authorized to manage teams for this department.' };
    }
    const clean = { ...structuredClone(group), id: group.id || makeId('tg') };
    const idx = this.snapshot.teamGroups.findIndex((t) => t.id === clean.id);
    if (idx >= 0) this.snapshot.teamGroups[idx] = clean;
    else this.snapshot.teamGroups.push(clean);
    this.appendLog(
      actor,
      idx >= 0 ? 'Updated Team Group' : 'Created Team Group',
      'operations',
      'team_group',
      clean.id,
      clean.name,
      `${clean.memberAssignments.length} assigned member(s).`,
      clean.departmentId,
    );
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public deleteTeamGroup(actor: AdminUser, groupId: string): ServiceResult<boolean> {
    const existing = this.snapshot.teamGroups.find((t) => t.id === groupId);
    if (!existing) return { ok: false, error: 'Team group not found.' };
    if (!hasPermission(actor, 'operations.teams') || !canAccessDepartment(actor, existing.departmentId)) {
      return { ok: false, error: 'Not authorized to delete this team group.' };
    }
    this.snapshot.teamGroups = this.snapshot.teamGroups.filter((t) => t.id !== groupId);
    this.appendLog(
      actor,
      'Deleted Team Group',
      'operations',
      'team_group',
      groupId,
      existing.name,
      'Removed team group.',
      existing.departmentId,
    );
    this.persist();
    return { ok: true, data: true };
  }

  public saveShift(actor: AdminUser, shift: ShiftRecord): ServiceResult<ShiftRecord> {
    if (!hasPermission(actor, 'operations.shifts') || !canAccessDepartment(actor, shift.departmentId)) {
      return { ok: false, error: 'Not authorized to schedule shifts for this department.' };
    }
    const clean = { ...structuredClone(shift), id: shift.id || makeId('sh') };
    const idx = this.snapshot.shifts.findIndex((s) => s.id === clean.id);
    if (idx >= 0) this.snapshot.shifts[idx] = clean;
    else this.snapshot.shifts.push(clean);
    this.appendLog(
      actor,
      idx >= 0 ? 'Updated Shift / Deployment' : 'Scheduled Shift / Deployment',
      'operations',
      'shift',
      clean.id,
      clean.title,
      `${clean.location} (${clean.station}) · ${clean.startTime}-${clean.endTime}`,
      clean.departmentId,
    );
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public deleteShift(actor: AdminUser, shiftId: string): ServiceResult<boolean> {
    const existing = this.snapshot.shifts.find((s) => s.id === shiftId);
    if (!existing) return { ok: false, error: 'Shift not found.' };
    if (!hasPermission(actor, 'operations.shifts') || !canAccessDepartment(actor, existing.departmentId)) {
      return { ok: false, error: 'Not authorized to delete this shift.' };
    }
    this.snapshot.shifts = this.snapshot.shifts.filter((s) => s.id !== shiftId);
    this.appendLog(
      actor,
      'Deleted Shift',
      'operations',
      'shift',
      shiftId,
      existing.title,
      'Removed scheduled shift.',
      existing.departmentId,
    );
    this.persist();
    return { ok: true, data: true };
  }

  // =========================================================
  // QR PASSES & VENUE ATTENDANCE
  // =========================================================

  public saveQrPass(actor: AdminUser, pass: QrPassRecord): ServiceResult<QrPassRecord> {
    if (!hasPermission(actor, 'qr.manage')) {
      return { ok: false, error: 'Not authorized to manage QR passes.' };
    }
    const clean = {
      ...structuredClone(pass),
      id: pass.id || makeId('qr'),
      token: pass.token.trim().toUpperCase(),
    };
    const idx = this.snapshot.qrPasses.findIndex((p) => p.id === clean.id);
    if (idx >= 0) this.snapshot.qrPasses[idx] = clean;
    else this.snapshot.qrPasses.unshift(clean);
    this.appendLog(
      actor,
      idx >= 0 ? 'Updated QR Pass' : 'Issued QR Pass',
      'qr',
      'qr_pass',
      clean.id,
      `${clean.holderName} (${clean.token})`,
      `Active: ${clean.active}`,
      clean.departmentId,
    );
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public scanQrToken(
    actor: AdminUser,
    token: string,
    gateLocation: string,
  ): ServiceResult<AttendanceScanRecord> {
    if (!hasPermission(actor, 'qr.scan') && !hasPermission(actor, 'qr.manage')) {
      return { ok: false, error: 'QR scanner permissions required to verify venue credentials.' };
    }
    const timestamp = nowIso();
    const evaluation = evaluateQrScan(
      token,
      this.snapshot.qrPasses,
      this.snapshot.attendanceScans,
      timestamp,
    );

    const record: AttendanceScanRecord = {
      id: makeId('scan'),
      passId: evaluation.pass?.id ?? null,
      tokenScanned: token.trim().toUpperCase() || '(EMPTY)',
      holderName: evaluation.pass?.holderName ?? 'Unrecognized Code',
      departmentId: evaluation.pass?.departmentId ?? null,
      roleLabel: evaluation.pass?.roleLabel ?? 'Unknown',
      result: evaluation.result,
      scannedBy: actor.fullName,
      gateLocation: gateLocation.trim() || 'Main Atrium Gate A',
      scannedAt: timestamp,
    };
    this.snapshot.attendanceScans.unshift(record);

    if (evaluation.result === 'valid_checkin' && evaluation.pass) {
      const passObj = this.snapshot.qrPasses.find((p) => p.id === evaluation.pass!.id);
      if (passObj) {
        passObj.checkedIn = true;
        passObj.lastScannedAt = timestamp;
      }
    }

    this.appendLog(
      actor,
      `QR Scan: ${evaluation.result}`,
      'qr',
      'attendance_scan',
      record.id,
      `${record.holderName} · ${record.gateLocation}`,
      evaluation.message,
      record.departmentId,
    );
    this.persist();
    return {
      ok: evaluation.result === 'valid_checkin',
      data: structuredClone(record),
      error: evaluation.result === 'valid_checkin' ? undefined : evaluation.message,
    };
  }

  // =========================================================
  // WEBSITE CMS: DRAFT -> PREVIEW -> PUBLISH -> ROLLBACK
  // =========================================================

  public updateWebsiteDraft(
    actor: AdminUser,
    updater: (draft: WebsiteContentSnapshot) => WebsiteContentSnapshot,
    summary: string,
  ): ServiceResult<WebsiteContentSnapshot> {
    if (!hasPermission(actor, 'website.edit')) {
      return { ok: false, error: 'Not authorized to edit Website CMS drafts.' };
    }
    // IMPORTANT: Never auto-publish; edits update websiteDraft ONLY.
    this.snapshot.websiteDraft = structuredClone(updater(structuredClone(this.snapshot.websiteDraft)));
    this.appendLog(
      actor,
      'Saved Website Draft',
      'website',
      'website_draft',
      'draft',
      'Public Website Draft',
      summary,
    );
    this.persist();
    return { ok: true, data: structuredClone(this.snapshot.websiteDraft) };
  }

  public publishWebsiteChanges(
    actor: AdminUser,
    summary: string,
  ): ServiceResult<WebsiteVersionRecord> {
    if (!hasPermission(actor, 'website.publish')) {
      return { ok: false, error: 'Not authorized to publish website changes live.' };
    }
    const timestamp = nowIso();
    const nextVersionNumber =
      (this.snapshot.websiteVersions[0]?.versionNumber ?? 0) + 1;
    const liveSnapshot = structuredClone(this.snapshot.websiteDraft);
    this.snapshot.websitePublished = liveSnapshot;

    const versionRecord: WebsiteVersionRecord = {
      id: makeId('ver'),
      versionNumber: nextVersionNumber,
      summary: summary.trim() || `Published editorial update v${nextVersionNumber}`,
      publishedBy: actor.fullName,
      publishedAt: timestamp,
      snapshot: structuredClone(liveSnapshot),
    };
    this.snapshot.websiteVersions.unshift(versionRecord);

    this.appendLog(
      actor,
      `Published Website v${nextVersionNumber}`,
      'website',
      'website_version',
      versionRecord.id,
      `v${nextVersionNumber} Live Release`,
      versionRecord.summary,
    );
    this.persist();
    return { ok: true, data: structuredClone(versionRecord) };
  }

  public restoreWebsiteVersion(
    actor: AdminUser,
    versionId: string,
    publishImmediately = false,
  ): ServiceResult<WebsiteContentSnapshot> {
    if (!hasPermission(actor, 'website.publish')) {
      return { ok: false, error: 'Not authorized to restore Website CMS versions.' };
    }
    const target = this.snapshot.websiteVersions.find((v) => v.id === versionId);
    if (!target) return { ok: false, error: 'Version snapshot not found.' };

    this.snapshot.websiteDraft = structuredClone(target.snapshot);
    if (publishImmediately) {
      this.publishWebsiteChanges(actor, `Restored live site to Version v${target.versionNumber}`);
    } else {
      this.appendLog(
        actor,
        `Restored Draft from v${target.versionNumber}`,
        'website',
        'website_version',
        target.id,
        `Version v${target.versionNumber}`,
        'Loaded historical version into Website Draft for preview before publish.',
      );
      this.persist();
    }
    return { ok: true, data: structuredClone(this.snapshot.websiteDraft) };
  }

  public saveMediaAsset(actor: AdminUser, asset: MediaAssetRecord): ServiceResult<MediaAssetRecord> {
    if (!hasPermission(actor, 'media.manage')) {
      return { ok: false, error: 'Not authorized to manage Media Library.' };
    }
    const clean = {
      ...structuredClone(asset),
      id: asset.id || makeId('med'),
      uploadedAt: asset.uploadedAt || nowIso(),
    };
    const idx = this.snapshot.mediaLibrary.findIndex((m) => m.id === clean.id);
    if (idx >= 0) this.snapshot.mediaLibrary[idx] = clean;
    else this.snapshot.mediaLibrary.unshift(clean);
    this.appendLog(actor, 'Saved Media Asset', 'website', 'media', clean.id, clean.fileName, clean.folder);
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public deleteMediaAsset(actor: AdminUser, assetId: string): ServiceResult<boolean> {
    if (!hasPermission(actor, 'media.manage')) {
      return { ok: false, error: 'Not authorized to delete Media Library items.' };
    }
    const target = this.snapshot.mediaLibrary.find((m) => m.id === assetId);
    if (!target) return { ok: false, error: 'Asset not found.' };
    this.snapshot.mediaLibrary = this.snapshot.mediaLibrary.filter((m) => m.id !== assetId);
    this.appendLog(actor, 'Deleted Media Asset', 'website', 'media', assetId, target.fileName, 'Removed asset.');
    this.persist();
    return { ok: true, data: true };
  }

  // =========================================================
  // COMMUNICATION & INQUIRIES
  // =========================================================

  public saveEmailTemplate(actor: AdminUser, template: EmailTemplate): ServiceResult<EmailTemplate> {
    if (!hasPermission(actor, 'email.send') && !hasPermission(actor, 'email.bulk_send')) {
      return { ok: false, error: 'Not authorized to edit email templates.' };
    }
    const clean = { ...structuredClone(template), updatedAt: nowIso() };
    const idx = this.snapshot.emailTemplates.findIndex((t) => t.id === clean.id);
    if (idx >= 0) this.snapshot.emailTemplates[idx] = clean;
    else this.snapshot.emailTemplates.push(clean);
    this.appendLog(actor, 'Saved Email Template', 'email', 'email_template', clean.id, clean.name, clean.subject);
    this.persist();
    return { ok: true, data: structuredClone(clean) };
  }

  public sendEmails(actor: AdminUser, payload: SendEmailPayload): ServiceResult<SentEmailRecord[]> {
    const isBulk = payload.applicationIds.length > 1;
    if (isBulk && !hasPermission(actor, 'email.bulk_send')) {
      return { ok: false, error: 'Not authorized to send bulk emails.' };
    }
    if (!isBulk && !hasPermission(actor, 'email.send')) {
      return { ok: false, error: 'Not authorized to send emails.' };
    }

    const recipientCount =
      payload.applicationIds.length > 0
        ? payload.applicationIds.length
        : payload.customRecipientEmail
          ? 1
          : 0;
    const validationError = validateEmailDraft(payload.subject, payload.body, recipientCount);
    if (validationError) return { ok: false, error: validationError };

    const timestamp = nowIso();
    const sent: SentEmailRecord[] = [];
    const deptById = new Map(this.snapshot.departments.map((d) => [d.id, d]));

    if (payload.applicationIds.length > 0) {
      for (const appId of payload.applicationIds) {
        const app = this.snapshot.applications.find((a) => a.id === appId);
        if (!app) continue;
        const deptName = deptById.get(app.departmentId)?.name ?? app.departmentId;
        const rec: SentEmailRecord = {
          id: makeId('mail'),
          templateId: payload.templateId,
          recipientEmail: app.email,
          recipientName: app.applicantName,
          applicationId: app.id,
          subject: renderEmailTemplateText(
            payload.subject,
            app,
            deptName,
            this.snapshot.settings.editionYear,
          ),
          body: renderEmailTemplateText(
            payload.body,
            app,
            deptName,
            this.snapshot.settings.editionYear,
          ),
          status: 'sent',
          sentBy: actor.fullName,
          sentAt: timestamp,
        };
        sent.push(rec);
      }
    } else if (payload.customRecipientEmail) {
      sent.push({
        id: makeId('mail'),
        templateId: payload.templateId,
        recipientEmail: payload.customRecipientEmail.trim(),
        recipientName: payload.customRecipientName?.trim() || payload.customRecipientEmail.trim(),
        applicationId: null,
        subject: payload.subject,
        body: payload.body,
        status: 'sent',
        sentBy: actor.fullName,
        sentAt: timestamp,
      });
    }

    this.snapshot.sentEmails = [...sent, ...this.snapshot.sentEmails];
    this.snapshot.emailConnection.dailyQuotaUsed += sent.length;
    this.appendLog(
      actor,
      `Dispatched ${sent.length} Email(s)`,
      'email',
      'email_batch',
      sent[0]?.id ?? 'custom',
      `${sent.length} recipient(s)`,
      `Subject: ${payload.subject}`,
    );
    this.persist();
    return { ok: true, data: structuredClone(sent) };
  }

  public submitPublicInquiry(input: PublicInquiryInput): ServiceResult<InquiryRecord> {
    if (!input.name.trim() || !input.message.trim()) {
      return { ok: false, error: 'Name and message are required.' };
    }
    const timestamp = nowIso();
    const record: InquiryRecord = {
      id: makeId('inq'),
      name: input.name.trim(),
      email: input.email.trim() || 'Anonymous / Not Provided',
      type: input.type,
      message: input.message.trim(),
      status: 'new',
      internalNotes: '',
      submittedAt: timestamp,
      resolvedBy: null,
    };
    this.snapshot.inquiries.unshift(record);
    this.snapshot.notifications.unshift({
      id: makeId('notif'),
      title: `New ${record.type} from ${record.name}`,
      message: record.message.slice(0, 120),
      category: 'system',
      createdAt: timestamp,
      read: false,
      departmentId: null,
    });
    this.persist();
    return { ok: true, data: structuredClone(record) };
  }

  public updateInquiry(
    actor: AdminUser,
    inquiryId: string,
    patch: Partial<InquiryRecord>,
  ): ServiceResult<InquiryRecord> {
    if (!hasPermission(actor, 'inquiries.manage')) {
      return { ok: false, error: 'Not authorized to manage inquiries.' };
    }
    const target = this.snapshot.inquiries.find((i) => i.id === inquiryId);
    if (!target) return { ok: false, error: 'Inquiry not found.' };
    Object.assign(target, patch, {
      id: target.id,
      resolvedBy: patch.status === 'resolved' ? actor.fullName : target.resolvedBy,
    });
    this.appendLog(
      actor,
      `Updated Inquiry (${target.status})`,
      'email',
      'inquiry',
      target.id,
      target.name,
      `Type: ${target.type}`,
    );
    this.persist();
    return { ok: true, data: structuredClone(target) };
  }

  // =========================================================
  // CONFERENCE SETTINGS, MONITORING & SECURITY AUDITS
  // =========================================================

  public updateSettings(
    actor: AdminUser,
    patch: Partial<ConferenceSettings>,
  ): ServiceResult<ConferenceSettings> {
    const regOnly =
      Object.keys(patch).every((k) =>
        ['globalRegistrationOpen', 'registrationWindowStart', 'registrationDeadline', 'maxApplicationsPerApplicant'].includes(
          k,
        ),
      ) && hasPermission(actor, 'registration.manage');

    if (!hasPermission(actor, 'system.settings') && !regOnly) {
      return { ok: false, error: 'Not authorized to update conference settings.' };
    }
    this.snapshot.settings = { ...this.snapshot.settings, ...patch };
    this.appendLog(
      actor,
      regOnly ? 'Updated Registration Controls' : 'Updated Conference Settings',
      regOnly ? 'registration' : 'system',
      'settings',
      'conference',
      'Conference Configuration',
      `Modified ${Object.keys(patch).join(', ')}.`,
    );
    this.persist();
    return { ok: true, data: structuredClone(this.snapshot.settings) };
  }

  public resolveErrorLog(actor: AdminUser, errorId: string): ServiceResult<SystemErrorLog> {
    if (!hasPermission(actor, 'system.monitoring')) {
      return { ok: false, error: 'Not authorized to manage system monitoring alerts.' };
    }
    const err = this.snapshot.errorLogs.find((e) => e.id === errorId);
    if (!err) return { ok: false, error: 'Error log entry not found.' };
    err.resolved = !err.resolved;
    this.appendLog(
      actor,
      err.resolved ? 'Resolved System Error Alert' : 'Reopened System Error Alert',
      'system',
      'error_log',
      err.id,
      err.code,
      err.message,
    );
    this.persist();
    return { ok: true, data: structuredClone(err) };
  }

  public updateTechnicalConfig(
    actor: AdminUser,
    patch: Partial<TechnicalConfig>,
  ): ServiceResult<TechnicalConfig> {
    if (!hasPermission(actor, 'system.monitoring')) {
      return { ok: false, error: 'Not authorized to update technical monitoring parameters.' };
    }
    this.snapshot.technicalConfig = { ...this.snapshot.technicalConfig, ...patch };
    this.appendLog(
      actor,
      'Updated System Parameters',
      'system',
      'technical_config',
      'global',
      'System Parameters',
      `Updated ${Object.keys(patch).join(', ')}.`,
    );
    this.persist();
    return { ok: true, data: structuredClone(this.snapshot.technicalConfig) };
  }

  public runHealthChecks(actor: AdminUser): ServiceResult<SystemServiceCheck[]> {
    if (!hasPermission(actor, 'system.monitoring')) {
      return { ok: false, error: 'Not authorized to run health checks.' };
    }
    const ts = nowIso();
    this.snapshot.serviceChecks = this.snapshot.serviceChecks.map((s) => ({
      ...s,
      latencyMs: Math.max(8, Math.round(s.latencyMs * 0.9 + Math.random() * 14)),
      lastCheckedAt: ts,
    }));
    this.appendLog(
      actor,
      'Executed Service Health Verification',
      'system',
      'health_checks',
      'all',
      'Platform Services',
      'All core endpoints returned operational status.',
    );
    this.persist();
    return { ok: true, data: structuredClone(this.snapshot.serviceChecks) };
  }

  public markAllNotificationsRead(): AdminNotification[] {
    this.snapshot.notifications = this.snapshot.notifications.map((n) => ({ ...n, read: true }));
    this.persist();
    return structuredClone(this.snapshot.notifications);
  }

  public recordSecurityAttempt(
    actor: AdminUser,
    targetType: string,
    targetId: string,
    details: string,
  ): ActivityLogEntry {
    const entry = this.appendLog(
      actor,
      'Access Control Blocked Attempt',
      'security',
      targetType,
      targetId,
      targetId,
      details,
      actor.departmentId,
    );
    this.persist();
    return structuredClone(entry);
  }
}

export const conferenceDataService: IConferenceAdminRepository =
  new MockConferenceAdminService();
