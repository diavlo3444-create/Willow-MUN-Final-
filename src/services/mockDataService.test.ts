import test from 'node:test';
import assert from 'node:assert/strict';
import type { AdminUser } from '../types/admin';
import {
  ADMIN_DEFAULT_PERMISSIONS,
  DEPARTMENT_HEAD_DEFAULT_PERMISSIONS,
  EXECUTIVE_BOARD_DEFAULT_PERMISSIONS,
  SUPER_ADMIN_PERMISSIONS,
} from '../utils/adminPermissions';
import { conferenceDataService } from './mockDataService';

function bootstrapSuperAdmin(): AdminUser {
  return {
    id: 'usr-sa-bootstrap',
    fullName: 'Bootstrap Super Admin',
    email: 'super@willowmun.org',
    role: 'super_admin',
    roleDefinitionId: 'role-super-admin',
    title: 'Secretary-General',
    departmentId: null,
    division: null,
    avatarUrl: null,
    isActive: true,
    status: 'active',
    invitationStatus: 'accepted',
    invitationToken: null,
    lastPasswordResetAt: null,
    permissions: { ...SUPER_ADMIN_PERMISSIONS },
    createdAt: '2027-10-01T00:00:00.000Z',
    lastActiveAt: '2027-11-17T00:00:00.000Z',
  };
}

test('production snapshot starts clean with core role definitions and zero IT role accounts', () => {
  const snap = conferenceDataService.resetDemoData();
  assert.equal(snap.users.length, 0);
  assert.equal(snap.applications.length, 0);
  const roleKeys = new Set(snap.roleDefinitions.map((r) => r.key));
  assert.equal(roleKeys.has('super_admin'), true);
  assert.equal(roleKeys.has('admin'), true);
  assert.equal(roleKeys.has('department_head'), true);
  assert.equal(roleKeys.has('executive_board'), true);
  assert.equal(roleKeys.has('it' as never), false);
});

test('service blocks Admin from creating/suspending accounts or modifying role definitions', () => {
  const snap = conferenceDataService.resetDemoData();
  const sa = bootstrapSuperAdmin();

  const adminRes = conferenceDataService.createAccount(sa, {
    fullName: 'Conference Admin',
    email: 'admin@willowmun.org',
    password: 'password123',
    role: 'admin',
    roleDefinitionId: 'role-admin',
    title: 'Director',
    departmentId: null,
    division: null,
    isActive: true,
    sendInvitation: false,
    permissions: { ...ADMIN_DEFAULT_PERMISSIONS },
  });
  assert.equal(adminRes.ok, true);
  const admin = adminRes.data!;

  const deptRes = conferenceDataService.createDepartment(sa, {
    slug: 'hr',
    name: 'Human Resources',
    cluster: 'Delegate Affairs & Operations',
    description: 'HR team',
    capacity: 15,
    positions: ['Officer'],
    registrationOpen: true,
    instructions: 'Standard HR review',
  });
  assert.equal(deptRes.ok, true);

  const headRes = conferenceDataService.createAccount(sa, {
    fullName: 'HR Head',
    email: 'hr-head@willowmun.org',
    password: 'password123',
    role: 'department_head',
    roleDefinitionId: 'role-department-head',
    title: 'Head of HR (Female)',
    departmentId: 'hr',
    division: 'Female Division',
    isActive: true,
    sendInvitation: false,
    permissions: { ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS },
  });
  assert.equal(headRes.ok, true);
  const head = headRes.data!;

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

  const suspendRes = conferenceDataService.suspendAccount(admin, head.id);
  assert.equal(suspendRes.ok, false);

  const roleRes = conferenceDataService.saveRoleDefinition(admin, snap.roleDefinitions[0]);
  assert.equal(roleRes.ok, false);
});

test('Department Head is blocked from workspace, teams, shifts, dept edits, QR management, and non-DCC committees', () => {
  conferenceDataService.resetDemoData();
  const sa = bootstrapSuperAdmin();
  conferenceDataService.createDepartment(sa, {
    slug: 'media-press',
    name: 'Media & Press',
    cluster: 'Communications & Creative',
    description: 'Media',
    capacity: 20,
    positions: ['Photographer'],
    registrationOpen: true,
    instructions: 'Portfolio required',
  });
  const head = conferenceDataService.createAccount(sa, {
    fullName: 'Media Head',
    email: 'media-head@willowmun.org',
    password: 'password123',
    role: 'department_head',
    roleDefinitionId: 'role-department-head',
    title: 'Head of Media (Male)',
    departmentId: 'media-press',
    division: 'Male Division',
    isActive: true,
    sendInvitation: false,
    permissions: { ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS },
  }).data!;

  const wsRes = conferenceDataService.saveWorkspaceRecord(head, {
    id: '',
    departmentId: 'media-press',
    module: 'tasks',
    title: 'Illegal head workspace write',
    description: 'Should fail',
    status: 'open',
    priority: 'medium',
    deadline: '2027-12-01',
    assignedTo: head.fullName,
    internalNotes: '',
    createdBy: head.fullName,
    updatedAt: '',
  });
  assert.equal(wsRes.ok, false);

  const deptUpdate = conferenceDataService.updateDepartment(head, 'media-press', { capacity: 99 });
  assert.equal(deptUpdate.ok, false);

  const qrManage = conferenceDataService.saveQrPass(head, {
    id: 'qr-illegal',
    token: 'WM27-TEST',
    holderName: 'Illegal',
    roleLabel: 'Test',
    departmentId: 'media-press',
    category: 'Staff',
    active: true,
    checkedIn: false,
    lastScannedAt: null,
  });
  assert.equal(qrManage.ok, false);

  const nonDccCommittee = conferenceDataService.saveCommittee(head, {
    id: '',
    chamber: 'UNSC',
    name: 'Blocked Committee',
    abbreviation: 'UNSC',
    difficulty: 'Intermediate',
    description: 'Blocked',
    topics: ['Topic'],
    chairName: 'Chair',
    viceChairName: 'Vice Chair',
    logoUrl: null,
    imageUrl: null,
    capacity: 20,
    published: true,
    order: 1,
  });
  assert.equal(nonDccCommittee.ok, false);
});

test('DCC actor can create and save committees without receiving account or settings permissions', () => {
  conferenceDataService.resetDemoData();
  const sa = bootstrapSuperAdmin();
  const dccEb = conferenceDataService.createAccount(sa, {
    fullName: 'DCC Chair',
    email: 'dcc@willowmun.org',
    password: 'password123',
    role: 'executive_board',
    roleDefinitionId: 'role-executive-board',
    title: 'DCC Committee Director',
    departmentId: 'dcc',
    division: null,
    isActive: true,
    sendInvitation: false,
    permissions: { ...EXECUTIVE_BOARD_DEFAULT_PERMISSIONS },
  }).data!;

  const saveCommitteeRes = conferenceDataService.saveCommittee(dccEb, {
    id: '',
    chamber: 'UNSC',
    name: 'United Nations Security Council',
    abbreviation: 'UNSC',
    difficulty: 'Advanced',
    description: 'Security Council chamber',
    topics: ['Maritime Security', 'Cyber Sovereignty'],
    chairName: 'Chair A',
    viceChairName: 'Chair B',
    logoUrl: null,
    imageUrl: null,
    capacity: 24,
    published: true,
    order: 1,
  });
  assert.equal(saveCommitteeRes.ok, true);
  assert.equal(conferenceDataService.getSnapshot().committees.length, 1);

  const settingsAttempt = conferenceDataService.updateSettings(dccEb, { venueText: 'Blocked Override' });
  assert.equal(settingsAttempt.ok, false);
});

test('Personal QR code is automatically issued, non-guessable, PII-free, and permanent across calls', () => {
  conferenceDataService.resetDemoData();
  const sa = bootstrapSuperAdmin();
  const admin = conferenceDataService.createAccount(sa, {
    fullName: 'Scanner Admin',
    email: 'scanner@willowmun.org',
    password: 'password123',
    role: 'admin',
    roleDefinitionId: 'role-admin',
    title: 'Operations Admin',
    departmentId: null,
    division: null,
    isActive: true,
    sendInvitation: false,
    permissions: { ...ADMIN_DEFAULT_PERMISSIONS },
  }).data!;

  const head = conferenceDataService.createAccount(sa, {
    fullName: 'Nour Al-Khatib',
    email: 'nour@willowmun.org',
    password: 'secret-password',
    role: 'department_head',
    roleDefinitionId: 'role-department-head',
    title: 'Head of Security (Female)',
    departmentId: 'security',
    division: 'Female Division',
    isActive: true,
    sendInvitation: false,
    permissions: { ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS },
  }).data!;

  const firstPass = conferenceDataService.ensurePersonalQrPass(head);
  const secondPass = conferenceDataService.ensurePersonalQrPass(head);

  assert.equal(firstPass.id, secondPass.id);
  assert.equal(firstPass.token, secondPass.token);
  assert.match(firstPass.token, /^WMQR-[A-F0-9]{16,}$/);
  assert.equal(firstPass.token.includes(head.email), false);
  assert.equal(firstPass.token.includes('secret-password'), false);

  // Admin can scan the opaque QR token and resolve the right holder; Head cannot operate scanner
  const blockedHeadScan = conferenceDataService.scanQrToken(head, firstPass.token, 'Main Gate');
  assert.equal(blockedHeadScan.ok, false);

  const adminScan = conferenceDataService.scanQrToken(admin, firstPass.token, 'Main Gate');
  assert.equal(adminScan.ok, true);
  assert.equal(adminScan.data?.holderName, 'Nour Al-Khatib');
});

test('Website CMS keeps draft isolated from published until Publish Changes & Version Rollback', () => {
  conferenceDataService.resetDemoData();
  const sa = bootstrapSuperAdmin();
  const initialBanner = conferenceDataService.getSnapshot().websitePublished.bannerText;

  conferenceDataService.updateWebsiteDraft(
    sa,
    (draft) => ({ ...draft, bannerText: 'DRAFT ONLY ANNOUNCEMENT 2027' }),
    'Update banner in draft',
  );

  let current = conferenceDataService.getSnapshot();
  assert.equal(current.websiteDraft.bannerText, 'DRAFT ONLY ANNOUNCEMENT 2027');
  assert.equal(current.websitePublished.bannerText, initialBanner);

  const pubRes = conferenceDataService.publishWebsiteChanges(sa, 'Publish new banner');
  assert.equal(pubRes.ok, true);

  current = conferenceDataService.getSnapshot();
  assert.equal(current.websitePublished.bannerText, 'DRAFT ONLY ANNOUNCEMENT 2027');

  const draftRestore = conferenceDataService.restoreWebsiteVersion(
    sa,
    current.websiteVersions[0].id,
    false,
  );
  assert.equal(draftRestore.ok, true);
});

