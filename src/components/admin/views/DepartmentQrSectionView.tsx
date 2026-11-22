import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AlertCircle, Clock3, Minimize2, QrCode, RefreshCw, ScanLine } from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import {
  commitQrPassAttendance,
  fetchDepartmentQrPasses,
  fetchMySecurityScans,
  type LiveQrScanEvent,
  type LiveQrPassExtended,
  type LiveQrValidationResponse,
} from '../../../services/liveBackendService';
import type { AdminUser } from '../../../types/admin';
import { canViewDepartmentQr, hasPermission } from '../../../utils/adminPermissions';
import type { DepartmentQrSectionKey } from '../../../utils/departmentQr';
import { QrCameraScanner } from '../QrCameraScanner';
import { QrValidationResultCard } from '../QrValidationResultCard';
import { WmSkeleton } from '../WmSkeleton';

interface DepartmentQrSectionViewProps {
  section: DepartmentQrSectionKey;
  actor?: AdminUser | null;
  autoStartCamera?: boolean;
}

const SECTION_COPY: Record<
  DepartmentQrSectionKey,
  { heading: string; description: string; emptyLabel: string; qrHeading: string }
> = {
  press_media: {
    heading: 'Press & Media',
    description: 'QR codes assigned to Press & Media members.',
    emptyLabel: 'No QR codes are currently assigned to Press & Media members.',
    qrHeading: 'Press & Media QR Codes',
  },
  volunteers: {
    heading: 'Volunteering',
    description: 'QR codes assigned to Volunteer members.',
    emptyLabel: 'No QR codes are currently assigned to Volunteers.',
    qrHeading: 'Volunteer QR Codes',
  },
  security: {
    heading: 'Security',
    description: 'Security QR scanner and QR codes assigned to Security members.',
    emptyLabel: 'No QR codes are currently assigned to Security members.',
    qrHeading: 'Security Member QR Codes',
  },
};

export function DepartmentQrSectionView({
  section,
  actor = null,
  autoStartCamera = true,
}: DepartmentQrSectionViewProps) {
  const { currentUser, data } = useAdminStore();
  const effectiveActor = actor ?? currentUser;
  const copy = SECTION_COPY[section];

  const [passes, setPasses] = useState<LiveQrPassExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [enlargedPass, setEnlargedPass] = useState<LiveQrPassExtended | null>(null);

  // Security scanner state (only used when section === 'security')
  const [scanBusy, setScanBusy] = useState(false);
  const [validation, setValidation] = useState<LiveQrValidationResponse | null>(null);
  const [scanError, setScanError] = useState('');
  const [attendanceAction, setAttendanceAction] = useState<'checkin' | 'checkout'>('checkin');
  const [myScans, setMyScans] = useState<LiveQrScanEvent[]>([]);
  const [scansLoading, setScansLoading] = useState(false);
  const [scansError, setScansError] = useState('');
  const scanInFlightRef = useRef(false);

  const canScan =
    section === 'security' &&
    effectiveActor !== null &&
    hasPermission(effectiveActor, 'qr.scan', data.departments);

  const canViewQrList = canViewDepartmentQr(effectiveActor, section, data.departments);

  const loadPasses = useCallback(async () => {
    if (!canViewQrList) {
      setPasses([]);
      setLoadError('You do not have permission to view QR passes for this department.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    const res = await fetchDepartmentQrPasses(
      section,
      data.departments,
      effectiveActor?.role,
    );
    if (!res.ok) {
      setPasses([]);
      setLoadError(res.error || 'Could not load QR codes from Supabase.');
    } else {
      setPasses(res.passes);
    }
    setLoading(false);
  }, [canViewQrList, data.departments, effectiveActor?.role, section]);

  useEffect(() => {
    void loadPasses();
  }, [loadPasses]);

  const loadMyScans = useCallback(async () => {
    if (section !== 'security' || !canScan) return;
    setScansLoading(true);
    const result = await fetchMySecurityScans();
    setMyScans(result.scans);
    setScansError(result.error || '');
    setScansLoading(false);
  }, [canScan, section]);

  useEffect(() => {
    void loadMyScans();
  }, [loadMyScans]);

  useEffect(() => {
    if (!enlargedPass) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEnlargedPass(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enlargedPass]);

  const handleScanToken = useCallback(
    async (rawToken: string) => {
      if (!canScan) {
        setScanError('Scanner authorization is required to verify QR passes.');
        return;
      }
      const cleanToken = rawToken.trim();
      if (!cleanToken || scanInFlightRef.current) return;

      scanInFlightRef.current = true;
      setScanBusy(true);
      setScanError('');

      try {
        const res = await commitQrPassAttendance(cleanToken, 'Main Entrance', attendanceAction, false);
        if (!res.ok || !res.validation) {
          setValidation(null);
          setScanError(res.error || 'Unable to verify QR code. Check connection and try again.');
          return;
        }
        setValidation(res.validation);
        void loadMyScans();
      } catch (err: any) {
        setValidation(null);
        setScanError(err?.message || 'Network error while validating QR code.');
      } finally {
        scanInFlightRef.current = false;
        setScanBusy(false);
      }
    },
    [attendanceAction, canScan, loadMyScans],
  );

  return (
    <div className="space-y-6">
      <header className="border-b border-[color:var(--wm-hairline)] pb-4">
        <h1 className="wm-serif text-2xl font-semibold text-[color:var(--wm-ink)] sm:text-3xl">
          {copy.heading}
        </h1>
        <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
          {copy.description}
        </p>
      </header>

      {section === 'security' && (
        <section aria-label="Security QR Scanner" className="wm-surface-panel overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-[color:var(--wm-hairline)] px-4 py-3.5 sm:px-5">
            <ScanLine className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <div>
              <h2 className="wm-serif text-lg font-semibold text-[color:var(--wm-ink)]">
                QR Code Scanner
              </h2>
              <p className="text-[11px] text-[color:var(--wm-ink-muted)]">
                Scan a Willow MUN member QR code to record attendance.
              </p>
              <div className="mt-3 inline-flex rounded-lg border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] p-1" role="group" aria-label="Attendance action">
                <button type="button" aria-pressed={attendanceAction === 'checkin'} onClick={() => { setAttendanceAction('checkin'); setValidation(null); setScanError(''); }} className={`min-h-[36px] rounded-md px-4 text-xs font-semibold transition-colors ${attendanceAction === 'checkin' ? 'bg-[color:var(--wm-emerald)] text-white' : 'text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'}`}>
                  Check In
                </button>
                <button type="button" aria-pressed={attendanceAction === 'checkout'} onClick={() => { setAttendanceAction('checkout'); setValidation(null); setScanError(''); }} className={`min-h-[36px] rounded-md px-4 text-xs font-semibold transition-colors ${attendanceAction === 'checkout' ? 'bg-[color:var(--wm-emerald)] text-white' : 'text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'}`}>
                  Check Out
                </button>
              </div>
            </div>
          </div>

          {!canScan ? (
            <div role="alert" className="p-6 text-center text-xs text-rose-200">
              Your account does not have camera scanner permission.
            </div>
          ) : (
            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <QrCameraScanner
                size="hero"
                autoStart={autoStartCamera}
                showManualHint={false}
                busy={scanBusy}
                onDetectToken={handleScanToken}
              />

              <QrValidationResultCard
                validation={validation}
                requestError={scanError}
                idleSubtitle="Allow camera access and point at a Willow MUN member QR code to check validity, assigned department, and check-in status."
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
          )}
        </section>
      )}

      {section === 'security' && canScan && (
        <section aria-label="My Scans" className="wm-surface-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-2.5">
              <Clock3 className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <div>
                <h2 className="wm-serif text-lg font-semibold text-[color:var(--wm-ink)]">My Scans</h2>
                <p className="text-[11px] text-[color:var(--wm-ink-muted)]">Your recent QR scans only.</p>
              </div>
            </div>
            <button type="button" onClick={() => void loadMyScans()} disabled={scansLoading} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] px-3 text-[11px] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] disabled:opacity-50">
              <RefreshCw className={`h-3 w-3 ${scansLoading ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
            </button>
          </div>
          {scansError ? (
            <p role="alert" className="p-4 text-xs text-rose-200">{scansError}</p>
          ) : scansLoading && myScans.length === 0 ? (
            <WmSkeleton variant="table" rows={3} />
          ) : myScans.length === 0 ? (
            <p className="p-6 text-center text-xs text-[color:var(--wm-ink-muted)]">No scans recorded yet. Your scans will appear here.</p>
          ) : (
            <div className="divide-y divide-[color:var(--wm-hairline)]">
              {myScans.map((scan) => (
                <div key={scan.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[color:var(--wm-ink)]">{scan.holder_name || 'Unrecognized QR pass'}</p>
                    <p className="mt-0.5 text-[11px] text-[color:var(--wm-ink-muted)]">{scan.department_name || 'Department unavailable'} · {scan.gate_location || 'Gate not recorded'}</p>
                    <p className="mt-1 font-mono text-[10px] text-[color:var(--wm-ink-muted)]">{new Date(scan.scanned_at).toLocaleString()}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${/check.?out/i.test(scan.result) ? 'border-sky-400/40 bg-sky-950/30 text-sky-200' : /check.?in|valid/i.test(scan.result) ? 'border-emerald-400/40 bg-emerald-950/30 text-emerald-200' : 'border-amber-400/40 bg-amber-950/30 text-amber-200'}`}>
                    {String(scan.result || 'scanned').replaceAll('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {canViewQrList && (
        <section aria-label={copy.qrHeading} className="space-y-4">
          {section === 'security' && (
            <h2 className="wm-serif text-lg font-semibold text-[color:var(--wm-ink)]">
              {copy.qrHeading}
            </h2>
          )}
  
          {loading ? (
            <WmSkeleton variant="cards" rows={4} />
          ) : loadError ? (
            <div
              role="alert"
              className="wm-surface-panel flex flex-wrap items-center justify-between gap-3 border-rose-400/45 bg-rose-950/30 p-5 text-xs text-rose-100"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
                <span>{loadError}</span>
              </div>
              <button
                type="button"
                onClick={() => void loadPasses()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-rose-300/40 bg-black/25 px-3.5 text-xs font-medium text-rose-100 hover:bg-black/40"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </button>
            </div>
          ) : passes.length === 0 ? (
            <div className="wm-surface-panel p-10 text-center">
              <QrCode className="mx-auto h-9 w-9 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
              <p className="mt-3 text-xs text-[color:var(--wm-ink-secondary)]">
                {copy.emptyLabel}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {passes.map((pass) => (
                <button
                  key={pass.id}
                  type="button"
                  onClick={() => setEnlargedPass(pass)}
                  aria-label={`View QR code for ${pass.holder_name}`}
                  className="wm-surface-panel group flex flex-col items-center p-5 text-center transition-colors hover:border-[color:var(--wm-accent)]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wm-accent)]"
                >
                  <div className="rounded-xl bg-white p-3.5 shadow-md transition-transform duration-150 group-hover:scale-[1.02]">
                    <QRCodeSVG
                      value={pass.token_value}
                      size={184}
                      level="H"
                      includeMargin={false}
                      bgColor="#ffffff"
                      fgColor="#06110c"
                    />
                  </div>
                  <p className="wm-serif mt-4 text-lg font-semibold text-[color:var(--wm-ink)]">
                    {pass.holder_name}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {enlargedPass && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`QR code for ${enlargedPass.holder_name}`}
          onClick={() => setEnlargedPass(null)}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-[#030906]/92 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] p-6 text-center shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--wm-accent)]">
                {copy.heading}
              </span>
              <button
                type="button"
                onClick={() => setEnlargedPass(null)}
                aria-label="Close enlarged QR view"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--wm-hairline)] text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-inset)] hover:text-[color:var(--wm-ink)]"
              >
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mx-auto mt-5 inline-block rounded-2xl bg-white p-5 shadow-xl">
              <QRCodeSVG
                value={enlargedPass.token_value}
                size={272}
                level="H"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#06110c"
              />
            </div>
            <h3 className="wm-serif mt-5 text-2xl font-semibold text-[color:var(--wm-ink)]">
              {enlargedPass.holder_name}
            </h3>
          </div>
        </div>
      )}
    </div>
  );
}
