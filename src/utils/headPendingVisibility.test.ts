import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canHeadAccessApplication,
  isHeadActorScopeMatch,
  redactApplicationForHead,
  resolveApplicationDepartmentSlug,
  resolveHeadContext,
} from '../../supabase/functions/willow-applications/policy.ts';
import type { AdminUser, Application, Department } from '../types/admin';
import {
  canAccessApplication,
  canViewHrAcceptedApplication,
  resolveUserPermissions,
} from './adminPermissions';
import { filterAndSortApplications, scopeApplicationsForActor } from './applicationFilters';
import { mapLiveRowToApplication, type LiveApplicationRow } from '../services/liveBackendService';

const DEPT_MEDIA_UUID = '11111111-1111-4111-8111-111111111111';
const DEPT_PRESS_UUID = '22222222-2222-4222-8222-222222222222';
const DEPT_VOLUNTEERS_UUID = '33333333-3333-4333-8333-333333333333';
const DEPT_HR_UUID = '44444444-4444-4444-8444-444444444444';

const deptSlugById = new Map<string, string>([
  [DEPT_MEDIA_UUID, 'media'],
  [DEPT_PRESS_UUID, 'press'],
  [DEPT_VOLUNTEERS_UUID, 'volunteers'],
  [DEPT_HR_UUID, 'hr'],
]);

const makeDept = (id: string, slug: string, name: string): Department => ({
  id,
  slug,
  name,
  description: '',
  cluster: 'Delegate Affairs & Operations',
  registrationOpen: true,
  capacity: 40,
  positions: ['Member'],
  headUserIds: [],
  instructions: '',
  updatedAt: '2026-11-20T00:00:00Z',
});

const departments: Department[] = [
  makeDept(DEPT_MEDIA_UUID, 'media', 'Media'),
  makeDept(DEPT_PRESS_UUID, 'press', 'Press'),
  makeDept(DEPT_VOLUNTEERS_UUID, 'volunteers', 'Volunteering'),
  makeDept(DEPT_HR_UUID, 'hr', 'Human Resources'),
];

const makeFrontendActor = (overrides: Partial<AdminUser>): AdminUser => ({
  id: 'u-default',
  email: 'user@willowmun.org',
  fullName: 'User Name',
  role: 'department_head',
  roleDefinitionId: 'role-head',
  departmentId: DEPT_VOLUNTEERS_UUID,
  departmentSlug: 'volunteers',
  title: 'Female Division Department Head',
  division: 'female',
  status: 'active',
  avatarUrl: null,
  invitationStatus: 'accepted',
  invitationToken: null,
  lastPasswordResetAt: null,
  isActive: true,
  permissions: resolveUserPermissions('department_head', {}),
  createdAt: '2026-11-20T00:00:00Z',
  lastActiveAt: '2026-11-20T00:00:00Z',
  ...overrides,
});

const makeApp = (overrides: Partial<Application>): Application => ({
  id: 'app-1',
  applicationCode: 'WM-001',
  applicationType: 'volunteer',
  category: 'volunteer',
  applicantName: 'Layla Applicant',
  gender: 'female',
  email: 'layla@example.com',
  phone: '+966500000001',
  schoolOrUniversity: 'Willow High',
  gradeOrYear: 'Grade 11',
  city: 'Riyadh',
  country: 'Saudi Arabia',
  age: 17,
  departmentId: DEPT_VOLUNTEERS_UUID,
  position: 'Volunteer',
  secondChoiceDepartmentId: null,
  status: 'pending',
  submittedAt: '2026-11-20T08:00:00Z',
  updatedAt: '2026-11-20T08:00:00Z',
  headRecommendation: 'none',
  headNotes: '',
  recommendedBy: null,
  recommendedByName: null,
  recommendedAt: null,
  finalDecisionBy: null,
  finalDecisionAt: null,
  adminDecisionNotes: '',
  reviewedBy: null,
  reviewedAt: null,
  signupLinkToken: null,
  signupLinkStatus: 'none',
  signupLinkGeneratedAt: null,
  emergencyContact: 'Guardian',
  experienceLevel: 'None',
  answers: [],
  documents: [],
  notes: [],
  history: [],
  ...overrides,
});

test('Edge policy: Department Heads and Co-Heads only access pending applications in their dept/track/gender', () => {
  const mediaHeadCtx = resolveHeadContext(
    {
      role: 'department_head',
      department_id: DEPT_MEDIA_UUID,
      title: 'Media Head (Female)',
      division: 'female',
      permissions: { 'applications.view': true, 'applications.recommend': true },
    },
    'media',
  );
  const mediaCoHeadCtx = resolveHeadContext(
    {
      role: 'executive_board',
      department_id: DEPT_MEDIA_UUID,
      eb_rank: 'co_head',
      title: 'Media Co-Head',
      division: 'female',
      permissions: { 'applications.view': true, 'applications.recommend': true },
    },
    'media',
  );

  const pendingUnrec = {
    status: 'pending',
    application_type: 'media',
    department_id: DEPT_MEDIA_UUID,
    gender: 'female',
  };
  const pendingRec = {
    status: 'pending',
    application_type: 'media',
    department_id: DEPT_MEDIA_UUID,
    gender: 'female',
    head_recommendation: 'recommend_accept',
  };
  const acceptedRow = { ...pendingUnrec, status: 'accepted', decision_by_name: 'Lana Admin' };
  const rejectedRow = { ...pendingUnrec, status: 'rejected', decision_by_name: 'Ahmed Admin' };
  const waitlistedRow = { ...pendingUnrec, status: 'waitlisted' };
  const pressPendingRow = {
    status: 'pending',
    application_type: 'press',
    department_id: DEPT_PRESS_UUID,
    gender: 'female',
  };
  const malePendingRow = { ...pendingUnrec, gender: 'male' };

  assert.equal(resolveApplicationDepartmentSlug('media', DEPT_MEDIA_UUID, deptSlugById), 'media');
  assert.equal(canHeadAccessApplication(mediaHeadCtx, pendingUnrec, deptSlugById), true);
  assert.equal(canHeadAccessApplication(mediaHeadCtx, pendingRec, deptSlugById), true);
  assert.equal(canHeadAccessApplication(mediaCoHeadCtx, pendingUnrec, deptSlugById), true);
  assert.equal(canHeadAccessApplication(mediaCoHeadCtx, pendingRec, deptSlugById), true);

  for (const blocked of [acceptedRow, rejectedRow, waitlistedRow, pressPendingRow, malePendingRow]) {
    assert.equal(canHeadAccessApplication(mediaHeadCtx, blocked, deptSlugById), false);
    assert.equal(canHeadAccessApplication(mediaCoHeadCtx, blocked, deptSlugById), false);
  }

  // Scope match stays true for accepted in-dept rows (used to return neutral 409) and false for out-of-scope (403)
  assert.equal(isHeadActorScopeMatch(mediaHeadCtx, acceptedRow, deptSlugById), true);
  assert.equal(isHeadActorScopeMatch(mediaHeadCtx, pressPendingRow, deptSlugById), false);
  assert.equal(isHeadActorScopeMatch(mediaHeadCtx, malePendingRow, deptSlugById), false);
});

test('Edge policy: redactApplicationForHead removes final decision attribution and admin notes', () => {
  const redacted = redactApplicationForHead({
    id: 'app-1',
    status: 'pending',
    head_recommendation: 'recommend_accept',
    recommended_by_name: 'Alya Head',
    decision_by: 'admin-uuid',
    decision_by_name: 'Lana Admin',
    decision_at: '2026-11-23T12:00:00Z',
    admin_decision_notes: 'Confidential admin note',
    review_notes: 'Legacy review note',
  });

  assert.equal(redacted.decision_by, null);
  assert.equal(redacted.decision_by_name, null);
  assert.equal(redacted.decision_at, null);
  assert.equal(redacted.admin_decision_notes, null);
  assert.equal(redacted.review_notes, null);
  assert.equal(redacted.head_recommendation, 'recommend_accept');
  assert.equal(redacted.recommended_by_name, 'Alya Head');
});

test('Frontend RBAC & filters: Heads/Co-Heads see only pending apps (including recommended); Admins retain all statuses', () => {
  const volHead = makeFrontendActor({
    id: 'head-vol-f',
    role: 'department_head',
    departmentId: DEPT_VOLUNTEERS_UUID,
    departmentSlug: 'volunteers',
  });
  const volCoHead = makeFrontendActor({
    id: 'cohead-vol-f',
    role: 'executive_board',
    ebRank: 'co_head',
    departmentId: DEPT_VOLUNTEERS_UUID,
    departmentSlug: 'volunteers',
    title: 'Volunteers Co-Head (Female)',
    permissions: resolveUserPermissions('executive_board', {}, 'co_head', undefined, 'Volunteers Co-Head (Female)'),
  });
  const adminActor = makeFrontendActor({
    id: 'admin-1',
    role: 'admin',
    departmentId: null,
    departmentSlug: null,
    title: 'Admin',
    permissions: resolveUserPermissions('admin', { 'applications.view': true, 'applications.review': true }),
  });
  const superAdminActor = makeFrontendActor({
    id: 'super-1',
    role: 'super_admin',
    departmentId: null,
    departmentSlug: null,
    title: 'Super Admin',
    permissions: resolveUserPermissions('super_admin'),
  });
  const hrActor = makeFrontendActor({
    id: 'hr-1',
    role: 'department_head',
    departmentId: DEPT_HR_UUID,
    departmentSlug: 'hr',
    title: 'HR Head',
  });

  const apps: Application[] = [
    makeApp({ id: 'p-1', status: 'pending', headRecommendation: 'none' }),
    makeApp({ id: 'p-2', status: 'pending', headRecommendation: 'recommend_accept', recommendedByName: 'Alya' }),
    makeApp({ id: 'acc-1', status: 'accepted', finalDecisionBy: 'Lana Admin' }),
    makeApp({ id: 'rej-1', status: 'rejected', finalDecisionBy: 'Mohammed Admin' }),
    makeApp({ id: 'wait-1', status: 'waitlisted', finalDecisionBy: 'Mohammed Admin' }),
    makeApp({ id: 'male-p', status: 'pending', gender: 'male' }),
  ];

  // Heads & Co-Heads only see their 2 pending female applications
  const headIds = scopeApplicationsForActor(apps, volHead, departments).map((a) => a.id);
  const coHeadIds = scopeApplicationsForActor(apps, volCoHead, departments).map((a) => a.id);
  assert.deepEqual(headIds, ['p-1', 'p-2']);
  assert.deepEqual(coHeadIds, ['p-1', 'p-2']);

  // Searching/filtering with status='accepted' must still return 0 for Heads
  assert.equal(
    filterAndSortApplications(apps, volHead, { status: 'accepted' }, departments).length,
    0,
  );
  assert.equal(
    filterAndSortApplications(apps, volCoHead, { status: 'rejected' }, departments).length,
    0,
  );
  assert.equal(canAccessApplication(volHead, apps[2], departments), false);
  assert.equal(canAccessApplication(volCoHead, apps[3], departments), false);

  // Admins & Super Admins retain full access across all statuses
  assert.equal(scopeApplicationsForActor(apps, adminActor, departments).length, 6);
  assert.equal(scopeApplicationsForActor(apps, superAdminActor, departments).length, 6);
  assert.equal(canAccessApplication(adminActor, apps[2], departments), true);
  assert.equal(canAccessApplication(superAdminActor, apps[3], departments), true);

  // HR still retains accepted applicant directory access
  assert.equal(canViewHrAcceptedApplication(hrActor, apps[2], departments), true);
});

test('mapLiveRowToApplication redacts final decision metadata for Heads while keeping it for Admins', () => {
  const row: LiveApplicationRow = {
    id: 'row-1',
    application_code: 'WM-900',
    application_type: 'media',
    department_id: 'media',
    applicant_name: 'Noura',
    gender: 'female',
    email: 'noura@example.com',
    phone: '+966500000099',
    school: 'Willow School',
    age: 17,
    availability: null,
    motivation: 'Interested in media coverage',
    experience: null,
    portfolio_url: null,
    review_notes: null,
    status: 'pending',
    head_recommendation: 'recommend_accept',
    recommended_by: 'head-1',
    recommended_by_name: 'Alya',
    recommended_at: '2026-11-22T10:00:00Z',
    decision_by: 'admin-1',
    decision_by_name: 'Lana Admin',
    decision_at: '2026-11-23T10:00:00Z',
    admin_decision_notes: 'Spoofed back to pending note',
    created_at: '2026-11-20T09:00:00Z',
  };

  const mediaHead = makeFrontendActor({
    role: 'department_head',
    departmentId: DEPT_MEDIA_UUID,
    departmentSlug: 'media',
    title: 'Media Head (Female)',
  });
  const adminActor = makeFrontendActor({
    role: 'admin',
    departmentId: null,
    departmentSlug: null,
    title: 'Admin',
  });

  const headView = mapLiveRowToApplication(row, mediaHead, departments);
  assert.equal(headView.finalDecisionBy, null);
  assert.equal(headView.finalDecisionAt, null);
  assert.equal(headView.reviewedBy, null);
  assert.equal(headView.adminDecisionNotes, '');
  assert.equal(headView.history.length, 0);
  assert.equal(headView.recommendedByName, 'Alya');

  const adminView = mapLiveRowToApplication(row, adminActor, departments);
  assert.equal(adminView.finalDecisionBy, 'Lana Admin');
  assert.equal(adminView.finalDecisionAt, '2026-11-23T10:00:00Z');
  assert.equal(adminView.adminDecisionNotes, 'Spoofed back to pending note');
  assert.equal(adminView.history.length, 1);
});
