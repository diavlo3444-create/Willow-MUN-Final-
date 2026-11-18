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
  getActorDepartmentSlug,
  getActorGenderScope,
  hasPermission,
  isDccActor,
  isHrActor,
} from '../utils/adminPermissions';
import { conferenceDataService } from './mockDataService';

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
  school: string | null;
  age: number | null;
  availability: string | null;
  motivation: string;
  experience: string | null;
  portfolio_url: string | null;
  status: ApplicationStatus;
  review_notes: string | null;
  decision_by?: string | null;
  decision_by_name?: string | null;
  decision_at?: string | null;
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

export function mapLiveRowToApplication(row: LiveApplicationRow): Application {
  const deptId = mapApplicationTypeToDepartment(row.application_type, row.department_id);
  const category = (['delegate', 'staff', 'security', 'media', 'volunteer'].includes(row.application_type)
    ? row.application_type
    : row.application_type === 'press'
      ? 'media'
      : 'staff') as ApplicationCategory;
  const code = row.application_code || `WM-${row.id.slice(0, 6).toUpperCase()}`;
  const rawGender = (row.gender || '').toLowerCase();
  const gender: 'male' | 'female' | null =
    rawGender === 'female' ? 'female' : rawGender === 'male' ? 'male' : null;

  return {
    id: row.id,
    applicationCode: code,
    applicationType: row.application_type,
    category,
    applicantName: row.applicant_name,
    gender,
    email: row.email,
    phone: row.phone,
    schoolOrUniversity: row.school || '',
    gradeOrYear: '',
    city: '',
    country: '',
    age: row.age ?? 0,
    departmentId: deptId,
    position: row.position || `${row.application_type.charAt(0).toUpperCase()}${row.application_type.slice(1)} Applicant`,
    secondChoiceDepartmentId: null,
    status: row.status,
    submittedAt: row.created_at,
    updatedAt: row.updated_at || row.decision_at || row.created_at,
    headRecommendation: 'none',
    headNotes: row.review_notes || '',
    recommendedBy: null,
    recommendedAt: null,
    finalDecisionBy: row.decision_by_name || null,
    finalDecisionAt: row.decision_at || null,
    adminDecisionNotes: row.review_notes || '',
    reviewedBy: row.decision_by_name || null,
    reviewedAt: row.decision_at || null,
    signupLinkToken: null,
    signupLinkStatus: 'none',
    signupLinkGeneratedAt: null,
    emergencyContact: '',
    experienceLevel: row.experience || '',
    answers: [
      ...(row.motivation
        ? [{ questionId: 'motivation', section: 'Statement', label: 'Motivation & Statement of Interest', answer: row.motivation }]
        : []),
      ...(row.experience
        ? [{ questionId: 'experience', section: 'Background', label: 'Relevant Experience', answer: row.experience }]
        : []),
      ...(row.availability
        ? [{ questionId: 'availability', section: 'Availability', label: 'Conference Availability', answer: row.availability }]
        : []),
      ...(row.portfolio_url
        ? [{ questionId: 'portfolio', section: 'Links', label: 'Portfolio / Work Link', answer: row.portfolio_url }]
        : []),
    ],
    documents: [],
    notes: [],
    history: row.decision_at
      ? [
          {
            id: `hist-${row.id}`,
            timestamp: row.decision_at,
            actorName: row.decision_by_name || 'Reviewer',
            actorRole: 'department_head',
            summary: `Status updated to ${row.status.toUpperCase()}`,
          },
        ]
      : [],
  };
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
    const mapped = (data.applications as LiveApplicationRow[]).map(mapLiveRowToApplication);
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
      const mapped = (rows as LiveApplicationRow[]).map(mapLiveRowToApplication);
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
      applications: (data.applications as LiveApplicationRow[]).map(mapLiveRowToApplication),
    };
  }

  // Fallback 1: list + filter accepted (e.g. for Admin/SuperAdmin or older function deploy)
  const listRes = await supabase.functions.invoke('willow-applications', {
    body: { action: 'list' },
  });
  if (!listRes.error && listRes.data && Array.isArray(listRes.data.applications)) {
    const all = (listRes.data.applications as LiveApplicationRow[]).map(mapLiveRowToApplication);
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
      return { applications: (rows as LiveApplicationRow[]).map(mapLiveRowToApplication) };
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

export async function submitHeadOrAdminDecision(
  actor: AdminUser,
  applicationId: string,
  status: 'accepted' | 'rejected' | 'waitlisted' | 'pending',
  notes?: string,
  departments?: Department[],
): Promise<{ ok: boolean; application?: Application; error?: string }> {
  if (!hasPermission(actor, 'applications.review', departments)) {
    return { ok: false, error: 'You are not permitted to make application decisions.' };
  }
  const isHeadOrEb = actor.role === 'department_head' || actor.role === 'executive_board';
  if (isHeadOrEb && status !== 'accepted' && status !== 'rejected') {
    return { ok: false, error: 'Department Heads can only accept or decline applications.' };
  }

  const body: Record<string, unknown> = {
    action: 'update',
    id: applicationId,
    status,
  };
  if (!isHeadOrEb && notes !== undefined) {
    body.review_notes = notes;
  }

  const { data, error } = await supabase.functions.invoke('willow-applications', { body });
  if (!error && data && !data.error && data.application) {
    return {
      ok: true,
      application: mapLiveRowToApplication(data.application as LiveApplicationRow),
    };
  }

  // Direct table RLS fallback
  try {
    const patch: Record<string, unknown> = {
      status,
      decision_by: actor.id,
      decision_by_name: actor.fullName,
      decision_at: new Date().toISOString(),
    };
    if (!isHeadOrEb && notes !== undefined) {
      patch.review_notes = notes;
    }
    const { data: row, error: tableErr } = await supabase
      .from('wm_applications')
      .update(patch)
      .eq('id', applicationId)
      .select()
      .single();
    if (!tableErr && row) {
      return {
        ok: true,
        application: mapLiveRowToApplication(row as LiveApplicationRow),
      };
    }
  } catch {
    // Continue to local fallback if application lives in local snapshot
  }

  const localRes = conferenceDataService.updateApplicationStatus(actor, applicationId, status, notes);
  if (localRes.ok && localRes.data) {
    return { ok: true, application: localRes.data };
  }

  return {
    ok: false,
    error: data?.error || error?.message || localRes.error || 'Could not update application status.',
  };
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
