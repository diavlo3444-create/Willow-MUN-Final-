import test from 'node:test';
import assert from 'node:assert/strict';
import type { LiveAttendanceAttendee, LiveQrValidationResponse } from '../services/liveBackendService';
import {
  canResetAllAttendance,
  classifyQrScanOutcome,
  shouldIgnoreRapidCameraFrame,
  splitAndFilterAttendanceRoster,
} from './qrAttendance';

function makeValidation(overrides: Partial<LiveQrValidationResponse> = {}): LiveQrValidationResponse {
  return {
    status: 'valid',
    result: 'valid_checkin',
    message: 'Checked in successfully.',
    pass_id: 'pass-1',
    holder_name: 'Layla Al-Mansoor',
    role_label: 'Delegate',
    category: 'Delegate',
    department_name: 'Security Council',
    committee_name: 'UNSC',
    application_code: 'WM-1042',
    pass_active: true,
    checked_in_at: '2026-11-20T09:15:00.000Z',
    checked_in_gate: 'Main Entrance',
    gate_location: 'Main Entrance',
    scanned_at: '2026-11-20T09:15:00.000Z',
    committed: true,
    ...overrides,
  };
}

test('classifyQrScanOutcome handles fresh auto check-in, duplicate warning, invalid pass, and connection errors', () => {
  const fresh = classifyQrScanOutcome(makeValidation());
  assert.equal(fresh.kind, 'checked_in');
  assert.equal(fresh.headline, 'CHECKED IN');
  assert.equal(fresh.fullName, 'Layla Al-Mansoor');
  assert.equal(fresh.roleLabel, 'Delegate');
  assert.equal(fresh.departmentName, 'Security Council');
  assert.equal(fresh.isValid, true);
  assert.equal(fresh.validityLabel, 'Valid QR Code');
  assert.equal(fresh.alreadyCheckedIn, false);
  assert.equal(fresh.checkedInAt, '2026-11-20T09:15:00.000Z');

  const duplicate = classifyQrScanOutcome(
    makeValidation({
      status: 'already_checked_in',
      result: 'already_checked_in',
      message: 'Already checked in. Original check-in time preserved.',
      checked_in_at: '2026-11-20T08:05:12.000Z',
      scanned_at: '2026-11-20T10:30:00.000Z',
      committed: false,
    }),
  );
  assert.equal(duplicate.kind, 'already_checked_in');
  assert.equal(duplicate.headline, 'ALREADY CHECKED IN');
  assert.equal(duplicate.originalCheckedInAt, '2026-11-20T08:05:12.000Z');
  assert.equal(duplicate.fullName, 'Layla Al-Mansoor');
  assert.equal(duplicate.departmentName, 'Security Council');
  assert.equal(duplicate.isValid, true);
  assert.equal(duplicate.alreadyCheckedIn, true);
  assert.equal(duplicate.checkInStatusLabel, 'Already Checked In');

  const invalid = classifyQrScanOutcome(
    makeValidation({
      status: 'invalid',
      result: 'invalid_token',
      message: 'QR code does not match any issued Willow MUN pass.',
      pass_id: null,
      holder_name: null,
      role_label: null,
      department_name: null,
      committee_name: null,
      committed: false,
    }),
  );
  assert.equal(invalid.kind, 'invalid');
  assert.equal(invalid.headline, 'INVALID QR CODE');
  assert.equal(invalid.isValid, false);
  assert.equal(invalid.validityLabel, 'Invalid QR Code');
  assert.equal(invalid.alreadyCheckedIn, false);

  const networkFail = classifyQrScanOutcome(null, 'Network request timed out.');
  assert.equal(networkFail.kind, 'error');
  assert.equal(networkFail.headline, 'CHECK-IN FAILED');
  assert.equal(networkFail.message, 'Network request timed out.');
  assert.equal(networkFail.isValid, null);
});

test('canResetAllAttendance restricts reset strictly to super_admin', () => {
  assert.equal(canResetAllAttendance({ role: 'super_admin' }), true);
  assert.equal(canResetAllAttendance({ role: 'admin' }), false);
  assert.equal(canResetAllAttendance({ role: 'department_head' }), false);
  assert.equal(canResetAllAttendance({ role: 'executive_board' }), false);
  assert.equal(canResetAllAttendance({ role: 'staff' }), false);
  assert.equal(canResetAllAttendance(null), false);
  assert.equal(canResetAllAttendance(undefined), false);
});

test('shouldIgnoreRapidCameraFrame prevents rapid duplicate scans of the same token without delaying different passes', () => {
  assert.equal(shouldIgnoreRapidCameraFrame('WMQR-ABC', 1000, 'wmqr-abc', 2500, 3000), true);
  assert.equal(shouldIgnoreRapidCameraFrame('WMQR-ABC', 1000, 'WMQR-ABC', 4200, 3000), false);
  assert.equal(shouldIgnoreRapidCameraFrame('WMQR-ABC', 1000, 'WMQR-XYZ', 1100, 3000), false);
});

test('splitAndFilterAttendanceRoster sorts Checked In newest-first and Not Checked In alphabetically', () => {
  const checkedIn: LiveAttendanceAttendee[] = [
    {
      id: '1',
      holder_name: 'Omar Hassan',
      role_label: 'Delegate',
      category: 'Delegate',
      department_name: null,
      committee_name: 'DISEC',
      application_code: 'WM-101',
      checked_in_at: '2026-11-20T08:00:00.000Z',
      checked_in_gate: 'Main Entrance',
    },
    {
      id: '2',
      holder_name: 'Alya Ismail',
      role_label: 'Chair',
      category: 'Executive Board',
      department_name: 'DCC',
      committee_name: null,
      application_code: null,
      checked_in_at: '2026-11-20T09:00:00.000Z',
      checked_in_gate: 'Main Entrance',
    },
  ];
  const notCheckedIn: LiveAttendanceAttendee[] = [
    {
      id: '3',
      holder_name: 'Zaid Kareem',
      role_label: 'Volunteer',
      category: 'Staff',
      department_name: 'Volunteers',
      committee_name: null,
      application_code: null,
      checked_in_at: null,
      checked_in_gate: null,
    },
    {
      id: '4',
      holder_name: 'Dana Jradi',
      role_label: 'Media Photographer',
      category: 'Staff',
      department_name: 'Media',
      committee_name: null,
      application_code: null,
      checked_in_at: null,
      checked_in_gate: null,
    },
  ];

  const all = splitAndFilterAttendanceRoster(checkedIn, notCheckedIn, '');
  assert.deepEqual(
    all.checkedIn.map((p) => p.holder_name),
    ['Alya Ismail', 'Omar Hassan'],
  );
  assert.deepEqual(
    all.notCheckedIn.map((p) => p.holder_name),
    ['Dana Jradi', 'Zaid Kareem'],
  );

  const filtered = splitAndFilterAttendanceRoster(checkedIn, notCheckedIn, 'media');
  assert.equal(filtered.checkedIn.length, 0);
  assert.deepEqual(
    filtered.notCheckedIn.map((p) => p.holder_name),
    ['Dana Jradi'],
  );
});
