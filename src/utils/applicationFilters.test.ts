import test from 'node:test';
import assert from 'node:assert/strict';
import type { AdminUser, Application, Department } from '../types/admin';
import {
  ADMIN_DEFAULT_PERMISSIONS,
  DEPARTMENT_HEAD_DEFAULT_PERMISSIONS,
  SUPER_ADMIN_PERMISSIONS,
} from './adminPermissions';
import {
  buildApplicationsCsv,
  canViewHeadRecommended,
  computeApplicationStats,
  computeDailyApplicationTrend,
  filterAndSortApplications,
  filterHeadRecommendedApplications,
  filterLiveApplicationsQueue,
  isHeadRecommendedApplication,
  matchesApplicationQueue,
  normalizeHeadRecommendation,
  paginateItems,
  scopeAcceptedApplicationsForHr,
  scopeApplicationsForActor,
} from './applicationFilters';

const adminActor: AdminUser = {
  id: 'admin-1',
  fullName: 'Admin',
  email: 'admin@willowmun.org',
  role: 'admin',
  roleDefinitionId: 'role-admin',
  title: 'Admin',
  departmentId: null,
  division: null,
  avatarUrl: null,
  isActive: true,
  status: 'active',
  invitationStatus: 'accepted',
  invitationToken: null,
  lastPasswordResetAt: null,
  permissions: { ...ADMIN_DEFAULT_PERMISSIONS },
  createdAt: '2027-10-01T00:00:00Z',
  lastActiveAt: '2027-11-17T00:00:00Z',
};

const headHrActor: AdminUser = {
  ...adminActor,
  id: 'head-hr',
  role: 'department_head',
  roleDefinitionId: 'role-head',
  departmentId: 'hr',
  division: 'Female Division',
  title: 'Head of HR (Female)',
  permissions: { ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS },
};

const headMediaFemaleActor: AdminUser = {
  ...adminActor,
  id: 'head-media-f',
  role: 'department_head',
  roleDefinitionId: 'role-head',
  departmentId: 'media-press',
  division: 'Female',
  title: 'Head of Media (Female)',
  permissions: { ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS },
};

const superActor: AdminUser = {
  ...adminActor,
  id: 'sa-1',
  role: 'super_admin',
  roleDefinitionId: 'role-super-admin',
  permissions: { ...SUPER_ADMIN_PERMISSIONS },
};

function makeSampleApp(
  id: string,
  dept: string,
  category: Application['category'],
  status: Application['status'],
  submittedAt: string,
  gender: 'male' | 'female' = 'female',
): Application {
  return {
    id,
    applicationCode: `WM-${id}`,
    category,
    applicantName: `Candidate ${id}`,
    email: `${id}@example.com`,
    phone: '+97150000000',
    schoolOrUniversity: 'Willow Academy',
    gradeOrYear: 'Grade 12',
    city: 'Dubai',
    country: 'UAE',
    age: 18,
    gender,
    departmentId: dept,
    position: category === 'delegate' ? 'Delegate (UNSC)' : 'Officer',
    secondChoiceDepartmentId: null,
    status,
    submittedAt,
    updatedAt: submittedAt,
    headRecommendation: status === 'pending' ? 'recommend_accept' : 'none',
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
    emergencyContact: 'Parent',
    experienceLevel: '3 MUNs',
    answers: [],
    documents: [],
    notes: [],
    history: [],
  };
}

const sampleApps: Application[] = [
  makeSampleApp('1', 'hr', 'staff', 'pending', '2027-11-10T10:00:00Z', 'female'),
  makeSampleApp('2', 'media-press', 'media', 'accepted', '2027-11-12T10:00:00Z', 'male'),
  makeSampleApp('3', 'dcc', 'delegate', 'waitlisted', '2027-11-14T10:00:00Z', 'female'),
  makeSampleApp('4', 'security', 'security', 'withdrawn', '2027-11-16T10:00:00Z', 'male'),
  makeSampleApp('5', 'hr', 'staff', 'accepted', '2027-11-16T11:00:00Z', 'male'),
];

test('scopeApplicationsForActor isolates Department Head strictly by department AND gender across statuses', () => {
  assert.equal(scopeApplicationsForActor(sampleApps, superActor).length, 5);
  const hrScoped = scopeApplicationsForActor(sampleApps, headHrActor);
  assert.equal(hrScoped.length, 1);
  assert.equal(hrScoped[0].id, '1');
  assert.equal(hrScoped[0].departmentId, 'hr');
  assert.equal(hrScoped[0].gender, 'female');

  // Adding a rejected HR Female app and accepted HR Female app are visible to Female HR Head,
  // while Male HR app #5 stays hidden due to Female division scope.
  const extraHrApps: Application[] = [
    ...sampleApps,
    makeSampleApp('6', 'hr', 'staff', 'accepted', '2027-11-17T10:00:00Z', 'female'),
    makeSampleApp('7', 'hr', 'staff', 'rejected', '2027-11-18T10:00:00Z', 'female'),
  ];
  const hrScopedWithDecisions = scopeApplicationsForActor(extraHrApps, headHrActor);
  assert.deepEqual(
    hrScopedWithDecisions.map((a) => a.id),
    ['1', '6', '7'],
  );
});

test('scopeAcceptedApplicationsForHr gives HR cross-department & cross-gender accepted applicants with search/filters', () => {
  // Non-HR head receives nothing from HR cross-dept view
  assert.equal(scopeAcceptedApplicationsForHr(sampleApps, headMediaFemaleActor).length, 0);

  // HR Head sees accepted apps across ALL departments and BOTH genders
  const allAccepted = scopeAcceptedApplicationsForHr(sampleApps, headHrActor);
  assert.equal(allAccepted.length, 2);

  const byDept = scopeAcceptedApplicationsForHr(sampleApps, headHrActor, { departmentId: 'media-press' });
  assert.equal(byDept.length, 1);
  assert.equal(byDept[0].id, '2');

  const byGender = scopeAcceptedApplicationsForHr(sampleApps, headHrActor, { gender: 'male' });
  assert.equal(byGender.length, 2);

  const byName = scopeAcceptedApplicationsForHr(sampleApps, headHrActor, { search: 'Candidate 5' });
  assert.equal(byName.length, 1);
  assert.equal(byName[0].id, '5');
});

test('filterAndSortApplications supports category, status, date range, and recommendation filters', () => {
  const delegates = filterAndSortApplications(sampleApps, adminActor, { category: 'delegate' });
  assert.equal(delegates.length, 1);
  assert.equal(delegates[0].id, '3');

  const staffGroup = filterAndSortApplications(sampleApps, adminActor, { category: 'staff_group' });
  assert.equal(staffGroup.length, 4);

  const rangeFiltered = filterAndSortApplications(sampleApps, adminActor, {
    dateFrom: '2027-11-13',
    dateTo: '2027-11-17',
  });
  assert.equal(rangeFiltered.length, 3);

  const recommended = filterAndSortApplications(sampleApps, adminActor, {
    recommendation: 'recommend_accept',
  });
  assert.equal(recommended.length, 1);
});

test('computeApplicationStats, 14-day timeline, pagination, and CSV export produce accurate output', () => {
  const stats = computeApplicationStats(sampleApps);
  assert.equal(stats.total, 5);
  assert.equal(stats.pending, 1);
  assert.equal(stats.accepted, 2);
  assert.equal(stats.waitlisted, 1);
  assert.equal(stats.withdrawn, 1);
  assert.equal(stats.acceptanceRate, 100);

  const timeline = computeDailyApplicationTrend(sampleApps, 14);
  assert.equal(timeline.length, 14);
  assert.equal(timeline[timeline.length - 1].dateKey, '2027-11-16');

  const paged = paginateItems(sampleApps, 2, 2);
  assert.equal(paged.items.length, 2);
  assert.equal(paged.totalPages, 3);

  const depts: Department[] = [
    {
      id: 'hr',
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
  const csv = buildApplicationsCsv([sampleApps[0]], depts);
  assert.match(csv, /Application ID,Category,Applicant Name/);
  assert.match(csv, /WM-1,staff,Candidate 1/);
});

test('scopeApplicationsForActor and scopeAcceptedApplicationsForHr resolve UUID department IDs via departments list', () => {
  const depts: Department[] = [
    {
      id: 'aaaa1111-1111-1111-1111-111111111111',
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
      id: 'bbbb2222-2222-2222-2222-222222222222',
      slug: 'media-press',
      name: 'Media & Press',
      cluster: 'Communications & Creative',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 10,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
  ];
  const uuidHrEbHead: AdminUser = {
    ...adminActor,
    id: 'eb-hr-uuid',
    role: 'executive_board',
    departmentId: 'aaaa1111-1111-1111-1111-111111111111',
    division: 'female',
    title: 'Division Lead',
    ebRank: 'head',
    permissions: { ...DEPARTMENT_HEAD_DEFAULT_PERMISSIONS },
  };
  const scoped = scopeApplicationsForActor(sampleApps, uuidHrEbHead, depts);
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0].id, '1');

  const hrAcceptedFiltered = scopeAcceptedApplicationsForHr(
    sampleApps,
    uuidHrEbHead,
    { departmentId: 'bbbb2222-2222-2222-2222-222222222222' },
    depts,
  );
  assert.equal(hrAcceptedFiltered.length, 1);
  assert.equal(hrAcceptedFiltered[0].id, '2');
});

test('filterLiveApplicationsQueue separates Pending (including Waitlisted), Accepted, Rejected, and Registrations', () => {
  const mixedApps: Application[] = [
    makeSampleApp('1', 'media', 'media', 'pending', '2027-11-10T10:00:00Z', 'female'),
    makeSampleApp('2', 'press', 'press', 'waitlisted', '2027-11-11T10:00:00Z', 'male'),
    makeSampleApp('3', 'volunteers', 'volunteer', 'accepted', '2027-11-12T10:00:00Z', 'female'),
    makeSampleApp('4', 'security', 'security', 'rejected', '2027-11-13T10:00:00Z', 'male'),
  ];

  // Registrations ('all') preserves all 4
  assert.equal(filterLiveApplicationsQueue(mixedApps, { queueMode: 'all' }).length, 4);

  // Pending Applications includes both pending AND waitlisted
  const waiting = filterLiveApplicationsQueue(mixedApps, { queueMode: 'pending', pendingSubFilter: 'all_waiting' });
  assert.deepEqual(waiting.map((a) => a.id), ['1', '2']);
  assert.deepEqual(
    filterLiveApplicationsQueue(mixedApps, { queueMode: 'pending', pendingSubFilter: 'pending' }).map((a) => a.id),
    ['1'],
  );
  assert.deepEqual(
    filterLiveApplicationsQueue(mixedApps, { queueMode: 'pending', pendingSubFilter: 'waitlisted' }).map((a) => a.id),
    ['2'],
  );

  // Accepted Applicants isolates accepted
  assert.deepEqual(
    filterLiveApplicationsQueue(mixedApps, { queueMode: 'accepted' }).map((a) => a.id),
    ['3'],
  );

  // Rejected Applicants isolates rejected
  assert.deepEqual(
    filterLiveApplicationsQueue(mixedApps, { queueMode: 'rejected' }).map((a) => a.id),
    ['4'],
  );

  // Supports track + search narrowing inside focused queues
  assert.deepEqual(
    filterLiveApplicationsQueue(mixedApps, { queueMode: 'pending', typeFilter: 'press', query: 'Candidate 2' }).map((a) => a.id),
    ['2'],
  );
  assert.equal(matchesApplicationQueue(mixedApps[1], 'pending', 'all_waiting'), true);
  assert.equal(matchesApplicationQueue(mixedApps[2], 'pending', 'all_waiting'), false);
});


test('normalizeHeadRecommendation normalizes case/whitespace and falls back to none', () => {
  assert.equal(normalizeHeadRecommendation('recommend_accept'), 'recommend_accept');
  assert.equal(normalizeHeadRecommendation('  RECOMMEND_ACCEPT '), 'recommend_accept');
  assert.equal(normalizeHeadRecommendation('recommend_reject'), 'recommend_reject');
  assert.equal(normalizeHeadRecommendation('Recommend_Reject'), 'recommend_reject');
  assert.equal(normalizeHeadRecommendation('none'), 'none');
  assert.equal(normalizeHeadRecommendation(''), 'none');
  assert.equal(normalizeHeadRecommendation(null), 'none');
  assert.equal(normalizeHeadRecommendation(undefined), 'none');
  assert.equal(normalizeHeadRecommendation('accepted'), 'none');
});

test('canViewHeadRecommended strictly authorizes active Admin/Super Admin with review permissions', () => {
  assert.equal(canViewHeadRecommended(superActor), true);
  assert.equal(canViewHeadRecommended(adminActor), true);
  assert.equal(
    canViewHeadRecommended({
      ...adminActor,
      permissions: { ...adminActor.permissions, 'applications.review': false },
    }),
    false,
  );
  assert.equal(
    canViewHeadRecommended({
      ...adminActor,
      permissions: { ...adminActor.permissions, 'applications.view': false },
    }),
    false,
  );
  assert.equal(canViewHeadRecommended({ ...adminActor, isActive: false }), false);
  assert.equal(canViewHeadRecommended(headHrActor), false);
  assert.equal(canViewHeadRecommended(headMediaFemaleActor), false);
  assert.equal(canViewHeadRecommended(null), false);
});

test('filterHeadRecommendedApplications includes both accept/reject and all statuses without dropping pending', () => {
  const depts: Department[] = [
    {
      id: 'dept-media-uuid',
      slug: 'media-press',
      name: 'Media & Press',
      cluster: 'Communications & Creative',
      description: '',
      headUserIds: [],
      registrationOpen: true,
      capacity: 10,
      positions: [],
      instructions: '',
      updatedAt: '',
    },
    {
      id: 'dept-sec-uuid',
      slug: 'security',
      name: 'Security',
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

  const appPendingAccept: Application = {
    ...makeSampleApp('rec-1', 'media-press', 'media', 'pending', '2027-11-10T10:00:00Z', 'female'),
    applicationType: 'media',
    headRecommendation: 'recommend_accept',
    recommendedBy: 'head-media-1',
    recommendedByName: 'Sara Media Head',
    recommendedAt: '2027-11-18T09:00:00Z',
  };

  const appPendingReject: Application = {
    ...makeSampleApp('rec-2', 'security', 'security', 'pending', '2027-11-10T11:00:00Z', 'male'),
    applicationType: 'security',
    headRecommendation: 'recommend_reject',
    recommendedBy: 'head-sec-1',
    recommendedByName: 'Omar Security Head',
    recommendedAt: '2027-11-19T12:00:00Z',
  };

  const appAccepted: Application = {
    ...makeSampleApp('rec-3', 'volunteers', 'volunteer', 'accepted', '2027-11-09T10:00:00Z', 'female'),
    applicationType: 'volunteer',
    headRecommendation: 'recommend_accept',
    recommendedBy: 'head-vol-1',
    recommendedByName: 'Lina Volunteers Head',
    recommendedAt: '2027-11-17T08:00:00Z',
  };

  const appWaitlistedReject: Application = {
    ...makeSampleApp('rec-4', 'media-press', 'press', 'waitlisted', '2027-11-08T10:00:00Z', 'male'),
    applicationType: 'press',
    headRecommendation: 'recommend_reject',
    recommendedBy: 'head-press-1',
    recommendedByName: 'Tariq Press Head',
    recommendedAt: '2027-11-20T15:30:00Z',
  };

  const appNoRec: Application = {
    ...makeSampleApp('no-rec', 'security', 'security', 'pending', '2027-11-15T10:00:00Z', 'male'),
    headRecommendation: 'none',
  };

  assert.equal(isHeadRecommendedApplication(appPendingAccept), true);
  assert.equal(isHeadRecommendedApplication(appPendingReject), true);
  assert.equal(isHeadRecommendedApplication(appNoRec), false);

  const combined = [
    appPendingAccept,
    appPendingReject,
    appPendingAccept, // duplicate id must be deduplicated
    appAccepted,
    appWaitlistedReject,
    appNoRec,
  ];

  const allDefault = filterHeadRecommendedApplications(combined, {}, depts);
  assert.deepEqual(
    allDefault.map((a) => a.id),
    ['rec-4', 'rec-2', 'rec-1', 'rec-3'],
  );

  const onlyAccept = filterHeadRecommendedApplications(
    combined,
    { recommendation: 'recommend_accept' },
    depts,
  );
  assert.deepEqual(
    onlyAccept.map((a) => a.id),
    ['rec-1', 'rec-3'],
  );

  const onlyReject = filterHeadRecommendedApplications(
    combined,
    { recommendation: 'recommend_reject' },
    depts,
  );
  assert.deepEqual(
    onlyReject.map((a) => a.id),
    ['rec-4', 'rec-2'],
  );

  const byDeptUuid = filterHeadRecommendedApplications(
    combined,
    { departmentId: 'dept-media-uuid' },
    depts,
  );
  assert.deepEqual(
    byDeptUuid.map((a) => a.id),
    ['rec-4', 'rec-1'],
  );

  const byRecommenderName = filterHeadRecommendedApplications(
    combined,
    { search: 'Omar Security' },
    depts,
  );
  assert.deepEqual(
    byRecommenderName.map((a) => a.id),
    ['rec-2'],
  );

  const byStatus = filterHeadRecommendedApplications(
    combined,
    { status: 'accepted' },
    depts,
  );
  assert.deepEqual(
    byStatus.map((a) => a.id),
    ['rec-3'],
  );
});


