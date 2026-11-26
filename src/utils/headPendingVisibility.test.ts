import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canHeadAccessApplication,
  isHeadActorScopeMatch,
  mapDepartment,
  redactApplicationForHead,
  resolveApplicationDepartmentSlug,
  resolveHeadContext,
} from '../../supabase/functions/willow-applications/policy.ts';
import type { AdminUser, Application, Department } from '../types/admin';
import {
  canAccessApplication,
  canViewConfidentialMedicalInfo,
  canViewHrAcceptedApplication,
  getActorDepartmentSlug,
  resolveUserPermissions,
} from './adminPermissions';
import {
  computeDepartmentBreakdown,
  filterAndSortApplications,
  scopeApplicationsForActor,
} from './applicationFilters';
import { mapLiveRowToApplication, type LiveApplicationRow } from '../services/liveBackendService';

const DEPT_MEDIA_UUID = '11111111-1111-4111-8111-111111111111';
const DEPT_PRESS_UUID = '22222222-2222-4222-8222-222222222222';
const DEPT_VOLUNTEERS_UUID = '33333333-3333-4333-8333-333333333333';
const DEPT_HR_UUID = '44444444-4444-4444-8444-444444444444';
const DEPT_PR_UUID = '55555555-5555-4555-8555-555555555555';
const DEPT_CEREMONY_UUID = '66666666-6666-4666-8666-666666666666';
const DEPT_LOGISTICS_UUID = '77777777-7777-4777-8777-777777777777';
const DEPT_SECURITY_UUID = '88888888-8888-4888-8888-888888888888';

const deptSlugById = new Map<string, string>([
  [DEPT_MEDIA_UUID, 'media'],
  [DEPT_PRESS_UUID, 'press'],
  [DEPT_VOLUNTEERS_UUID, 'volunteering'],
  [DEPT_HR_UUID, 'hr'],
  [DEPT_PR_UUID, 'pr'],
  [DEPT_CEREMONY_UUID, 'ceremonies'],
  [DEPT_LOGISTICS_UUID, 'logistics'],
  [DEPT_SECURITY_UUID, 'security'],
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
  makeDept(DEPT_VOLUNTEERS_UUID, 'volunteering', 'Volunteering'),
  makeDept(DEPT_HR_UUID, 'hr', 'Human Resources'),
  makeDept(DEPT_PR_UUID, 'pr', 'Public Relations'),
  makeDept(DEPT_CEREMONY_UUID, 'ceremonies', 'Ceremonies'),
  makeDept(DEPT_LOGISTICS_UUID, 'logistics', 'Logistics'),
  makeDept(DEPT_SECURITY_UUID, 'security', 'Security'),
];

const makeFrontendActor = (overrides: Partial<AdminUser>): AdminUser => ({
  id: 'u-default',
  email: 'user@willowmun.org',
  fullName: 'User Name',
  role: 'department_head',
  roleDefinitionId: 'role-head',
  departmentId: DEPT_VOLUNTEERS_UUID,
  departmentSlug: null,
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

test('Edge policy: Department Heads and Co-Heads see Pending, Waitlisted, Accepted, and Rejected apps strictly in their dept/track/gender', () => {
  const mediaHeadCtx = resolveHeadContext(
    {
      role: 'department_head',
      department_id: DEPT_MEDIA_UUID,
      title: 'Media & Press Head (Female)',
      division: 'female',
      permissions: { 'applications.view': true, 'applications.recommend': true },
    },
    'media',
  );
  const mediaCoHeadCtx = resolveHeadContext(
    {
      role: 'executive_board',
      department_id: DEPT_MEDIA_UUID,
      eb_rank: 'co-head',
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
    ...pendingUnrec,
    head_recommendation: 'recommend_accept',
  };
  const acceptedRow = { ...pendingUnrec, status: 'accepted', decision_by_name: 'Lana Admin' };
  const rejectedRow = { ...pendingUnrec, status: 'rejected', decision_by_name: 'Ahmed Admin' };
  const waitlistedRow = { ...pendingUnrec, status: 'waitlisted' };
  const staleUuidAccepted = {
    status: 'accepted',
    application_type: 'media',
    department_id: '99999999-9999-4999-8999-999999999999',
    gender: 'female',
  };
  const pressAcceptedRow = {
    status: 'accepted',
    application_type: 'press',
    department_id: DEPT_PRESS_UUID,
    gender: 'female',
  };
  const maleAcceptedRow = { ...acceptedRow, gender: 'male' };

  assert.equal(mediaHeadCtx.actorApplicationType, 'media');
  assert.equal(resolveApplicationDepartmentSlug('media', DEPT_MEDIA_UUID, deptSlugById), 'media');
  assert.equal(
    resolveApplicationDepartmentSlug('ceremony', DEPT_CEREMONY_UUID, deptSlugById),
    'ceremony',
  );
  assert.equal(
    resolveApplicationDepartmentSlug('pr', '99999999-9999-4999-8999-999999999999', deptSlugById),
    'pr',
  );
  assert.equal(mapDepartment('media', 'media-press'), 'media');
  assert.equal(mapDepartment('ceremonies', 'ceremonies'), 'ceremony');

  for (const allowed of [pendingUnrec, pendingRec, acceptedRow, rejectedRow, waitlistedRow, staleUuidAccepted]) {
    assert.equal(canHeadAccessApplication(mediaHeadCtx, allowed, deptSlugById), true);
    assert.equal(canHeadAccessApplication(mediaCoHeadCtx, allowed, deptSlugById), true);
  }

  for (const blocked of [pressAcceptedRow, maleAcceptedRow]) {
    assert.equal(canHeadAccessApplication(mediaHeadCtx, blocked, deptSlugById), false);
    assert.equal(canHeadAccessApplication(mediaCoHeadCtx, blocked, deptSlugById), false);
  }

  assert.equal(isHeadActorScopeMatch(mediaHeadCtx, pressAcceptedRow, deptSlugById), false);
  assert.equal(isHeadActorScopeMatch(mediaHeadCtx, maleAcceptedRow, deptSlugById), false);
});

test('Edge policy: Every department (Volunteers, Security, PR, Ceremony, Logistics, HR) sees Accepted and Rejected in their own dept', () => {
  const specs = [
    { slug: 'volunteering', appType: 'volunteer', deptId: DEPT_VOLUNTEERS_UUID, title: 'Volunteers Head' },
    { slug: 'ceremonies', appType: 'ceremonies', deptId: DEPT_CEREMONY_UUID, title: 'Ceremonies Coordinator' },
    { slug: 'pr', appType: 'pr', deptId: DEPT_PR_UUID, title: 'PR Head' },
    { slug: 'logistics', appType: 'logistics', deptId: DEPT_LOGISTICS_UUID, title: 'Logistics Director' },
    { slug: 'security', appType: 'security', deptId: DEPT_SECURITY_UUID, title: 'Security Head' },
  ];

  for (const spec of specs) {
    const ctx = resolveHeadContext(
      {
        role: 'executive_board',
        department_id: spec.deptId,
        eb_rank: 'head',
        title: spec.title,
        division: null,
        permissions: { 'applications.view': true, 'applications.recommend': true },
      },
      spec.slug,
    );
    assert.equal(ctx.isHead, true);
    assert.equal(
      canHeadAccessApplication(
        ctx,
        { status: 'accepted', application_type: spec.appType, department_id: spec.deptId, gender: 'male' },
        deptSlugById,
      ),
      true,
    );
    assert.equal(
      canHeadAccessApplication(
        ctx,
        { status: 'rejected', application_type: spec.appType, department_id: '99999999-9999-4999-8999-999999999999', gender: 'female' },
        deptSlugById,
      ),
      true,
    );
    assert.equal(
      canHeadAccessApplication(
        ctx,
        { status: 'accepted', application_type: 'hr', department_id: DEPT_HR_UUID, gender: 'female' },
        deptSlugById,
      ),
      false,
    );
  }
});

test('Edge policy: redactApplicationForHead removes final decision attribution and admin notes', () => {
  const redacted = redactApplicationForHead({
    id: 'app-1',
    status: 'accepted',
    head_recommendation: 'recommend_accept',
    recommended_by_name: 'Alya Head',
    decision_by: 'admin-uuid',
    decision_by_name: 'Lana Admin',
    decision_at: '2026-11-23T12:00:00Z',
    admin_decision_notes: 'Confidential admin note',
    review_notes: 'Legacy review note',
  });

  assert.equal(redacted.status, 'accepted');
  assert.equal(redacted.decision_by, null);
  assert.equal(redacted.decision_by_name, null);
  assert.equal(redacted.decision_at, null);
  assert.equal(redacted.admin_decision_notes, null);
  assert.equal(redacted.review_notes, null);
  assert.equal(redacted.head_recommendation, 'recommend_accept');
  assert.equal(redacted.recommended_by_name, 'Alya Head');
});

test('Frontend RBAC & filters: Heads/Co-Heads across all departments and aliases see Pending, Waitlisted, Accepted, Rejected in their own dept', () => {
  const volHead = makeFrontendActor({
    id: 'head-vol-f',
    role: 'department_head',
    departmentId: DEPT_VOLUNTEERS_UUID,
    departmentSlug: 'volunteers',
  });
  const ceremonyCoHead = makeFrontendActor({
    id: 'cohead-ceremony',
    role: 'executive_board',
    ebRank: 'co-head',
    departmentId: DEPT_CEREMONY_UUID,
    departmentSlug: null,
    division: null,
    title: 'Ceremonies Co-Head',
    permissions: resolveUserPermissions('executive_board', {}, 'co-head', undefined, 'Ceremonies Co-Head'),
  });
  const adminActor = makeFrontendActor({
    id: 'admin-1',
    role: 'admin',
    departmentId: null,
    departmentSlug: null,
    division: null,
    title: 'Admin',
    permissions: resolveUserPermissions('admin', { 'applications.view': true, 'applications.review': true }),
  });
  const hrActor = makeFrontendActor({
    id: 'hr-1',
    role: 'department_head',
    departmentId: DEPT_HR_UUID,
    departmentSlug: 'hr',
    division: null,
    title: 'HR Head',
  });

  const apps: Application[] = [
    makeApp({ id: 'p-1', status: 'pending', headRecommendation: 'none' }),
    makeApp({ id: 'p-2', status: 'pending', headRecommendation: 'recommend_accept', recommendedByName: 'Alya' }),
    makeApp({ id: 'acc-1', status: 'accepted', finalDecisionBy: 'Lana Admin' }),
    makeApp({ id: 'rej-1', status: 'rejected', finalDecisionBy: 'Mohammed Admin' }),
    makeApp({ id: 'wait-1', status: 'waitlisted', finalDecisionBy: 'Mohammed Admin' }),
    makeApp({ id: 'male-p', status: 'pending', gender: 'male' }),
    makeApp({
      id: 'cer-acc',
      applicationType: 'ceremonies',
      category: 'staff',
      departmentId: 'ceremony',
      gender: 'male',
      status: 'accepted',
    }),
    makeApp({
      id: 'cer-rej',
      applicationType: 'ceremonies',
      category: 'staff',
      departmentId: '99999999-9999-4999-8999-999999999999',
      gender: 'female',
      status: 'rejected',
    }),
  ];

  // Volunteers (Female) Head sees Pending, Waitlisted, Accepted, and Rejected female volunteers (not male, not ceremonies)
  const volHeadIds = scopeApplicationsForActor(apps, volHead, departments).map((a) => a.id);
  assert.deepEqual(volHeadIds, ['p-1', 'p-2', 'acc-1', 'rej-1', 'wait-1']);
  assert.equal(
    filterAndSortApplications(apps, volHead, { status: 'accepted' }, departments).map((a) => a.id)[0],
    'acc-1',
  );
  assert.equal(
    filterAndSortApplications(apps, volHead, { status: 'rejected' }, departments).map((a) => a.id)[0],
    'rej-1',
  );

  // Ceremonies Co-Head sees normalized 'ceremony' + stale UUID rows across Accepted & Rejected
  assert.equal(getActorDepartmentSlug(ceremonyCoHead, departments), 'ceremony');
  assert.deepEqual(
    scopeApplicationsForActor(apps, ceremonyCoHead, departments).map((a) => a.id),
    ['cer-acc', 'cer-rej'],
  );

  // computeDepartmentBreakdown counts slug-mapped apps cleanly under UUID department definitions
  const breakdown = computeDepartmentBreakdown(apps, departments);
  const ceremonyStats = breakdown.find((b) => b.departmentId === DEPT_CEREMONY_UUID);
  assert.equal(ceremonyStats?.accepted, 1);

  // Admins retain full access; HR keeps accepted directory; confidential medical stays blocked for Heads
  assert.equal(scopeApplicationsForActor(apps, adminActor, departments).length, 8);
  assert.equal(canAccessApplication(adminActor, apps[2], departments), true);
  assert.equal(canViewHrAcceptedApplication(hrActor, apps[2], departments), true);
  assert.equal(canViewConfidentialMedicalInfo(volHead, departments), false);
  assert.equal(canViewConfidentialMedicalInfo(ceremonyCoHead, departments), false);
});

test('mapLiveRowToApplication normalizes UUIDs/aliases and redacts final decision metadata for Heads while keeping it for Admins', () => {
  const row: LiveApplicationRow = {
    id: 'row-1',
    application_code: 'WM-900',
    application_type: 'volunteer',
    department_id: DEPT_VOLUNTEERS_UUID,
    applicant_name: 'Noura',
    gender: 'female',
    email: 'noura@example.com',
    phone: '+966500000099',
    school: 'Willow School',
    age: 17,
    availability: null,
    motivation: 'Interested in volunteering',
    experience: null,
    portfolio_url: null,
    review_notes: null,
    status: 'accepted',
    head_recommendation: 'recommend_accept',
    recommended_by: 'head-1',
    recommended_by_name: 'Alya',
    recommended_at: '2026-11-22T10:00:00Z',
    decision_by: 'admin-1',
    decision_by_name: 'Lana Admin',
    decision_at: '2026-11-23T10:00:00Z',
    admin_decision_notes: 'Internal admin note',
    created_at: '2026-11-20T09:00:00Z',
  };

  const volHead = makeFrontendActor({
    role: 'department_head',
    departmentId: DEPT_VOLUNTEERS_UUID,
    departmentSlug: 'volunteers',
    title: 'Volunteers Head (Female)',
  });
  const adminActor = makeFrontendActor({
    role: 'admin',
    departmentId: null,
    departmentSlug: null,
    division: null,
    title: 'Admin',
  });

  const headView = mapLiveRowToApplication(row, volHead, departments);
  assert.equal(headView.departmentId, 'volunteers');
  assert.equal(headView.status, 'accepted');
  assert.equal(headView.finalDecisionBy, null);
  assert.equal(headView.finalDecisionAt, null);
  assert.equal(headView.reviewedBy, null);
  assert.equal(headView.adminDecisionNotes, '');
  assert.equal(headView.history.length, 0);
  assert.equal(headView.recommendedByName, 'Alya');

  const adminView = mapLiveRowToApplication(row, adminActor, departments);
  assert.equal(adminView.finalDecisionBy, 'Lana Admin');
  assert.equal(adminView.finalDecisionAt, '2026-11-23T10:00:00Z');
  assert.equal(adminView.adminDecisionNotes, 'Internal admin note');
  assert.equal(adminView.history.length, 1);
});
