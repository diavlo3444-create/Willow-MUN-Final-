import type {
  AdminUser,
  Application,
  Department,
  PermissionDefinition,
  PermissionKey,
  PermissionMap,
  PortalKey,
  RoleType,
} from '../types/admin';

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Applications & Forms
  {
    key: 'applications.view',
    label: 'View Applications',
    category: 'Applications & Forms',
    description: 'Access application lists and applicant summary tables.',
  },
  {
    key: 'applications.view_confidential',
    label: 'View Confidential Profiles & Files',
    category: 'Applications & Forms',
    description: 'Inspect contact info, full answers, and uploaded applicant documents.',
  },
  {
    key: 'applications.review',
    label: 'Final Application Decisions (Stage 2)',
    category: 'Applications & Forms',
    description: 'Accept, reject, waitlist, or change final applicant status.',
  },
  {
    key: 'applications.recommend',
    label: 'Submit Department Recommendations (Stage 1)',
    category: 'Applications & Forms',
    description: 'Submit Stage 1 accept/reject recommendations for administrative review.',
  },
  {
    key: 'applications.bulk_actions',
    label: 'Bulk Application Actions',
    category: 'Applications & Forms',
    description: 'Execute bulk status updates and bulk approve recommended applicants.',
  },
  {
    key: 'applications.notes',
    label: 'Internal Evaluation Notes',
    category: 'Applications & Forms',
    description: 'Record confidential internal notes on applicant dossiers.',
  },
  {
    key: 'applications.export',
    label: 'Export Application Records',
    category: 'Applications & Forms',
    description: 'Export filtered applicant datasets to CSV.',
  },
  {
    key: 'applications.signup_links',
    label: 'Manage Applicant Signup Links',
    category: 'Applications & Forms',
    description: 'Generate, copy, revoke, and regenerate signup invitation links.',
  },
  {
    key: 'forms.manage',
    label: 'Manage Application Forms',
    category: 'Applications & Forms',
    description: 'Create/edit forms and questions without altering historical submissions.',
  },

  // Conference Content
  {
    key: 'departments.view_all',
    label: 'View All Departments',
    category: 'Conference Content',
    description: 'Inspect all conference departments across clusters.',
  },
  {
    key: 'departments.manage',
    label: 'Manage Departments',
    category: 'Conference Content',
    description: 'Create departments and edit capacities, positions, and instructions.',
  },
  {
    key: 'departments.assign_head',
    label: 'Assign Department Heads to Departments',
    category: 'Conference Content',
    description: 'Link or unlink department heads in department configuration.',
  },
  {
    key: 'departments.toggle_registration',
    label: 'Toggle Department Registration',
    category: 'Conference Content',
    description: 'Open or close registration per department.',
  },
  {
    key: 'committees.manage',
    label: 'Manage Committees',
    category: 'Conference Content',
    description: 'Create, edit, reorder, and publish MUN committees and chairs.',
  },
  {
    key: 'secretariat.view',
    label: 'View Secretariat Roster',
    category: 'Conference Content',
    description: 'Inspect conference Secretariat profiles.',
  },
  {
    key: 'secretariat.manage',
    label: 'Manage Secretariat Roster',
    category: 'Conference Content',
    description: 'Add, edit, remove, and reorder Secretariat members.',
  },
  {
    key: 'executive_board.manage',
    label: 'Manage Executive Board',
    category: 'Conference Content',
    description: 'Add, edit, categorize, and reorder Executive Board members.',
  },
  {
    key: 'sponsors.manage',
    label: 'Manage Sponsors',
    category: 'Conference Content',
    description: 'Create, edit, reorder, and toggle sponsor visibility.',
  },
  {
    key: 'schedule.manage',
    label: 'Manage Schedule & Calendar',
    category: 'Conference Content',
    description: 'Create and publish official conference schedule events.',
  },
  {
    key: 'content.conference_assets',
    label: 'Manage Docs, FAQs & Gallery',
    category: 'Conference Content',
    description: 'Manage conference documents, FAQs, and public gallery items.',
  },

  // Department & Operations
  {
    key: 'departments.workspace',
    label: 'Department Operations Workspace',
    category: 'Department & Operations',
    description: 'Access tasks, campaigns, incidents, run-of-show, and directives.',
  },
  {
    key: 'operations.teams',
    label: 'Manage Teams & Rosters',
    category: 'Department & Operations',
    description: 'Organize team groups, custom positions, and staff rosters.',
  },
  {
    key: 'operations.shifts',
    label: 'Manage Shifts',
    category: 'Department & Operations',
    description: 'Schedule shifts, start/end times, and personnel coverage.',
  },
  {
    key: 'operations.deployment',
    label: 'Manage Deployment Planner',
    category: 'Department & Operations',
    description: 'Assign staff to stations, duties, locations, and supervisors.',
  },
  {
    key: 'qr.view_pass',
    label: 'View Personal QR Pass',
    category: 'Department & Operations',
    description: 'View conference QR identification pass.',
  },
  {
    key: 'qr.scan',
    label: 'Operate QR Security Scanner',
    category: 'Department & Operations',
    description: 'Scan QR passes at checkpoints and record attendance.',
  },
  {
    key: 'qr.manage',
    label: 'Manage QR Passes & Venue Attendance',
    category: 'Department & Operations',
    description: 'Issue, revoke, and monitor live venue attendance.',
  },

  // Website CMS
  {
    key: 'website.view',
    label: 'View Website CMS & Previews',
    category: 'Website CMS',
    description: 'Inspect pages, sections, navigation, SEO, and multi-viewport previews.',
  },
  {
    key: 'website.edit',
    label: 'Edit Website Drafts',
    category: 'Website CMS',
    description: 'Modify pages, sections, navigation, footer, SEO, and announcements in draft.',
  },
  {
    key: 'website.publish',
    label: 'Publish Website Changes & Rollback',
    category: 'Website CMS',
    description: 'Publish draft snapshots live and restore prior version history.',
  },
  {
    key: 'media.manage',
    label: 'Manage Media Library',
    category: 'Website CMS',
    description: 'Upload, rename, replace, organize, and delete website assets.',
  },

  // Communication
  {
    key: 'email.view',
    label: 'View Email Center & History',
    category: 'Communication',
    description: 'Inspect templates, connection status, and dispatched emails.',
  },
  {
    key: 'email.send',
    label: 'Send Individual Emails',
    category: 'Communication',
    description: 'Compose and send templated emails to single recipients.',
  },
  {
    key: 'email.bulk_send',
    label: 'Send Bulk Emails',
    category: 'Communication',
    description: 'Dispatch batch emails to filtered applicant groups.',
  },
  {
    key: 'inquiries.manage',
    label: 'Manage Messages & Inquiries',
    category: 'Communication',
    description: 'Review contact submissions, add internal notes, and resolve inquiries.',
  },

  // Administration & Reports
  {
    key: 'registration.view',
    label: 'View Registration Status',
    category: 'Administration & Reports',
    description: 'Monitor registration intake and departmental quotas.',
  },
  {
    key: 'registration.manage',
    label: 'Manage Registration Controls',
    category: 'Administration & Reports',
    description: 'Toggle global/department registration and edit windows/deadlines.',
  },
  {
    key: 'reports.view',
    label: 'View Statistics & Reports',
    category: 'Administration & Reports',
    description: 'Inspect analytics dashboards and conference performance breakdowns.',
  },
  {
    key: 'reports.export',
    label: 'Export Reports (CSV)',
    category: 'Administration & Reports',
    description: 'Download department, registration, and summary CSV reports.',
  },
  {
    key: 'logs.view',
    label: 'View Activity Logs',
    category: 'Administration & Reports',
    description: 'Audit administrative, operational, and security events.',
  },
  {
    key: 'system.settings',
    label: 'Manage Conference Settings',
    category: 'Administration & Reports',
    description: 'Edit conference dates, venue, organizer details, fees, and legal policies.',
  },
  {
    key: 'system.monitoring',
    label: 'Access System Monitoring',
    category: 'Administration & Reports',
    description: 'Monitor service health, error alerts, and technical configuration.',
  },
  {
    key: 'accounts.view',
    label: 'View Account Directories',
    category: 'Administration & Reports',
    description: 'Inspect administrator and department head directories (read-only for Admin).',
  },

  // Super Admin Security (strictly enforced for Super Admin only)
  {
    key: 'accounts.manage_admins',
    label: 'Manage Administrator Accounts',
    category: 'Super Admin Security',
    description: 'Create, edit, suspend, reactivate, invite, reset, and delete Admin accounts.',
    superAdminOnly: true,
  },
  {
    key: 'accounts.manage_heads',
    label: 'Manage Department Head Accounts',
    category: 'Super Admin Security',
    description: 'Create, assign departments/divisions, suspend, and delete Head accounts.',
    superAdminOnly: true,
  },
  {
    key: 'roles.manage',
    label: 'Manage Role Definitions',
    category: 'Super Admin Security',
    description: 'Create, edit, and delete conference role definitions.',
    superAdminOnly: true,
  },
  {
    key: 'permissions.manage',
    label: 'Configure Global Permission Definitions',
    category: 'Super Admin Security',
    description: 'Configure global permission rules and individual staff overrides.',
    superAdminOnly: true,
  },
  {
    key: 'testing.impersonate_head',
    label: 'Department Access Testing Mode',
    category: 'Super Admin Security',
    description: 'Preview /head as any selected Department Head in an isolated test session.',
    superAdminOnly: true,
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_DEFINITIONS.map((p) => p.key);

export function buildPermissionMap(
  overrides: Partial<PermissionMap> = {},
  defaultValue = false,
): PermissionMap {
  const map = {} as PermissionMap;
  for (const key of ALL_PERMISSION_KEYS) {
    map[key] = overrides[key] ?? defaultValue;
  }
  return map;
}

export const SUPER_ADMIN_PERMISSIONS: PermissionMap = buildPermissionMap({}, true);

export const ADMIN_DEFAULT_PERMISSIONS: PermissionMap = buildPermissionMap({
  'applications.view': true,
  'applications.view_confidential': true,
  'applications.review': true,
  'applications.recommend': true,
  'applications.bulk_actions': true,
  'applications.notes': true,
  'applications.export': true,
  'applications.signup_links': true,
  'forms.manage': true,
  'departments.view_all': true,
  'departments.manage': true,
  'departments.assign_head': false,
  'departments.toggle_registration': true,
  'departments.workspace': true,
  'committees.manage': true,
  'secretariat.view': true,
  'secretariat.manage': true,
  'executive_board.manage': true,
  'sponsors.manage': true,
  'schedule.manage': true,
  'content.conference_assets': true,
  'operations.teams': true,
  'operations.shifts': true,
  'operations.deployment': true,
  'qr.view_pass': true,
  'qr.scan': true,
  'qr.manage': true,
  'website.view': true,
  'website.edit': true,
  'website.publish': true,
  'media.manage': true,
  'registration.view': true,
  'registration.manage': true,
  'accounts.view': true,
  // CRITICAL ACCOUNT SECURITY: Admins NEVER manage accounts or role definitions
  'accounts.manage_admins': false,
  'accounts.manage_heads': false,
  'roles.manage': false,
  'permissions.manage': false,
  'testing.impersonate_head': false,
  'email.view': true,
  'email.send': true,
  'email.bulk_send': true,
  'inquiries.manage': true,
  'reports.view': true,
  'reports.export': true,
  'logs.view': true,
  'system.settings': true,
  'system.monitoring': true,
});

export const DEPARTMENT_HEAD_DEFAULT_PERMISSIONS: PermissionMap = buildPermissionMap({
  'applications.view': true,
  'applications.view_confidential': true,
  'applications.review': false,
  'applications.recommend': true,
  'applications.notes': false,
  'applications.bulk_actions': false,
  'applications.export': false,
  'applications.signup_links': false,
  'departments.workspace': false,
  'operations.teams': false,
  'operations.shifts': false,
  'operations.deployment': false,
  'qr.view_pass': true,
  'qr.scan': false,
  'qr.manage': false,
});

export const EXECUTIVE_BOARD_DEFAULT_PERMISSIONS: PermissionMap = buildPermissionMap({
  'applications.view': false,
  'applications.view_confidential': false,
  'applications.review': false,
  'applications.recommend': false,
  'departments.workspace': true,
  'operations.teams': true,
  'operations.shifts': true,
  'operations.deployment': true,
  'qr.view_pass': true,
  'qr.scan': false,
});

export const ROLE_DEFAULT_PERMISSIONS: Record<RoleType, PermissionMap> = {
  super_admin: SUPER_ADMIN_PERMISSIONS,
  admin: ADMIN_DEFAULT_PERMISSIONS,
  department_head: DEPARTMENT_HEAD_DEFAULT_PERMISSIONS,
  executive_board: EXECUTIVE_BOARD_DEFAULT_PERMISSIONS,
};

export const SUPER_ADMIN_ONLY_KEYS = new Set<PermissionKey>(
  PERMISSION_DEFINITIONS.filter((p) => p.superAdminOnly).map((p) => p.key),
);

export function normalizeDepartmentSlug(value: string | null | undefined): string {
  const clean = String(value || '').trim().toLowerCase();
  if (!clean) return '';
  if (clean === 'human-resources' || clean === 'human_resources') return 'hr';
  if (clean === 'delegate-affairs' || clean === 'delegate_affairs') return 'dcc';
  if (clean === 'media-press') return 'media';
  if (clean === 'media') return 'media';
  if (clean === 'press') return 'press';
  if (clean === 'volunteer') return 'volunteers';
  return clean;
}

export function getActorDepartmentSlug(
  user: AdminUser | null | undefined,
  departments?: Department[],
): string | null {
  if (!user) return null;
  if (user.departmentSlug) {
    return normalizeDepartmentSlug(user.departmentSlug);
  }
  if (user.departmentId && departments?.length) {
    const matched = departments.find(
      (d) =>
        d.id === user.departmentId ||
        normalizeDepartmentSlug(d.slug) === normalizeDepartmentSlug(user.departmentId),
    );
    if (matched) return normalizeDepartmentSlug(matched.slug);
  }
  if (user.departmentId) {
    const normalized = normalizeDepartmentSlug(user.departmentId);
    // Avoid returning raw UUID as slug if not found in departments
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) {
      return normalized;
    }
  }
  const label = `${user.title || ''} ${user.division || ''}`.toLowerCase();
  if (/\b(hr|human\s+resources)\b/.test(label)) return 'hr';
  if (/\b(dcc|delegate\s+affairs|delegate\s+care)\b/.test(label)) return 'dcc';
  if (/\bpress\b/.test(label)) return 'press';
  if (/\bmedia\b/.test(label)) return 'media';
  if (/\bsecurity\b/.test(label)) return 'security';
  if (/\bvolunteers?\b/.test(label)) return 'volunteers';
  return null;
}

export function isEbHeadActor(profile: {
  role?: RoleType | string | null;
  ebRank?: string | null;
  ebPermissions?: Record<string, boolean> | null;
  title?: string | null;
  permissions?: Partial<PermissionMap> | null;
}): boolean {
  if (!profile) return false;
  if (profile.role === 'department_head') return true;
  if (profile.role !== 'executive_board') return false;
  const rank = String(profile.ebRank || '').toLowerCase();
  if (rank === 'head' || rank === 'co_head') return true;
  if (profile.ebPermissions?.manage_department === true) return true;
  if (/\bhead\b/i.test(String(profile.title || ''))) return true;
  if (profile.permissions?.['applications.view'] === true) return true;
  return false;
}

export function resolveUserPermissions(
  role: RoleType,
  dbPermissions?: Partial<Record<string, boolean>> | null,
  ebRank?: string | null,
  ebPermissions?: Record<string, boolean> | null,
  title?: string | null,
): PermissionMap {
  if (role === 'super_admin') {
    return { ...SUPER_ADMIN_PERMISSIONS };
  }

  let base: PermissionMap;
  if (role === 'admin') {
    base = { ...ADMIN_DEFAULT_PERMISSIONS };
  } else if (role === 'department_head') {
    base = { ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS };
  } else {
    const ebHead = isEbHeadActor({ role, ebRank, ebPermissions, title, permissions: dbPermissions ?? undefined });
    base = ebHead ? { ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS } : { ...EXECUTIVE_BOARD_DEFAULT_PERMISSIONS };
  }

  if (dbPermissions && typeof dbPermissions === 'object') {
    for (const key of ALL_PERMISSION_KEYS) {
      if (SUPER_ADMIN_ONLY_KEYS.has(key)) {
        base[key] = false;
        continue;
      }
      if (typeof dbPermissions[key] === 'boolean') {
        base[key] = Boolean(dbPermissions[key]);
      }
    }
  }

  for (const superKey of SUPER_ADMIN_ONLY_KEYS) {
    base[superKey] = false;
  }

  return base;
}

export function getActorGenderScope(user: AdminUser | null | undefined): 'male' | 'female' | null {
  if (!user) return null;
  const label = `${user.division || ''} ${user.title || ''} ${user.fullName || ''}`.toLowerCase();
  if (/\bfemale\b|\bwomen\b|\bwoman\b|\bgirls?\b/.test(label)) return 'female';
  if (/\bmale\b|\bmen\b|\bman\b|\bboys?\b/.test(label)) return 'male';
  return null;
}

export function getMediaPressSubScope(user: AdminUser | null | undefined): 'media' | 'press' | null {
  if (!user) return null;
  const label = `${user.title || ''} ${user.division || ''}`.toLowerCase();
  if (/\bpress\b/.test(label)) return 'press';
  if (/\bmedia\b/.test(label)) return 'media';
  return null;
}

export function isHrActor(user: AdminUser | null | undefined, departments?: Department[]): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  const deptSlug = getActorDepartmentSlug(user, departments);
  const deptRaw = (user.departmentId || '').toLowerCase();
  const title = `${user.title || ''} ${user.division || ''}`.toLowerCase();
  return (
    deptSlug === 'hr' ||
    deptRaw === 'hr' ||
    deptRaw === 'human-resources' ||
    /\bhr\b|human resources/.test(title)
  );
}

export function isDccActor(user: AdminUser | null | undefined, departments?: Department[]): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  if (user.ebPermissions?.manage_committees || user.permissions?.['committees.manage']) return true;
  const deptSlug = getActorDepartmentSlug(user, departments);
  const deptRaw = (user.departmentId || '').toLowerCase();
  const title = `${user.title || ''} ${user.division || ''}`.toLowerCase();
  return (
    deptSlug === 'dcc' ||
    deptRaw === 'dcc' ||
    deptRaw === 'delegate-affairs' ||
    /\bdcc\b|delegate affairs|committees?\s*(chair|head|director|lead)/.test(title)
  );
}

export function isSecurityAccount(
  user: AdminUser | null | undefined,
  departments?: Department[],
): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  if (user.role === 'department_head') {
    return (
      getActorDepartmentSlug(user, departments) === 'security' &&
      user.permissions?.['qr.scan'] !== false
    );
  }
  if (user.role === 'executive_board') {
    return getActorDepartmentSlug(user, departments) === 'security' && user.permissions?.['qr.scan'] !== false;
  }
  return false;
}

/**
 * Enforces that ONLY Super Admins can ever exercise account, role, or testing privileges,
 * regardless of UI state or manually mutated permission objects.
 * Department Heads and EB members share the same scoped permission model on /head:
 * application review (dept + gender + Media/Press isolated), personal My QR,
 * and explicit HR / DCC domain modules when assigned.
 */
export function hasPermission(
  user: AdminUser | null | undefined,
  permission: PermissionKey,
  departments?: Department[],
): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  if (user.role === 'super_admin') return true;
  if (permission === 'qr.scan' && user.role === 'admin') return true;
  if (SUPER_ADMIN_ONLY_KEYS.has(permission)) return false;

  if (user.role === 'department_head') {
    if (
      permission === 'applications.view' ||
      permission === 'applications.view_confidential' ||
      permission === 'applications.review' ||
      permission === 'applications.recommend'
    ) {
      const applicationDepartment = getActorDepartmentSlug(user, departments);
      const applicationDepartmentAllowed =
        ['media', 'press', 'security', 'volunteers'].includes(applicationDepartment || '') &&
        (applicationDepartment !== 'media' && applicationDepartment !== 'press' || getMediaPressSubScope(user) !== null);
      if (permission === 'applications.review') return false;
      return applicationDepartmentAllowed && user.permissions?.[permission] !== false;
    }
    if (permission === 'qr.view_pass') {
      return user.permissions?.['qr.view_pass'] !== false;
    }
    if (permission === 'qr.scan') {
      return (
        getActorDepartmentSlug(user, departments) === 'security' &&
        user.permissions?.['qr.scan'] !== false
      );
    }
    if (permission === 'committees.manage') {
      return isDccActor(user, departments);
    }
    return false;
  }

  if (user.role === 'executive_board') {
    if (
      permission === 'applications.view' ||
      permission === 'applications.view_confidential' ||
      permission === 'applications.review' ||
      permission === 'applications.recommend'
    ) {
      const applicationDepartment = getActorDepartmentSlug(user, departments);
      const applicationDepartmentAllowed =
        ['media', 'press', 'security', 'volunteers'].includes(applicationDepartment || '') &&
        (applicationDepartment !== 'media' && applicationDepartment !== 'press' || getMediaPressSubScope(user) !== null);
      if (!applicationDepartmentAllowed) return false;
      if (permission === 'applications.review') return false;
      if (typeof user.permissions?.[permission] === 'boolean') {
        return Boolean(user.permissions[permission]);
      }
      return isEbHeadActor(user);
    }
    if (permission === 'committees.manage') {
      return isDccActor(user, departments);
    }
    if (permission === 'qr.view_pass') {
      return user.permissions?.['qr.view_pass'] !== false;
    }
    if (permission === 'qr.scan') {
      return getActorDepartmentSlug(user, departments) === 'security' && user.permissions?.['qr.scan'] !== false;
    }
    return false;
  }

  return Boolean(user.permissions[permission]);
}

export function canManageAccountsOrRoles(user: AdminUser | null | undefined): boolean {
  return Boolean(user && user.isActive && user.status === 'active' && user.role === 'super_admin');
}

export function canAccessPortal(
  user: AdminUser | null | undefined,
  portal: PortalKey,
  departments?: Department[],
): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  if (user.role === 'super_admin') return true;
  if (portal === 'admin') return user.role === 'admin';
  if (portal === 'department_head') {
    return user.role === 'department_head' || user.role === 'executive_board';
  }
  if (portal === 'executive_board') return user.role === 'executive_board';
  if (portal === 'security') return isSecurityAccount(user, departments);
  return false;
}

export function canAccessDepartment(
  user: AdminUser | null | undefined,
  departmentId: string,
  departments?: Department[],
): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  if (user.role === 'department_head' || user.role === 'executive_board') {
    if (!user.departmentId && !user.departmentSlug) return false;
    if (user.departmentId === departmentId) return true;
    const actorSlug = getActorDepartmentSlug(user, departments);
    const matchedTarget = departments?.find(
      (d) => d.id === departmentId || normalizeDepartmentSlug(d.slug) === normalizeDepartmentSlug(departmentId),
    );
    const targetSlug = normalizeDepartmentSlug(matchedTarget?.slug || departmentId);
    return Boolean(actorSlug && targetSlug && actorSlug === targetSlug);
  }
  return false;
}

export function canAccessApplication(
  user: AdminUser | null | undefined,
  application: Application,
  departments?: Department[],
): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  if (user.role === 'super_admin' || user.role === 'admin') {
    return hasPermission(user, 'applications.view', departments);
  }
  if (user.role === 'department_head' || user.role === 'executive_board') {
    if (!hasPermission(user, 'applications.view', departments)) return false;
    if (!canAccessDepartment(user, application.departmentId, departments)) return false;

    const actorDeptSlug = getActorDepartmentSlug(user, departments);
    if (actorDeptSlug === 'media-press' || actorDeptSlug === 'media' || actorDeptSlug === 'press') {
      const subScope = getMediaPressSubScope(user);
      const appType = String(
        application.applicationType ||
          (application.category === 'press'
            ? 'press'
            : /\bpress\b/i.test(application.position || '')
              ? 'press'
              : application.category === 'media'
                ? 'media'
                : ''),
      ).toLowerCase();
      if (subScope && appType && subScope !== appType) return false;
    }

    const actorGender = getActorGenderScope(user);
    const applicantGender = application.gender ? application.gender.toLowerCase() : null;
    if (!actorGender || !applicantGender) return false;
    return actorGender === applicantGender;
  }
  return false;
}

export function canViewHrAcceptedApplication(
  user: AdminUser | null | undefined,
  application: Application,
  departments?: Department[],
): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  if (application.status !== 'accepted') return false;
  return isHrActor(user, departments);
}

export function canViewConfidentialApplicantInfo(
  user: AdminUser | null | undefined,
  application: Application,
  departments?: Department[],
): boolean {
  if (canViewHrAcceptedApplication(user, application, departments)) return true;
  if (!canAccessApplication(user, application, departments)) return false;
  return hasPermission(user, 'applications.view_confidential', departments);
}

/**
 * Private medical disclosures are strictly limited to authorized Administrators
 * (Super Admin or Admin with applications.view_confidential). Department Heads,
 * EB Heads, and general HR actors never receive unredacted medical details.
 */
export function canViewConfidentialMedicalInfo(
  user: AdminUser | null | undefined,
  departments?: Department[],
): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'admin') {
    return hasPermission(user, 'applications.view_confidential', departments);
  }
  return false;
}

export function canReviewFinalDecision(
  user: AdminUser | null | undefined,
  application: Application,
  departments?: Department[],
): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  return (
    canAccessApplication(user, application, departments) &&
    hasPermission(user, 'applications.review', departments)
  );
}

export function canSubmitRecommendation(
  user: AdminUser | null | undefined,
  application: Application,
  departments?: Department[],
): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  if (user.role === 'department_head' || user.role === 'executive_board') return false;
  if (!canAccessApplication(user, application, departments)) return false;
  return hasPermission(user, 'applications.recommend', departments);
}

export function getRoleLabel(role: RoleType): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'department_head':
      return 'Department Head';
    case 'executive_board':
      return 'Executive Board';
  }
}

export function getPortalHomeRoute(role: RoleType): string {
  switch (role) {
    case 'super_admin':
      return '/super-admin';
    case 'admin':
      return '/admin';
    case 'department_head':
    case 'executive_board':
      return '/head';
  }
}

export function getPortalHomeRouteForUser(
  user: AdminUser | null | undefined,
  departments?: Department[],
): string {
  if (!user) return '/portal';
  if (user.role === 'super_admin') return '/super-admin';
  if (user.role === 'admin') return '/admin';
  if (isSecurityAccount(user, departments) && !hasPermission(user, 'applications.view', departments)) {
    return '/security';
  }
  return '/head';
}

export function getPortalBasePath(portal: PortalKey): string {
  switch (portal) {
    case 'super_admin':
      return '/super-admin';
    case 'admin':
      return '/admin';
    case 'security':
      return '/security';
    case 'department_head':
    case 'executive_board':
      return '/head';
  }
}

export interface NavItemConfig {
  id: string;
  label: string;
  path: string;
  readOnlyHint?: boolean;
  requiredPermission?: PermissionKey;
  superAdminOnly?: boolean;
}

export interface NavGroupConfig {
  id: string;
  label: string;
  items: NavItemConfig[];
}

export function getNavigationGroups(
  user: AdminUser | null | undefined,
  portal: PortalKey,
  departments?: Department[],
): NavGroupConfig[] {
  if (!user || !canAccessPortal(user, portal, departments)) return [];

  const base = getPortalBasePath(portal);
  const isSuper = user.role === 'super_admin';

  if (portal === 'security') {
    const items: NavItemConfig[] = [
      { id: 'scanner', label: 'Live QR Scanner', path: '/security' },
      { id: 'history', label: 'Scan History', path: '/security/history' },
      { id: 'qr', label: 'My QR', path: '/security/qr', requiredPermission: 'qr.view_pass' },
    ];
    const visible = items.filter((item) => !item.requiredPermission || hasPermission(user, item.requiredPermission, departments));
    return visible.length ? [{ id: 'security-entrance', label: 'Entrance Security', items: visible }] : [];
  }

  if (portal === 'department_head' || portal === 'executive_board') {
    const items: NavItemConfig[] = [
      { id: 'applications', label: 'Applications', path: '/head/applications', requiredPermission: 'applications.view' },
      ...(isSecurityAccount(user, departments)
        ? [{ id: 'scanner', label: 'Entrance Scanner', path: '/head/scanner', requiredPermission: 'qr.scan' } satisfies NavItemConfig]
        : []),
      ...(isHrActor(user, departments)
        ? [{ id: 'hr-accepted', label: 'Accepted Applicants', path: '/head/hr-accepted' } satisfies NavItemConfig]
        : []),
      ...(isDccActor(user, departments)
        ? [{ id: 'committees', label: 'Committees', path: '/head/committees', requiredPermission: 'committees.manage' } satisfies NavItemConfig]
        : []),
      { id: 'qr', label: 'My QR', path: '/head/qr', requiredPermission: 'qr.view_pass' },
    ];
    const visible = items.filter((item) => !item.requiredPermission || hasPermission(user, item.requiredPermission, departments));
    return visible.length
      ? [{ id: 'head-portal', label: 'Department Review', items: visible }]
      : [];
  }

  const groups: NavGroupConfig[] = [
    {
      id: 'operations',
      label: 'Operations',
      items: [
        { id: 'dashboard', label: 'Overview', path: base },
        { id: 'applications', label: 'Registrations', path: base + '/applications', requiredPermission: 'applications.view' },
        ...(isHrActor(user, departments)
          ? [{ id: 'hr-accepted', label: 'Accepted Applicants', path: base + '/hr-accepted' } satisfies NavItemConfig]
          : []),
        { id: 'reports', label: 'Reports', path: base + '/reports', requiredPermission: 'reports.view' },
        { id: 'qr', label: 'QR Pass Scanner', path: base + '/qr', requiredPermission: 'qr.view_pass' },
        { id: 'attendance', label: 'Check-In Records', path: base + '/attendance', requiredPermission: 'qr.manage' },
      ],
    },
    ...(isSuper
      ? [
          {
            id: 'access-systems',
            label: 'Access & Systems',
            items: [
              { id: 'account-management', label: 'Account Management', path: base + '/account-management', requiredPermission: 'accounts.manage_admins', superAdminOnly: true },
              { id: 'admins', label: 'Admin Accounts', path: base + '/admins', requiredPermission: 'accounts.view', superAdminOnly: true },
              { id: 'eb-signup-link', label: 'EB Sign Up Link', path: base + '/eb-signup-link', superAdminOnly: true },
              { id: 'testing', label: 'Department Testing', path: base + '/testing', requiredPermission: 'testing.impersonate_head', superAdminOnly: true },
            ],
          } satisfies NavGroupConfig,
        ]
      : []),
    {
      id: 'communications',
      label: 'Communications',
      items: [
        { id: 'settings', label: 'Settings', path: base + '/settings', requiredPermission: 'system.settings' },
      ],
    },
    {
      id: 'website-content',
      label: 'Website CMS & Content',
      items: [
        { id: 'committees', label: 'Committees', path: base + '/committees', requiredPermission: 'committees.manage' },
        { id: 'sponsors', label: 'Sponsors', path: base + '/sponsors', requiredPermission: 'sponsors.manage' },
        { id: 'schedule', label: 'Schedule', path: base + '/schedule', requiredPermission: 'schedule.manage' },
        { id: 'announcements', label: 'Announcements', path: base + '/announcements', requiredPermission: 'website.edit' },
        { id: 'documents', label: 'Documents', path: base + '/documents', requiredPermission: 'content.conference_assets' },
        { id: 'faqs', label: 'FAQs', path: base + '/faqs', requiredPermission: 'content.conference_assets' },
      ],
    },
  ];

  return groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.superAdminOnly && !isSuper) return false;
      if (!item.requiredPermission) return true;
      return hasPermission(user, item.requiredPermission, departments);
    }),
  })).filter((group) => group.items.length > 0);
}
