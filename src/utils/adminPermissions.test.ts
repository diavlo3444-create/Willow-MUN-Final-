import test from 'node:test';
import assert from 'node:assert/strict';
import type { AdminUser, Application, Department } from '../types/admin';
import {
  ADMIN_DEFAULT_PERMISSIONS,
  canAccessApplication,
  canAccessDepartment,
  canAccessPortal,
  canManageAccountsOrRoles,
  canReviewFinalDecision,
  canSubmitRecommendation,
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
  assert.equal(canReviewFinalDecision(femaleMediaHead, mediaFemaleApp), true);
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
    ['applications', 'qr'],
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
    ['applications', 'hr-accepted', 'qr'],
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
    ['applications', 'committees', 'qr'],
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
    ['applications', 'hr-accepted', 'qr'],
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
});



