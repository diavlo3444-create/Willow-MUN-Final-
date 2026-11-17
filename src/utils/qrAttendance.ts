import type { AttendanceScanRecord, QrPassRecord } from '../types/admin';

export interface QrScanEvaluation {
  result: AttendanceScanRecord['result'];
  pass: QrPassRecord | null;
  message: string;
}

/**
 * Pure QR pass verification helper used by the Venue Security Scanner.
 * Detects invalid tokens, revoked passes, duplicate scans within the cooldown window, and valid check-ins.
 */
export function evaluateQrScan(
  tokenRaw: string,
  passes: QrPassRecord[],
  recentScans: AttendanceScanRecord[],
  nowIso: string,
  duplicateWindowMs = 5 * 60 * 1000,
): QrScanEvaluation {
  const token = tokenRaw.trim().toUpperCase();
  if (!token) {
    return {
      result: 'invalid_token',
      pass: null,
      message: 'Scan token is empty. Enter or scan a valid Willow MUN QR pass code.',
    };
  }

  const matched = passes.find((p) => p.token.toUpperCase() === token);
  if (!matched) {
    return {
      result: 'invalid_token',
      pass: null,
      message: `Unrecognized pass token "${token}". No conference credential matches this code.`,
    };
  }

  if (!matched.active) {
    return {
      result: 'revoked_pass',
      pass: matched,
      message: `Pass for ${matched.holderName} has been revoked or deactivated.`,
    };
  }

  const nowMs = Date.parse(nowIso);
  const recentDuplicate = recentScans.find((s) => {
    if (s.passId !== matched.id || s.result !== 'valid_checkin') return false;
    const diff = nowMs - Date.parse(s.scannedAt);
    return diff >= 0 && diff <= duplicateWindowMs;
  });

  if (recentDuplicate) {
    return {
      result: 'duplicate_recent',
      pass: matched,
      message: `Duplicate scan detected: ${matched.holderName} already checked in at ${recentDuplicate.gateLocation}.`,
    };
  }

  return {
    result: 'valid_checkin',
    pass: matched,
    message: `Verified: ${matched.holderName} (${matched.roleLabel}) checked in.`,
  };
}
