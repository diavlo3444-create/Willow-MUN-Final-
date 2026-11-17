import test from 'node:test';
import assert from 'node:assert/strict';
import type { AdminUser, Application } from '../types/admin';
import {
  ADMIN_DEFAULT_PERMISSIONS,
  canAccessApplication,
  canAccessDepartment,
  canAccessPortal,
  canManageAccountsOrRoles,
  canReviewFinalDecision,
  canSubmitRecommendation,
  DEPARTMENT_HEAD_DEFAULT_PERMISSIONS,
  getNavigationGroups,
  hasPermission,
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
    createdAt: '2026-10-01T00:00:00.000Z',
    lastActiveAt: '2026-11-17T00:00:00.000Z',
    ...overrides,
  };
}

function makeApp(departmentId: string): Application {
  return {
    id: 'app-1',
    applicationCode: 'WM-2026-001',
    category: 'staff',
    applicantName: 'Applicant One',
    email: 'applicant@example.com',
    phone: '+971 50 000 0000',
    schoolOrUniversity: 'Test University',
    gradeOrYear: 'Year 2',
    city: 'Dubai',
    country: 'UAE',
    age: 19,
    departmentId,
    position: 'Officer',
    secondChoiceDepartmentId: null,
    status: 'pending',
    submittedAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
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
});

test('Admin can operate conference and website CMS but is strictly blocked from accounts and roles', () => {
  const tamperedAdmin = makeUser({
    role: 'admin',
    permissions: {
      ...ADMIN_DEFAULT_PERMISSIONS,
      // Attempt to tamper flags in memory
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
  const superGroup = navGroups.find((g) => g.id === 'super-admin-only');
  assert.ok(superGroup);
  assert.equal(superGroup.items.every((item) => item.readOnlyHint === true), true);
  assert.equal(superGroup.items.some((item) => item.id === 'permission-defs'), false);
});

test('Department Head is strictly isolated to assigned department and limited to Stage 1 recommendations', () => {
  const hrHead = makeUser({
    role: 'department_head',
    roleDefinitionId: 'role-head',
    departmentId: 'hr',
    permissions: { ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS },
  });
  const hrApp = makeApp('hr');
  const mediaApp = makeApp('media-press');

  assert.equal(canAccessPortal(hrHead, 'department_head'), true);
  assert.equal(canAccessPortal(hrHead, 'admin'), false);
  assert.equal(canAccessDepartment(hrHead, 'hr'), true);
  assert.equal(canAccessDepartment(hrHead, 'media-press'), false);
  assert.equal(canAccessApplication(hrHead, hrApp), true);
  assert.equal(canAccessApplication(hrHead, mediaApp), false);
  assert.equal(canSubmitRecommendation(hrHead, hrApp), true);
  assert.equal(canReviewFinalDecision(hrHead, hrApp), false);
});

test('Suspended or inactive users lose all portal and permission access', () => {
  const suspended = makeUser({ role: 'super_admin', status: 'suspended' });
  assert.equal(canAccessPortal(suspended, 'super_admin'), false);
  assert.equal(hasPermission(suspended, 'applications.view'), false);
  assert.equal(canManageAccountsOrRoles(suspended), false);
});
