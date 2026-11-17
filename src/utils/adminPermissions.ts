import type {
  AdminUser,
  Application,
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
  'applications.recommend': true,
  'applications.notes': true,
  'applications.review': false,
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
  executive_board: DEPARTMENT_HEAD_DEFAULT_PERMISSIONS,
};

const SUPER_ADMIN_ONLY_KEYS = new Set<PermissionKey>(
  PERMISSION_DEFINITIONS.filter((p) => p.superAdminOnly).map((p) => p.key),
);

/**
 * Enforces that ONLY Super Admins can ever exercise account, role, or testing privileges,
 * regardless of UI state or manually mutated permission objects.
 */
export function hasPermission(
  user: AdminUser | null | undefined,
  permission: PermissionKey,
): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  if (user.role === 'super_admin') return true;
  if (SUPER_ADMIN_ONLY_KEYS.has(permission)) return false;
  return Boolean(user.permissions[permission]);
}

export function canManageAccountsOrRoles(user: AdminUser | null | undefined): boolean {
  return Boolean(user && user.isActive && user.status === 'active' && user.role === 'super_admin');
}

export function canAccessPortal(user: AdminUser | null | undefined, portal: PortalKey): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  if (user.role === 'super_admin') return true;
  if (portal === 'admin') return user.role === 'admin';
  if (portal === 'department_head') return user.role === 'department_head';
  if (portal === 'executive_board') return user.role === 'executive_board';
  return false;
}

export function canAccessDepartment(
  user: AdminUser | null | undefined,
  departmentId: string,
): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  if (user.role === 'department_head' || user.role === 'executive_board') {
    return Boolean(user.departmentId && user.departmentId === departmentId);
  }
  return false;
}

export function canAccessApplication(
  user: AdminUser | null | undefined,
  application: Application,
): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  if (!hasPermission(user, 'applications.view')) return false;
  if (user.role === 'department_head') {
    return Boolean(user.departmentId && user.departmentId === application.departmentId);
  }
  return true;
}

export function canViewConfidentialApplicantInfo(
  user: AdminUser | null | undefined,
  application: Application,
): boolean {
  if (!canAccessApplication(user, application)) return false;
  return hasPermission(user, 'applications.view_confidential');
}

export function canReviewFinalDecision(
  user: AdminUser | null | undefined,
  application: Application,
): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;
  if (user.role === 'department_head') return false; // Dept heads submit Stage 1 recommendations only
  return canAccessApplication(user, application) && hasPermission(user, 'applications.review');
}

export function canSubmitRecommendation(
  user: AdminUser | null | undefined,
  application: Application,
): boolean {
  if (!canAccessApplication(user, application)) return false;
  return hasPermission(user, 'applications.recommend');
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
      return '/head';
    case 'executive_board':
      return '/eb';
  }
}

export function getPortalBasePath(portal: PortalKey): string {
  switch (portal) {
    case 'super_admin':
      return '/super-admin';
    case 'admin':
      return '/admin';
    case 'department_head':
      return '/head';
    case 'executive_board':
      return '/eb';
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
): NavGroupConfig[] {
  if (!user || !canAccessPortal(user, portal)) return [];

  const base = getPortalBasePath(portal);
  const isSuper = user.role === 'super_admin';

  if (portal === 'department_head') {
    const items: NavItemConfig[] = [
      { id: 'overview', label: 'Overview', path: '/head' },
      { id: 'applications', label: 'Applications', path: '/head/applications', requiredPermission: 'applications.view' },
      { id: 'workspace', label: 'Workspace', path: '/head/workspace', requiredPermission: 'departments.workspace' },
      { id: 'teams', label: 'Groups', path: '/head/teams', requiredPermission: 'operations.teams' },
      { id: 'shifts', label: 'Shifts & Roster', path: '/head/shifts', requiredPermission: 'operations.shifts' },
    ];
    const visible = items.filter((item) => !item.requiredPermission || hasPermission(user, item.requiredPermission));
    return visible.length ? [{ id: 'department-workspace', label: 'Department Workspace', items: visible }] : [];
  }

  const groups: NavGroupConfig[] = [
    {
      id: 'operations',
      label: 'Operations',
      items: [
        { id: 'dashboard', label: 'Overview', path: base },
        { id: 'applications', label: 'Registrations', path: base + '/applications', requiredPermission: 'applications.view' },
        { id: 'executive-board', label: 'Executive Board', path: base + '/executive-board', requiredPermission: 'executive_board.manage' },
        { id: 'heads', label: 'Heads', path: base + '/heads', requiredPermission: 'accounts.view' },
        { id: 'departments', label: 'Departments', path: base + '/departments', requiredPermission: 'departments.view_all' },
        { id: 'reports', label: 'Reports', path: base + '/reports', requiredPermission: 'reports.view' },
        { id: 'attendance', label: 'Checked-In People', path: base + '/attendance', requiredPermission: 'qr.manage' },
        { id: 'qr', label: 'Security Website', path: base + '/qr', requiredPermission: 'qr.view_pass' },
      ],
    },
    ...(isSuper ? [{
      id: 'access-systems',
      label: 'Access & Systems',
      items: [
        { id: 'admins', label: 'Admin Accounts', path: base + '/admins', requiredPermission: 'accounts.view', superAdminOnly: true },
        { id: 'eb-accounts', label: 'EB Signup & Accounts', path: base + '/eb-accounts', superAdminOnly: true },
        { id: 'testing', label: 'Head Access Testing', path: base + '/testing', requiredPermission: 'testing.impersonate_head', superAdminOnly: true },
      ],
    }] : []),
    {
      id: 'communications',
      label: 'Communications',
      items: [
        { id: 'messages', label: 'Inquiries', path: base + '/messages', requiredPermission: 'inquiries.manage' },
        { id: 'settings', label: 'Settings', path: base + '/settings', requiredPermission: 'system.settings' },
      ],
    },
    {
      id: 'website-content',
      label: 'Website CMS & Content',
      items: [
        { id: 'website-editor', label: 'Live Visual Editor', path: base + '/website-editor', requiredPermission: 'website.view' },
        { id: 'committees', label: 'Committees', path: base + '/committees', requiredPermission: 'committees.manage' },
        { id: 'secretariat', label: 'Secretariat', path: base + '/secretariat', requiredPermission: 'secretariat.view' },
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
      return hasPermission(user, item.requiredPermission);
    }),
  })).filter((group) => group.items.length > 0);
}
