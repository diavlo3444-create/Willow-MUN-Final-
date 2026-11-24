import type { AdminUser, ApplicationStatus } from '../types/admin';
import { canOverrideApplicationDecision } from './adminPermissions';

export interface AssignableAdminOption {
  userId: string;
  fullName: string;
  email: string;
  role: 'admin' | 'super_admin';
  title: string;
}

export interface SpoofAuditEntry {
  id: string;
  application_id: string;
  applicant_name: string;
  application_code: string | null;
  previous_status: string;
  new_status: string;
  reason: string;
  actor_user_id: string | null;
  actor_name: string | null;
  previous_decision_by_name: string | null;
  spoofed_decision_by: string | null;
  spoofed_decision_by_name: string | null;
  created_at: string;
}

export interface RawAssignableAdminRow {
  user_id?: string | null;
  id?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
  title?: string | null;
  is_active?: boolean | null;
  isActive?: boolean | null;
}

export function canAccessSpoofSection(user: AdminUser | null | undefined): boolean {
  return canOverrideApplicationDecision(user);
}

export function cleanDecisionMakerName(decisionBy?: string | null): string | null {
  const raw = String(decisionBy || '').trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/\s*\(\s*(?:attributed\s+(?:by|to)\s+super\s*admin|spoofed\s+by)\s*:[^)]*\)\s*$/i, '')
    .trim();
  return cleaned || null;
}

export function formatDecisionByLabel(
  status: ApplicationStatus | string,
  decisionBy?: string | null,
): string | null {
  const cleanName = cleanDecisionMakerName(decisionBy);
  const cleanStatus = String(status || '').trim().toLowerCase();
  if (!cleanName || cleanStatus === 'pending') return null;
  if (cleanStatus === 'accepted') return `Accepted by ${cleanName}`;
  if (cleanStatus === 'rejected') return `Rejected by ${cleanName}`;
  if (cleanStatus === 'waitlisted') return `Waitlisted by ${cleanName}`;
  if (cleanStatus === 'withdrawn') return `Withdrawn by ${cleanName}`;
  return `Decided by ${cleanName}`;
}

export function formatDecisionSummary(
  status: ApplicationStatus | string,
  decisionBy?: string | null,
): string {
  const explicit = formatDecisionByLabel(status, decisionBy);
  if (explicit) return explicit;
  const cleanStatus = String(status || '').trim().toLowerCase();
  if (cleanStatus === 'pending') return 'Pending decision';
  if (!cleanStatus) return 'Pending decision';
  return cleanStatus.charAt(0).toUpperCase() + cleanStatus.slice(1);
}

export function normalizeAssignableAdmins(rows: RawAssignableAdminRow[]): AssignableAdminOption[] {
  const deduped = new Map<string, AssignableAdminOption>();
  for (const row of rows || []) {
    const userId = String(row.user_id || row.id || '').trim();
    const fullName = String(row.full_name || row.fullName || '').trim();
    const role = String(row.role || '').trim();
    const isActive = row.is_active !== false && row.isActive !== false;
    if (!userId || !fullName || !isActive) continue;
    if (role !== 'admin' && role !== 'super_admin') continue;
    if (deduped.has(userId)) continue;
    deduped.set(userId, {
      userId,
      fullName,
      email: String(row.email || '').trim(),
      role,
      title: String(row.title || '').trim(),
    });
  }
  return Array.from(deduped.values()).sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
    return a.fullName.localeCompare(b.fullName);
  });
}

export function selectAssignableAdminsFromStore(users: AdminUser[]): AssignableAdminOption[] {
  return normalizeAssignableAdmins(
    (users || [])
      .filter((u) => u.isActive && u.status === 'active' && (u.role === 'admin' || u.role === 'super_admin'))
      .map((u) => ({
        user_id: u.id,
        full_name: u.fullName,
        email: u.email,
        role: u.role,
        title: u.title,
        is_active: u.isActive,
      })),
  );
}

export function validateSpoofRequest(input: {
  applicationId: string;
  nextStatus: ApplicationStatus;
  attributedAdminId: string;
  assignableAdmins: AssignableAdminOption[];
}):
  | { valid: true; attributedAdmin: AssignableAdminOption | null }
  | { valid: false; error: string } {
  const applicationId = String(input.applicationId || '').trim();
  if (!applicationId) {
    return { valid: false, error: 'Application ID is required.' };
  }

  if (!['pending', 'accepted', 'rejected', 'waitlisted'].includes(input.nextStatus)) {
    return { valid: false, error: 'Choose Accepted, Rejected, Waitlisted, or Pending.' };
  }

  if (input.nextStatus === 'pending') {
    return { valid: true, attributedAdmin: null };
  }

  const targetId = String(input.attributedAdminId || '').trim();
  if (!targetId) {
    return {
      valid: false,
      error: 'Select an existing Admin account to attribute this decision to.',
    };
  }

  const matched = input.assignableAdmins.find((admin) => admin.userId === targetId);
  if (!matched) {
    return {
      valid: false,
      error: 'Selected Admin account is not active or not eligible.',
    };
  }

  return { valid: true, attributedAdmin: matched };
}
