import test from 'node:test';
import assert from 'node:assert/strict';
import type { AdminUser } from '../types/admin';
import {
  ADMIN_DEFAULT_PERMISSIONS,
  DEPARTMENT_HEAD_DEFAULT_PERMISSIONS,
  getNavigationGroups,
  SUPER_ADMIN_PERMISSIONS,
} from './adminPermissions';
import {
  canAccessSpoofSection,
  formatDecisionByLabel,
  formatDecisionSummary,
  normalizeAssignableAdmins,
  selectAssignableAdminsFromStore,
  validateSpoofRequest,
} from './decisionAttribution';

function makeUser(overrides: Partial<AdminUser>): AdminUser {
  return {
    id: 'user-1',
    fullName: 'Test User',
    email: 'test@willowmun.org',
    role: 'admin',
    roleDefinitionId: 'admin',
    title: 'Admin',
    departmentId: null,
    division: null,
    avatarUrl: null,
    isActive: true,
    status: 'active',
    invitationStatus: 'none',
    invitationToken: null,
    lastPasswordResetAt: null,
    permissions: ADMIN_DEFAULT_PERMISSIONS,
    createdAt: '2026-11-01T00:00:00Z',
    lastActiveAt: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

test('canAccessSpoofSection strictly allows only active super_admin users', () => {
  assert.equal(canAccessSpoofSection(makeUser({ role: 'super_admin', permissions: SUPER_ADMIN_PERMISSIONS })), true);
  assert.equal(canAccessSpoofSection(makeUser({ role: 'super_admin', isActive: false, permissions: SUPER_ADMIN_PERMISSIONS })), false);
  assert.equal(canAccessSpoofSection(makeUser({ role: 'admin', title: 'Super Admin Spoof' })), false);
  assert.equal(canAccessSpoofSection(makeUser({ role: 'department_head', permissions: DEPARTMENT_HEAD_DEFAULT_PERMISSIONS })), false);
  assert.equal(canAccessSpoofSection(null), false);
});

test('Spoof sidebar item under Access & Systems appears strictly for super_admin', () => {
  const superNav = getNavigationGroups(
    makeUser({ role: 'super_admin', permissions: SUPER_ADMIN_PERMISSIONS }),
    'super_admin',
  );
  const accessGroup = superNav.find((g) => g.id === 'access-systems');
  assert.ok(accessGroup, 'Super Admin should have Access & Systems group');
  const spoofNav = accessGroup.items.find((item) => item.id === 'spoof');
  assert.ok(spoofNav, 'Super Admin should have Spoof nav item');
  assert.equal(spoofNav.label, 'Spoof');
  assert.equal(spoofNav.path, '/super-admin/spoof');
  assert.equal(spoofNav.superAdminOnly, true);

  const adminNav = getNavigationGroups(
    makeUser({ role: 'admin', permissions: ADMIN_DEFAULT_PERMISSIONS }),
    'admin',
  );
  const adminAllIds = adminNav.flatMap((g) => g.items.map((i) => i.id));
  assert.equal(adminAllIds.includes('spoof'), false);

  const headNav = getNavigationGroups(
    makeUser({ role: 'department_head', departmentId: 'security', permissions: DEPARTMENT_HEAD_DEFAULT_PERMISSIONS }),
    'department_head',
  );
  const headAllIds = headNav.flatMap((g) => g.items.map((i) => i.id));
  assert.equal(headAllIds.includes('spoof'), false);
});

test('formatDecisionByLabel and formatDecisionSummary format attribution uniformly', () => {
  assert.equal(formatDecisionByLabel('rejected', 'Ahmed Magdi'), 'Rejected by Ahmed Magdi');
  assert.equal(formatDecisionByLabel('accepted', 'Layla Hassan'), 'Accepted by Layla Hassan');
  assert.equal(formatDecisionByLabel('waitlisted', 'Naya Barakat'), 'Waitlisted by Naya Barakat');
  assert.equal(formatDecisionByLabel('pending', 'Anyone'), null);
  assert.equal(formatDecisionByLabel('accepted', null), null);

  assert.equal(formatDecisionSummary('pending', null), 'Pending decision');
  assert.equal(formatDecisionSummary('rejected', 'Ahmed Magdi'), 'Rejected by Ahmed Magdi');
  assert.equal(formatDecisionSummary('accepted', ''), 'Accepted');
});

test('normalizeAssignableAdmins keeps only active admins and super_admins sorted with admins first', () => {
  const list = normalizeAssignableAdmins([
    { user_id: 'sa-1', full_name: 'Zayd Super', role: 'super_admin', is_active: true },
    { user_id: 'ad-2', full_name: 'Naya Barakat', role: 'admin', is_active: true },
    { user_id: 'ad-1', full_name: 'Ahmed Magdi', role: 'admin', is_active: true },
    { user_id: 'ad-off', full_name: 'Inactive Admin', role: 'admin', is_active: false },
    { user_id: 'hd-1', full_name: 'Dept Head', role: 'department_head', is_active: true },
    { user_id: 'eb-1', full_name: 'EB Member', role: 'executive_board', is_active: true },
    { user_id: 'ad-2', full_name: 'Duplicate Naya', role: 'admin', is_active: true },
  ]);

  assert.deepEqual(
    list.map((a) => `${a.role}:${a.fullName}`),
    ['admin:Ahmed Magdi', 'admin:Naya Barakat', 'super_admin:Zayd Super'],
  );
});

test('selectAssignableAdminsFromStore filters suspended store admins out', () => {
  const admins = selectAssignableAdminsFromStore([
    makeUser({ id: 'a1', fullName: 'Active Admin', role: 'admin', status: 'active', isActive: true }),
    makeUser({ id: 'a2', fullName: 'Suspended Admin', role: 'admin', status: 'suspended', isActive: true }),
    makeUser({ id: 'h1', fullName: 'Head User', role: 'department_head', status: 'active', isActive: true }),
  ]);
  assert.equal(admins.length, 1);
  assert.equal(admins[0].userId, 'a1');
});

test('validateSpoofRequest requires active existing admin for non-pending decisions and clears for pending', () => {
  const assignableAdmins = normalizeAssignableAdmins([
    { user_id: 'ad-1', full_name: 'Ahmed Magdi', role: 'admin', is_active: true },
  ]);

  const missingAdmin = validateSpoofRequest({
    applicationId: 'app-1',
    nextStatus: 'rejected',
    attributedAdminId: '',
    assignableAdmins,
  });
  assert.equal(missingAdmin.valid, false);

  const nonAdmin = validateSpoofRequest({
    applicationId: 'app-1',
    nextStatus: 'accepted',
    attributedAdminId: 'unknown-id',
    assignableAdmins,
  });
  assert.equal(nonAdmin.valid, false);

  const validAccepted = validateSpoofRequest({
    applicationId: 'app-1',
    nextStatus: 'accepted',
    attributedAdminId: 'ad-1',
    assignableAdmins,
  });
  assert.equal(validAccepted.valid, true);
  if (validAccepted.valid) {
    assert.equal(validAccepted.attributedAdmin?.fullName, 'Ahmed Magdi');
  }

  const validPending = validateSpoofRequest({
    applicationId: 'app-1',
    nextStatus: 'pending',
    attributedAdminId: '',
    assignableAdmins,
  });
  assert.equal(validPending.valid, true);
  if (validPending.valid) {
    assert.equal(validPending.attributedAdmin, null);
  }
});
