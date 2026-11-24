import { supabase } from '../lib/supabase';
import type {
  AdminUser,
  Application,
  ApplicationCategory,
  ApplicationStatus,
  CommitteeRecord,
  Department,
  QrPassRecord,
} from '../types/admin';
import {
  canAccessApplication,
  canViewConfidentialMedicalInfo,
  getActorDepartmentSlug,
  getActorGenderScope,
  hasPermission,
  isDccActor,
  isHrActor,
} from '../utils/adminPermissions';
import { decodeLegacyExperienceMeta } from '../utils/applicationForm';
import {
  canViewHeadRecommended,
  isHeadRecommendedApplication,
  normalizeHeadRecommendation,
} from '../utils/applicationFilters';
import {
  cleanDecisionMakerName,
  normalizeAssignableAdmins,
  type AssignableAdminOption,
  type SpoofAuditEntry,
} from '../utils/decisionAttribution';
export { normalizeHeadRecommendation };
import { conferenceDataService } from './mockDataService';
import {
  filterAndSortDepartmentQrPasses,
  type DepartmentQrMatchInput,
  type DepartmentQrSectionKey,
} from '../utils/departmentQr';

async function getQrInvokeError(error: any, data: any, fallback: string): Promise<string> {
  if (data?.error) return String(data.error);
  const ctx = error?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } catch { /* response body unavailable or already consumed */ }
  }
  return error?.message || fallback;
}

export interface LiveFileRecord {
  id: string;
  name: string;
  category?: string;
  fileType?: string;
  sizeBytes?: number;
  sizeLabel?: string;
  storageBucket?: string;
  storagePath?: string;
  previewUrl?: string;
  uploadedAt?: string;
}

export interface LiveApplicationRow {
  id: string;
  application_type: string;
  department_id?: string | null;
  gender?: string | null;
  application_code?: string | null;
  position?: string | null;
  applicant_name: string;
  email: string;
  phone: string;
  guardian_phone?: string | null;
  grade?: string | null;
  school: string | null;
  age: number | null;
  availability: string | null;
  attends_all_days?: boolean | null;
  absence_reason?: string | null;
  motivation: string;
  experience: string | null;
  camera_model?: string | null;
  portfolio_url: string | null;
  answers?: Array<{ questionId: string; section: string; label: string; answer: string }> | null;
  proof_files?: LiveFileRecord[] | null;
  media_photos?: LiveFileRecord[] | null;
  writing_samples?: LiveFileRecord[] | null;
  medical_has_conditions?: boolean | null;
  medical_details?: string | null;
  medical_restricted?: boolean | null;
  status: ApplicationStatus;
  head_recommendation?: "none" | "recommend_accept" | "recommend_reject" | null;
  head_notes?: string | null;
  recommended_by?: string | null;
  recommended_by_name?: string | null;
  recommended_at?: string | null;
  admin_decision_notes?: string | null;
  review_notes: string | null;
  decision_by?: string | null;
  decision_by_name?: string | null;
  decision_at?: string | null;
  privacy_policy_accepted?: boolean | null;
  terms_accepted?: boolean | null;
  privacy_policy_version?: string | null;
  terms_version?: string | null;
  consent_accepted_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface LiveQrPass {
  id: string;
  user_id: string | null;
  application_id?: string | null;
  token_value: string;
  holder_name: string;
  holder_email?: string | null;
  role_label: string;
  category: string;
  department_id: string | null;
  active: boolean;
  checked_in_at: string | null;
  checked_in_gate: string | null;
  created_at?: string;
}

export function mapApplicationTypeToDepartment(appType: string | null | undefined, explicitDept?: string | null): string {
  if (explicitDept) return explicitDept;
  switch ((appType || '').toLowerCase()) {
    case 'press':
    case 'media':
      return 'media-press';
    case 'volunteer':
      return 'volunteers';
    case 'security':
      return 'security';
    case 'hr':
      return 'hr';
    case 'marketing':
      return 'marketing';
    case 'design':
      return 'design';
    case 'it':
      return 'it';
    case 'dcc':
    case 'delegate':
      return 'dcc';
    default:
      return (appType || 'volunteers').toLowerCase();
  }
}

function normalizeDocList(
  raw: unknown,
  fallbackCategory: 'photo' | 'cv' | 'portfolio' | 'id_document' | 'other',
): Application['documents'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is LiveFileRecord => Boolean(f && typeof f === 'object'))
    .map((f, idx) => {
      const cat =
        f.category === 'photo' ||
        f.category === 'cv' ||
        f.category === 'portfolio' ||
        f.category === 'id_document' ||
        f.category === 'other'
          ? f.category
          : fallbackCategory;
      return {
        id: String(f.id || `doc-${fallbackCategory}-${idx}`),
        name: String(f.name || `Attachment ${idx + 1}`),
        category: cat,
        fileType: String(f.fileType || 'application/octet-stream'),
        sizeLabel: String(f.sizeLabel || ''),
        previewUrl: String(f.previewUrl || ''),
        storageBucket: f.storageBucket,
        storagePath: f.storagePath,
        uploadedAt: String(f.uploadedAt || new Date().toISOString()),
      };
    });
}

export function mapLiveRowToApplication(
  row: LiveApplicationRow,
  actor?: AdminUser | null,
  departments?: Department[],
): Application {
  const deptId = mapApplicationTypeToDepartment(row.application_type, row.department_id);
  const rawType = (row.application_type || '').toLowerCase();
  const category = (['delegate', 'staff', 'security', 'media', 'press', 'volunteer'].includes(rawType)
    ? rawType
    : 'staff') as ApplicationCategory;
  const code = row.application_code || `WM-${row.id.slice(0, 6).toUpperCase()}`;
  const rawGender = (row.gender || '').toLowerCase();
  const gender: 'male' | 'female' | null =
    rawGender === 'female' ? 'female' : rawGender === 'male' ? 'male' : null;

  const { cleanExperience, meta } = decodeLegacyExperienceMeta(row.experience);
  const cameraModel = row.camera_model ?? meta?.cameraModel ?? null;
  const attendsAllDays =
    typeof row.attends_all_days === 'boolean'
      ? row.attends_all_days
      : meta?.attendsAllDays ?? null;
  const absenceReason = row.absence_reason ?? meta?.absenceReason ?? null;
  const grade = row.grade || meta?.grade || '';
  const guardianPhone = row.guardian_phone || meta?.guardianPhone || '';

  const structuredAnswers =
    Array.isArray(row.answers) && row.answers.length > 0
      ? row.answers
      : Array.isArray(meta?.answers) && meta.answers.length > 0
        ? meta.answers
        : [
            ...(row.motivation
              ? [{ questionId: 'motivation', section: 'Statement', label: 'Motivation & Statement of Interest', answer: row.motivation }]
              : []),
            ...(cleanExperience
              ? [{ questionId: 'experience', section: 'Background', label: 'Relevant Experience', answer: cleanExperience }]
              : []),
            ...(row.availability
              ? [{ questionId: 'availability', section: 'Availability', label: 'Conference Availability', answer: row.availability }]
              : []),
            ...(row.portfolio_url
              ? [{ questionId: 'portfolio', section: 'Links', label: 'Portfolio / Work Link', answer: row.portfolio_url }]
              : []),
          ];

  const proofDocs = normalizeDocList(
    Array.isArray(row.proof_files) && row.proof_files.length > 0
      ? row.proof_files
      : meta?.proofFiles,
    'other',
  );
  const mediaDocs = normalizeDocList(
    Array.isArray(row.media_photos) && row.media_photos.length > 0
      ? row.media_photos
      : meta?.mediaPhotos,
    'photo',
  );
  const writingDocs = normalizeDocList(
    Array.isArray(row.writing_samples) && row.writing_samples.length > 0
      ? row.writing_samples
      : meta?.writingSamples,
    'portfolio',
  );

  const allowMedical =
    canViewConfidentialMedicalInfo(actor, departments) && row.medical_restricted !== true;
  const cleanDecisionBy = cleanDecisionMakerName(row.decision_by_name);

  return {
    id: row.id,
    applicationCode: code,
    applicationType: row.application_type,
    category,
    applicantName: row.applicant_name,
    gender,
    email: row.email,
    phone: row.phone,
    guardianPhone,
    schoolOrUniversity: row.school || '',
    gradeOrYear: grade,
    city: '',
    country: '',
    age: row.age ?? 0,
    departmentId: deptId,
    position: row.position || `${row.application_type.charAt(0).toUpperCase()}${row.application_type.slice(1)} Applicant`,
    secondChoiceDepartmentId: null,
    status: row.status,
    submittedAt: row.created_at,
    updatedAt: row.updated_at || row.decision_at || row.created_at,
    headRecommendation: normalizeHeadRecommendation(row.head_recommendation),
    headNotes: row.head_notes || '',
    recommendedBy: row.recommended_by || null,
    recommendedByName: row.recommended_by_name || null,
    recommendedAt: row.recommended_at || null,
    finalDecisionBy: cleanDecisionBy,
    finalDecisionAt: row.decision_at || null,
    adminDecisionNotes: row.admin_decision_notes ?? row.review_notes ?? '',
    reviewedBy: cleanDecisionBy,
    reviewedAt: row.decision_at || null,
    signupLinkToken: null,
    signupLinkStatus: 'none',
    signupLinkGeneratedAt: null,
    emergencyContact: guardianPhone ? `Guardian: ${guardianPhone}` : '',
    cameraModel,
    attendsAllDays,
    absenceReason,
    medicalInfo: allowMedical
      ? {
          hasConditions:
            typeof row.medical_has_conditions === 'boolean'
              ? row.medical_has_conditions
              : null,
          details: row.medical_details ?? null,
          restricted: false,
        }
      : {
          hasConditions: null,
          details: null,
          restricted: true,
        },
    experienceLevel: cleanExperience,
    answers: structuredAnswers,
    documents: [...mediaDocs, ...writingDocs, ...proofDocs],
    notes: [],
    legalConsent: {
      privacyPolicyAccepted:
        typeof row.privacy_policy_accepted === 'boolean' ? row.privacy_policy_accepted : null,
      termsAccepted: typeof row.terms_accepted === 'boolean' ? row.terms_accepted : null,
      privacyPolicyVersion: row.privacy_policy_version ?? null,
      termsVersion: row.terms_version ?? null,
      consentAcceptedAt: row.consent_accepted_at ?? null,
    },
    history: row.decision_at
      ? [
          {
            id: `hist-${row.id}`,
            timestamp: row.decision_at,
            actorName: cleanDecisionBy || 'Reviewer',
            actorRole: row.decision_by ? 'admin' : 'department_head',
            summary: `Status updated to ${row.status.toUpperCase()}`,
          },
        ]
      : [],
  };
}

export async function fetchSignedDocumentUrls(
  applicationId: string,
): Promise<Record<string, string>> {
  if (!applicationId) return {};
  try {
    const { data, error } = await supabase.functions.invoke('willow-applications', {
      body: { action: 'sign_files', application_id: applicationId },
    });
    if (!error && data && !data.error && data.urls && typeof data.urls === 'object') {
      return data.urls as Record<string, string>;
    }
  } catch {
    // Return empty map gracefully
  }
  return {};
}

export async function fetchScopedApplicationsForActor(
  actor: AdminUser | null | undefined,
  departments?: Department[],
): Promise<{ applications: Application[]; source: 'live' | 'table' | 'local'; error?: string }> {
  if (!actor || !actor.isActive || actor.status !== 'active') {
    return { applications: [], source: 'live', error: 'Authentication required.' };
  }

  // Try Edge Function first
  const { data, error } = await supabase.functions.invoke('willow-applications', {
    body: { action: 'list' },
  });

  if (!error && data && !data.error && Array.isArray(data.applications)) {
    const mapped = (data.applications as LiveApplicationRow[]).map((r) =>
      mapLiveRowToApplication(r, actor, departments),
    );
    // Apply exact client-side head scope (used both for real heads and Super Admin "Sign In As" preview)
    if (actor.role === 'department_head' || actor.role === 'executive_board') {
      return {
        applications: mapped.filter((app) => canAccessApplication(actor, app, departments)),
        source: 'live',
      };
    }
    return { applications: mapped, source: 'live' };
  }

  // Fallback to direct RLS table read if Edge Function returned error or is mid-deploy
  try {
    let query = supabase.from('wm_applications').select('*').order('created_at', { ascending: false });
    if (actor.role === 'department_head' || actor.role === 'executive_board') {
      const deptSlug = getActorDepartmentSlug(actor, departments);
      const gender = getActorGenderScope(actor);
      if (!deptSlug || !gender || !hasPermission(actor, 'applications.view', departments)) {
        return { applications: [], source: 'table' };
      }
      query = query.eq('department_id', deptSlug).eq('gender', gender);
    }
    const { data: rows, error: tableError } = await query;
    if (!tableError && Array.isArray(rows)) {
      const mapped = (rows as LiveApplicationRow[]).map((r) =>
        mapLiveRowToApplication(r, actor, departments),
      );
      return {
        applications:
          actor.role === 'department_head' || actor.role === 'executive_board'
            ? mapped.filter((app) => canAccessApplication(actor, app, departments))
            : mapped,
        source: 'table',
      };
    }
  } catch {
    // Ignore table fallback errors and surface message below
  }

  const localApps = conferenceDataService.getSnapshot().applications;
  if (localApps.length > 0) {
    return { applications: localApps, source: 'local' };
  }

  return {
    applications: [],
    source: 'live',
    error: data?.error || error?.message || 'Could not load applications from the server.',
  };
}

export async function fetchHrAcceptedApplications(
  actor: AdminUser | null | undefined,
  departments?: Department[],
): Promise<{ applications: Application[]; error?: string }> {
  if (!isHrActor(actor, departments)) {
    return { applications: [], error: 'Only HR staff and Administrators can view cross-department accepted applicants.' };
  }

  const { data, error } = await supabase.functions.invoke('willow-applications', {
    body: { action: 'hr_accepted' },
  });

  if (!error && data && !data.error && Array.isArray(data.applications)) {
    return {
      applications: (data.applications as LiveApplicationRow[]).map((r) =>
        mapLiveRowToApplication(r, actor, departments),
      ),
    };
  }

  // Fallback 1: list + filter accepted (e.g. for Admin/SuperAdmin or older function deploy)
  const listRes = await supabase.functions.invoke('willow-applications', {
    body: { action: 'list' },
  });
  if (!listRes.error && listRes.data && Array.isArray(listRes.data.applications)) {
    const all = (listRes.data.applications as LiveApplicationRow[]).map((r) =>
      mapLiveRowToApplication(r, actor, departments),
    );
    const accepted = all.filter((a) => a.status === 'accepted');
    if (accepted.length > 0 || actor?.role === 'admin' || actor?.role === 'super_admin') {
      return { applications: accepted };
    }
  }

  // Fallback 2: direct table query with RLS
  try {
    const { data: rows, error: tableError } = await supabase
      .from('wm_applications')
      .select('*')
      .eq('status', 'accepted')
      .order('created_at', { ascending: false });
    if (!tableError && Array.isArray(rows)) {
      return {
        applications: (rows as LiveApplicationRow[]).map((r) =>
          mapLiveRowToApplication(r, actor, departments),
        ),
      };
    }
  } catch {
    // Ignore and check local snapshot
  }

  const localAccepted = conferenceDataService.getSnapshot().applications.filter((a) => a.status === 'accepted');
  if (localAccepted.length > 0) {
    return { applications: localAccepted };
  }

  return {
    applications: [],
    error: data?.error || error?.message || 'Could not load accepted applicants feed.',
  };
}

export async function fetchHeadRecommendedApplications(
  actor: AdminUser | null | undefined,
  departments?: Department[],
): Promise<{ applications: Application[]; error?: string }> {
  if (!canViewHeadRecommended(actor, departments)) {
    return {
      applications: [],
      error: 'Only authorized Admin or Super Admin accounts can view cross-department Head recommendations.',
    };
  }

  const dedupeAndFilter = (rows: LiveApplicationRow[]): Application[] => {
    const map = new Map<string, Application>();
    for (const row of rows) {
      if (!row?.id || map.has(row.id)) continue;
      const mapped = mapLiveRowToApplication(row, actor, departments);
      if (isHeadRecommendedApplication(mapped)) {
        map.set(mapped.id, mapped);
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.recommendedAt || a.updatedAt || a.submittedAt;
      const bTime = b.recommendedAt || b.updatedAt || b.submittedAt;
      const cmp = bTime.localeCompare(aTime);
      return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
    });
  };

  let primaryError = '';
  try {
    const { data, error } = await supabase.functions.invoke('willow-applications', {
      body: { action: 'list' },
    });
    if (!error && data && !data.error && Array.isArray(data.applications)) {
      return { applications: dedupeAndFilter(data.applications as LiveApplicationRow[]) };
    }
    primaryError = String(data?.error || error?.message || '');
  } catch (err: any) {
    primaryError = err?.message || 'Could not reach applications service.';
  }

  // Fallback to RLS-enforced direct table query for authorized Admin / Super Admin only (never mock data)
  try {
    const { data: rows, error: tableError } = await supabase
      .from('wm_applications')
      .select('*')
      .in('head_recommendation', ['recommend_accept', 'recommend_reject'])
      .order('created_at', { ascending: false });

    if (!tableError && Array.isArray(rows)) {
      return { applications: dedupeAndFilter(rows as LiveApplicationRow[]) };
    }
    if (tableError) {
      return {
        applications: [],
        error: primaryError || tableError.message || 'Could not load Head recommended applications.',
      };
    }
  } catch (err: any) {
    return {
      applications: [],
      error: primaryError || err?.message || 'Could not load Head recommended applications.',
    };
  }

  return {
    applications: [],
    error: primaryError || 'Could not load Head recommended applications from the server.',
  };
}

export async function submitHeadRecommendation(
  actor: AdminUser, applicationId: string,
  recommendation: 'recommend_accept' | 'recommend_reject',
  notes?: string, departments?: Department[],
): Promise<{ ok: boolean; application?: Application; error?: string }> {
  if ((actor.role !== 'department_head' && actor.role !== 'executive_board') || !hasPermission(actor, 'applications.recommend', departments)) return { ok: false, error: 'You are not permitted to submit department recommendations.' };
  const { data, error } = await supabase.functions.invoke('willow-applications', { body: { action: 'recommend', id: applicationId, recommendation, head_notes: notes || '' } });
  if (error || data?.error || !data?.application) {
    let serverMessage = data?.error || data?.message || '';
    const context = (error as { context?: { json?: () => Promise<{ error?: string; message?: string; details?: string }> } } | null)?.context;
    if (!serverMessage && context && typeof context.json === 'function') {
      try {
        const payload = await context.json();
        serverMessage = payload?.error || payload?.message || payload?.details || '';
      } catch {
        // Fall back to the SDK error message below.
      }
    }
    return { ok: false, error: serverMessage || error?.message || 'Could not save recommendation.' };
  }
  return { ok: true, application: mapLiveRowToApplication(data.application as LiveApplicationRow, actor, departments) };
}

export async function fetchSpoofAssignableAdmins(): Promise<{
  admins: AssignableAdminOption[];
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke('willow-applications', {
    body: { action: 'list_spoof_admins' },
  });

  if (!error && data && !data.error && Array.isArray(data.admins)) {
    return { admins: normalizeAssignableAdmins(data.admins) };
  }

  // Fallback to willow-staff-admin list if willow-applications does not yet expose list_spoof_admins
  const staffRes = await supabase.functions.invoke('willow-staff-admin', {
    body: { action: 'list' },
  });
  if (!staffRes.error && staffRes.data && Array.isArray(staffRes.data.accounts)) {
    return { admins: normalizeAssignableAdmins(staffRes.data.accounts) };
  }

  const errMsg =
    data?.error ||
    (error ? await getQrInvokeError(error, data, 'Could not load active Admin accounts.') : undefined) ||
    staffRes.data?.error ||
    'Could not load active Admin accounts.';
  return { admins: [], error: errMsg };
}

export async function fetchSpoofAuditLogs(): Promise<{
  entries: SpoofAuditEntry[];
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke('willow-applications', {
    body: { action: 'list_spoof_audit' },
  });

  if (!error && data && !data.error && Array.isArray(data.entries)) {
    return { entries: data.entries as SpoofAuditEntry[] };
  }

  const errMsg = data?.error || (error ? await getQrInvokeError(error, data, 'Could not load spoof audit history.') : 'Could not load spoof audit history.');
  return { entries: [], error: errMsg };
}
// =========================================================
// COMMITTEES (Supabase wm_committees + Local CMS Sync)
// =========================================================

export const COMMITTEES_UPDATED_EVENT = 'willowmun:committees-updated';

export function emitCommitteesUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COMMITTEES_UPDATED_EVENT));
  }
}

function mapLiveCommitteeRow(row: any): CommitteeRecord {
  return {
    id: String(row.id),
    chamber: String(row.chamber || ''),
    name: String(row.name || ''),
    abbreviation: String(row.abbreviation || ''),
    difficulty: (['Beginner', 'Intermediate', 'Advanced', 'Crisis'].includes(row.difficulty)
      ? row.difficulty
      : 'Intermediate') as CommitteeRecord['difficulty'],
    description: String(row.description || ''),
    topics: Array.isArray(row.topics) ? row.topics.map(String) : [],
    chairName: String(row.chair_name || 'TBA'),
    viceChairName: String(row.vice_chair_name || 'TBA'),
    logoUrl: row.logo_url ?? null,
    imageUrl: row.image_url ?? null,
    capacity: Number(row.capacity ?? 40),
    published: row.published !== false,
    order: Number(row.sort_order ?? 1),
  };
}

export async function fetchPublicCommittees(): Promise<CommitteeRecord[]> {
  // 1. Try Edge Function public feed
  try {
    const { data, error } = await supabase.functions.invoke('willow-committees', {
      body: { action: 'list_public' },
    });
    if (!error && data && Array.isArray(data.committees) && data.committees.length > 0) {
      return data.committees.map(mapLiveCommitteeRow);
    }
  } catch {
    // Fall through cleanly
  }

  // 2. Try direct Supabase wm_committees table query
  try {
    const { data: rows, error } = await supabase
      .from('wm_committees')
      .select('*')
      .eq('published', true)
      .order('sort_order', { ascending: true });
    if (!error && Array.isArray(rows) && rows.length > 0) {
      return rows.map(mapLiveCommitteeRow);
    }
  } catch {
    // Fall through to conferenceDataService snapshot
  }

  return conferenceDataService.getSnapshot().committees.filter((c) => c.published).sort((a, b) => a.order - b.order);
}

export async function fetchManageableCommittees(
  actor: AdminUser | null | undefined,
  departments?: Department[],
): Promise<{ committees: CommitteeRecord[]; remoteAvailable: boolean; error?: string }> {
  if (!isDccActor(actor, departments)) {
    return { committees: [], remoteAvailable: false, error: 'DCC or Administrator access required.' };
  }

  // 1. Try Edge Function
  try {
    const { data, error } = await supabase.functions.invoke('willow-committees', {
      body: { action: 'list' },
    });
    if (!error && data && !data.error && Array.isArray(data.committees)) {
      const mapped = data.committees.map(mapLiveCommitteeRow);
      return { committees: mapped, remoteAvailable: true };
    }
  } catch {
    // Fall through to direct table query
  }

  // 2. Try direct table query
  try {
    const { data: rows, error } = await supabase
      .from('wm_committees')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!error && Array.isArray(rows)) {
      return { committees: rows.map(mapLiveCommitteeRow), remoteAvailable: true };
    }
  } catch {
    // Fall through to local store
  }

  return {
    committees: conferenceDataService.getSnapshot().committees.sort((a, b) => a.order - b.order),
    remoteAvailable: false,
  };
}

export async function upsertLiveCommittee(
  actor: AdminUser,
  committee: CommitteeRecord,
  departments?: Department[],
): Promise<{ ok: boolean; committee?: CommitteeRecord; remoteSynced: boolean; error?: string }> {
  if (!isDccActor(actor, departments)) {
    return { ok: false, remoteSynced: false, error: 'Not authorized to manage committees.' };
  }

  let remoteSynced = false;
  let savedCommittee: CommitteeRecord = { ...committee };

  const payload = {
    id: committee.id || `chamber-${committee.abbreviation.toLowerCase().replace(/[^a-z0-9]+/g, '-') || Date.now().toString(36)}`,
    chamber: committee.chamber.trim(),
    name: committee.name.trim(),
    abbreviation: committee.abbreviation.trim(),
    difficulty: committee.difficulty,
    description: committee.description.trim(),
    topics: committee.topics.map((t) => t.trim()).filter(Boolean),
    chair_name: committee.chairName.trim() || 'TBA',
    vice_chair_name: committee.viceChairName.trim() || 'TBA',
    logo_url: committee.logoUrl,
    image_url: committee.imageUrl,
    capacity: Math.max(1, Number(committee.capacity) || 40),
    published: committee.published,
    sort_order: Number(committee.order) || 1,
  };

  try {
    const { data, error } = await supabase.functions.invoke('willow-committees', {
      body: { action: 'upsert', committee: payload },
    });
    if (!error && data && !data.error && data.committee) {
      remoteSynced = true;
      savedCommittee = mapLiveCommitteeRow(data.committee);
    }
  } catch {
    // Try direct table upsert
  }

  if (!remoteSynced) {
    try {
      const { data: row, error } = await supabase
        .from('wm_committees')
        .upsert(
          {
            ...payload,
            updated_by: actor.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        )
        .select()
        .single();
      if (!error && row) {
        remoteSynced = true;
        savedCommittee = mapLiveCommitteeRow(row);
      }
    } catch {
      // Fallback to local CMS sync
    }
  }

  const localRes = conferenceDataService.saveCommittee(actor, savedCommittee);
  emitCommitteesUpdated();

  if (!localRes.ok && !remoteSynced) {
    return { ok: false, remoteSynced: false, error: localRes.error || 'Could not save committee.' };
  }

  return { ok: true, committee: localRes.data ?? savedCommittee, remoteSynced };
}

export async function removeLiveCommittee(
  actor: AdminUser,
  committeeId: string,
  departments?: Department[],
): Promise<{ ok: boolean; remoteSynced: boolean; error?: string }> {
  if (!isDccActor(actor, departments)) {
    return { ok: false, remoteSynced: false, error: 'Not authorized to remove committees.' };
  }

  let remoteSynced = false;
  try {
    const { data, error } = await supabase.functions.invoke('willow-committees', {
      body: { action: 'delete', id: committeeId },
    });
    if (!error && data && !data.error) {
      remoteSynced = true;
    }
  } catch {
    // Try direct delete
  }

  if (!remoteSynced) {
    try {
      const { error } = await supabase.from('wm_committees').delete().eq('id', committeeId);
      if (!error) remoteSynced = true;
    } catch {
      // Fallback
    }
  }

  conferenceDataService.deleteCommittee(actor, committeeId);
  emitCommitteesUpdated();
  return { ok: true, remoteSynced };
}

// =========================================================
// PERSONAL PERMANENT QR IDENTITY
// =========================================================

export async function fetchPersonalQrPass(
  actor: AdminUser | null | undefined,
): Promise<{ pass: LiveQrPass | null; source: 'remote' | 'local'; error?: string }> {
  if (!actor) return { pass: null, source: 'local', error: 'Sign in to access your QR credential.' };

  // 1. Call secure server endpoint (`willow-qr` action `my_pass`).
  // Note: server strictly ignores any external user_id param and reads auth JWT sub!
  try {
    const { data, error } = await supabase.functions.invoke('willow-qr', {
      body: { action: 'my_pass' },
    });
    if (!error && data?.pass?.token_value) {
      return { pass: data.pass as LiveQrPass, source: 'remote' };
    }
    // Older willow-qr versions might not auto-provision on `my_pass`. Only if my_pass returned pass: null cleanly, inspect direct table first.
    if (!error && data && data.pass === null) {
      const { data: tablePass } = await supabase
        .from('wm_qr_passes')
        .select('*')
        .eq('user_id', actor.id)
        .maybeSingle();
      if (tablePass?.token_value) {
        return { pass: tablePass as LiveQrPass, source: 'remote' };
      }
      // If actor has admin rights and backend still lacks auto-trigger, call `issue` once on server for own user_id
      if (actor.role === 'admin' || actor.role === 'super_admin') {
        const issued = await supabase.functions.invoke('willow-qr', {
          body: { action: 'issue', user_id: actor.id },
        });
        if (!issued.error && issued.data?.pass?.token_value) {
          return { pass: issued.data.pass as LiveQrPass, source: 'remote' };
        }
      }
    }
  } catch {
    // Continue to direct table lookup / local permanent store
  }

  // 2. Direct table lookup (RLS enforced: user_id = auth.uid())
  try {
    const { data: tablePass, error: tableErr } = await supabase
      .from('wm_qr_passes')
      .select('*')
      .eq('user_id', actor.id)
      .maybeSingle();
    if (!tableErr && tablePass?.token_value) {
      return { pass: tablePass as LiveQrPass, source: 'remote' };
    }
  } catch {
    // Fall through to deterministic permanent local fallback
  }

  // 3. Deterministic permanent per-account fallback in conferenceDataService (never mutates once created)
  const localPass: QrPassRecord = conferenceDataService.ensurePersonalQrPass(actor);
  return {
    pass: {
      id: localPass.id,
      user_id: localPass.userId ?? actor.id,
      token_value: localPass.token,
      holder_name: localPass.holderName,
      holder_email: actor.email || null,
      role_label: localPass.roleLabel,
      category: localPass.category,
      department_id: localPass.departmentId,
      active: localPass.active,
      checked_in_at: localPass.lastScannedAt,
      checked_in_gate: null,
    },
    source: 'local',
  };
}

// =========================================================
// LIVE QR PASS SCANNER & CHECK-IN MANAGEMENT (willow-qr)
// =========================================================

export type QrValidationStatus =
  | 'valid'
  | 'already_checked_in'
  | 'checked_out'
  | 'checkout_warning'
  | 'not_checked_in'
  | 'invalid'
  | 'revoked'
  | 'not_eligible';

export interface LiveQrPassExtended extends LiveQrPass {
  checked_in_by?: string | null;
  checked_in_by_name?: string | null;
  checked_out_at?: string | null;
  checked_out_gate?: string | null;
  checked_out_by?: string | null;
  checked_out_by_name?: string | null;
  revoked_at?: string | null;
  revoke_reason?: string | null;
  application_code?: string | null;
  application_status?: string | null;
  department_name?: string | null;
  committee_name?: string | null;
}

export interface LiveQrScanEvent {
  id: string;
  pass_id: string | null;
  holder_name: string | null;
  result: string;
  gate_location: string;
  scanned_at: string;
  scanned_by?: string | null;
  scanned_by_name?: string | null;
  scanner_role?: string | null;
  token_value_masked?: string | null;
  application_id?: string | null;
  application_code?: string | null;
  department_name?: string | null;
  committee_name?: string | null;
  previous_checked_in_at?: string | null;
  previous_checked_in_gate?: string | null;
  detail_message?: string | null;
}

export interface LiveQrValidationResponse {
  status: QrValidationStatus;
  result: string;
  message: string;
  pass_id: string | null;
  holder_name: string | null;
  role_label: string | null;
  category: string | null;
  department_name: string | null;
  committee_name: string | null;
  application_code: string | null;
  application_id?: string | null;
  application_status?: string | null;
  department_id?: string | null;
  user_id?: string | null;
  pass_active: boolean | null;
  checked_in_at: string | null;
  checked_in_gate: string | null;
  checked_in_by_name?: string | null;
  checked_out_at?: string | null;
  checked_out_gate?: string | null;
  prior_checkout_count?: number;
  gate_location: string;
  scanned_at: string;
  committed: boolean;
}

export interface LiveQrCorrectionLog {
  id: string;
  pass_id: string;
  holder_name: string;
  application_id?: string | null;
  action_type: 'reset_checkin' | 'manual_checkin' | 'update_gate' | 'revoke_pass' | 'reactivate_pass';
  reason: string;
  previous_checked_in_at?: string | null;
  previous_checked_in_gate?: string | null;
  previous_active?: boolean | null;
  new_checked_in_at?: string | null;
  new_checked_in_gate?: string | null;
  new_active?: boolean | null;
  corrected_by?: string | null;
  corrected_by_name: string;
  corrected_by_role: string;
  created_at: string;
}

export interface AdminQrRegistryMetrics {
  total_issued: number;
  active_issued: number;
  checked_in: number;
  remaining: number;
  revoked: number;
}

export function normalizeValidationResponse(
  raw: Record<string, any>,
  fallbackGate: string,
  committed: boolean,
): LiveQrValidationResponse {
  const rawResult = String(raw.result || '');
  let status: QrValidationStatus = (raw.status as QrValidationStatus) || 'invalid';
  if (!raw.status) {
    if (rawResult === 'valid_checkin' || rawResult === 'valid_preview') status = 'valid';
    else if (rawResult === 'already_checked_in' || rawResult === 'duplicate_recent') status = 'already_checked_in';
    else if (rawResult === 'revoked_pass') status = 'revoked';
    else if (rawResult === 'not_eligible') status = 'not_eligible';
    else status = 'invalid';
  }
  return {
    status,
    result: rawResult || status,
    message: String(raw.message || ''),
    pass_id: raw.pass_id ?? null,
    holder_name: raw.holder_name ?? null,
    role_label: raw.role_label ?? null,
    category: raw.category ?? null,
    department_name: raw.department_name ?? null,
    committee_name: raw.committee_name ?? null,
    application_code: raw.application_code ?? null,
    application_id: raw.application_id ?? null,
    application_status: raw.application_status ?? null,
    department_id: raw.department_id ?? null,
    user_id: raw.user_id ?? null,
    pass_active: typeof raw.pass_active === 'boolean' ? raw.pass_active : null,
    checked_in_at: raw.checked_in_at ?? null,
    checked_in_gate: raw.checked_in_gate ?? null,
    checked_in_by_name: raw.checked_in_by_name ?? null,
    checked_out_at: raw.checked_out_at ?? null,
    checked_out_gate: raw.checked_out_gate ?? null,
    prior_checkout_count: Number(raw.prior_checkout_count ?? 0),
    gate_location: String(raw.gate_location || fallbackGate),
    scanned_at: String(raw.scanned_at || new Date().toISOString()),
    committed: typeof raw.committed === 'boolean' ? raw.committed : committed,
  };
}

export async function verifyQrPassToken(
  token: string,
  gateLocation: string,
): Promise<{ ok: boolean; validation?: LiveQrValidationResponse; error?: string }> {
  const { data, error } = await supabase.functions.invoke('willow-qr', {
    body: { action: 'verify', token: token.trim(), gate_location: gateLocation },
  });
  if (error || data?.error) {
    return { ok: false, error: data?.error || error?.message || 'Verification failed.' };
  }
  return {
    ok: true,
    validation: normalizeValidationResponse(data as Record<string, any>, gateLocation, false),
  };
}

export async function commitQrPassCheckin(
  token: string,
  gateLocation: string,
): Promise<{ ok: boolean; validation?: LiveQrValidationResponse; error?: string }> {
  const { data, error } = await supabase.functions.invoke('willow-qr', {
    body: { action: 'checkin', token: token.trim(), gate_location: gateLocation },
  });
  if (error || data?.error) {
    return { ok: false, error: data?.error || error?.message || 'Check-in failed.' };
  }
  return {
    ok: true,
    validation: normalizeValidationResponse(data as Record<string, any>, gateLocation, true),
  };
}

export async function verifyQrPassAttendance(
  token: string,
  gateLocation?: string,
  attendanceAction: 'checkin' | 'checkout' = 'checkin',
): Promise<{ ok: boolean; validation?: LiveQrValidationResponse; error?: string }> {
  const trimmedGate = gateLocation?.trim();
  const { data, error } = await supabase.functions.invoke('willow-qr', {
    body: {
      action: 'verify',
      token: token.trim(),
      ...(trimmedGate ? { gate_location: trimmedGate } : {}),
      attendance_action: attendanceAction,
    },
  });
  if (error || data?.error) return { ok: false, error: await getQrInvokeError(error, data, 'Verification failed.') };
  return { ok: true, validation: normalizeValidationResponse(data as Record<string, any>, trimmedGate || '', false) };
}

export async function commitQrPassAttendance(
  token: string,
  gateLocation?: string,
  attendanceAction: 'checkin' | 'checkout' = 'checkin',
  confirmRepeatCheckout = false,
): Promise<{ ok: boolean; validation?: LiveQrValidationResponse; error?: string }> {
  const trimmedGate = gateLocation?.trim();
  const { data, error } = await supabase.functions.invoke('willow-qr', {
    body: {
      action: 'checkin',
      token: token.trim(),
      ...(trimmedGate ? { gate_location: trimmedGate } : {}),
      attendance_action: attendanceAction,
      confirm_repeat: confirmRepeatCheckout,
    },
  });
  if (error || data?.error) return { ok: false, error: await getQrInvokeError(error, data, 'Attendance update failed.') };
  return { ok: true, validation: normalizeValidationResponse(data as Record<string, any>, trimmedGate || '', true) };
}

export async function resetAllQrAttendance(): Promise<{ ok: boolean; result?: { passes_reset: number; checkins_cleared: number; checkouts_cleared: number }; error?: string }> {
  const { data, error } = await supabase.functions.invoke('willow-qr', { body: { action: 'reset_all_attendance' } });
  if (error || data?.error) return { ok: false, error: data?.error || error?.message || 'Attendance reset failed.' };
  return { ok: true, result: data };
}

export interface LiveAttendanceAttendee {
  id: string;
  holder_name: string;
  role_label: string;
  category: string;
  department_name: string | null;
  committee_name: string | null;
  application_code: string | null;
  checked_in_at: string | null;
  checked_in_gate: string | null;
  checked_in_by_name?: string | null;
  checked_out_at?: string | null;
  checked_out_gate?: string | null;
}

export async function fetchQrAttendanceRoster(
  actorRole?: AdminUser['role'] | null,
): Promise<{
  ok: boolean;
  checkedIn: LiveAttendanceAttendee[];
  notCheckedIn: LiveAttendanceAttendee[];
  canReset: boolean;
  syncedAt: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('willow-qr', {
      body: { action: 'attendance_roster' },
    });

    if (!error && data && !data.error) {
      return {
        ok: true,
        checkedIn: (data.checked_in ?? []) as LiveAttendanceAttendee[],
        notCheckedIn: (data.not_checked_in ?? []) as LiveAttendanceAttendee[],
        canReset: Boolean(data.can_reset),
        syncedAt: String(data.synced_at || new Date().toISOString()),
      };
    }

    const msg = await getQrInvokeError(error, data, 'Unable to load attendance roster.');
    // Graceful compatibility fallback if an admin hits an older deployed edge function
    if (
      (actorRole === 'super_admin' || actorRole === 'admin') &&
      msg.toLowerCase().includes('unsupported')
    ) {
      const listRes = await supabase.functions.invoke('willow-qr', {
        body: { action: 'list' },
      });
      if (!listRes.error && listRes.data && !listRes.data.error) {
        const passes = (listRes.data.passes ?? []) as LiveQrPassExtended[];
        const active = passes
          .filter((p) => p.active !== false)
          .map<LiveAttendanceAttendee>((p) => ({
            id: p.id,
            holder_name: p.holder_name,
            role_label: p.role_label,
            category: p.category,
            department_name: p.department_name ?? null,
            committee_name: p.committee_name ?? null,
            application_code: p.application_code ?? null,
            checked_in_at: p.checked_in_at ?? null,
            checked_in_gate: p.checked_in_gate ?? null,
            checked_in_by_name: p.checked_in_by_name ?? null,
          }));
        return {
          ok: true,
          checkedIn: active.filter((p) => Boolean(p.checked_in_at)),
          notCheckedIn: active.filter((p) => !p.checked_in_at),
          canReset: actorRole === 'super_admin',
          syncedAt: new Date().toISOString(),
        };
      }
    }

    return {
      ok: false,
      checkedIn: [],
      notCheckedIn: [],
      canReset: false,
      syncedAt: new Date().toISOString(),
      error: msg,
    };
  } catch (err: any) {
    return {
      ok: false,
      checkedIn: [],
      notCheckedIn: [],
      canReset: false,
      syncedAt: new Date().toISOString(),
      error: err?.message || 'Network error while loading attendance lists.',
    };
  }
}

export async function fetchMySecurityScans(): Promise<{
  scans: LiveQrScanEvent[];
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke('willow-qr', {
    body: { action: 'my_scans' },
  });
  if (error || data?.error) {
    return { scans: [], error: data?.error || error?.message };
  }
  return { scans: (data?.scans ?? []) as LiveQrScanEvent[] };
}

export async function fetchAdminQrDashboard(): Promise<{
  passes: LiveQrPassExtended[];
  scans: LiveQrScanEvent[];
  correctionLogs: LiveQrCorrectionLog[];
  metrics: AdminQrRegistryMetrics;
  error?: string;
}> {
  const [listRes, scanRes, corrRes] = await Promise.all([
    supabase.functions.invoke('willow-qr', { body: { action: 'list' } }),
    supabase.functions.invoke('willow-qr', { body: { action: 'scan_log' } }),
    supabase.functions.invoke('willow-qr', { body: { action: 'correction_logs' } }),
  ]);

  const passes = ((listRes.data?.passes ?? []) as LiveQrPassExtended[]);
  const activePasses = passes.filter((p) => p.active !== false);
  const checkedInCount = activePasses.filter((p) => Boolean(p.checked_in_at)).length;
  const fallbackMetrics: AdminQrRegistryMetrics = {
    total_issued: passes.length,
    active_issued: activePasses.length,
    checked_in: checkedInCount,
    remaining: activePasses.length - checkedInCount,
    revoked: passes.filter((p) => p.active === false).length,
  };

  return {
    passes,
    scans: ((scanRes.data?.scans ?? []) as LiveQrScanEvent[]),
    correctionLogs: ((corrRes.data?.logs ?? []) as LiveQrCorrectionLog[]),
    metrics: (listRes.data?.metrics as AdminQrRegistryMetrics) || fallbackMetrics,
    error: listRes.data?.error || listRes.error?.message || scanRes.data?.error || scanRes.error?.message,
  };
}

export async function fetchDepartmentQrPasses(
  section: DepartmentQrSectionKey,
  departments: Array<Pick<Department, 'id' | 'slug' | 'name'>> = [],
  actorRole?: AdminUser['role'] | null,
): Promise<{
  ok: boolean;
  passes: LiveQrPassExtended[];
  error?: string;
}> {
  try {
    const departmentSlugBySection: Record<DepartmentQrSectionKey, string> = {
      press_media: 'media',
      volunteers: 'volunteers',
      security: 'security',
    };
    const { data, error } = await supabase.functions.invoke('willow-qr', {
      body: {
        action: 'department_passes',
        section,
        department_slug: departmentSlugBySection[section],
      },
    });

    if (!error && data && !data.error && Array.isArray(data.passes)) {
      const passes = filterAndSortDepartmentQrPasses(
        data.passes as LiveQrPassExtended[],
        section,
        departments,
      );
      return { ok: true, passes };
    }

    const edgeMsg = await getQrInvokeError(error, data, 'Unable to load department QR passes.');
    const isAdminActor = actorRole === 'super_admin' || actorRole === 'admin';

    // Graceful compatibility fallback for Admins / Super Admins when remote edge function
    // has not yet been redeployed with department_passes.
    if (isAdminActor) {
      const listRes = await supabase.functions.invoke('willow-qr', {
        body: { action: 'list' },
      });
      if (!listRes.error && listRes.data && !listRes.data.error && Array.isArray(listRes.data.passes)) {
        const passes = filterAndSortDepartmentQrPasses(
          listRes.data.passes as LiveQrPassExtended[],
          section,
          departments,
        );
        return { ok: true, passes };
      }
    }

    // Database RPC fallback (enforces department + qr.view_pass authorization via SECURITY DEFINER)
    const rpcRes = await supabase.rpc('wm_get_department_qr_passes', {
      p_section: section,
    });
    if (!rpcRes.error && Array.isArray(rpcRes.data)) {
      const passes = filterAndSortDepartmentQrPasses(
        rpcRes.data as LiveQrPassExtended[],
        section,
        departments,
      );
      return { ok: true, passes };
    }
    if (rpcRes.error && String(rpcRes.error.code || '') === '42501') {
      return {
        ok: false,
        passes: [],
        error: rpcRes.error.message || 'You do not have permission to view QR passes for this department.',
      };
    }

    // Direct RLS fallback for Admins (Admins can SELECT wm_qr_passes directly)
    if (isAdminActor) {
      const [passesRes, deptsRes] = await Promise.all([
        supabase
          .from('wm_qr_passes')
          .select('id,user_id,application_id,token_value,holder_name,role_label,category,department_id,active,checked_in_at,checked_in_gate,created_at')
          .eq('active', true)
          .order('holder_name', { ascending: true }),
        supabase
          .from('wm_departments')
          .select('id,slug,name'),
      ]);

      if (!passesRes.error && Array.isArray(passesRes.data)) {
        const resolvedDepts = (deptsRes.data as Array<Pick<Department, 'id' | 'slug' | 'name'>> | null) || departments;
        const rawPasses = passesRes.data as Array<LiveQrPassExtended & Partial<DepartmentQrMatchInput>>;

        const appIds = Array.from(new Set(rawPasses.map((p) => p.application_id).filter((id): id is string => Boolean(id))));
        const appMap = new Map<string, { application_type?: string | null; department_id?: string | null; status?: string | null }>();
        if (appIds.length > 0) {
          const { data: appRows } = await supabase
            .from('wm_applications')
            .select('id,application_type,department_id,status')
            .in('id', appIds);
          for (const a of appRows || []) {
            appMap.set(String(a.id), a);
          }
        }

        const userIds = Array.from(new Set(rawPasses.map((p) => p.user_id).filter((id): id is string => Boolean(id))));
        const profileMap = new Map<string, { department_id?: string | null; is_active?: boolean | null }>();
        if (userIds.length > 0) {
          const { data: profRows } = await supabase
            .from('wm_profiles')
            .select('user_id,department_id,is_active')
            .in('user_id', userIds);
          for (const prof of profRows || []) {
            profileMap.set(String(prof.user_id), prof);
          }
        }

        const enriched = rawPasses.map((p) => {
          const app = p.application_id ? appMap.get(String(p.application_id)) : undefined;
          const prof = p.user_id ? profileMap.get(String(p.user_id)) : undefined;
          return {
            ...p,
            application_type: app?.application_type ?? null,
            application_department_id: app?.department_id ?? null,
            application_status: app?.status ?? null,
            profile_department_id: prof?.department_id ?? null,
            profile_is_active: prof?.is_active ?? null,
          };
        });

        return {
          ok: true,
          passes: filterAndSortDepartmentQrPasses(enriched, section, resolvedDepts),
        };
      }
    }

    const legacyAdminOnlyReply =
      edgeMsg.toLowerCase().includes('pass registry management is restricted to administrators');
    return {
      ok: false,
      passes: [],
      error: legacyAdminOnlyReply
        ? 'The deployed Supabase QR function (`willow-qr`) needs to be updated with the `department_passes` handler or database migration to serve department QR passes.'
        : edgeMsg,
    };
  } catch (err: any) {
    return {
      ok: false,
      passes: [],
      error: err?.message || 'Network error while loading department QR passes.',
    };
  }
}

export async function correctQrCheckinRecord(payload: {
  passId: string;
  correctionAction: 'reset_checkin' | 'manual_checkin' | 'update_gate';
  gateLocation?: string;
  reason: string;
}): Promise<{ ok: boolean; pass?: LiveQrPassExtended; warning?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('willow-qr', {
    body: {
      action: 'correct_checkin',
      pass_id: payload.passId,
      correction_action: payload.correctionAction,
      gate_location: payload.gateLocation,
      reason: payload.reason.trim(),
    },
  });
  if (error || data?.error) {
    return { ok: false, error: data?.error || error?.message || 'Correction failed.' };
  }
  return { ok: true, pass: data?.pass as LiveQrPassExtended, warning: data?.warning };
}

export async function setQrPassActiveState(
  passId: string,
  activate: boolean,
  reason?: string,
): Promise<{ ok: boolean; pass?: LiveQrPassExtended; error?: string }> {
  const { data, error } = await supabase.functions.invoke('willow-qr', {
    body: {
      action: activate ? 'activate' : 'revoke',
      pass_id: passId,
      reason: reason?.trim() || undefined,
    },
  });
  if (error || data?.error) {
    return { ok: false, error: data?.error || error?.message || 'Pass update failed.' };
  }
  return { ok: true, pass: data?.pass as LiveQrPassExtended };
}

export async function issueConferenceQrPass(payload: {
  holderName: string;
  holderEmail?: string;
  roleLabel: string;
  category?: string;
}): Promise<{ ok: boolean; pass?: LiveQrPassExtended; error?: string }> {
  const { data, error } = await supabase.functions.invoke('willow-qr', {
    body: {
      action: 'issue',
      holder_name: payload.holderName.trim(),
      holder_email: payload.holderEmail?.trim() || null,
      role_label: payload.roleLabel.trim() || 'Conference Participant',
      category: payload.category || 'Delegate',
    },
  });
  if (error || data?.error) {
    return { ok: false, error: data?.error || error?.message || 'Could not issue pass.' };
  }
  return { ok: true, pass: data?.pass as LiveQrPassExtended };
}

export async function backfillStaffQrPasses(): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke('willow-qr', {
    body: { action: 'ensure_profile_passes' },
  });
  if (error || data?.error) {
    return { ok: false, error: data?.error || error?.message || 'Could not backfill passes.' };
  }
  return { ok: true, message: data?.message };
}

export async function createHrApplicantSignupInvite(applicationId: string): Promise<{ url?: string; email?: string; fullName?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('willow-hr-signup', {
    body: { action: 'create_invite', application_id: applicationId, origin: window.location.origin },
  });
  if (error || !data?.success || !data?.signup_url) {
    return { error: data?.error || error?.message || 'Could not create signup link.' };
  }
  return { url: data.signup_url, email: data.email, fullName: data.full_name };
}

export async function claimHrApplicantSignup(
  token: string,
  password: string,
): Promise<{ success?: boolean; email?: string; role?: string; departmentSlug?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('willow-hr-signup', {
    body: { action: 'signup', token, password },
  });
  if (error || !data?.success) {
    let detail = data?.error || error?.message || 'Signup failed.';
    const context = (error as any)?.context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (body?.error) detail = String(body.error);
      } catch { /* Keep the SDK message if the response body cannot be read. */ }
    }
    return { error: detail };
  }
  return {
    success: true,
    email: data.email,
    role: data.role,
    departmentSlug: data.department_slug,
  };
}
