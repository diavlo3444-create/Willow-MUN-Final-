import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInterpolationContext,
  renderEmailTemplateText,
  validateEmailDraft,
} from './emailTemplates';
import type { Application, Department } from '../types/admin';

const dept: Department = {
  id: 'hr',
  slug: 'hr',
  name: 'Human Resources',
  cluster: 'Delegate Affairs & Operations',
  description: 'HR',
  headUserIds: [],
  registrationOpen: true,
  capacity: 15,
  positions: ['HR Coordinator'],
  instructions: '',
  updatedAt: '2027-11-01T00:00:00Z',
};

const app: Application = {
  id: 'app-1',
  applicationCode: 'WM-2027-001',
  category: 'staff',
  applicantName: 'Layla Mansour',
  email: 'layla@example.com',
  phone: '+971500001',
  schoolOrUniversity: 'Willow International',
  gradeOrYear: 'Grade 12',
  city: 'Dubai',
  country: 'UAE',
  age: 17,
  departmentId: 'hr',
  position: 'HR Coordinator',
  secondChoiceDepartmentId: null,
  status: 'accepted',
  submittedAt: '2027-11-10T09:00:00Z',
  updatedAt: '2027-11-10T09:00:00Z',
  headRecommendation: 'recommend_accept',
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
  experienceLevel: '3 Conferences',
  answers: [],
  documents: [],
  notes: [],
  history: [],
};

test('renderEmailTemplateText interpolates all applicant and conference variables', () => {
  const ctx = buildInterpolationContext(app, [dept]);
  const output = renderEmailTemplateText(
    'Dear {{name}}, your application {{applicationId}} for {{position}} in {{department}} at {{conferenceName}} {{year}} is accepted.',
    ctx,
  );
  assert.equal(
    output,
    'Dear Layla Mansour, your application WM-2027-001 for HR Coordinator in Human Resources at Willow MUN 2027 is accepted.',
  );
});

test('validateEmailDraft rejects empty subject, empty body, or zero recipients', () => {
  assert.ok(validateEmailDraft('', 'Body', 1));
  assert.ok(validateEmailDraft('Subject', '   ', 1));
  assert.ok(validateEmailDraft('Subject', 'Body', 0));
  assert.equal(validateEmailDraft('Welcome', 'Hello!', 2), null);
});
