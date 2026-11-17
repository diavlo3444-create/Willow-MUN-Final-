import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPER_ADMIN_PERMISSIONS } from '../utils/adminPermissions';
import { conferenceDataService } from './mockDataService';

test('seeded dataset has strictly 3 roles with zero IT role accounts', () => {
  const snap = conferenceDataService.resetDemoData();
  const roles = new Set(snap.users.map((u) => u.role));
  assert.equal(roles.has('super_admin'), true);
  assert.equal(roles.has('admin'), true);
  assert.equal(roles.has('department_head'), true);
  assert.equal(snap.users.every((u) => u.role !== ('it' as string)), true);
});

test('service blocks Admin from creating/suspending accounts or modifying role definitions', () => {
  const snap = conferenceDataService.resetDemoData();
  const admin = snap.users.find((u) => u.role === 'admin')!;
  const target = snap.users.find((u) => u.role === 'department_head')!;

  const createRes = conferenceDataService.createAccount(admin, {
    fullName: 'Unauthorized Admin Attempt',
    email: 'blocked@willowmun.org',
    password: 'password123',
    role: 'admin',
    roleDefinitionId: 'role-admin',
    title: 'Blocked',
    departmentId: null,
    division: 'Ops',
    isActive: true,
    sendInvitation: false,
    permissions: SUPER_ADMIN_PERMISSIONS,
  });
  assert.equal(createRes.ok, false);

  const suspendRes = conferenceDataService.suspendAccount(admin, target.id);
  assert.equal(suspendRes.ok, false);

  const roleRes = conferenceDataService.saveRoleDefinition(admin, snap.roleDefinitions[0]);
  assert.equal(roleRes.ok, false);
});

test('two-stage review enforces Dept Head Stage 1 recommendation != Stage 2 acceptance', () => {
  const snap = conferenceDataService.resetDemoData();
  const head = snap.users.find((u) => u.departmentId === 'hr')!;
  const admin = snap.users.find((u) => u.role === 'admin')!;
  const pendingHrApp = snap.applications.find(
    (a) => a.departmentId === 'hr' && a.status === 'pending',
  )!;

  const illegalDirectAccept = conferenceDataService.updateApplicationStatus(
    head,
    pendingHrApp.id,
    'accepted',
  );
  assert.equal(illegalDirectAccept.ok, false);

  const recRes = conferenceDataService.submitHeadRecommendation(
    head,
    pendingHrApp.id,
    'recommend_accept',
    'Strong HR rubric sample',
  );
  assert.equal(recRes.ok, true);
  assert.equal(recRes.data?.status, 'pending');
  assert.equal(recRes.data?.headRecommendation, 'recommend_accept');

  const stage2Res = conferenceDataService.updateApplicationStatus(
    admin,
    pendingHrApp.id,
    'accepted',
    'Final Stage 2 confirmed by Admin',
  );
  assert.equal(stage2Res.ok, true);
  assert.equal(stage2Res.data?.status, 'accepted');
});

test('Website CMS keeps draft isolated from published until Publish Changes & Version Rollback', () => {
  const snap = conferenceDataService.resetDemoData();
  const superAdmin = snap.users.find((u) => u.role === 'super_admin')!;
  const initialBanner = snap.websitePublished.bannerText;

  conferenceDataService.updateWebsiteDraft(
    superAdmin,
    (draft) => ({ ...draft, bannerText: 'DRAFT ONLY ANNOUNCEMENT 2026' }),
    'Update banner in draft',
  );

  let current = conferenceDataService.getSnapshot();
  assert.equal(current.websiteDraft.bannerText, 'DRAFT ONLY ANNOUNCEMENT 2026');
  assert.equal(current.websitePublished.bannerText, initialBanner);

  const pubRes = conferenceDataService.publishWebsiteChanges(superAdmin, 'Publish new banner');
  assert.equal(pubRes.ok, true);

  current = conferenceDataService.getSnapshot();
  assert.equal(current.websitePublished.bannerText, 'DRAFT ONLY ANNOUNCEMENT 2026');

  // Rollback to v1
  const v1 = current.websiteVersions.find((v) => v.versionNumber === 1)!;
  const rbRes = conferenceDataService.restoreWebsiteVersion(superAdmin, v1.id, true);
  assert.equal(rbRes.ok, true);
  assert.equal(conferenceDataService.getSnapshot().websitePublished.bannerText, initialBanner);
});
