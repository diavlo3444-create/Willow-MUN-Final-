import test from 'node:test';
import assert from 'node:assert/strict';
import type { AttendanceScanRecord, QrPassRecord } from '../types/admin';
import { evaluateQrScan } from './qrAttendance';

const passes: QrPassRecord[] = [
  {
    id: 'qr-1',
    token: 'WM26-STAFF-001',
    holderName: 'Naya Barakat',
    roleLabel: 'Deputy Secretary-General',
    departmentId: null,
    category: 'Executive',
    active: true,
    checkedIn: false,
    lastScannedAt: null,
  },
  {
    id: 'qr-2',
    token: 'WM26-SEC-099',
    holderName: 'Revoked Holder',
    roleLabel: 'Security Officer',
    departmentId: 'security',
    category: 'Security',
    active: false,
    checkedIn: false,
    lastScannedAt: null,
  },
];

const scans: AttendanceScanRecord[] = [
  {
    id: 'scan-1',
    passId: 'qr-1',
    tokenScanned: 'WM26-STAFF-001',
    holderName: 'Naya Barakat',
    departmentId: null,
    roleLabel: 'Deputy Secretary-General',
    result: 'valid_checkin',
    scannedBy: 'Wed Sidahmed',
    gateLocation: 'Main Hall Entrance',
    scannedAt: '2026-11-17T09:00:00.000Z',
  },
];

test('evaluateQrScan detects valid, duplicate, revoked, and invalid tokens accurately', () => {
  const duplicate = evaluateQrScan(
    'WM26-STAFF-001',
    passes,
    scans,
    '2026-11-17T09:02:00.000Z',
  );
  assert.equal(duplicate.result, 'duplicate_recent');

  const validAfterWindow = evaluateQrScan(
    'wm26-staff-001',
    passes,
    scans,
    '2026-11-17T09:10:00.000Z',
  );
  assert.equal(validAfterWindow.result, 'valid_checkin');
  assert.equal(validAfterWindow.pass?.id, 'qr-1');

  const revoked = evaluateQrScan('WM26-SEC-099', passes, scans, '2026-11-17T09:10:00.000Z');
  assert.equal(revoked.result, 'revoked_pass');

  const invalid = evaluateQrScan('UNKNOWN-999', passes, scans, '2026-11-17T09:10:00.000Z');
  assert.equal(invalid.result, 'invalid_token');

  const alreadyUsedPass: QrPassRecord = {
    ...passes[0],
    id: 'qr-used',
    token: 'WM26-USED-002',
    checkedIn: true,
    lastScannedAt: '2026-11-16T08:30:00.000Z',
  };
  const alreadyChecked = evaluateQrScan(
    'WM26-USED-002',
    [...passes, alreadyUsedPass],
    scans,
    '2026-11-17T09:10:00.000Z',
  );
  assert.equal(alreadyChecked.result, 'already_checked_in');
});
