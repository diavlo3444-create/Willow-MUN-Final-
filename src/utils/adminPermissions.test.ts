import test from 'node:test';
import assert from 'node:assert/strict';
import type { AdminUser, Application, Department } from '../types/admin';
import {
  ADMIN_DEFAULT_PERMISSIONS,
  canAccessApplication,
  canAccessDepartment,
  canAccessEmailsDashboard,
  canAccessPortal,
  canDispatchEmails,
  canManageAccountsOrRoles,
  canOverrideApplicationDecision,
  canReviewFinalDecision,
  canSubmitRecommendation,
  canViewDepartmentQr,
  canViewHrAcceptedApplication,
  DEPARTMENT_HEAD_DEFAULT_PERMISSIONS,
  getActorGenderScope,
  getNavigationGroups,
  getPortalHomeRoute,
  getPortalHomeRouteForUser,
  hasPermission,
  isDccActor,
  isHrActor,
  isSecurityAccount,
  resolveUserPermissions,
  SUPER_ADMIN_PERMISSIONS,
} from './adminPermissions';

function makeUser(overrides: Partial<AdminUser>): AdminUser {
  return {
    id: 'u-1',
    fullName: 'Test User',
    email: 'test@willowmun.org',
    role: 'admin',
    roleDefinitionId: 'role-admin',
    title: 'Staff',
    departmentId: null,
    division: null,
    avatarUrl: null,
    isActive: true,
    status: 'active',
    invitationStatus: 'accepted',
    invitationToken: null,
    lastPasswordResetAt: null,
    permissions: { ...ADMIN_DEFAULT_PERMISSIONS },
    createdAt: '2027-10-01T00:00:00.000Z',
    lastActiveAt: '2027-11-17T00:00:00.000Z',
    ...overrides,
  };
}

function makeApp(
  departmentId: string,
  gender: 'male' | 'female' | null = 'male',
  status: Application['status'] = 'pending',
): Application {
  return {
    id: `app-${departmentId}-${gender ?? 'unknown'}`,
    applicationCode: 'WM-2027-001',
    category: 'staff',
    applicantName: 'Applicant One',
    email: 'applicant@example.com',
    phone: '+971 50 000 0000',
    schoolOrUniversity: 'Test University',
    gradeOrYear: 'Year 2',
    city: 'Dubai',
    country: 'UAE',
    age: 19,
    gender,
    departmentId,
    position: 'Officer',
    secondChoiceDepartmentId: null,
    status,
    submittedAt: '2027-11-10T10:00:00.000Z',
    updatedAt: '2027-11-10T10:00:00.000Z',
    headRecommendation: 'none',
    headNotes: '',
    recommendedBy: null,
    recommendedAt: null,
    finalDecisionBy: null,
    finalDecisionAt: null,
    adminDecisionNotes: '',
    reviewedBy: null,
    reviewedAt: null,
    signupLinkToken: null,
    signupLinkStatus: 'none',
    signupLinkGeneratedAt: null,
    emergencyContact: 'Parent +971 50 000 0001',
    experienceLevel: '2 conferences',
    answers: [],
    documents: [],
    notes: [],
    history: [],
  };
}

test('Super Admin has unrestricted access including accounts, roles, website CMS, and testing', () => {
  const sa = makeUser({
    role: 'super_admin',
    roleDefinitionId: 'role-super-admin',
    permissions: { ...SUPER_ADMIN_PERMISSIONS },
  });
  assert.equal(canManageAccountsOrRoles(sa), true);
  assert.equal(hasPermission(sa, 'accounts.manage_admins'), true);
  assert.equal(hasPermission(sa, 'roles.manage'), true);
  assert.equal(hasPermission(sa, 'testing.impersonate_head'), true);
  assert.equal(canAccessPortal(sa, 'super_admin'), true);
  assert.equal(canAccessPortal(sa, 'admin'), true);
  assert.equal(canAccessDepartment(sa, 'hr'), true);

  const navGroups = getNavigationGroups(sa, 'super_admin');
  const accessGroup = navGroups.find((g) => g.id === 'access-systems');
  assert.ok(accessGroup);
  assert.equal(accessGroup.items.some((i) => i.id === 'admins'), true);
  assert.equal(accessGroup.items.some((i) => i.id === 'testing'), true);
});

test('Admin can operate conference and website CMS but is strictly blocked from accounts and roles', () => {
  const tamperedAdmin = makeUser({
    role: 'admin',
    permissions: {
      ...ADMIN_DEFAULT_PERMISSIONS,
      'accounts.manage_admins': true,
      'accounts.manage_heads': true,
      'roles.manage': true,
      'permissions.manage': true,
    },
  });
  assert.equal(canManageAccountsOrRoles(tamperedAdmin), false);
  assert.equal(hasPermission(tamperedAdmin, 'accounts.manage_admins'), false);
  assert.equal(hasPermission(tamperedAdmin, 'accounts.manage_heads'), false);
  assert.equal(hasPermission(tamperedAdmin, 'roles.manage'), false);
  assert.equal(hasPermission(tamperedAdmin, 'permissions.manage'), false);
  assert.equal(hasPermission(tamperedAdmin, 'website.publish'), true);
  assert.equal(hasPermission(tamperedAdmin, 'committees.manage'), true);
  assert.equal(hasPermission(tamperedAdmin, 'system.monitoring'), true);
  assert.equal(hasPermission(tamperedAdmin, 'accounts.view'), true);

  const navGroups = getNavigationGroups(tamperedAdmin, 'admin');
  assert.equal(navGroups.some((g) => g.id === 'access-systems'), false);
});

test('Department Head is strictly isolated to department + gender and only has accept/decline and My QR', () => {
  const femaleMediaHead = makeUser({
    role: 'department_head',
    roleDefinitionId: 'role-head',
    departmentId: 'media-press',
    division: 'Female Division',
    title: 'Head of Media (Female)',
    permissions: {
      ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS,
      'accounts.manage_heads': true,
      'departments.manage': true,
      'departments.workspace': true,
      'operations.teams': true,
      'operations.shifts': true,
      'qr.manage': true,
      'qr.scan': true,
      'system.settings': true,
    },
  });

  const mediaFemaleApp = makeApp('media-press', 'female');
  const mediaMaleApp = makeApp('media-press', 'male');
  const mediaUnknownGenderApp = makeApp('media-press', null);
  const securityFemaleApp = makeApp('security', 'female');

  assert.equal(getActorGenderScope(femaleMediaHead), 'female');
  assert.equal(canAccessPortal(femaleMediaHead, 'department_head'), true);
  assert.equal(canAccessPortal(femaleMediaHead, 'admin'), false);
  assert.equal(canAccessDepartment(femaleMediaHead, 'media-press'), true);
  assert.equal(canAccessDepartment(femaleMediaHead, 'security'), false);

  assert.equal(canAccessApplication(femaleMediaHead, mediaFemaleApp), true);
  assert.equal(canReviewFinalDecision(femaleMediaHead, mediaFemaleApp), false);
  assert.equal(hasPermission(femaleMediaHead, 'applications.recommend'), true);
  assert.equal(canAccessApplication(femaleMediaHead, mediaMaleApp), false);
  assert.equal(canReviewFinalDecision(femaleMediaHead, mediaMaleApp), false);
  assert.equal(canAccessApplication(femaleMediaHead, mediaUnknownGenderApp), false);
  assert.equal(canAccessApplication(femaleMediaHead, securityFemaleApp), false);
  assert.equal(canSubmitRecommendation(femaleMediaHead, mediaFemaleApp), false);

  assert.equal(hasPermission(femaleMediaHead, 'departments.workspace'), false);
  assert.equal(hasPermission(femaleMediaHead, 'operations.teams'), false);
  assert.equal(hasPermission(femaleMediaHead, 'operations.shifts'), false);
  assert.equal(hasPermission(femaleMediaHead, 'departments.manage'), false);
  assert.equal(hasPermission(femaleMediaHead, 'qr.manage'), false);
  assert.equal(hasPermission(femaleMediaHead, 'qr.scan'), false);
  assert.equal(hasPermission(femaleMediaHead, 'system.settings'), false);
  assert.equal(hasPermission(femaleMediaHead, 'committees.manage'), false);
  assert.equal(hasPermission(femaleMediaHead, 'qr.view_pass'), true);

  const nav = getNavigationGroups(femaleMediaHead, 'department_head');
  assert.deepEqual(
    nav[0].items.map((i) => i.id),
    ['applications', 'press-media', 'qr'],
  );
});

test('HR actor gains cross-department & cross-gender Accepted Applicants access without Super Admin rights', () => {
  const hrHead = makeUser({
    role: 'department_head',
    roleDefinitionId: 'role-head',
    departmentId: 'hr',
    division: 'Male Division',
    title: 'Head of HR (Male)',
    permissions: { ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS },
  });

  const acceptedSecurityFemale = makeApp('security', 'female', 'accepted');
  const pendingSecurityFemale = makeApp('security', 'female', 'pending');

  assert.equal(isHrActor(hrHead), true);
  assert.equal(canViewHrAcceptedApplication(hrHead, acceptedSecurityFemale), true);
  assert.equal(canViewHrAcceptedApplication(hrHead, pendingSecurityFemale), false);
  assert.equal(canAccessApplication(hrHead, acceptedSecurityFemale), false);
  assert.equal(canManageAccountsOrRoles(hrHead), false);

  const nav = getNavigationGroups(hrHead, 'department_head');
  assert.deepEqual(
    nav[0].items.map((i) => i.id),
    ['hr-accepted', 'emails', 'qr'],
  );
});

test('DCC actor can manage committees without gaining Admin/Super Admin permissions', () => {
  const dccMember = makeUser({
    role: 'executive_board',
    roleDefinitionId: 'role-executive-board',
    departmentId: 'dcc',
    title: 'Delegate Affairs (DCC) Coordinator',
    permissions: { ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS, 'applications.view': false, 'applications.review': false },
  });

  assert.equal(isDccActor(dccMember), true);
  assert.equal(hasPermission(dccMember, 'committees.manage'), true);
  assert.equal(hasPermission(dccMember, 'accounts.manage_admins'), false);
  assert.equal(hasPermission(dccMember, 'system.settings'), false);

  const dccHead = makeUser({
    role: 'department_head',
    roleDefinitionId: 'role-head',
    departmentId: 'dcc',
    division: 'Female',
    permissions: { ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS },
  });
  const nav = getNavigationGroups(dccHead, 'department_head');
  assert.deepEqual(
    nav[0].items.map((i) => i.id),
    ['committees', 'qr'],
  );
});

test('Suspended or inactive users lose all portal and permission access', () => {
  const suspended = makeUser({ role: 'super_admin', status: 'suspended' });
  assert.equal(canAccessPortal(suspended, 'super_admin'), false);
  assert.equal(hasPermission(suspended, 'applications.view'), false);
  assert.equal(canManageAccountsOrRoles(suspended), false);
  assert.equal(isHrActor(suspended), false);
  assert.equal(isDccActor(suspended), false);
});

test('Executive Board Head uses the unified /head portal, Media/Press isolation, and UUID department lookup', () => {
  const departments: Department[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      slug: 'hr',
      name: 'Human Resources',
      cluster: 'Delegate Affairs & Operations',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 15,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      slug: 'media-press',
      name: 'Media & Press',
      cluster: 'Communications & Creative',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 15,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
  ];

  const ebHrHead = makeUser({
    role: 'executive_board',
    roleDefinitionId: 'executive_board',
    departmentId: '11111111-1111-1111-1111-111111111111',
    division: 'female',
    title: 'Head of HR',
    ebRank: 'head',
    permissions: resolveUserPermissions('executive_board', null, 'head', { manage_department: true }, 'Head of HR'),
  });

  assert.equal(getPortalHomeRoute('executive_board'), '/head');
  assert.equal(canAccessPortal(ebHrHead, 'department_head'), true);
  assert.equal(canAccessPortal(ebHrHead, 'admin'), false);
  assert.equal(isHrActor(ebHrHead, departments), true);
  assert.equal(canAccessDepartment(ebHrHead, 'hr', departments), true);

  const nav = getNavigationGroups(ebHrHead, 'department_head', departments);
  assert.deepEqual(
    nav[0].items.map((i) => i.id),
    ['hr-accepted', 'emails', 'qr'],
  );

  // Non-head EB member lacking applications.view cannot view/review apps
  const ebObserver = makeUser({
    role: 'executive_board',
    departmentId: '22222222-2222-2222-2222-222222222222',
    division: 'male',
    title: 'Logistics Coordinator',
    ebRank: 'member',
    permissions: resolveUserPermissions('executive_board', { 'applications.view': false }, 'member', {}, 'Logistics Coordinator'),
  });
  const mediaMaleApp = makeApp('media-press', 'male');
  assert.equal(canAccessApplication(ebObserver, mediaMaleApp, departments), false);
  assert.equal(canReviewFinalDecision(ebObserver, mediaMaleApp, departments), false);

  // Media Head vs Press Head isolation
  const ebMediaHead = makeUser({
    role: 'executive_board',
    departmentId: '22222222-2222-2222-2222-222222222222',
    division: 'female',
    title: 'Head of Media (Female)',
    ebRank: 'head',
    permissions: resolveUserPermissions('executive_board', null, 'head', {}, 'Head of Media (Female)'),
  });
  const pressFemaleApp: Application = { ...makeApp('media-press', 'female'), applicationType: 'press', position: 'Press Journalist' };
  const mediaFemaleApp: Application = { ...makeApp('media-press', 'female'), applicationType: 'media', position: 'Media Crew' };
  assert.equal(canAccessApplication(ebMediaHead, mediaFemaleApp, departments), true);
  assert.equal(canAccessApplication(ebMediaHead, pressFemaleApp, departments), false);
});

test('resolveUserPermissions strips superAdminOnly keys for non-super-admins', () => {
  const escalated = resolveUserPermissions('admin', {
    'accounts.manage_admins': true,
    'accounts.manage_heads': true,
    'roles.manage': true,
    'permissions.manage': true,
    'testing.impersonate_head': true,
    'committees.manage': true,
  });
  assert.equal(escalated['accounts.manage_admins'], false);
  assert.equal(escalated['accounts.manage_heads'], false);
  assert.equal(escalated['roles.manage'], false);
  assert.equal(escalated['permissions.manage'], false);
  assert.equal(escalated['testing.impersonate_head'], false);
  assert.equal(escalated['committees.manage'], true);
});

test('Security accounts get dedicated /security scanner portal without admin privileges', () => {
  const departments: Department[] = [
    {
      id: '33333333-3333-3333-3333-333333333333',
      slug: 'security',
      name: 'Security',
      cluster: 'Logistics & Administration',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 15,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
  ];

  const securityGuard = makeUser({
    role: 'executive_board',
    departmentId: '33333333-3333-3333-3333-333333333333',
    title: 'Entrance Security Officer',
    ebRank: 'member',
    permissions: resolveUserPermissions('executive_board', { 'applications.view': false, 'qr.scan': true }, 'member', { scan_qr: true }, 'Entrance Security Officer'),
  });

  assert.equal(isSecurityAccount(securityGuard, departments), true);
  assert.equal(canAccessPortal(securityGuard, 'security', departments), true);
  assert.equal(canAccessPortal(securityGuard, 'admin', departments), false);
  assert.equal(canAccessPortal(securityGuard, 'super_admin', departments), false);
  assert.equal(hasPermission(securityGuard, 'qr.scan', departments), true);
  assert.equal(hasPermission(securityGuard, 'qr.manage', departments), false);
  assert.equal(hasPermission(securityGuard, 'accounts.manage_admins', departments), false);
  assert.equal(hasPermission(securityGuard, 'applications.review', departments), false);
  assert.equal(getPortalHomeRouteForUser(securityGuard, departments), '/security');

  const secNav = getNavigationGroups(securityGuard, 'security', departments);
  assert.deepEqual(
    secNav[0].items.map((i) => i.id),
    ['scanner', 'history', 'qr'],
  );

  const regularAdmin = makeUser({
    role: 'admin',
    permissions: { ...ADMIN_DEFAULT_PERMISSIONS },
  });
  assert.equal(isSecurityAccount(regularAdmin, departments), false);
  assert.equal(canAccessPortal(regularAdmin, 'security', departments), false);
  assert.equal(canAccessPortal(regularAdmin, 'admin', departments), true);

  const adminNav = getNavigationGroups(regularAdmin, 'admin');
  const adminOps = adminNav.find((g) => g.id === 'operations');
  assert.ok(adminOps);
  assert.equal(adminOps.items.some((i) => i.id === 'application-management'), true);

  const sa = makeUser({
    role: 'super_admin',
    permissions: { ...SUPER_ADMIN_PERMISSIONS },
  });
  const saNav = getNavigationGroups(sa, 'super_admin');
  const saOps = saNav.find((g) => g.id === 'operations');
  assert.ok(saOps);
  assert.equal(saOps.items.some((i) => i.id === 'application-management'), true);
});

test('Security, Volunteer, Media, and Press staff accounts route to exact portals without EB or Admin privilege escalation', () => {
  const departments: Department[] = [
    {
      id: '33333333-3333-3333-3333-333333333333',
      slug: 'security',
      name: 'Security',
      cluster: 'Logistics & Administration',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 15,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      slug: 'volunteers',
      name: 'Volunteers',
      cluster: 'Logistics & Administration',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 30,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
    {
      id: '55555555-5555-5555-5555-555555555555',
      slug: 'media',
      name: 'Media',
      cluster: 'Communications & Creative',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 15,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
    {
      id: '66666666-6666-6666-6666-666666666666',
      slug: 'press',
      name: 'Press',
      cluster: 'Communications & Creative',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 15,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
  ];

  const securityStaff = makeUser({
    role: 'staff',
    departmentId: '33333333-3333-3333-3333-333333333333',
    departmentSlug: null,
    title: 'Security Gate Officer',
    permissions: resolveUserPermissions('staff', null, null, null, 'Security Gate Officer'),
  });
  assert.equal(isSecurityAccount(securityStaff, departments), true);
  assert.equal(canAccessPortal(securityStaff, 'security', departments), true);
  assert.equal(canAccessPortal(securityStaff, 'staff', departments), false);
  assert.equal(canAccessPortal(securityStaff, 'department_head', departments), false);
  assert.equal(canAccessPortal(securityStaff, 'admin', departments), false);
  assert.equal(hasPermission(securityStaff, 'qr.scan', departments), true);
  assert.equal(hasPermission(securityStaff, 'qr.view_pass', departments), true);
  assert.equal(hasPermission(securityStaff, 'applications.view', departments), false);
  assert.equal(getPortalHomeRouteForUser(securityStaff, departments), '/security');

  const volunteerStaff = makeUser({
    role: 'staff',
    departmentId: '44444444-4444-4444-4444-444444444444',
    departmentSlug: null,
    title: 'Floor Volunteer',
    permissions: resolveUserPermissions('staff', null, null, null, 'Floor Volunteer'),
  });
  assert.equal(isSecurityAccount(volunteerStaff, departments), false);
  assert.equal(canAccessPortal(volunteerStaff, 'staff', departments), true);
  assert.equal(canAccessPortal(volunteerStaff, 'security', departments), false);
  assert.equal(canAccessPortal(volunteerStaff, 'department_head', departments), false);
  assert.equal(hasPermission(volunteerStaff, 'qr.scan', departments), false);
  assert.equal(hasPermission(volunteerStaff, 'departments.workspace', departments), true);
  assert.equal(hasPermission(volunteerStaff, 'operations.teams', departments), true);
  assert.equal(hasPermission(volunteerStaff, 'operations.shifts', departments), true);
  assert.equal(hasPermission(volunteerStaff, 'applications.view', departments), false);
  assert.equal(getPortalHomeRouteForUser(volunteerStaff, departments), '/staff/volunteers');
  assert.equal(canAccessDepartment(volunteerStaff, 'volunteers', departments), true);
  assert.equal(canAccessDepartment(volunteerStaff, 'media', departments), false);

  const volNav = getNavigationGroups(volunteerStaff, 'staff', departments);
  assert.equal(volNav[0].items[0].path, '/staff/volunteers');
  assert.equal(volNav[0].items[1].path, '/staff/volunteers/workspace');

  const mediaStaff = makeUser({
    role: 'staff',
    departmentId: '55555555-5555-5555-5555-555555555555',
    departmentSlug: null,
    title: 'Event Photographer',
    permissions: resolveUserPermissions('staff', null, null, null, 'Event Photographer'),
  });
  assert.equal(getPortalHomeRouteForUser(mediaStaff, departments), '/staff/media');

  const pressStaff = makeUser({
    role: 'staff',
    departmentId: '66666666-6666-6666-6666-666666666666',
    departmentSlug: null,
    title: 'Committee Press Reporter',
    permissions: resolveUserPermissions('staff', null, null, null, 'Committee Press Reporter'),
  });
  assert.equal(getPortalHomeRouteForUser(pressStaff, departments), '/staff/press');

  // Even if departments failed to load and departmentId is UUID, title inference rescues routing
  const securityStaffNoDepts = makeUser({
    role: 'staff',
    departmentId: '33333333-3333-3333-3333-333333333333',
    departmentSlug: null,
    title: 'Entrance Security Guard',
    permissions: resolveUserPermissions('staff'),
  });
  assert.equal(getPortalHomeRouteForUser(securityStaffNoDepts, []), '/security');
  assert.equal(canAccessPortal(securityStaffNoDepts, 'security', []), true);
});

test('Email dashboard & Failed to Send recovery strictly allow Admin and HR only', () => {
  const departments: Department[] = [
    {
      id: 'dept-hr',
      slug: 'hr',
      name: 'Human Resources',
      cluster: 'Delegate Affairs & Operations',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 10,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
    {
      id: 'dept-sec',
      slug: 'security',
      name: 'Security',
      cluster: 'Logistics & Administration',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 20,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
  ];

  const superAdmin = makeUser({ role: 'super_admin', permissions: { ...SUPER_ADMIN_PERMISSIONS } });
  const admin = makeUser({ role: 'admin', permissions: { ...ADMIN_DEFAULT_PERMISSIONS } });
  const readOnlyAdmin = makeUser({
    role: 'admin',
    permissions: { ...ADMIN_DEFAULT_PERMISSIONS, 'email.send': false },
  });
  const hrHead = makeUser({
    role: 'department_head',
    departmentId: 'dept-hr',
    title: 'Head of HR',
    permissions: { ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS },
  });
  const hrEbMember = makeUser({
    role: 'executive_board',
    departmentId: 'dept-hr',
    title: 'HR Officer',
    permissions: resolveUserPermissions('executive_board'),
  });
  const securityHead = makeUser({
    role: 'department_head',
    departmentId: 'dept-sec',
    title: 'Head of Security',
    permissions: { ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS, 'email.view': true, 'email.send': true },
  });
  const volunteerStaff = makeUser({
    role: 'staff',
    departmentId: 'volunteers',
    title: 'Volunteer',
    permissions: resolveUserPermissions('staff'),
  });
  const suspendedHr = makeUser({
    role: 'department_head',
    departmentId: 'dept-hr',
    status: 'suspended',
  });

  assert.equal(canAccessEmailsDashboard(superAdmin, departments), true);
  assert.equal(canDispatchEmails(superAdmin, departments), true);

  assert.equal(canAccessEmailsDashboard(admin, departments), true);
  assert.equal(canDispatchEmails(admin, departments), true);

  assert.equal(canAccessEmailsDashboard(readOnlyAdmin, departments), true);
  assert.equal(canDispatchEmails(readOnlyAdmin, departments), false);

  assert.equal(canAccessEmailsDashboard(hrHead, departments), true);
  assert.equal(canDispatchEmails(hrHead, departments), true);

  assert.equal(canAccessEmailsDashboard(hrEbMember, departments), true);
  assert.equal(canDispatchEmails(hrEbMember, departments), true);

  // Other departments & staff MUST be blocked even if permissions were tampered
  assert.equal(canAccessEmailsDashboard(securityHead, departments), false);
  assert.equal(canDispatchEmails(securityHead, departments), false);
  assert.equal(canAccessEmailsDashboard(volunteerStaff, departments), false);
  assert.equal(canDispatchEmails(volunteerStaff, departments), false);
  assert.equal(canAccessEmailsDashboard(suspendedHr, departments), false);
  assert.equal(canAccessEmailsDashboard(null, departments), false);
});

test('Volunteering, Press & Media, and Security staff and heads view own department QR codes without Admin permissions while qr.manage stays Admin-only', () => {
  const departments: Department[] = [
    {
      id: 'dept-vol',
      slug: 'volunteers',
      name: 'Volunteers',
      cluster: 'Logistics & Administration',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 30,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
    {
      id: 'dept-media',
      slug: 'media',
      name: 'Media',
      cluster: 'Communications & Creative',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 15,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
    {
      id: 'dept-press',
      slug: 'press',
      name: 'Press',
      cluster: 'Communications & Creative',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 15,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
    {
      id: 'dept-sec',
      slug: 'security',
      name: 'Security',
      cluster: 'Logistics & Administration',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 20,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
    {
      id: 'dept-hr',
      slug: 'hr',
      name: 'Human Resources',
      cluster: 'Delegate Affairs & Operations',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 10,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
  ];

  const volunteerStaff = makeUser({
    role: 'staff',
    departmentId: 'dept-vol',
    title: 'Volunteer Staff',
    permissions: resolveUserPermissions('staff'),
  });
  assert.equal(canViewDepartmentQr(volunteerStaff, 'volunteers', departments), true);
  assert.equal(canViewDepartmentQr(volunteerStaff, 'press_media', departments), false);
  assert.equal(canViewDepartmentQr(volunteerStaff, 'security', departments), false);
  assert.equal(hasPermission(volunteerStaff, 'qr.manage', departments), false);

  const volunteerHead = makeUser({
    role: 'department_head',
    departmentId: 'dept-vol',
    division: 'Male Division',
    title: 'Head of Volunteers (Male)',
    permissions: resolveUserPermissions('department_head'),
  });
  assert.equal(canViewDepartmentQr(volunteerHead, 'volunteers', departments), true);
  assert.equal(canViewDepartmentQr(volunteerHead, 'press_media', departments), false);
  assert.equal(hasPermission(volunteerHead, 'qr.manage', departments), false);
  assert.deepEqual(
    getNavigationGroups(volunteerHead, 'department_head', departments)[0].items.map((i) => i.id),
    ['applications', 'volunteering', 'qr'],
  );

  const pressStaff = makeUser({
    role: 'staff',
    departmentId: 'dept-press',
    title: 'Press Reporter',
    permissions: resolveUserPermissions('staff'),
  });
  const mediaEbHead = makeUser({
    role: 'executive_board',
    departmentId: 'dept-media',
    division: 'Female Division',
    title: 'Head of Media (Female)',
    ebRank: 'head',
    permissions: resolveUserPermissions('executive_board', null, 'head', {}, 'Head of Media (Female)'),
  });
  assert.equal(canViewDepartmentQr(pressStaff, 'press_media', departments), true);
  assert.equal(canViewDepartmentQr(pressStaff, 'volunteers', departments), false);
  assert.equal(hasPermission(pressStaff, 'qr.manage', departments), false);
  assert.equal(canViewDepartmentQr(mediaEbHead, 'press_media', departments), true);
  assert.equal(canViewDepartmentQr(mediaEbHead, 'volunteers', departments), false);
  assert.equal(hasPermission(mediaEbHead, 'qr.manage', departments), false);
  assert.deepEqual(
    getNavigationGroups(mediaEbHead, 'department_head', departments)[0].items.map((i) => i.id),
    ['applications', 'press-media', 'qr'],
  );

  const securityStaff = makeUser({
    role: 'staff',
    departmentId: 'dept-sec',
    title: 'Security Gate Officer',
    permissions: resolveUserPermissions('staff'),
  });
  assert.equal(canViewDepartmentQr(securityStaff, 'security', departments), true);
  assert.equal(hasPermission(securityStaff, 'qr.scan', departments), true);
  assert.equal(hasPermission(securityStaff, 'qr.manage', departments), false);

  const securityNoPassPerm = makeUser({
    role: 'staff',
    departmentId: 'dept-sec',
    title: 'Security Gate Officer',
    permissions: resolveUserPermissions('staff', { 'qr.view_pass': false }),
  });
  assert.equal(canViewDepartmentQr(securityNoPassPerm, 'security', departments), false);
  assert.equal(hasPermission(securityNoPassPerm, 'qr.scan', departments), true);

  const hrHead = makeUser({
    role: 'department_head',
    departmentId: 'dept-hr',
    title: 'Head of HR',
    permissions: resolveUserPermissions('department_head'),
  });
  assert.equal(canViewDepartmentQr(hrHead, 'volunteers', departments), false);
  assert.equal(canViewDepartmentQr(hrHead, 'press_media', departments), false);
  assert.equal(canViewDepartmentQr(hrHead, 'security', departments), false);

  const admin = makeUser({ role: 'admin', permissions: { ...ADMIN_DEFAULT_PERMISSIONS } });
  assert.equal(canViewDepartmentQr(admin, 'volunteers', departments), true);
  assert.equal(canViewDepartmentQr(admin, 'press_media', departments), true);
  assert.equal(canViewDepartmentQr(admin, 'security', departments), true);
  assert.equal(hasPermission(admin, 'qr.manage', departments), true);
});

test('Super Admin decision override permission strictly checks active super_admin role (never title)', () => {
  const superAdmin = makeUser({
    role: 'super_admin',
    title: 'Director General',
    permissions: { ...SUPER_ADMIN_PERMISSIONS },
  });
  const suspendedSuperAdmin = makeUser({
    role: 'super_admin',
    isActive: false,
    status: 'suspended',
    permissions: { ...SUPER_ADMIN_PERMISSIONS },
  });
  const spoofedTitleAdmin = makeUser({
    role: 'admin',
    title: 'Super Admin',
    permissions: { ...SUPER_ADMIN_PERMISSIONS },
  });
  const departmentHead = makeUser({
    role: 'department_head',
    title: 'Super Admin',
    permissions: { ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS },
  });
  const ebUser = makeUser({ role: 'executive_board', title: 'Super Admin' });
  const staffUser = makeUser({ role: 'staff', title: 'Staff' });

  assert.equal(canOverrideApplicationDecision(superAdmin), true);
  assert.equal(canOverrideApplicationDecision(suspendedSuperAdmin), false);
  assert.equal(canOverrideApplicationDecision(spoofedTitleAdmin), false);
  assert.equal(canOverrideApplicationDecision(departmentHead), false);
  assert.equal(canOverrideApplicationDecision(ebUser), false);
  assert.equal(canOverrideApplicationDecision(staffUser), false);
  assert.equal(canOverrideApplicationDecision(null), false);
  assert.equal(canOverrideApplicationDecision(undefined), false);
});

test('Admin and Super Admin Operations sidebar exposes Registrations plus Pending, Accepted, and Rejected sections without duplicate HR Accepted', () => {
  for (const [role, portal, base] of [
    ['admin', 'admin', '/admin'],
    ['super_admin', 'super_admin', '/super-admin'],
  ] as const) {
    const actor = makeUser({
      role,
      permissions: role === 'super_admin' ? { ...SUPER_ADMIN_PERMISSIONS } : { ...ADMIN_DEFAULT_PERMISSIONS },
    });
    const nav = getNavigationGroups(actor, portal);
    const ops = nav.find((g) => g.id === 'operations');
    assert.ok(ops);
    const ids = ops.items.map((item) => item.id);
    assert.equal(ids.includes('applications'), true);
    assert.equal(ids.includes('pending-applications'), true);
    assert.equal(ids.includes('accepted-applicants'), true);
    assert.equal(ids.includes('rejected-applicants'), true);
    assert.equal(ids.includes('hr-accepted'), false);
    assert.equal(ops.items.find((i) => i.id === 'pending-applications')?.path, `${base}/pending-applications`);
    assert.equal(ops.items.find((i) => i.id === 'accepted-applicants')?.path, `${base}/accepted-applicants`);
    assert.equal(ops.items.find((i) => i.id === 'rejected-applicants')?.path, `${base}/rejected-applicants`);

    const acceptedLabels = nav.flatMap((g) => g.items).filter((i) => i.label === 'Accepted Applicants');
    assert.equal(acceptedLabels.length, 1);
  }
});
