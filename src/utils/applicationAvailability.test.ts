import test from 'node:test';
import assert from 'node:assert/strict';
import type { Application, Department } from '../types/admin';
import {
  WEBSITE_APPLICATION_FORMS,
  WEBSITE_APPLICATION_SLUGS,
  computeFormSubmissionCounts,
  findDepartmentForForm,
} from './applicationAvailability';

function makeDept(slug: string, registrationOpen: boolean): Department {
  return {
    id: `dept-${slug}`,
    slug,
    name: slug.toUpperCase(),
    cluster: 'Communications & Creative',
    description: '',
    headUserIds: [],
    registrationOpen,
    capacity: 20,
    positions: [],
    instructions: '',
    updatedAt: '',
  };
}

function makeApp(
  applicationType: Application['applicationType'],
  status: Application['status'],
  departmentId = 'dept-other',
): Application {
  return {
    id: `app-${applicationType}-${status}`,
    applicationCode: 'WM-2027-001',
    category: 'staff',
    applicationType,
    applicantName: 'Test Applicant',
    email: 'applicant@example.com',
    phone: '+971500000000',
    schoolOrUniversity: 'Test School',
    gradeOrYear: '11',
    city: 'Dubai',
    country: 'UAE',
    age: 17,
    gender: 'female',
    departmentId,
    position: 'Member',
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
    emergencyContact: 'Parent',
    experienceLevel: '1 year',
    answers: [],
    documents: [],
    notes: [],
    history: [],
  };
}

test('WEBSITE_APPLICATION_FORMS covers exactly the four actual public website tracks', () => {
  assert.deepEqual(
    WEBSITE_APPLICATION_FORMS.map((f) => f.id),
    ['media', 'press', 'volunteer', 'security'],
  );
  assert.deepEqual(WEBSITE_APPLICATION_SLUGS, ['media', 'press', 'volunteers', 'security']);
});

test('findDepartmentForForm maps each form slug cleanly to its department row', () => {
  const departments = [
    makeDept('media', false),
    makeDept('press', false),
    makeDept('volunteers', true),
    makeDept('security', true),
  ];

  const volunteerForm = WEBSITE_APPLICATION_FORMS.find((f) => f.id === 'volunteer')!;
  const matched = findDepartmentForForm(volunteerForm, departments);
  assert.ok(matched);
  assert.equal(matched.id, 'dept-volunteers');
  assert.equal(matched.registrationOpen, true);
});

test('computeFormSubmissionCounts counts Media and Press separately without mixing shared departments', () => {
  const mediaForm = WEBSITE_APPLICATION_FORMS.find((f) => f.id === 'media')!;
  const pressForm = WEBSITE_APPLICATION_FORMS.find((f) => f.id === 'press')!;
  const volunteerForm = WEBSITE_APPLICATION_FORMS.find((f) => f.id === 'volunteer')!;

  const apps: Application[] = [
    makeApp('media', 'pending', 'shared-dept'),
    makeApp('media', 'accepted', 'shared-dept'),
    makeApp('press', 'rejected', 'shared-dept'),
    makeApp('volunteer', 'pending', 'dept-volunteers'),
  ];

  assert.deepEqual(computeFormSubmissionCounts(mediaForm, apps, 'shared-dept'), {
    total: 2,
    pending: 1,
    accepted: 1,
    rejected: 0,
  });
  assert.deepEqual(computeFormSubmissionCounts(pressForm, apps, 'shared-dept'), {
    total: 1,
    pending: 0,
    accepted: 0,
    rejected: 1,
  });
  assert.deepEqual(computeFormSubmissionCounts(volunteerForm, apps, 'dept-volunteers'), {
    total: 1,
    pending: 1,
    accepted: 0,
    rejected: 0,
  });
});
