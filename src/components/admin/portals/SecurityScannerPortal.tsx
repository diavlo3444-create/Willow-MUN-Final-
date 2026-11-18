import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  History,
  LogOut,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import {
  commitQrPassAttendance,
  fetchMySecurityScans,
  verifyQrPassAttendance,
  type LiveQrScanEvent,
  type LiveQrValidationResponse,
} from '../../../services/liveBackendService';
import {
  canAccessPortal,
  getPortalHomeRouteForUser,
  hasPermission,
  isSecurityAccount,
} from '../../../utils/adminPermissions';
import { MyQrCard, MyQrModal } from '../MyQrModal';
import { PortalAuthView } from '../PortalAuthView';
import { QrCameraScanner } from '../QrCameraScanner';
import { QrValidationResultCard } from '../QrValidationResultCard';

interface SecurityScannerPortalProps {
  pathname: string;
  onNavigate: (path: string) => void;
}

const GATES = [
  'Main Entrance',
  'VIP Entrance',
  'Committee Hall',
  'Registration Desk',
  'Staff Entrance',
];

export function SecurityScannerPortal({
  pathname,
  onNavigate,
}: SecurityScannerPortalProps) {
  const { currentUser, data, signOut, pushToast, openMyQrModal } = useAdminStore();

  const authorized =
    currentUser !== null && canAccessPortal(currentUser, 'security', data.departments);
  const canViewHeadApps =
    currentUser !== null &&
    (currentUser.role === 'department_head' || currentUser.role === 'executive_board') &&
    hasPermission(currentUser, 'applications.view', data.departments);

  const subPath = pathname.replace(/^\/security\/?/, '');
  const activeTab: 'scanner' | 'history' | 'qr' =
    subPath.startsWith('history')
      ? 'history'
      : subPath.startsWith('qr')
        ? 'qr'
        : 'scanner';

  const [gateLocation, setGateLocation] = useState<string>('Main Entrance');
  const [confirmBeforeCheckin, setConfirmBeforeCheckin] = useState<boolean>(true);
  const [attendanceAction, setAttendanceAction] = useState<'checkin' | 'checkout'>('checkin');
  const [manualToken, setManualToken] = useState<string>('');
  const [pendingToken, setPendingToken] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [validation, setValidation] = useState<LiveQrValidationResponse | null>(null);
  const [scanError, setScanError] = useState<string>('');
  const [recentScans, setRecentScans] = useState<LiveQrScanEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);

  const loadRecentScans = useCallback(async () => {
    if (!authorized) {
      setLoadingHistory(false);
      return;
    }
    setLoadingHistory(true);
    const res = await fetchMySecurityScans();
    setRecentScans(res.scans);
    setLoadingHistory(false);
  }, [authorized]);

  useEffect(() => {
    void loadRecentScans();
  }, [loadRecentScans]);

  const handleScanOrManual = useCallback(
    async (rawToken: string) => {
      const cleanToken = rawToken.trim();
      if (!cleanToken) return;
      setScanError('');
      setBusy(true);
      setPendingToken(cleanToken);

      const response = confirmBeforeCheckin
        ? await verifyQrPassAttendance(cleanToken, gateLocation, attendanceAction)
        : await commitQrPassAttendance(cleanToken, gateLocation, attendanceAction);

      setBusy(false);

      if (!response.ok || !response.validation) {
        setScanError(response.error || 'Could not validate QR pass.');
        return;
      }

      const v = response.validation;
      setValidation(v);
      setManualToken('');

      if ((v.status === 'valid' || v.status === 'checked_out') && v.committed) {
        pushToast({
          tone: 'success',
          title: attendanceAction === 'checkout' ? 'Check-Out Recorded' : 'Entry Approved',
          description: `${v.holder_name || 'Attendee'} ${attendanceAction === 'checkout' ? 'checked out' : 'checked in'} at ${gateLocation}.`,
        });
      } else if (v.status === 'checkout_warning' || v.status === 'not_checked_in') {
        pushToast({ tone: 'warning', title: v.status === 'checkout_warning' ? 'Repeat Check-Out Warning' : 'Not Checked In', description: v.message });
      } else if (v.status === 'already_checked_in') {
        pushToast({
          tone: 'warning',
          title: 'Already Checked In',
          description: v.holder_name || 'Pass has already been used.',
        });
      } else if (v.status !== 'valid' && v.status !== 'checkout_warning') {
        pushToast({
          tone: 'error',
          title:
            v.status === 'revoked'
              ? 'Pass Revoked'
              : v.status === 'not_eligible'
                ? 'Not Eligible'
                : 'Invalid QR Pass',
          description: v.message,
        });
      }

      await loadRecentScans();
    },
    [attendanceAction, confirmBeforeCheckin, gateLocation, loadRecentScans, pushToast],
  );

  const handleConfirmPendingCheckin = useCallback(async () => {
    if (!pendingToken) return;
    setScanError('');
    setBusy(true);
    const res = await commitQrPassAttendance(pendingToken, gateLocation, attendanceAction, validation?.status === 'checkout_warning');
    setBusy(false);

    if (!res.ok || !res.validation) {
      setScanError(res.error || 'Could not complete check-in.');
      return;
    }

    const v = res.validation;
    setValidation(v);

    if ((v.status === 'valid' || v.status === 'checked_out') && v.committed) {
      pushToast({
        tone: 'success',
        title: attendanceAction === 'checkout' ? 'Check-Out Recorded' : 'Check-In Recorded',
        description: `${v.holder_name || 'Attendee'} · ${gateLocation}`,
      });
    } else if (v.status === 'already_checked_in' || v.status === 'not_checked_in') {
      pushToast({ tone: 'warning', title: 'Attendance Status Warning', description: v.message });
    } else {
      pushToast({
        tone: 'error',
        title: 'Entry Blocked',
        description: v.message,
      });
    }

    await loadRecentScans();
  }, [attendanceAction, gateLocation, loadRecentScans, pendingToken, pushToast, validation?.status]);

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    void handleScanOrManual(manualToken);
  };

  if (!currentUser) {
    return <PortalAuthView portal="security" onNavigate={onNavigate} />;
  }

  if (!authorized || !isSecurityAccount(currentUser, data.departments)) {
    return (
      <div className="wm-admin min-h-[100dvh] flex items-center justify-center bg-[color:var(--wm-canvas)] p-6 text-[color:var(--wm-ink)]">
        <div className="wm-surface-panel max-w-md border-rose-400/35 p-6 text-center">
          <ShieldAlert className="mx-auto h-9 w-9 text-rose-300" aria-hidden="true" />
          <h1 className="wm-serif mt-3 text-xl font-semibold text-rose-100">
            Security Scanner Access Restricted
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
            This terminal is restricted to authorized Willow MUN Security accounts.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate(getPortalHomeRouteForUser(currentUser, data.departments))}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Open My Portal
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] px-3 text-xs text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const awaitingConfirmation = Boolean(
    validation && ((validation.status === 'valid' && !validation.committed) || validation.status === 'checkout_warning'),
  );

  return (
    <div className="wm-admin min-h-[100dvh] bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)]">
      {/* Focused Security Top Bar — minimal navigation, mobile & tablet optimized */}
      <header className="sticky top-0 z-30 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)]">
              <img src="/assets/logo-transparent.png" alt="" className="h-full w-full object-contain p-1" />
            </span>
            <div>
              <p className="wm-display text-[12.5px] tracking-[0.12em] text-[color:var(--wm-ink)]">
                WILLOW MUN <span className="text-[color:var(--wm-accent)]">SECURITY</span>
              </p>
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)]">
                Entrance Pass Scanner · {currentUser.fullName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canViewHeadApps && (
              <button
                type="button"
                onClick={() => onNavigate('/head/applications')}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-2.5 text-[11px] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]"
              >
                <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                Head Portal
              </button>
            )}
            <button
              type="button"
              onClick={openMyQrModal}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[#2d6a4f]/28 px-2.5 text-[11px] font-medium text-[color:var(--wm-focal)] hover:bg-[#2d6a4f]/45"
            >
              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
              My QR
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline)] px-2.5 text-[11px] text-[color:var(--wm-ink-secondary)] hover:border-rose-400/40 hover:text-rose-200"
            >
              <LogOut className="h-3 w-3" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>

        {/* Minimal 3-button Navigation Strip */}
        <div className="mx-auto flex max-w-6xl items-center gap-1.5 border-t border-[color:var(--wm-hairline)] px-4 py-2 sm:px-6">
          <button
            type="button"
            onClick={() => onNavigate('/security')}
            className={`inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-xs font-medium transition-colors ${
              activeTab === 'scanner'
                ? 'bg-[#2d6a4f]/35 text-[color:var(--wm-ink)] ring-1 ring-[color:var(--wm-accent)]/50'
                : 'text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-inset)]'
            }`}
          >
            <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
            Live Scanner
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/security/history')}
            className={`inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-xs font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-[#2d6a4f]/35 text-[color:var(--wm-ink)] ring-1 ring-[color:var(--wm-accent)]/50'
                : 'text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-inset)]'
            }`}
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            Recent Scans ({recentScans.length})
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/security/qr')}
            className={`inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-xs font-medium transition-colors ${
              activeTab === 'qr'
                ? 'bg-[#2d6a4f]/35 text-[color:var(--wm-ink)] ring-1 ring-[color:var(--wm-accent)]/50'
                : 'text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-inset)]'
            }`}
          >
            <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
            My QR
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
        {activeTab === 'qr' ? (
          <div className="mx-auto max-w-xl">
            <MyQrCard actorOverride={currentUser} />
          </div>
        ) : activeTab === 'history' ? (
          <section className="wm-surface-panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] px-4 py-3.5">
              <div>
                <h1 className="wm-serif text-xl font-semibold text-[color:var(--wm-ink)]">
                  My Recent Entrance Scans
                </h1>
                <p className="mt-0.5 text-[11px] text-[color:var(--wm-ink-muted)]">
                  Latest 50 QR verifications recorded by your Security terminal
                </p>
              </div>
              <button
                type="button"
                disabled={loadingHistory}
                onClick={() => void loadRecentScans()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-xs text-[color:var(--wm-focal)] hover:bg-[color:var(--wm-overlay)]"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loadingHistory ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Refresh
              </button>
            </div>

            {recentScans.length === 0 ? (
              <p className="p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">
                No scans recorded from this Security account yet.
              </p>
            ) : (
              <div className="divide-y divide-[color:var(--wm-hairline)]">
                {recentScans.map((scan) => {
                  const isValid = scan.result === 'valid_checkin' || scan.result === 'valid_checkout';
                  const isDuplicate =
                    scan.result === 'already_checked_in' || scan.result === 'duplicate_recent';
                  return (
                    <div
                      key={scan.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex items-start gap-3">
                        {isValid ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        ) : isDuplicate ? (
                          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                        )}
                        <div>
                          <p className="text-xs font-semibold text-[color:var(--wm-ink)]">
                            {scan.holder_name || 'Unrecognized QR Token'}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[color:var(--wm-ink-muted)]">
                            {scan.application_code ? `${scan.application_code} · ` : ''}
                            {scan.committee_name || scan.department_name || ''}
                            {(scan.committee_name || scan.department_name) ? ' · ' : ''}
                            {scan.gate_location} · {new Date(scan.scanned_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded border px-2 py-1 text-[10px] font-mono uppercase tracking-wider ${
                          isValid
                            ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
                            : isDuplicate
                              ? 'border-amber-400/35 bg-amber-500/10 text-amber-200'
                              : 'border-rose-400/35 bg-rose-500/10 text-rose-200'
                        }`}
                      >
                        {scan.result.replaceAll('_', ' ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            {/* Left: Large Camera & Manual Entry */}
            <section className="wm-surface-panel space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] pb-3.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
                  <h1 className="wm-serif text-lg font-semibold text-[color:var(--wm-ink)]">
                    Gate Checkpoint Camera
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] p-1" aria-label="Attendance action">
                    <button type="button" onClick={() => { setAttendanceAction('checkin'); setValidation(null); }} className={`rounded px-3 py-1.5 text-[11px] font-semibold transition ${attendanceAction === 'checkin' ? 'bg-emerald-600 text-white shadow' : 'text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'}`}>Check In</button>
                    <button type="button" onClick={() => { setAttendanceAction('checkout'); setValidation(null); }} className={`rounded px-3 py-1.5 text-[11px] font-semibold transition ${attendanceAction === 'checkout' ? 'bg-amber-600 text-white shadow' : 'text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'}`}>Check Out</button>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-[color:var(--wm-ink-secondary)]">
                    <span>Gate:</span>
                    <select
                      value={gateLocation}
                      onChange={(e) => setGateLocation(e.target.value)}
                      className="h-8 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2.5 text-xs text-[color:var(--wm-ink)]"
                    >
                      {GATES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <QrCameraScanner
                size="hero"
                busy={busy}
                pauseWhenLocked={awaitingConfirmation}
                onDetectToken={handleScanOrManual}
              />

              {/* Mode toggle + Manual Token Fallback */}
              <div className="space-y-3 border-t border-[color:var(--wm-hairline)] pt-3.5">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-3 py-2 text-xs">
                  <span className="text-[color:var(--wm-ink-secondary)]">
                    Review pass details before recording {attendanceAction === 'checkout' ? 'check-out' : 'check-in'}
                  </span>
                  <input
                    type="checkbox"
                    checked={confirmBeforeCheckin}
                    onChange={(e) => setConfirmBeforeCheckin(e.target.checked)}
                    className="h-4 w-4 accent-[#2d6a4f]"
                  />
                </label>

                <form onSubmit={handleManualSubmit} className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Manual fallback: paste or type WMQR-… token"
                    className="h-11 flex-1 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3.5 font-mono text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
                  />
                  <button
                    type="submit"
                    disabled={busy || !manualToken.trim()}
                    className="h-11 rounded-md bg-[color:var(--wm-emerald)] px-5 text-xs font-semibold text-[#eef4ef] transition-colors hover:bg-[#357a5b] disabled:opacity-50"
                  >
                    {busy ? 'Checking…' : confirmBeforeCheckin ? 'Verify Pass' : attendanceAction === 'checkout' ? 'Verify & Check Out' : 'Verify & Check In'}
                  </button>
                </form>

                {scanError && (
                  <p role="alert" className="text-xs text-rose-300">
                    {scanError}
                  </p>
                )}
              </div>
            </section>

            {/* Right: Validation Result & Live Entrance Feed */}
            <div className="space-y-5">
              <QrValidationResultCard
                validation={validation}
                busy={busy}
                variant="security"
                attendanceAction={attendanceAction}
                onConfirmCheckin={() => void handleConfirmPendingCheckin()}
                onResetResult={() => {
                  setValidation(null);
                  setPendingToken('');
                  setScanError('');
                }}
              />

              <section className="wm-surface-panel overflow-hidden">
                <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] px-4 py-3">
                  <h2 className="text-xs font-semibold text-[color:var(--wm-ink)]">
                    Recent Scans at Gate
                  </h2>
                  <button
                    type="button"
                    onClick={() => onNavigate('/security/history')}
                    className="text-[11px] font-medium text-[color:var(--wm-accent)] hover:underline"
                  >
                    View all
                  </button>
                </div>
                <div className="divide-y divide-[color:var(--wm-hairline)]">
                  {recentScans.length === 0 ? (
                    <p className="p-5 text-center text-xs text-[color:var(--wm-ink-muted)]">
                      No recent entrance scans yet.
                    </p>
                  ) : (
                    recentScans.slice(0, 6).map((scan) => {
                      const isValid = scan.result === 'valid_checkin';
                      const isDup =
                        scan.result === 'already_checked_in' || scan.result === 'duplicate_recent';
                      return (
                        <div
                          key={scan.id}
                          className="flex items-center justify-between gap-2 px-4 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-[color:var(--wm-ink)]">
                              {scan.holder_name || 'Unrecognized Code'}
                            </p>
                            <p className="truncate text-[10px] text-[color:var(--wm-ink-muted)]">
                              {scan.gate_location} · {new Date(scan.scanned_at).toLocaleTimeString()}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase ${
                              isValid
                                ? 'border-emerald-400/35 text-emerald-200'
                                : isDup
                                  ? 'border-amber-400/35 text-amber-200'
                                  : 'border-rose-400/35 text-rose-200'
                            }`}
                          >
                            {scan.result === 'valid_checkout' ? 'CHECKED OUT' : scan.result === 'valid_checkin' ? 'CHECKED IN' : isDup ? 'USED' : 'DENIED'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      <MyQrModal />
    </div>
  );
}
