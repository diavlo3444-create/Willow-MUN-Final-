import type { Department } from '../types/admin';
import type { LiveQrPassExtended } from '../services/liveBackendService';

export type DepartmentQrSectionKey = 'press_media' | 'volunteers' | 'security';

export interface DepartmentQrMatchInput {
  id: string;
  holder_name: string;
  token_value: string;
  department_id?: string | null;
  department_name?: string | null;
  role_label?: string | null;
  category?: string | null;
  active?: boolean | null;
  checked_in_at?: string | null;
  application_type?: string | null;
  application_department_id?: string | null;
  application_status?: string | null;
  profile_department_id?: string | null;
  profile_is_active?: boolean | null;
}

export function normalizeDepartmentQrSection(
  value: string | null | undefined,
): DepartmentQrSectionKey | null {
  const clean = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
  if (!clean) return null;
  if (
    clean === 'press-media' ||
    clean === 'media-press' ||
    clean === 'media' ||
    clean === 'press' ||
    clean === 'media-&-press' ||
    clean === 'press-&-media'
  ) {
    return 'press_media';
  }
  if (clean === 'volunteers' || clean === 'volunteer' || clean === 'volunteering') {
    return 'volunteers';
  }
  if (clean === 'security') {
    return 'security';
  }
  return null;
}

function resolveDeptKeyToSection(
  rawValue: string | null | undefined,
  departments: Array<Pick<Department, 'id' | 'slug' | 'name'>>,
): DepartmentQrSectionKey | null {
  const clean = String(rawValue || '').trim();
  if (!clean) return null;

  const direct = normalizeDepartmentQrSection(clean);
  if (direct) return direct;

  const lower = clean.toLowerCase();
  const matchedDept = departments.find(
    (d) =>
      d.id === clean ||
      d.slug.toLowerCase() === lower ||
      d.name.toLowerCase() === lower,
  );
  if (matchedDept) {
    return (
      normalizeDepartmentQrSection(matchedDept.slug) ||
      normalizeDepartmentQrSection(matchedDept.name)
    );
  }
  return null;
}

function resolveAnyKnownDeptSlug(
  rawValue: string | null | undefined,
  departments: Array<Pick<Department, 'id' | 'slug' | 'name'>>,
): string | null {
  const clean = String(rawValue || '').trim();
  if (!clean) return null;
  const lower = clean.toLowerCase();
  const matchedDept = departments.find(
    (d) =>
      d.id === clean ||
      d.slug.toLowerCase() === lower ||
      d.name.toLowerCase() === lower,
  );
  if (matchedDept) return matchedDept.slug.toLowerCase();
  return lower;
}

function inferSectionFromRoleLabel(roleLabel: string | null | undefined): DepartmentQrSectionKey | null {
  const clean = String(roleLabel || '').trim().toLowerCase();
  if (!clean) return null;
  if (/\b(press|media|journalist|photographer|videographer|cameraman|reporter)\b/.test(clean)) {
    return 'press_media';
  }
  if (/\b(volunteer|volunteers|volunteering)\b/.test(clean)) {
    return 'volunteers';
  }
  if (/\b(security|guard|entrance\s+security)\b/.test(clean)) {
    return 'security';
  }
  return null;
}

export function isPassEligibleForDisplay(pass: DepartmentQrMatchInput): boolean {
  if (pass.active !== true) return false;
  if (!String(pass.token_value || '').trim()) return false;
  if (
    pass.application_status &&
    String(pass.application_status).trim().toLowerCase() !== 'accepted'
  ) {
    return false;
  }
  if (pass.profile_is_active === false) {
    return false;
  }
  return true;
}

export function matchesDepartmentQrSection(
  pass: DepartmentQrMatchInput,
  section: DepartmentQrSectionKey,
  departments: Array<Pick<Department, 'id' | 'slug' | 'name'>> = [],
): boolean {
  if (!isPassEligibleForDisplay(pass)) return false;

  const candidateKeys = [
    pass.department_id,
    pass.department_name,
    pass.application_department_id,
    pass.application_type,
    pass.profile_department_id,
  ];

  // If any structured department field explicitly belongs to a DIFFERENT known department, stop.
  let hasExplicitOtherDepartment = false;
  for (const key of candidateKeys) {
    if (!key) continue;
    const matchedSection = resolveDeptKeyToSection(key, departments);
    if (matchedSection) {
      return matchedSection === section;
    }
    const knownOther = resolveAnyKnownDeptSlug(key, departments);
    if (
      knownOther &&
      ['hr', 'dcc', 'delegate', 'it', 'design', 'marketing', 'secretariat'].includes(knownOther)
    ) {
      hasExplicitOtherDepartment = true;
    }
  }

  if (hasExplicitOtherDepartment) return false;

  // Fallback to unambiguous role label when structured department fields are absent
  if (String(pass.category || '').trim().toLowerCase() === 'delegate') {
    return false;
  }
  return inferSectionFromRoleLabel(pass.role_label) === section;
}

export function filterAndSortDepartmentQrPasses(
  passes: Array<LiveQrPassExtended & Partial<DepartmentQrMatchInput>>,
  section: DepartmentQrSectionKey,
  departments: Array<Pick<Department, 'id' | 'slug' | 'name'>> = [],
): LiveQrPassExtended[] {
  const seenIds = new Set<string>();
  const filtered: LiveQrPassExtended[] = [];

  for (const pass of passes) {
    if (!pass?.id || seenIds.has(pass.id)) continue;
    if (!matchesDepartmentQrSection(pass, section, departments)) continue;
    seenIds.add(pass.id);
    filtered.push(pass);
  }

  return filtered.sort((a, b) =>
    String(a.holder_name || '').localeCompare(String(b.holder_name || ''), undefined, {
      sensitivity: 'base',
    }),
  );
}
