import test from 'node:test';
import assert from 'node:assert/strict';
import type { Department } from '../types/admin';
import {
  filterAndSortDepartmentQrPasses,
  matchesDepartmentQrSection,
  normalizeDepartmentQrSection,
} from './departmentQr';

const DEPARTMENTS: Array<Pick<Department, 'id' | 'slug' | 'name'>> = [
  { id: 'dept-media', slug: 'media', name: 'Media' },
  { id: 'dept-press', slug: 'press', name: 'Press' },
  { id: 'dept-vol', slug: 'volunteers', name: 'Volunteers' },
  { id: 'dept-sec', slug: 'security', name: 'Security' },
  { id: 'dept-hr', slug: 'hr', name: 'Human Resources' },
];

test('normalizeDepartmentQrSection resolves Press, Media, Volunteering, and Security aliases', () => {
  assert.equal(normalizeDepartmentQrSection('press-media'), 'press_media');
  assert.equal(normalizeDepartmentQrSection('media-press'), 'press_media');
  assert.equal(normalizeDepartmentQrSection('media'), 'press_media');
  assert.equal(normalizeDepartmentQrSection('press'), 'press_media');
  assert.equal(normalizeDepartmentQrSection('volunteering'), 'volunteers');
  assert.equal(normalizeDepartmentQrSection('volunteers'), 'volunteers');
  assert.equal(normalizeDepartmentQrSection('volunteer'), 'volunteers');
  assert.equal(normalizeDepartmentQrSection('security'), 'security');
  assert.equal(normalizeDepartmentQrSection('hr'), null);
});

test('filterAndSortDepartmentQrPasses returns only active, eligible passes scoped to each department', () => {
  const passes = [
    {
      id: 'p-press',
      user_id: null,
      application_id: 'a-1',
      token_value: 'WMQR-PRESS-1',
      holder_name: 'Zainab Press',
      role_label: 'Press Journalist',
      category: 'Staff',
      department_id: 'dept-press',
      department_name: 'Press',
      active: true,
      checked_in_at: null,
      checked_in_gate: null,
      application_status: 'accepted',
    },
    {
      id: 'p-media',
      user_id: 'u-media',
      application_id: null,
      token_value: 'WMQR-MEDIA-1',
      holder_name: 'Adam Media',
      role_label: 'Media Photographer',
      category: 'Staff',
      department_id: 'dept-media',
      department_name: 'Media',
      active: true,
      checked_in_at: null,
      checked_in_gate: null,
    },
    {
      id: 'p-vol-active',
      user_id: null,
      application_id: 'a-2',
      token_value: 'WMQR-VOL-1',
      holder_name: 'Nour Volunteer',
      role_label: 'Floor Volunteer',
      category: 'Staff',
      department_id: 'dept-vol',
      department_name: 'Volunteers',
      active: true,
      checked_in_at: null,
      checked_in_gate: null,
      application_status: 'accepted',
    },
    {
      id: 'p-vol-revoked',
      user_id: null,
      application_id: null,
      token_value: 'WMQR-VOL-REVOKED',
      holder_name: 'Revoked Volunteer',
      role_label: 'Floor Volunteer',
      category: 'Staff',
      department_id: 'dept-vol',
      department_name: 'Volunteers',
      active: false,
      checked_in_at: null,
      checked_in_gate: null,
    },
    {
      id: 'p-vol-pending-app',
      user_id: null,
      application_id: 'a-pending',
      token_value: 'WMQR-VOL-PENDING',
      holder_name: 'Pending Applicant',
      role_label: 'Volunteer',
      category: 'Staff',
      department_id: 'dept-vol',
      department_name: 'Volunteers',
      active: true,
      checked_in_at: null,
      checked_in_gate: null,
      application_status: 'pending',
    },
    {
      id: 'p-sec',
      user_id: 'u-sec',
      application_id: null,
      token_value: 'WMQR-SEC-1',
      holder_name: 'Karim Security',
      role_label: 'Entrance Security',
      category: 'Staff',
      department_id: 'dept-sec',
      department_name: 'Security',
      active: true,
      checked_in_at: null,
      checked_in_gate: null,
    },
    {
      id: 'p-hr',
      user_id: 'u-hr',
      application_id: null,
      token_value: 'WMQR-HR-1',
      holder_name: 'HR Member',
      role_label: 'Media & Press Liaison',
      category: 'Staff',
      department_id: 'dept-hr',
      department_name: 'Human Resources',
      active: true,
      checked_in_at: null,
      checked_in_gate: null,
    },
    {
      id: 'p-delegate',
      user_id: null,
      application_id: 'a-del',
      token_value: 'WMQR-DEL-1',
      holder_name: 'Delegate User',
      role_label: 'Press Delegate',
      category: 'Delegate',
      department_id: null,
      department_name: null,
      active: true,
      checked_in_at: null,
      checked_in_gate: null,
    },
  ];

  const pressMedia = filterAndSortDepartmentQrPasses(passes, 'press_media', DEPARTMENTS);
  assert.deepEqual(
    pressMedia.map((p) => p.holder_name),
    ['Adam Media', 'Zainab Press'],
  );

  const volunteers = filterAndSortDepartmentQrPasses(passes, 'volunteers', DEPARTMENTS);
  assert.deepEqual(
    volunteers.map((p) => p.holder_name),
    ['Nour Volunteer'],
  );

  const security = filterAndSortDepartmentQrPasses(passes, 'security', DEPARTMENTS);
  assert.deepEqual(
    security.map((p) => p.holder_name),
    ['Karim Security'],
  );

  // Role-label fallback only triggers when structured department fields are absent
  assert.equal(
    matchesDepartmentQrSection(
      {
        id: 'p-fallback',
        holder_name: 'Fallback Photographer',
        token_value: 'WMQR-FALLBACK',
        role_label: 'Event Photographer',
        category: 'Staff',
        active: true,
      },
      'press_media',
      DEPARTMENTS,
    ),
    true,
  );
});
