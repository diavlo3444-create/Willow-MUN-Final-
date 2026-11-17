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
  computeApplicationStats,
  computeDailyApplicationTrend,
  filterAndSortApplications,
  paginateItems,
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
  createdAt: '2026-10-01T00:00:00Z',
  lastActiveAt: '2026-11-17T00:00:00Z',
};

const headHrActor: AdminUser = {
  ...adminActor,
  id: 'head-hr',
  role: 'department_head',
  roleDefinitionId: 'role-head',
  departmentId: 'hr',
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
  makeSampleApp('1', 'hr', 'staff', 'pending', '2026-11-10T10:00:00Z'),
  makeSampleApp('2', 'media-press', 'media', 'accepted', '2026-11-12T10:00:00Z'),
  makeSampleApp('3', 'dcc', 'delegate', 'waitlisted', '2026-11-14T10:00:00Z'),
  makeSampleApp('4', 'security', 'security', 'withdrawn', '2026-11-16T10:00:00Z'),
];

test('scopeApplicationsForActor isolates Department Head to only their department', () => {
  assert.equal(scopeApplicationsForActor(sampleApps, superActor).length, 4);
  const hrScoped = scopeApplicationsForActor(sampleApps, headHrActor);
  assert.equal(hrScoped.length, 1);
  assert.equal(hrScoped[0].departmentId, 'hr');
});

test('filterAndSortApplications supports category, status, date range, and recommendation filters', () => {
  const delegates = filterAndSortApplications(sampleApps, adminActor, { category: 'delegate' });
  assert.equal(delegates.length, 1);
  assert.equal(delegates[0].id, '3');

  const staffGroup = filterAndSortApplications(sampleApps, adminActor, { category: 'staff_group' });
  assert.equal(staffGroup.length, 3);

  const rangeFiltered = filterAndSortApplications(sampleApps, adminActor, {
    dateFrom: '2026-11-13',
    dateTo: '2026-11-17',
  });
  assert.equal(rangeFiltered.length, 2);

  const recommended = filterAndSortApplications(sampleApps, adminActor, {
    recommendation: 'recommend_accept',
  });
  assert.equal(recommended.length, 1);
});

test('computeApplicationStats, 14-day timeline, pagination, and CSV export produce accurate output', () => {
  const stats = computeApplicationStats(sampleApps);
  assert.equal(stats.total, 4);
  assert.equal(stats.pending, 1);
  assert.equal(stats.accepted, 1);
  assert.equal(stats.waitlisted, 1);
  assert.equal(stats.withdrawn, 1);
  assert.equal(stats.acceptanceRate, 100);

  const timeline = computeDailyApplicationTrend(sampleApps, 14);
  assert.equal(timeline.length, 14);
  assert.equal(timeline[timeline.length - 1].dateKey, '2026-11-16');

  const paged = paginateItems(sampleApps, 2, 2);
  assert.equal(paged.items.length, 2);
  assert.equal(paged.totalPages, 2);

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
