import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  ConferenceDataSnapshot,
  CreateAccountInput,
  CreateDepartmentInput,
  PublicInquiryInput,
  SendEmailPayload,
  ServiceResult,
  UpdateAccountInput,
} from '../services/interfaces';
import { conferenceDataService } from '../services/mockDataService';
import { supabase } from '../lib/supabase';
import { DEPARTMENT_HEAD_DEFAULT_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from '../utils/adminPermissions';
import membersJson from '../data/members.json';
import type {
  AdminNotification,
  AdminUser,
  AnnouncementRecord,
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
  ShiftRecord,
  SponsorRecord,
  TeamGroupRecord,
  TechnicalConfig,
  ToastMessage,
  WebsiteContentSnapshot,
  WorkspaceRecord,
} from '../types/admin';

const TEST_HEAD_STORAGE_KEY = 'willow_mun_test_head_uid_v3';
const TEST_HEAD_PROFILE_STORAGE_KEY = 'willow_mun_test_head_profile_v1';
const TEST_EB_PROFILE_STORAGE_KEY = 'willow_mun_test_eb_profile_v1';

interface AdminStoreContextValue {
  data: ConferenceDataSnapshot;
  currentUser: AdminUser | null;
  authReady: boolean;
  testModeHeadUser: AdminUser | null;
  testModeExecutiveBoardUser: AdminUser | null;
  toasts: ToastMessage[];
  notifications: AdminNotification[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  signInWithCredentials: (
    email: string,
    password: string,
    expectedPortal?: PortalKey,
  ) => Promise<ServiceResult<AdminUser>>;
  signInAsDemoUser: (userId: string) => ServiceResult<AdminUser>;
  signOut: () => void;
  enterDepartmentTestMode: (headUserId: string) => boolean;
  exitDepartmentTestMode: () => void;
  resetDemoData: () => void;
  refreshSnapshot: () => void;

  // Applications & Forms
  updateApplicationStatus: (
    applicationId: string,
    status: ApplicationStatus,
    decisionNotes?: string,
  ) => boolean;
  submitHeadRecommendation: (
    applicationId: string,
    recommendation: RecommendationDecision,
    notes: string,
  ) => boolean;
  bulkUpdateApplicationStatus: (applicationIds: string[], status: ApplicationStatus) => boolean;
  bulkApproveRecommended: (departmentId?: string) => boolean;
  addApplicationNote: (applicationId: string, content: string) => boolean;
  generateSignupLink: (applicationId: string) => boolean;
  bulkGenerateSignupLinks: (applicationIds: string[]) => boolean;
  revokeSignupLink: (applicationId: string) => boolean;
  saveApplicationForm: (form: ApplicationFormDefinition) => boolean;
  deleteApplicationForm: (formId: string) => boolean;

  // Departments & Operations
  createDepartment: (input: CreateDepartmentInput) => boolean;
  updateDepartment: (departmentId: string, patch: Partial<Department>) => boolean;
  assignDepartmentHead: (departmentId: string, headUserId: string, assigned: boolean) => boolean;
  saveWorkspaceRecord: (record: WorkspaceRecord) => boolean;
  deleteWorkspaceRecord: (recordId: string) => boolean;
  saveTeamGroup: (group: TeamGroupRecord) => boolean;
  deleteTeamGroup: (groupId: string) => boolean;
  saveShift: (shift: ShiftRecord) => boolean;
  deleteShift: (shiftId: string) => boolean;
  saveQrPass: (pass: QrPassRecord) => boolean;
  scanQrToken: (token: string, gateLocation: string) => ServiceResult<AttendanceScanRecord>;

  // Super Admin Accounts & Roles
  createAccount: (input: CreateAccountInput) => boolean;
  updateAccount: (userId: string, patch: UpdateAccountInput) => boolean;
  suspendAccount: (userId: string) => boolean;
  reactivateAccount: (userId: string) => boolean;
  resetAccountPassword: (userId: string, newPassword: string) => boolean;
  manageAccountInvitation: (userId: string, action: 'generate' | 'revoke') => boolean;
  deleteAccount: (userId: string) => boolean;
  retryDepartmentAssignment: (userId: string, departmentId: string) => boolean;
  saveRoleDefinition: (role: RoleDefinition) => boolean;
  deleteRoleDefinition: (roleId: string) => boolean;
  updatePermissionDefinition: (key: PermissionKey, patch: Partial<PermissionDefinition>) => boolean;

  // Conference Content CMS
  saveCommittee: (item: CommitteeRecord) => boolean;
  deleteCommittee: (committeeId: string) => boolean;
  saveSecretariatMember: (member: SecretariatMember) => boolean;
  deleteSecretariatMember: (memberId: string) => boolean;
  saveExecutiveBoardMember: (member: ExecutiveBoardMember) => boolean;
  deleteExecutiveBoardMember: (memberId: string) => boolean;
  saveSponsor: (sponsor: SponsorRecord) => boolean;
  deleteSponsor: (sponsorId: string) => boolean;
  saveAnnouncement: (announcement: AnnouncementRecord) => boolean;
  deleteAnnouncement: (announcementId: string) => boolean;
  saveScheduleEvent: (event: ScheduleEventRecord) => boolean;
  deleteScheduleEvent: (eventId: string) => boolean;
  saveConferenceDocument: (doc: ConferenceDocumentRecord) => boolean;
  deleteConferenceDocument: (docId: string) => boolean;
  saveFaq: (faq: FaqRecord) => boolean;
  deleteFaq: (faqId: string) => boolean;
  saveGalleryItem: (item: GalleryItemRecord) => boolean;
  deleteGalleryItem: (itemId: string) => boolean;

  // Website CMS & Media Library
  updateWebsiteDraft: (
    updater: (draft: WebsiteContentSnapshot) => WebsiteContentSnapshot,
    summary: string,
  ) => boolean;
  publishWebsiteChanges: (summary: string) => boolean;
  restoreWebsiteVersion: (versionId: string, publishImmediately?: boolean) => boolean;
  saveMediaAsset: (asset: MediaAssetRecord) => boolean;
  deleteMediaAsset: (assetId: string) => boolean;

  // Communication, Inquiries, Settings & Monitoring
  saveEmailTemplate: (template: EmailTemplate) => boolean;
  sendEmails: (payload: SendEmailPayload) => boolean;
  submitPublicInquiry: (input: PublicInquiryInput) => boolean;
  updateInquiry: (inquiryId: string, patch: Partial<InquiryRecord>) => boolean;
  updateSettings: (patch: Partial<ConferenceSettings>) => boolean;
  resolveErrorLog: (errorId: string) => boolean;
  updateTechnicalConfig: (patch: Partial<TechnicalConfig>) => boolean;
  runHealthChecks: () => boolean;
  markNotificationsRead: () => void;
  recordSecurityViolation: (targetType: string, targetId: string, details: string) => void;
}

const AdminStoreContext = createContext<AdminStoreContextValue | null>(null);

export function AdminStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ConferenceDataSnapshot>(() =>
    conferenceDataService.getSnapshot(),
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [testModeHeadUserId, setTestModeHeadUserId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const queryHeadId = params.get('testHead');
      if (queryHeadId) {
        window.sessionStorage.setItem(TEST_HEAD_STORAGE_KEY, queryHeadId);
        return queryHeadId;
      }
      return window.sessionStorage.getItem(TEST_HEAD_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [testModeEbProfile] = useState<{
    fullName: string; email: string; title: string; departmentId: string;
    ebRank: string; ebPermissions: Record<string, boolean>; avatarUrl?: string | null;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(window.sessionStorage.getItem(TEST_EB_PROFILE_STORAGE_KEY) || 'null');
    } catch {
      return null;
    }
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const authenticatedUser = useMemo(() => {
    if (!currentUserId) return null;
    const found = data.users.find((u) => u.id === currentUserId);
    return found && found.isActive && found.status === 'active' ? found : null;
  }, [currentUserId, data.users]);

  // A test tab presents the selected head as the active actor throughout the UI.
  // The underlying Supabase session remains the authenticated Super Admin session.
  const testModeHeadUser = useMemo(() => {
    if (!authenticatedUser || authenticatedUser.role !== 'super_admin' || !testModeHeadUserId) return null;
    const provisioned = data.users.find((u) => u.id === testModeHeadUserId && u.role === 'department_head' && u.isActive && u.status === 'active');
    if (provisioned) return provisioned;

    // The profile payload lets the testing page preview live directory accounts
    // even when their auth profile is not part of the local mock snapshot.
    let profile: { id?: string; fullName?: string; email?: string; title?: string; departmentId?: string | null } | null = null;
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const queryProfile = params.get('testProfile');
        profile = queryProfile
          ? JSON.parse(queryProfile)
          : JSON.parse(window.sessionStorage.getItem(TEST_HEAD_PROFILE_STORAGE_KEY) || 'null');
        if (queryProfile) window.sessionStorage.setItem(TEST_HEAD_PROFILE_STORAGE_KEY, queryProfile);
      } else {
        profile = null;
      }
    } catch {
      profile = null;
    }

    let member: (typeof membersJson.members)[number] | undefined;
    if (testModeHeadUserId.startsWith('roster:')) {
      const rosterId = testModeHeadUserId.slice('roster:'.length);
      member = membersJson.members.find((entry) => entry.id === rosterId);
    }
    const departmentByGroup: Record<string, string> = {
      media: 'media-press', press: 'media-press', marketing: 'marketing', design: 'design',
      security: 'security', it: 'it', hr: 'hr', 'delegate-affairs': 'dcc', volunteers: 'volunteers',
    };
    const departmentKey = member ? departmentByGroup[member.group] : null;
    const requestedDepartment = profile?.departmentId || departmentKey;
    const departmentId = requestedDepartment
      ? data.departments.find((item) => item.id === requestedDepartment || item.slug === requestedDepartment)?.id ?? null
      : null;
    const template = data.users.find((user) => user.role === 'department_head') ?? data.users[0];
    if (!template || !departmentId) return null;
    if (member && (!member.role || !/\bhead\b/i.test(member.role))) return null;

    return {
      ...template,
      id: profile?.id || testModeHeadUserId,
      fullName: profile?.fullName || member?.name || 'Department Head Preview',
      email: profile?.email || '',
      password: undefined,
      role: 'department_head',
      roleDefinitionId: 'department_head',
      title: profile?.title || member?.role || 'Department Head',
      departmentId,
      division: null,
      avatarUrl: null,
      isActive: true,
      status: 'active',
      invitationStatus: 'none',
      invitationToken: null,
      lastPasswordResetAt: null,
      permissions: DEPARTMENT_HEAD_DEFAULT_PERMISSIONS,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
  }, [authenticatedUser, data.departments, data.users, testModeHeadUserId]);

  const testModeExecutiveBoardUser = useMemo(() => {
    if (!authenticatedUser || authenticatedUser.role !== 'super_admin' || !testModeEbProfile) return null;
    const template = data.users.find((user) => user.role === 'executive_board') ?? data.users[0];
    if (!template || !testModeEbProfile.departmentId) return null;
    return {
      ...template,
      // Keep the real Super Admin auth UUID so database reads work in preview.
      // This is UI impersonation only; Supabase still authenticates the Super Admin.
      id: authenticatedUser.id,
      fullName: testModeEbProfile.fullName,
      email: testModeEbProfile.email,
      role: 'executive_board',
      roleDefinitionId: 'executive_board',
      title: testModeEbProfile.title,
      departmentId: testModeEbProfile.departmentId,
      avatarUrl: testModeEbProfile.avatarUrl || null,
      isActive: true,
      status: 'active',
      ebRank: testModeEbProfile.ebRank || 'member',
      ebPermissions: testModeEbProfile.ebPermissions || {},
      permissions: template.permissions,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
  }, [authenticatedUser, data.users, testModeEbProfile]);

  const currentUser = testModeHeadUser ?? testModeExecutiveBoardUser ?? authenticatedUser;

  const currentUserRef = useRef<AdminUser | null>(currentUser);
  currentUserRef.current = currentUser;


  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (testModeHeadUserId) window.sessionStorage.setItem(TEST_HEAD_STORAGE_KEY, testModeHeadUserId);
      else window.sessionStorage.removeItem(TEST_HEAD_STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
  }, [testModeHeadUserId]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      window.setTimeout(() => dismissToast(id), 4200);
    },
    [dismissToast],
  );

  const refreshSnapshot = useCallback(() => {
    setData((previous) => ({
      ...conferenceDataService.getSnapshot(),
      users: previous.users,
      departments: previous.departments,
    }));
  }, []);

  const loadLiveDepartments = useCallback(async (): Promise<Department[]> => {
    const { data: rows, error } = await supabase.from('wm_departments')
      .select('id,slug,name,description,cluster,registration_open,capacity,positions,instructions,updated_at')
      .order('name');
    if (error) throw error;
    return (rows ?? []).map((row: any) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description ?? '',
      cluster: row.cluster as Department['cluster'],
      headUserIds: [],
      registrationOpen: row.registration_open === true,
      capacity: row.capacity ?? 0,
      positions: Array.isArray(row.positions) ? row.positions : [],
      instructions: row.instructions ?? '',
      updatedAt: row.updated_at,
    }));
  }, []);

  const userFromProfile = useCallback((profile: any, authUser: any): AdminUser => {
    const role = profile.role as AdminUser['role'];
    const snapshot = conferenceDataService.getSnapshot();
    const template = snapshot.users.find((u) => u.role === role) ?? snapshot.users[0];
    return {
      ...template,
      id: authUser.id,
      fullName: profile.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Willow Staff',
      email: authUser.email ?? '',
      password: undefined,
      role,
      roleDefinitionId: role,
      title: profile.title || (role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Administrator' : role === 'executive_board' ? 'Executive Board' : 'Department Head'),
      departmentId: profile.department_id ?? null,
      division: profile.division ?? null,
      avatarUrl: profile.avatar_url ?? null,
      isActive: profile.is_active === true,
      status: profile.is_active === true ? 'active' : 'suspended',
      invitationStatus: 'accepted',
      invitationToken: null,
      lastPasswordResetAt: null,
      permissions: ROLE_DEFAULT_PERMISSIONS[role],
      ebPermissions: profile.eb_permissions ?? {},
      ebRank: profile.eb_rank ?? 'member',
      createdAt: authUser.created_at ?? new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
  }, []);

  const loadAuthenticatedUser = useCallback(async (authUser: any) => {
    if (!authUser) { setCurrentUserId(null); setAuthReady(true); return; }
    const { data: profile, error } = await supabase.from('wm_profiles')
      .select('user_id, full_name, role, department_id, is_active, title, division, avatar_url, eb_permissions, eb_rank')
      .eq('user_id', authUser.id).maybeSingle();
    if (error || !profile || profile.is_active !== true) {
      setCurrentUserId(null); setAuthReady(true); await supabase.auth.signOut(); return;
    }
    const user = userFromProfile(profile, authUser);
    try {
      const departments = await loadLiveDepartments();
      setData((prev) => ({ ...prev, users: [...prev.users.filter((u) => u.id !== user.id), user], departments }));
    } catch (departmentError) {
      console.error('Could not load Willow departments:', departmentError);
      setData((prev) => ({ ...prev, users: [...prev.users.filter((u) => u.id !== user.id), user] }));
    }
    setCurrentUserId(user.id); setAuthReady(true);
  }, [userFromProfile, loadLiveDepartments]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) window.setTimeout(() => { if (active) void loadAuthenticatedUser(session?.user ?? null); }, 0);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) window.setTimeout(() => { if (active) void loadAuthenticatedUser(session?.user ?? null); }, 0);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [loadAuthenticatedUser]);

  const signInWithCredentials = useCallback(
    async (email: string, password: string, expectedPortal?: PortalKey): Promise<ServiceResult<AdminUser>> => {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (authError || !authData.user) return { ok: false, error: authError?.message ?? 'Sign in failed.' };
      const { data: profile, error: profileError } = await supabase.from('wm_profiles')
        .select('user_id, full_name, role, department_id, is_active, title, division, avatar_url, eb_permissions, eb_rank')
        .eq('user_id', authData.user.id).maybeSingle();
      if (profileError || !profile || profile.is_active !== true) {
        await supabase.auth.signOut();
        return { ok: false, error: 'Your account is not provisioned or has been disabled. Contact the Super Admin.' };
      }
      const user = userFromProfile(profile, authData.user);
      if (expectedPortal && expectedPortal !== 'admin' && user.role !== expectedPortal) {
        await supabase.auth.signOut(); return { ok: false, error: 'This account does not have access to the selected portal.' };
      }
      if (expectedPortal === 'admin' && user.role !== 'admin' && user.role !== 'super_admin') {
        await supabase.auth.signOut(); return { ok: false, error: 'This account does not have access to the Admin portal.' };
      }
      const departments = await loadLiveDepartments();
      setData((prev) => ({ ...prev, users: [...prev.users.filter((u) => u.id !== user.id), user], departments }));
      setCurrentUserId(user.id); setTestModeHeadUserId(null); setAuthReady(true);
      pushToast({ tone: 'success', title: `Signed in as ${user.fullName}`, description: user.title });
      return { ok: true, data: user };
    }, [pushToast, userFromProfile, loadLiveDepartments],
  );

  const signInAsDemoUser = useCallback(
    (userId: string): ServiceResult<AdminUser> => {
      const res = conferenceDataService.signInDemoUser(userId);
      if (!res.ok || !res.data) {
        pushToast({ tone: 'error', title: res.error ?? 'Could not sign in.' });
        return { ok: false, error: res.error };
      }
      setCurrentUserId(res.data.user.id);
      setTestModeHeadUserId(null);
      refreshSnapshot();
      pushToast({
        tone: 'success',
        title: `Signed in as ${res.data.user.fullName}`,
        description: res.data.user.title,
      });
      return { ok: true, data: res.data.user };
    },
    [pushToast, refreshSnapshot],
  );

  const signOut = useCallback(() => {
    if (testModeHeadUser || testModeExecutiveBoardUser) {
      try {
        window.sessionStorage.removeItem(TEST_HEAD_STORAGE_KEY);
        window.sessionStorage.removeItem(TEST_HEAD_PROFILE_STORAGE_KEY);
        window.sessionStorage.removeItem(TEST_EB_PROFILE_STORAGE_KEY);
      } catch { /* Ignore storage errors */ }
      window.location.replace('/super-admin');
      return;
    }
    void supabase.auth.signOut();
    setCurrentUserId(null);
    setTestModeHeadUserId(null);
    pushToast({ tone: 'info', title: 'Signed out of Willow MUN administration' });
  }, [pushToast, testModeHeadUser, testModeExecutiveBoardUser]);

  const enterDepartmentTestMode = useCallback(
    (headUserId: string) => {
      if (!currentUser || currentUser.role !== 'super_admin') return false;
      const target = data.users.find((u) => u.id === headUserId && u.role === 'department_head');
      const rosterId = headUserId.startsWith('roster:') ? headUserId.slice('roster:'.length) : '';
      const member = rosterId ? membersJson.members.find((entry) => entry.id === rosterId) : null;
      if (!target && (!member || !member.role || !/\bhead\b/i.test(member.role))) {
        pushToast({ tone: 'error', title: 'Department Head preview could not be found' });
        return false;
      }
      const targetName = target?.fullName ?? member?.name ?? 'Department Head';
      const targetTitle = target?.title ?? member?.role ?? 'Department Head';
      setTestModeHeadUserId(headUserId);
      pushToast({
        tone: 'info',
        title: `Testing Mode Active: ${targetName}`,
        description: `Previewing /head as ${targetTitle}. This is a simulated preview, not a separate Supabase login.`,
      });
      return true;
    },
    [currentUser, data.users, pushToast],
  );

  const exitDepartmentTestMode = useCallback(() => {
    setTestModeHeadUserId(null);
    pushToast({ tone: 'info', title: 'Exited Department Access Testing Mode' });
  }, [pushToast]);

  const resetDemoData = useCallback(() => {
    const fresh = conferenceDataService.resetDemoData();
    setData((previous) => ({ ...fresh, users: previous.users, departments: previous.departments }));
    setTestModeHeadUserId(null);
    pushToast({ tone: 'info', title: 'Local workspace reset to a clean baseline' });
  }, [pushToast]);

  const handleResult = useCallback(
    <T,>(res: ServiceResult<T>, successTitle: string, successDesc?: string): boolean => {
      if (!res.ok) {
        refreshSnapshot();
        pushToast({ tone: 'error', title: 'Action blocked', description: res.error });
        return false;
      }
      refreshSnapshot();
      if (res.warning) {
        pushToast({ tone: 'warning', title: successTitle, description: res.warning });
      } else {
        pushToast({ tone: 'success', title: successTitle, description: successDesc });
      }
      return true;
    },
    [pushToast, refreshSnapshot],
  );

  // =========================================================
  // MUTATION WRAPPERS
  // =========================================================

  const updateApplicationStatus = useCallback(
    (applicationId: string, status: ApplicationStatus, decisionNotes?: string) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.updateApplicationStatus(currentUser, applicationId, status, decisionNotes),
        'Final decision recorded',
      );
    },
    [currentUser, handleResult],
  );

  const submitHeadRecommendation = useCallback(
    (applicationId: string, recommendation: RecommendationDecision, notes: string) => {
      if (!currentUser) return false;
      const actingActor = testModeHeadUser ?? currentUser;
      return handleResult(
        conferenceDataService.submitHeadRecommendation(actingActor, applicationId, recommendation, notes),
        'Stage 1 recommendation saved',
        'Queued for Stage 2 Admin confirmation.',
      );
    },
    [currentUser, testModeHeadUser, handleResult],
  );

  const bulkUpdateApplicationStatus = useCallback(
    (applicationIds: string[], status: ApplicationStatus) => {
      if (!currentUser) return false;
      const res = conferenceDataService.bulkUpdateApplicationStatus(currentUser, applicationIds, status);
      return handleResult(res, `Updated ${res.data?.length ?? 0} applications`);
    },
    [currentUser, handleResult],
  );

  const bulkApproveRecommended = useCallback(
    (departmentId?: string) => {
      if (!currentUser) return false;
      const res = conferenceDataService.bulkApproveRecommended(currentUser, departmentId);
      return handleResult(
        res,
        `Approved ${res.data?.length ?? 0} recommended applicant(s)`,
      );
    },
    [currentUser, handleResult],
  );

  const addApplicationNote = useCallback(
    (applicationId: string, content: string) => {
      if (!currentUser) return false;
      const actingActor = testModeHeadUser ?? currentUser;
      return handleResult(
        conferenceDataService.addApplicationNote(actingActor, applicationId, content),
        'Evaluation note saved',
      );
    },
    [currentUser, testModeHeadUser, handleResult],
  );

  const generateSignupLink = useCallback(
    (applicationId: string) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.generateSignupLink(currentUser, applicationId),
        'Signup link generated',
      );
    },
    [currentUser, handleResult],
  );

  const bulkGenerateSignupLinks = useCallback(
    (applicationIds: string[]) => {
      if (!currentUser) return false;
      const res = conferenceDataService.bulkGenerateSignupLinks(currentUser, applicationIds);
      return handleResult(res, `Generated ${res.data?.length ?? 0} signup link(s)`);
    },
    [currentUser, handleResult],
  );

  const revokeSignupLink = useCallback(
    (applicationId: string) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.revokeSignupLink(currentUser, applicationId),
        'Signup link revoked',
      );
    },
    [currentUser, handleResult],
  );

  const saveApplicationForm = useCallback(
    (form: ApplicationFormDefinition) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.saveApplicationForm(currentUser, form),
        'Application form saved',
        'Historical answers remain untouched.',
      );
    },
    [currentUser, handleResult],
  );

  const deleteApplicationForm = useCallback(
    (formId: string) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.deleteApplicationForm(currentUser, formId),
        'Application form deleted',
      );
    },
    [currentUser, handleResult],
  );

  const createDepartment = useCallback(
    (input: CreateDepartmentInput) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.createDepartment(currentUser, input), 'Department created');
    },
    [currentUser, handleResult],
  );

  const updateDepartment = useCallback(
    (departmentId: string, patch: Partial<Department>) => {
      if (!currentUser) return false;
      const actingActor = testModeHeadUser ?? currentUser;
      return handleResult(
        conferenceDataService.updateDepartment(actingActor, departmentId, patch),
        'Department updated',
      );
    },
    [currentUser, testModeHeadUser, handleResult],
  );

  const assignDepartmentHead = useCallback(
    (departmentId: string, headUserId: string, assigned: boolean) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.assignDepartmentHead(currentUser, departmentId, headUserId, assigned),
        assigned ? 'Department Head assigned' : 'Department Head removed',
      );
    },
    [currentUser, handleResult],
  );

  const saveWorkspaceRecord = useCallback(
    (record: WorkspaceRecord) => {
      if (!currentUser) return false;
      const actingActor = testModeHeadUser ?? currentUser;
      return handleResult(
        conferenceDataService.saveWorkspaceRecord(actingActor, record),
        'Workspace item saved',
      );
    },
    [currentUser, testModeHeadUser, handleResult],
  );

  const deleteWorkspaceRecord = useCallback(
    (recordId: string) => {
      if (!currentUser) return false;
      const actingActor = testModeHeadUser ?? currentUser;
      return handleResult(
        conferenceDataService.deleteWorkspaceRecord(actingActor, recordId),
        'Workspace item removed',
      );
    },
    [currentUser, testModeHeadUser, handleResult],
  );

  const saveTeamGroup = useCallback(
    (group: TeamGroupRecord) => {
      if (!currentUser) return false;
      const actingActor = testModeHeadUser ?? currentUser;
      return handleResult(conferenceDataService.saveTeamGroup(actingActor, group), 'Team group saved');
    },
    [currentUser, testModeHeadUser, handleResult],
  );

  const deleteTeamGroup = useCallback(
    (groupId: string) => {
      if (!currentUser) return false;
      const actingActor = testModeHeadUser ?? currentUser;
      return handleResult(conferenceDataService.deleteTeamGroup(actingActor, groupId), 'Team group deleted');
    },
    [currentUser, testModeHeadUser, handleResult],
  );

  const saveShift = useCallback(
    (shift: ShiftRecord) => {
      if (!currentUser) return false;
      const actingActor = testModeHeadUser ?? currentUser;
      return handleResult(conferenceDataService.saveShift(actingActor, shift), 'Shift & deployment saved');
    },
    [currentUser, testModeHeadUser, handleResult],
  );

  const deleteShift = useCallback(
    (shiftId: string) => {
      if (!currentUser) return false;
      const actingActor = testModeHeadUser ?? currentUser;
      return handleResult(conferenceDataService.deleteShift(actingActor, shiftId), 'Shift deleted');
    },
    [currentUser, testModeHeadUser, handleResult],
  );

  const saveQrPass = useCallback(
    (pass: QrPassRecord) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.saveQrPass(currentUser, pass), 'QR pass saved');
    },
    [currentUser, handleResult],
  );

  const scanQrToken = useCallback(
    (token: string, gateLocation: string): ServiceResult<AttendanceScanRecord> => {
      if (!currentUser) return { ok: false, error: 'Not authenticated.' };
      const actingActor = testModeHeadUser ?? currentUser;
      const res = conferenceDataService.scanQrToken(actingActor, token, gateLocation);
      refreshSnapshot();
      pushToast({
        tone: res.ok ? 'success' : res.data?.result === 'duplicate_recent' ? 'warning' : 'error',
        title: res.ok ? 'Valid Check-In Recorded' : 'Scan Attention',
        description: res.error ?? `${res.data?.holderName} checked in.`,
      });
      return res;
    },
    [currentUser, testModeHeadUser, pushToast, refreshSnapshot],
  );

  // Super Admin Account & Role Management
  const createAccount = useCallback(
    (input: CreateAccountInput) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.createAccount(currentUser, input), 'Account created');
    },
    [currentUser, handleResult],
  );

  const updateAccount = useCallback(
    (userId: string, patch: UpdateAccountInput) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.updateAccount(currentUser, userId, patch), 'Account updated');
    },
    [currentUser, handleResult],
  );

  const suspendAccount = useCallback(
    (userId: string) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.suspendAccount(currentUser, userId), 'Account suspended');
    },
    [currentUser, handleResult],
  );

  const reactivateAccount = useCallback(
    (userId: string) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.reactivateAccount(currentUser, userId), 'Account reactivated');
    },
    [currentUser, handleResult],
  );

  const resetAccountPassword = useCallback(
    (userId: string, newPassword: string) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.resetAccountPassword(currentUser, userId, newPassword),
        'Temporary password set',
      );
    },
    [currentUser, handleResult],
  );

  const manageAccountInvitation = useCallback(
    (userId: string, action: 'generate' | 'revoke') => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.manageAccountInvitation(currentUser, userId, action),
        action === 'generate' ? 'Invitation token generated' : 'Invitation revoked',
      );
    },
    [currentUser, handleResult],
  );

  const deleteAccount = useCallback(
    (userId: string) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.deleteAccount(currentUser, userId), 'Account deleted');
    },
    [currentUser, handleResult],
  );

  const retryDepartmentAssignment = useCallback(
    (userId: string, departmentId: string) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.retryDepartmentAssignment(currentUser, userId, departmentId),
        'Department link completed',
      );
    },
    [currentUser, handleResult],
  );

  const saveRoleDefinition = useCallback(
    (role: RoleDefinition) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.saveRoleDefinition(currentUser, role), 'Role definition saved');
    },
    [currentUser, handleResult],
  );

  const deleteRoleDefinition = useCallback(
    (roleId: string) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.deleteRoleDefinition(currentUser, roleId), 'Role deleted');
    },
    [currentUser, handleResult],
  );

  const updatePermissionDefinition = useCallback(
    (key: PermissionKey, patch: Partial<PermissionDefinition>) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.updatePermissionDefinition(currentUser, key, patch),
        'Permission rule updated',
      );
    },
    [currentUser, handleResult],
  );

  // Conference CMS
  const saveCommittee = useCallback(
    (item: CommitteeRecord) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.saveCommittee(currentUser, item), 'Committee saved');
    },
    [currentUser, handleResult],
  );

  const deleteCommittee = useCallback(
    (committeeId: string) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.deleteCommittee(currentUser, committeeId), 'Committee removed');
    },
    [currentUser, handleResult],
  );

  const saveSecretariatMember = useCallback(
    (member: SecretariatMember) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.saveSecretariatMember(currentUser, member),
        'Secretariat member saved',
      );
    },
    [currentUser, handleResult],
  );

  const deleteSecretariatMember = useCallback(
    (memberId: string) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.deleteSecretariatMember(currentUser, memberId),
        'Secretariat member removed',
      );
    },
    [currentUser, handleResult],
  );

  const saveExecutiveBoardMember = useCallback(
    (member: ExecutiveBoardMember) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.saveExecutiveBoardMember(currentUser, member),
        'Executive Board member saved',
      );
    },
    [currentUser, handleResult],
  );

  const deleteExecutiveBoardMember = useCallback(
    (memberId: string) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.deleteExecutiveBoardMember(currentUser, memberId),
        'Executive Board member removed',
      );
    },
    [currentUser, handleResult],
  );

  const saveSponsor = useCallback(
    (sponsor: SponsorRecord) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.saveSponsor(currentUser, sponsor), 'Sponsor saved');
    },
    [currentUser, handleResult],
  );

  const deleteSponsor = useCallback(
    (sponsorId: string) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.deleteSponsor(currentUser, sponsorId), 'Sponsor deleted');
    },
    [currentUser, handleResult],
  );

  const saveAnnouncement = useCallback(
    (announcement: AnnouncementRecord) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.saveAnnouncement(currentUser, announcement),
        'Announcement saved',
      );
    },
    [currentUser, handleResult],
  );

  const deleteAnnouncement = useCallback(
    (announcementId: string) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.deleteAnnouncement(currentUser, announcementId),
        'Announcement deleted',
      );
    },
    [currentUser, handleResult],
  );

  const saveScheduleEvent = useCallback(
    (event: ScheduleEventRecord) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.saveScheduleEvent(currentUser, event), 'Schedule event saved');
    },
    [currentUser, handleResult],
  );

  const deleteScheduleEvent = useCallback(
    (eventId: string) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.deleteScheduleEvent(currentUser, eventId), 'Event deleted');
    },
    [currentUser, handleResult],
  );

  const saveConferenceDocument = useCallback(
    (doc: ConferenceDocumentRecord) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.saveConferenceDocument(currentUser, doc), 'Document saved');
    },
    [currentUser, handleResult],
  );

  const deleteConferenceDocument = useCallback(
    (docId: string) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.deleteConferenceDocument(currentUser, docId), 'Document deleted');
    },
    [currentUser, handleResult],
  );

  const saveFaq = useCallback(
    (faq: FaqRecord) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.saveFaq(currentUser, faq), 'FAQ item saved');
    },
    [currentUser, handleResult],
  );

  const deleteFaq = useCallback(
    (faqId: string) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.deleteFaq(currentUser, faqId), 'FAQ deleted');
    },
    [currentUser, handleResult],
  );

  const saveGalleryItem = useCallback(
    (item: GalleryItemRecord) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.saveGalleryItem(currentUser, item), 'Gallery item saved');
    },
    [currentUser, handleResult],
  );

  const deleteGalleryItem = useCallback(
    (itemId: string) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.deleteGalleryItem(currentUser, itemId), 'Gallery item deleted');
    },
    [currentUser, handleResult],
  );

  // Website CMS
  const updateWebsiteDraft = useCallback(
    (updater: (draft: WebsiteContentSnapshot) => WebsiteContentSnapshot, summary: string) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.updateWebsiteDraft(currentUser, updater, summary),
        'Saved to Website Draft',
        'Preview changes before publishing live.',
      );
    },
    [currentUser, handleResult],
  );

  const publishWebsiteChanges = useCallback(
    (summary: string) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.publishWebsiteChanges(currentUser, summary),
        'Website changes published live',
      );
    },
    [currentUser, handleResult],
  );

  const restoreWebsiteVersion = useCallback(
    (versionId: string, publishImmediately = false) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.restoreWebsiteVersion(currentUser, versionId, publishImmediately),
        publishImmediately ? 'Version restored & published live' : 'Version loaded into Website Draft',
      );
    },
    [currentUser, handleResult],
  );

  const saveMediaAsset = useCallback(
    (asset: MediaAssetRecord) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.saveMediaAsset(currentUser, asset), 'Media asset saved');
    },
    [currentUser, handleResult],
  );

  const deleteMediaAsset = useCallback(
    (assetId: string) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.deleteMediaAsset(currentUser, assetId), 'Media asset deleted');
    },
    [currentUser, handleResult],
  );

  // Communication & Admin
  const saveEmailTemplate = useCallback(
    (template: EmailTemplate) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.saveEmailTemplate(currentUser, template), 'Template saved');
    },
    [currentUser, handleResult],
  );

  const sendEmails = useCallback(
    (payload: SendEmailPayload) => {
      if (!currentUser) return false;
      const res = conferenceDataService.sendEmails(currentUser, payload);
      return handleResult(res, `Dispatched ${res.data?.length ?? 0} email(s)`);
    },
    [currentUser, handleResult],
  );

  const submitPublicInquiry = useCallback(
    (input: PublicInquiryInput) => {
      const res = conferenceDataService.submitPublicInquiry(input);
      refreshSnapshot();
      return res.ok;
    },
    [refreshSnapshot],
  );

  const updateInquiry = useCallback(
    (inquiryId: string, patch: Partial<InquiryRecord>) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.updateInquiry(currentUser, inquiryId, patch), 'Inquiry updated');
    },
    [currentUser, handleResult],
  );

  const updateSettings = useCallback(
    (patch: Partial<ConferenceSettings>) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.updateSettings(currentUser, patch), 'Conference settings saved');
    },
    [currentUser, handleResult],
  );

  const resolveErrorLog = useCallback(
    (errorId: string) => {
      if (!currentUser) return false;
      return handleResult(conferenceDataService.resolveErrorLog(currentUser, errorId), 'Alert status updated');
    },
    [currentUser, handleResult],
  );

  const updateTechnicalConfig = useCallback(
    (patch: Partial<TechnicalConfig>) => {
      if (!currentUser) return false;
      return handleResult(
        conferenceDataService.updateTechnicalConfig(currentUser, patch),
        'Technical configuration saved',
      );
    },
    [currentUser, handleResult],
  );

  const runHealthChecks = useCallback(() => {
    if (!currentUser) return false;
    return handleResult(conferenceDataService.runHealthChecks(currentUser), 'Service health verified');
  }, [currentUser, handleResult]);

  const markNotificationsRead = useCallback(() => {
    conferenceDataService.markAllNotificationsRead();
    refreshSnapshot();
  }, [refreshSnapshot]);

  const recordSecurityViolation = useCallback(
    (targetType: string, targetId: string, details: string) => {
      const actor = currentUserRef.current;
      if (!actor) return;
      conferenceDataService.recordSecurityAttempt(actor, targetType, targetId, details);
      refreshSnapshot();
    },
    [refreshSnapshot],
  );

  const notifications = useMemo(() => {
    if (!currentUser) return [];
    const scopedUser = testModeHeadUser ?? currentUser;
    if (scopedUser.role === 'department_head') {
      return data.notifications.filter(
        (n) => n.departmentId === null || n.departmentId === scopedUser.departmentId,
      );
    }
    return data.notifications;
  }, [currentUser, testModeHeadUser, data.notifications]);

  const value: AdminStoreContextValue = {
    data,
    currentUser,
    authReady,
    testModeHeadUser,
    testModeExecutiveBoardUser,
    toasts,
    notifications,
    pushToast,
    dismissToast,
    signInWithCredentials,
    signInAsDemoUser,
    signOut,
    enterDepartmentTestMode,
    exitDepartmentTestMode,
    resetDemoData,
    refreshSnapshot,
    updateApplicationStatus,
    submitHeadRecommendation,
    bulkUpdateApplicationStatus,
    bulkApproveRecommended,
    addApplicationNote,
    generateSignupLink,
    bulkGenerateSignupLinks,
    revokeSignupLink,
    saveApplicationForm,
    deleteApplicationForm,
    createDepartment,
    updateDepartment,
    assignDepartmentHead,
    saveWorkspaceRecord,
    deleteWorkspaceRecord,
    saveTeamGroup,
    deleteTeamGroup,
    saveShift,
    deleteShift,
    saveQrPass,
    scanQrToken,
    createAccount,
    updateAccount,
    suspendAccount,
    reactivateAccount,
    resetAccountPassword,
    manageAccountInvitation,
    deleteAccount,
    retryDepartmentAssignment,
    saveRoleDefinition,
    deleteRoleDefinition,
    updatePermissionDefinition,
    saveCommittee,
    deleteCommittee,
    saveSecretariatMember,
    deleteSecretariatMember,
    saveExecutiveBoardMember,
    deleteExecutiveBoardMember,
    saveSponsor,
    deleteSponsor,
    saveAnnouncement,
    deleteAnnouncement,
    saveScheduleEvent,
    deleteScheduleEvent,
    saveConferenceDocument,
    deleteConferenceDocument,
    saveFaq,
    deleteFaq,
    saveGalleryItem,
    deleteGalleryItem,
    updateWebsiteDraft,
    publishWebsiteChanges,
    restoreWebsiteVersion,
    saveMediaAsset,
    deleteMediaAsset,
    saveEmailTemplate,
    sendEmails,
    submitPublicInquiry,
    updateInquiry,
    updateSettings,
    resolveErrorLog,
    updateTechnicalConfig,
    runHealthChecks,
    markNotificationsRead,
    recordSecurityViolation,
  };

  return <AdminStoreContext.Provider value={value}>{children}</AdminStoreContext.Provider>;
}

export function useAdminStore(): AdminStoreContextValue {
  const ctx = useContext(AdminStoreContext);
  if (!ctx) throw new Error('useAdminStore must be used inside AdminStoreProvider');
  return ctx;
}
