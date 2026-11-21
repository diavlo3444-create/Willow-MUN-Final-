import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  ScanLine,
  Search,
} from 'lucide-react';
import { useAdminStore } from '../../context/AdminStoreContext';
import { supabase } from '../../lib/supabase';
import {
  commitQrPassAttendance,
  fetchQrAttendanceRoster,
  resetAllQrAttendance,
  type LiveAttendanceAttendee,
  type LiveQrValidationResponse,
} from '../../services/liveBackendService';
import type { AdminUser } from '../../types/admin';
import { hasPermission } from '../../utils/adminPermissions';
import {
  canResetAllAttendance,
  formatAttendanceTime,
  splitAndFilterAttendanceRoster,
} from '../../utils/qrAttendance';
import { ConfirmDialog } from './ConfirmDialog';
import { QrCameraScanner } from './QrCameraScanner';
import { QrValidationResultCard } from './QrValidationResultCard';
import { WmSkeleton } from './WmSkeleton';

interface LiveQrScannerWorkspaceProps {
  actor: AdminUser | null;
  autoStartCamera?: boolean;
}

const SYNC_CHANNEL_NAME = 'wm-qr-attendance-sync';

export function LiveQrScannerWorkspace({
  actor,
  autoStartCamera = true,
}: LiveQrScannerWorkspaceProps) {
  const { data, pushToast } = useAdminStore();

  const canScan =
    actor !== null &&
    (actor.role === 'super_admin' ||
      actor.role === 'admin' ||
      hasPermission(actor, 'qr.scan', data.departments));
  const isSuperAdmin = canResetAllAttendance(actor);

  const [checkedInList, setCheckedInList] = useState<LiveAttendanceAttendee[]>([]);
  const [notCheckedInList, setNotCheckedInList] = useState<LiveAttendanceAttendee[]>([]);
  const [rosterLoading, setRosterLoading] = useState<boolean>(true);
  const [rosterError, setRosterError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scanMode, setScanMode] = useState<'checkin' | 'checkout'>('checkin');

  const [manualToken, setManualToken] = useState<string>('');
  const [scanBusy, setScanBusy] = useState<boolean>(false);
  const [validation, setValidation] = useState<LiveQrValidationResponse | null>(null);
  const [scanError, setScanError] = useState<string>('');

  const [resetDialogOpen, setResetDialogOpen] = useState<boolean>(false);
  const [resetBusy, setResetBusy] = useState<boolean>(false);

  const scanInFlightRef = useRef<boolean>(false);
  const rosterFetchIdRef = useRef<number>(0);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  const loadRoster = useCallback(
    async (silent = false) => {
      if (!canScan) {
        setRosterLoading(false);
        return;
      }
      const fetchId = ++rosterFetchIdRef.current;
      if (!silent) {
        setRosterLoading(true);
      }

      const res = await fetchQrAttendanceRoster(actor?.role);
      if (fetchId !== rosterFetchIdRef.current) return;

      if (!res.ok) {
        setRosterError(res.error || 'Could not load live attendance lists.');
        setRosterLoading(false);
        return;
      }

      setRosterError('');
      setCheckedInList(res.checkedIn);
      setNotCheckedInList(res.notCheckedIn);
      setRosterLoading(false);
    },
    [actor?.role, canScan],
  );

  const notifyOtherScanners = useCallback(() => {
    const payload = { at: Date.now() };
    try {
      broadcastRef.current?.postMessage({ type: 'attendance_updated', ...payload });
    } catch {
      // Ignore BroadcastChannel errors in restricted contexts
    }
    try {
      void realtimeChannelRef.current?.send({
        type: 'broadcast',
        event: 'attendance_updated',
        payload,
      });
    } catch {
      // Ignore Realtime send errors
    }
  }, []);

  useEffect(() => {
    void loadRoster(false);
  }, [loadRoster]);

  // Multi-scanner live synchronization (Realtime broadcast + Postgres changes + BroadcastChannel + 4s polling)
  useEffect(() => {
    if (!canScan) return;

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
        bc.onmessage = (event) => {
          if (event?.data?.type === 'attendance_updated') {
            void loadRoster(true);
          }
        };
        broadcastRef.current = bc;
      } catch {
        bc = null;
      }
    }

    const channel = supabase
      .channel(SYNC_CHANNEL_NAME)
      .on('broadcast', { event: 'attendance_updated' }, () => {
        void loadRoster(true);
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wm_qr_passes' },
        () => {
          void loadRoster(true);
        },
      )
      .subscribe();
    realtimeChannelRef.current = channel;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadRoster(true);
      }
    }, 4000);

    const handleWakeSync = () => {
      if (document.visibilityState === 'visible') {
        void loadRoster(true);
      }
    };
    window.addEventListener('focus', handleWakeSync);
    window.addEventListener('online', handleWakeSync);
    document.addEventListener('visibilitychange', handleWakeSync);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWakeSync);
      window.removeEventListener('online', handleWakeSync);
      document.removeEventListener('visibilitychange', handleWakeSync);
      if (bc) {
        bc.close();
        broadcastRef.current = null;
      }
      realtimeChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [canScan, loadRoster]);

  const handleInstantScan = useCallback(
    async (rawToken: string) => {
      if (!canScan) {
        setScanError('Scanner authorization required.');
        return;
      }
      const cleanToken = rawToken.trim();
      if (!cleanToken || scanInFlightRef.current) return;

      scanInFlightRef.current = true;
      setScanBusy(true);
      setScanError('');

      try {
        let res = await commitQrPassAttendance(cleanToken, 'Main Entrance', scanMode, false);
        if (res.ok && res.validation?.status === 'checkout_warning') {
          const proceed = window.confirm(res.validation.message || 'This pass has been checked out before. Check out again?');
          if (!proceed) return;
          res = await commitQrPassAttendance(cleanToken, 'Main Entrance', 'checkout', true);
        }

        if (!res.ok || !res.validation) {
          const message = res.error || `Unable to process QR ${scanMode}. Check connection and retry.`;
          setValidation(null);
          setScanError(message);
          pushToast({
            tone: 'error',
            title: `${scanMode === 'checkin' ? 'Check-in' : 'Check-out'} failed`,
            description: message,
          });
          return;
        }

        const v = res.validation;
        setValidation(v);
        setManualToken('');

        if (scanMode === 'checkout' && v.status === 'checked_out' && v.committed) {
          void loadRoster(true);
          pushToast({ tone: 'success', title: 'Checked out', description: `${v.holder_name || 'Attendee'} · ${v.role_label || v.category || 'Participant'}` });
          notifyOtherScanners();
        } else if (v.status === 'valid' && v.committed) {
          const checkInTimestamp = v.checked_in_at || v.scanned_at;
          if (v.pass_id) {
            setNotCheckedInList((prev) => prev.filter((item) => item.id !== v.pass_id));
            setCheckedInList((prev) => {
              const existing = prev.find((item) => item.id === v.pass_id);
              const nextEntry: LiveAttendanceAttendee = {
                id: v.pass_id!,
                holder_name: v.holder_name || existing?.holder_name || 'Attendee',
                role_label: v.role_label || existing?.role_label || 'Participant',
                category: v.category || existing?.category || 'Delegate',
                department_name: v.department_name ?? existing?.department_name ?? null,
                committee_name: v.committee_name ?? existing?.committee_name ?? null,
                application_code: v.application_code ?? existing?.application_code ?? null,
                checked_in_at: checkInTimestamp,
                checked_in_gate: v.checked_in_gate ?? v.gate_location ?? 'Main Entrance',
                checked_in_by_name: v.checked_in_by_name ?? null,
              };
              return [nextEntry, ...prev.filter((item) => item.id !== v.pass_id)];
            });
          }

          pushToast({
            tone: 'success',
            title: 'Checked in',
            description: `${v.holder_name || 'Attendee'} · ${v.role_label || v.category || 'Participant'}`,
          });
          notifyOtherScanners();
          void loadRoster(true);
        } else if (v.status === 'already_checked_in') {
          pushToast({
            tone: 'warning',
            title: 'Already checked in',
            description: `${v.holder_name || 'Attendee'} — original check-in time preserved`,
          });
          void loadRoster(true);
        } else {
          pushToast({
            tone: 'error',
            title:
              v.status === 'revoked'
                ? 'Pass revoked'
                : v.status === 'not_eligible'
                  ? 'Not eligible'
                  : 'Invalid QR code',
            description: v.message,
          });
        }
      } catch (err: any) {
        const message = err?.message || `Network error while recording ${scanMode}.`; 
        setValidation(null);
        setScanError(message);
        pushToast({
          tone: 'error',
          title: 'Connection error',
          description: message,
        });
      } finally {
        scanInFlightRef.current = false;
        setScanBusy(false);
      }
    },
    [canScan, loadRoster, notifyOtherScanners, pushToast, scanMode],
  );

  const handleManualSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!manualToken.trim()) return;
    void handleInstantScan(manualToken);
  };

  const handleConfirmReset = async () => {
    if (!isSuperAdmin || resetBusy) return;
    setResetDialogOpen(false);
    setResetBusy(true);

    try {
      const res = await resetAllQrAttendance();
      if (!res.ok) {
        pushToast({
          tone: 'error',
          title: 'Reset failed',
          description: res.error || 'Could not reset attendance records.',
        });
        return;
      }

      setValidation(null);
      setScanError('');
      setCheckedInList((prevChecked) => {
        const moved = prevChecked.map((item) => ({
          ...item,
          checked_in_at: null,
          checked_in_gate: null,
          checked_in_by_name: null,
        }));
        setNotCheckedInList((prevNot) => [...prevNot, ...moved]);
        return [];
      });

      notifyOtherScanners();
      await loadRoster(true);

      pushToast({
        tone: 'success',
        title: 'Attendance reset',
        description: 'All attendees returned to Not Checked In.',
      });
    } catch (err: any) {
      pushToast({
        tone: 'error',
        title: 'Reset failed',
        description: err?.message || 'Network error while resetting attendance.',
      });
    } finally {
      setResetBusy(false);
    }
  };

  const filteredRoster = useMemo(
    () => splitAndFilterAttendanceRoster(checkedInList, notCheckedInList, searchQuery),
    [checkedInList, notCheckedInList, searchQuery],
  );

  if (!canScan) {
    return (
      <div
        role="alert"
        className="wm-surface-panel border-rose-400/40 p-6 text-center text-xs text-rose-200"
      >
        QR scanner authorization is required to access check-in operations.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. QR SCANNER / CAMERA SECTION */}
      <section aria-label="QR Scanner" className="wm-surface-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <ScanLine className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <div>
              <h1 className="wm-serif text-lg font-semibold text-[color:var(--wm-ink)]">
                QR Check-In Scanner
              </h1>
              <p className="text-[11px] text-[color:var(--wm-ink-muted)]">
                {scanMode === 'checkin' ? 'Valid passes check in automatically upon scan.' : 'Scan an attendee who is currently checked in to record departure.'}
              </p>
              <div className="mt-3 grid w-full max-w-sm grid-cols-2 gap-1 rounded-lg border border-[color:var(--wm-hairline-strong)] bg-black/15 p-1.5">
                <button type="button" disabled={scanBusy} onClick={() => { setScanMode('checkin'); setValidation(null); setScanError(''); }} aria-pressed={scanMode === 'checkin'} className={`min-h-10 rounded-md px-4 text-xs font-bold tracking-wide transition-colors disabled:opacity-50 ${scanMode === 'checkin' ? 'bg-[color:var(--wm-emerald)] text-white shadow-sm' : 'text-[color:var(--wm-ink-muted)] hover:bg-white/5'}`}>CHECK IN</button>
                <button type="button" disabled={scanBusy} onClick={() => { setScanMode('checkout'); setValidation(null); setScanError(''); }} aria-pressed={scanMode === 'checkout'} className={`min-h-10 rounded-md px-4 text-xs font-bold tracking-wide transition-colors disabled:opacity-50 ${scanMode === 'checkout' ? 'bg-amber-700 text-white shadow-sm' : 'text-[color:var(--wm-ink-muted)] hover:bg-white/5'}`}>CHECK OUT</button>
              </div>
            </div>
          </div>

          {isSuperAdmin && (
            <button
              type="button"
              disabled={resetBusy}
              onClick={() => setResetDialogOpen(true)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-rose-400/45 bg-rose-950/35 px-3.5 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-950/55 disabled:opacity-50"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${resetBusy ? 'animate-spin' : ''}`} aria-hidden="true" />
              {resetBusy ? 'Resetting…' : 'Reset All Check-Ins'}
            </button>
          )}
        </div>

        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-3.5">
            <QrCameraScanner
              size="hero"
              autoStart={autoStartCamera}
              busy={scanBusy}
              onDetectToken={handleInstantScan}
            />

            <form onSubmit={handleManualSubmit} className="flex flex-col gap-2 sm:flex-row">
              <input
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                aria-label="QR pass token"
                placeholder="Enter QR code manually (WMQR-…)"
                className="min-h-[44px] flex-1 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3.5 font-mono text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
              />
              <button
                type="submit"
                disabled={scanBusy || !manualToken.trim()}
                className="min-h-[44px] rounded-md bg-[color:var(--wm-emerald)] px-5 text-xs font-semibold text-[#eef4ef] transition-colors hover:bg-[#357a5b] disabled:opacity-50 whitespace-nowrap"
              >
                {scanBusy ? (scanMode === 'checkin' ? 'Checking In…' : 'Checking Out…') : (scanMode === 'checkin' ? 'Check In Pass' : 'Check Out Pass')}
              </button>
            </form>
          </div>

          <div>
            <QrValidationResultCard
              validation={validation}
              requestError={scanError}
              onDismiss={
                validation || scanError
                  ? () => {
                      setValidation(null);
                      setScanError('');
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </section>

      {/* Live Attendance Filter */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search attendance lists"
          placeholder="Search Checked In & Not Checked In by name or role…"
          className="min-h-[44px] w-full rounded-lg border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] pl-10 pr-4 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
        />
      </div>

      {rosterError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-400/50 bg-rose-950/35 px-4 py-3 text-xs text-rose-100"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
            <span>{rosterError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadRoster(false)}
            className="min-h-[44px] rounded-md border border-rose-300/40 bg-black/25 px-3 text-xs font-medium text-rose-100 hover:bg-black/40"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. CHECKED IN & 3. NOT CHECKED IN AREAS */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 2. CHECKED IN */}
        <section
          aria-label="Checked In"
          className="wm-surface-panel flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[color:var(--wm-hairline)] px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                Checked In
              </h2>
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-emerald-300">
              {filteredRoster.checkedIn.length}
            </span>
          </div>

          {rosterLoading ? (
            <div className="p-4">
              <WmSkeleton variant="table" rows={4} />
            </div>
          ) : filteredRoster.checkedIn.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-[color:var(--wm-ink-muted)]">
              {searchQuery.trim()
                ? 'No checked-in attendees match your search.'
                : 'No one has checked in yet.'}
            </p>
          ) : (
            <ul className="max-h-[440px] divide-y divide-[color:var(--wm-hairline)] overflow-y-auto">
              {filteredRoster.checkedIn.map((attendee) => (
                <li
                  key={attendee.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[color:var(--wm-ink)]">
                      {attendee.holder_name}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[color:var(--wm-ink-secondary)]">
                      {attendee.role_label}
                      {attendee.committee_name
                        ? ` · ${attendee.committee_name}`
                        : attendee.department_name
                          ? ` · ${attendee.department_name}`
                          : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-emerald-300">
                    {formatAttendanceTime(attendee.checked_in_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 3. NOT CHECKED IN */}
        <section
          aria-label="Not Checked In"
          className="wm-surface-panel flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[color:var(--wm-hairline)] px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                Not Checked In
              </h2>
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-[color:var(--wm-ink-secondary)]">
              {filteredRoster.notCheckedIn.length}
            </span>
          </div>

          {rosterLoading ? (
            <div className="p-4">
              <WmSkeleton variant="table" rows={4} />
            </div>
          ) : filteredRoster.notCheckedIn.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-[color:var(--wm-ink-muted)]">
              {searchQuery.trim()
                ? 'No remaining attendees match your search.'
                : 'Everyone with an active pass has checked in.'}
            </p>
          ) : (
            <ul className="max-h-[440px] divide-y divide-[color:var(--wm-hairline)] overflow-y-auto">
              {filteredRoster.notCheckedIn.map((attendee) => (
                <li
                  key={attendee.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[color:var(--wm-ink)]">
                      {attendee.holder_name}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[color:var(--wm-ink-secondary)]">
                      {attendee.role_label}
                      {attendee.committee_name
                        ? ` · ${attendee.committee_name}`
                        : attendee.department_name
                          ? ` · ${attendee.department_name}`
                          : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-[color:var(--wm-ink-muted)]">
                    {attendee.checked_out_at ? `Checked Out · ${formatAttendanceTime(attendee.checked_out_at)}` : 'Not Checked In'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Super Admin Only Confirmation Dialog */}
      {isSuperAdmin && (
        <ConfirmDialog
          open={resetDialogOpen}
          title="Reset All Check-Ins?"
          description="This will clear check-in status and attendance records for all attendees and move everyone back to Not Checked In across every scanner. This cannot be undone."
          confirmLabel="Reset All Check-Ins"
          cancelLabel="Cancel"
          tone="danger"
          onConfirm={() => void handleConfirmReset()}
          onCancel={() => setResetDialogOpen(false)}
        />
      )}
    </div>
  );
}
