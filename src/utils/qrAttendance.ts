import type { LiveAttendanceAttendee, LiveQrValidationResponse } from '../services/liveBackendService';
import type { AdminUser, AttendanceScanRecord, QrPassRecord } from '../types/admin';

export interface QrScanEvaluation {
  result: AttendanceScanRecord['result'];
  pass: QrPassRecord | null;
  message: string;
}

export function evaluateQrScan(
  token: string,
  passes: QrPassRecord[],
  _scans: AttendanceScanRecord[],
  _timestampIso: string,
): QrScanEvaluation {
  const clean = token.trim().toUpperCase();
  if (!clean) {
    return { result: 'invalid_token', pass: null, message: 'Empty QR token provided.' };
  }
  const pass = passes.find((p) => p.token.trim().toUpperCase() === clean) || null;
  if (!pass) {
    return { result: 'invalid_token', pass: null, message: 'QR code does not match any active pass.' };
  }
  if (!pass.active) {
    return { result: 'revoked_pass', pass, message: 'This QR pass has been revoked.' };
  }
  if (pass.checkedIn) {
    return {
      result: 'already_checked_in',
      pass,
      message: 'Already checked in. Original check-in time preserved.',
    };
  }
  return { result: 'valid_checkin', pass, message: 'Checked in successfully.' };
}

export type QrScanFeedbackKind =
  | 'idle'
  | 'checked_in'
  | 'checked_out'
  | 'already_checked_in'
  | 'invalid'
  | 'error';

export interface QrScanFeedbackState {
  kind: QrScanFeedbackKind;
  headline: string;
  message: string;
  fullName: string | null;
  roleLabel: string | null;
  category: string | null;
  departmentOrCommittee: string | null;
  departmentName: string | null;
  isValid: boolean | null;
  validityLabel: 'Valid QR Code' | 'Invalid QR Code' | null;
  alreadyCheckedIn: boolean;
  checkInStatusLabel: string | null;
  originalCheckedInAt: string | null;
  checkedInAt: string | null;
}

export function canResetAllAttendance(actor: Pick<AdminUser, 'role'> | null | undefined): boolean {
  return actor?.role === 'super_admin';
}

export function shouldIgnoreRapidCameraFrame(
  lastToken: string,
  lastDetectedAtMs: number,
  nextToken: string,
  nowMs: number,
  cooldownMs = 3000,
): boolean {
  const cleanPrev = lastToken.trim().toUpperCase();
  const cleanNext = nextToken.trim().toUpperCase();
  if (!cleanPrev || !cleanNext) return false;
  return cleanPrev === cleanNext && nowMs - lastDetectedAtMs < cooldownMs;
}

export function classifyQrScanOutcome(
  validation: LiveQrValidationResponse | null,
  requestError?: string | null,
): QrScanFeedbackState {
  if (requestError && requestError.trim()) {
    return {
      kind: 'error',
      headline: 'CHECK-IN FAILED',
      message: requestError.trim(),
      fullName: null,
      roleLabel: null,
      category: null,
      departmentOrCommittee: null,
      departmentName: null,
      isValid: null,
      validityLabel: null,
      alreadyCheckedIn: false,
      checkInStatusLabel: 'Verification Error',
      originalCheckedInAt: null,
      checkedInAt: null,
    };
  }

  if (!validation) {
    return {
      kind: 'idle',
      headline: 'READY TO SCAN',
      message: 'Point the camera at a Willow MUN QR pass to check in automatically.',
      fullName: null,
      roleLabel: null,
      category: null,
      departmentOrCommittee: null,
      departmentName: null,
      isValid: null,
      validityLabel: null,
      alreadyCheckedIn: false,
      checkInStatusLabel: null,
      originalCheckedInAt: null,
      checkedInAt: null,
    };
  }

  const fullName = validation.holder_name || 'Unlisted Holder';
  const roleLabel = validation.role_label || validation.category || 'Conference Attendee';
  const departmentName = validation.department_name || validation.committee_name || null;
  const departmentOrCommittee = validation.committee_name || validation.department_name || null;

  if (validation.status === 'checked_out' && validation.committed) {
    return {
      kind: 'checked_out',
      headline: 'CHECKED OUT',
      message: validation.message || 'Check-out recorded successfully.',
      fullName,
      roleLabel,
      category: validation.category,
      departmentOrCommittee,
      departmentName,
      isValid: true,
      validityLabel: 'Valid QR Code',
      alreadyCheckedIn: false,
      checkInStatusLabel: 'Checked Out',
      originalCheckedInAt: null,
      checkedInAt: validation.checked_out_at || validation.scanned_at,
    };
  }

  if (validation.status === 'already_checked_in') {
    return {
      kind: 'already_checked_in',
      headline: 'ALREADY CHECKED IN',
      message:
        validation.message ||
        'This pass has already been checked in. Original check-in time preserved.',
      fullName,
      roleLabel,
      category: validation.category,
      departmentOrCommittee,
      departmentName,
      isValid: true,
      validityLabel: 'Valid QR Code',
      alreadyCheckedIn: true,
      checkInStatusLabel: 'Already Checked In',
      originalCheckedInAt: validation.checked_in_at,
      checkedInAt: validation.checked_in_at,
    };
  }

  if (validation.status === 'valid' && validation.committed) {
    return {
      kind: 'checked_in',
      headline: 'CHECKED IN',
      message: validation.message || 'Checked in successfully.',
      fullName,
      roleLabel,
      category: validation.category,
      departmentOrCommittee,
      departmentName,
      isValid: true,
      validityLabel: 'Valid QR Code',
      alreadyCheckedIn: false,
      checkInStatusLabel: 'Checked In (First Scan)',
      originalCheckedInAt: null,
      checkedInAt: validation.checked_in_at || validation.scanned_at,
    };
  }

  if (validation.status === 'revoked') {
    return {
      kind: 'invalid',
      headline: 'PASS REVOKED',
      message: validation.message || 'This QR pass has been deactivated by an administrator.',
      fullName: validation.holder_name,
      roleLabel: validation.role_label,
      category: validation.category,
      departmentOrCommittee,
      departmentName,
      isValid: false,
      validityLabel: 'Invalid QR Code',
      alreadyCheckedIn: false,
      checkInStatusLabel: 'Pass Revoked',
      originalCheckedInAt: null,
      checkedInAt: null,
    };
  }

  if (validation.status === 'not_eligible') {
    return {
      kind: 'invalid',
      headline: 'NOT ELIGIBLE',
      message: validation.message || 'Pass holder is not eligible for check-in.',
      fullName: validation.holder_name,
      roleLabel: validation.role_label,
      category: validation.category,
      departmentOrCommittee,
      departmentName,
      isValid: false,
      validityLabel: 'Invalid QR Code',
      alreadyCheckedIn: false,
      checkInStatusLabel: 'Not Checked In (Not Eligible)',
      originalCheckedInAt: null,
      checkedInAt: null,
    };
  }

  return {
    kind: 'invalid',
    headline: 'INVALID QR CODE',
    message: validation.message || 'QR code does not match any active Willow MUN pass.',
    fullName: null,
    roleLabel: null,
    category: null,
    departmentOrCommittee: null,
    departmentName: null,
    isValid: false,
    validityLabel: 'Invalid QR Code',
    alreadyCheckedIn: false,
    checkInStatusLabel: 'Not Checked In (Invalid Pass)',
    originalCheckedInAt: null,
    checkedInAt: null,
  };
}

export function splitAndFilterAttendanceRoster(
  checkedIn: LiveAttendanceAttendee[],
  notCheckedIn: LiveAttendanceAttendee[],
  searchQuery: string,
): {
  checkedIn: LiveAttendanceAttendee[];
  notCheckedIn: LiveAttendanceAttendee[];
} {
  const q = searchQuery.trim().toLowerCase();
  const matches = (entry: LiveAttendanceAttendee) => {
    if (!q) return true;
    const haystack = `${entry.holder_name} ${entry.role_label} ${entry.category} ${entry.department_name || ''} ${entry.committee_name || ''}`.toLowerCase();
    return haystack.includes(q);
  };

  const sortedCheckedIn = [...checkedIn]
    .filter((entry) => Boolean(entry.checked_in_at) && matches(entry))
    .sort((a, b) => {
      const timeA = a.checked_in_at ? new Date(a.checked_in_at).getTime() : 0;
      const timeB = b.checked_in_at ? new Date(b.checked_in_at).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return a.holder_name.localeCompare(b.holder_name);
    });

  const sortedNotCheckedIn = [...notCheckedIn]
    .filter((entry) => !entry.checked_in_at && matches(entry))
    .sort((a, b) => a.holder_name.localeCompare(b.holder_name));

  return {
    checkedIn: sortedCheckedIn,
    notCheckedIn: sortedNotCheckedIn,
  };
}

export function formatAttendanceTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatAttendanceDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
