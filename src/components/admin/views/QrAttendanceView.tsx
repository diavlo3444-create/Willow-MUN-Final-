import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Download,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { supabase } from '../../../lib/supabase';
import { hasPermission } from '../../../utils/adminPermissions';
import { MyQrCard } from '../MyQrModal';
import { WmSkeleton } from '../WmSkeleton';

type Pass = {
  id: string;
  user_id: string | null;
  holder_name: string;
  holder_email: string | null;
  role_label: string;
  category: string;
  department_id: string | null;
  active: boolean;
  checked_in_at: string | null;
  checked_in_gate: string | null;
  token_value?: string;
  created_at: string;
};

type Scan = {
  id: string;
  holder_name: string | null;
  result: string;
  gate_location: string;
  scanned_at: string;
  pass_id: string | null;
};

export function QrAttendanceView({
  mode,
  actingUserOverride = null,
}: {
  mode: 'qr' | 'attendance';
  actingUserOverride?: ReturnType<typeof useAdminStore>['testModeHeadUser'];
}) {
  const { currentUser, pushToast } = useAdminStore();
  const actor = actingUserOverride ?? currentUser;
  const isAdmin = actor?.role === 'admin' || actor?.role === 'super_admin';
  const canScan = isAdmin || hasPermission(actor, 'qr.scan');
  const canManage = isAdmin || hasPermission(actor, 'qr.manage');

  const [passes, setPasses] = useState<Pass[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [gateLocation, setGateLocation] = useState('Main Entrance');
  const [lastResult, setLastResult] = useState<{
    result: string;
    holder_name?: string | null;
    role_label?: string | null;
    gate_location?: string;
  } | null>(null);
  const [scanError, setScanError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [newHolder, setNewHolder] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('Conference Participant');
  const [issuedPass, setIssuedPass] = useState<Pass | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannedTokenRef = useRef('');
  const modalCanvasHostRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [registry, log] = await Promise.all([
      supabase.functions.invoke('willow-qr', { body: { action: 'list' } }),
      supabase.functions.invoke('willow-qr', { body: { action: 'scan_log' } }),
    ]);
    if (registry?.error) {
      pushToast({ tone: 'error', title: 'Pass registry unavailable', description: registry.error.message });
    } else {
      setPasses(registry?.data?.passes ?? []);
    }
    if (!log?.error) {
      setScans(log?.data?.scans ?? []);
    }
    setLoading(false);
  }, [canManage, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const scanToken = useCallback(
    async (token: string) => {
      if (!canScan) {
        setScanError('Scanner authorization required.');
        return;
      }
      setBusy(true);
      const { data: response, error } = await supabase.functions.invoke('willow-qr', {
        body: { action: 'scan', token, gate_location: gateLocation },
      });
      setBusy(false);
      if (error || response?.error) {
        setScanError(response?.error || error?.message || 'Scan failed.');
        setLastResult(null);
        return;
      }
      setScanError('');
      setLastResult(response);
      setScanInput('');
      if (response.result === 'valid_checkin') {
        pushToast({
          tone: 'success',
          title: 'Check-in successful',
          description: `${response.holder_name} · ${gateLocation}`,
        });
      } else if (response.result === 'duplicate_recent') {
        pushToast({
          tone: 'warning',
          title: 'Already checked in',
          description: response.holder_name || 'This pass has already been used.',
        });
      } else {
        pushToast({
          tone: 'error',
          title: response.result === 'revoked_pass' ? 'Pass revoked' : 'Invalid QR pass',
          description: 'Do not admit this pass holder.',
        });
      }
      await load();
    },
    [canScan, gateLocation, load, pushToast],
  );

  useEffect(() => {
    if (!scannerOpen) {
      stopCamera();
      return;
    }
    let interval = 0;
    let cancelled = false;
    const start = async () => {
      try {
        if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access is not available in this browser.');
        }
        const Detector = (window as any).BarcodeDetector;
        if (!Detector) {
          throw new Error('Live camera detection is unavailable in this browser. Enter or scan the token manually below.');
        }
        const detector = new Detector({ formats: ['qr_code'] });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        interval = window.setInterval(async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2 || busy) return;
          try {
            const codes = await detector.detect(video);
            const value = codes?.[0]?.rawValue;
            if (value && value !== scannedTokenRef.current) {
              scannedTokenRef.current = value;
              setScannerOpen(false);
              await scanToken(value);
              window.setTimeout(() => {
                scannedTokenRef.current = '';
              }, 1200);
            }
          } catch {
            // Wait for the next camera frame
          }
        }, 350);
      } catch (error) {
        setScanError(error instanceof Error ? error.message : 'Could not start camera.');
        setScannerOpen(false);
      }
    };
    void start();
    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
      stopCamera();
    };
  }, [scannerOpen, stopCamera, scanToken, busy]);

  const issueGuestPass = async (event: FormEvent) => {
    event.preventDefault();
    if (!newHolder.trim() || !canManage) return;
    setBusy(true);
    const { data: response, error } = await supabase.functions.invoke('willow-qr', {
      body: {
        action: 'issue',
        holder_name: newHolder.trim(),
        holder_email: newEmail.trim() || null,
        role_label: newRole,
        category: 'Delegate',
      },
    });
    setBusy(false);
    if (error || response?.error) {
      pushToast({
        tone: 'error',
        title: 'Pass could not be issued',
        description: response?.error || error?.message,
      });
      return;
    }
    setIssuedPass(response.pass);
    setNewHolder('');
    setNewEmail('');
    await load();
  };

  const issueMissing = async () => {
    if (!canManage) return;
    setBusy(true);
    const { data: response, error } = await supabase.functions.invoke('willow-qr', {
      body: { action: 'ensure_profile_passes' },
    });
    setBusy(false);
    if (error || response?.error) {
      pushToast({
        tone: 'error',
        title: 'Could not issue account passes',
        description: response?.error || error?.message,
      });
    } else {
      pushToast({ tone: 'success', title: 'QR passes verified', description: response.message });
    }
    await load();
  };

  const setPassActive = async (pass: Pass) => {
    if (!canManage) return;
    const { data: response, error } = await supabase.functions.invoke('willow-qr', {
      body: { action: pass.active ? 'revoke' : 'activate', pass_id: pass.id },
    });
    if (error || response?.error) {
      pushToast({
        tone: 'error',
        title: 'Pass could not be updated',
        description: response?.error || error?.message,
      });
    } else {
      await load();
    }
  };

  const downloadIssuedPassImage = () => {
    if (!issuedPass?.token_value) return;
    const qrCanvas = modalCanvasHostRef.current?.querySelector('canvas');
    if (!qrCanvas) return;

    const width = 640;
    const height = 820;
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#06110c';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(148, 191, 165, 0.32)';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    ctx.fillStyle = '#74c69d';
    ctx.font = '600 16px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WILLOW MUN · CONFERENCE PASS', width / 2, 72);

    const qrBox = 380;
    const x = (width - qrBox) / 2;
    const y = 120;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x, y, qrBox, qrBox, 16);
    ctx.fill();
    ctx.drawImage(qrCanvas, x + 24, y + 24, qrBox - 48, qrBox - 48);

    ctx.fillStyle = '#eef4ef';
    ctx.font = '600 28px Georgia, serif';
    ctx.fillText(issuedPass.holder_name, width / 2, 575, width - 80);

    ctx.fillStyle = '#95d5b2';
    ctx.font = '500 19px system-ui, sans-serif';
    ctx.fillText(issuedPass.role_label, width / 2, 615, width - 80);

    ctx.fillStyle = '#7fa08c';
    ctx.font = '500 14px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(issuedPass.token_value, width / 2, 700, width - 80);

    const slug = issuedPass.holder_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pass';
    const link = document.createElement('a');
    link.href = out.toDataURL('image/png');
    link.download = `willow-mun-pass-${slug}.png`;
    link.click();
  };

  const checkedIn = passes.filter((pass) => pass.checked_in_at).length;

  return (
    <div className="space-y-5">
      {mode === 'qr' && <MyQrCard actorOverride={actor} />}

      {canScan && (
        <section className="wm-surface-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <ScanLine className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <div>
                <h2 className="text-xs font-semibold text-[color:var(--wm-ink)]">Security Checkpoint Scanner</h2>
                <p className="mt-0.5 text-[10px] text-[color:var(--wm-ink-muted)]">
                  Scan QR passes via camera or enter a credential token for backend lookup
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setScannerOpen((v) => !v);
                setScanError('');
              }}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-[11px] font-medium text-[color:var(--wm-focal)] hover:bg-[color:var(--wm-overlay)]"
            >
              {scannerOpen ? (
                <>
                  <CameraOff className="h-3.5 w-3.5" aria-hidden="true" /> Stop camera
                </>
              ) : (
                <>
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" /> Open camera
                </>
              )}
            </button>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <div className="space-y-3">
              {scannerOpen && (
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="aspect-video w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-black object-cover"
                />
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (scanInput.trim()) void scanToken(scanInput.trim());
                }}
                className="space-y-3"
              >
                <label className="block text-[11px] text-[color:var(--wm-ink-secondary)]">
                  QR token
                  <input
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Scan or paste WMQR-… token"
                    className="mt-1 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 font-mono text-xs text-[color:var(--wm-ink)]"
                  />
                </label>
                <label className="block text-[11px] text-[color:var(--wm-ink-secondary)]">
                  Checkpoint location
                  <select
                    value={gateLocation}
                    onChange={(e) => setGateLocation(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
                  >
                    <option>Main Entrance</option>
                    <option>VIP Entrance</option>
                    <option>Committee Hall</option>
                    <option>Staff Entrance</option>
                  </select>
                </label>
                <button
                  disabled={busy || !scanInput.trim()}
                  className="h-9 w-full rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] disabled:opacity-50"
                >
                  {busy ? 'Verifying…' : 'Verify & Check In'}
                </button>
              </form>
              {scanError && (
                <p role="alert" className="text-[11px] text-rose-300">
                  {scanError}
                </p>
              )}
            </div>

            <div className="wm-surface-inset flex min-h-48 flex-col justify-center p-4">
              {!lastResult ? (
                <div className="text-center">
                  <ShieldAlert className="mx-auto h-7 w-7 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
                  <p className="mt-2 text-xs text-[color:var(--wm-ink-secondary)]">
                    Waiting for a pass to be scanned
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  {lastResult.result === 'valid_checkin' ? (
                    <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400" aria-hidden="true" />
                  ) : lastResult.result === 'duplicate_recent' ? (
                    <ShieldAlert className="mx-auto h-9 w-9 text-amber-300" aria-hidden="true" />
                  ) : (
                    <XCircle className="mx-auto h-9 w-9 text-rose-400" aria-hidden="true" />
                  )}
                  <p
                    className={
                      'mt-3 text-sm font-semibold ' +
                      (lastResult.result === 'valid_checkin'
                        ? 'text-emerald-300'
                        : lastResult.result === 'duplicate_recent'
                          ? 'text-amber-200'
                          : 'text-rose-300')
                    }
                  >
                    {lastResult.result === 'valid_checkin'
                      ? 'CHECK-IN APPROVED'
                      : lastResult.result === 'duplicate_recent'
                        ? 'ALREADY CHECKED IN'
                        : lastResult.result === 'revoked_pass'
                          ? 'PASS REVOKED'
                          : 'INVALID PASS'}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--wm-ink)]">
                    {lastResult.holder_name || 'No matching person found'}
                  </p>
                  <p className="mt-1 text-[10px] text-[color:var(--wm-ink-muted)]">
                    {lastResult.role_label || ''} · {lastResult.gate_location || gateLocation}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {canManage && (
        <section className="wm-surface-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] px-4 py-3.5">
            <div>
              <h2 className="text-xs font-semibold text-[color:var(--wm-ink)]">Conference Pass Registry</h2>
              <p className="mt-0.5 text-[10px] text-[color:var(--wm-ink-muted)]">
                {passes.length} issued passes · {checkedIn} checked in
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void issueMissing()}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-[11px] text-[color:var(--wm-focal)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Backfill Missing Staff Passes
            </button>
          </div>

          <form
            onSubmit={issueGuestPass}
            className="grid gap-2 border-b border-[color:var(--wm-hairline)] p-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <input
              value={newHolder}
              onChange={(e) => setNewHolder(e.target.value)}
              required
              placeholder="Guest / delegate name"
              className="h-9 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
            />
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              type="email"
              placeholder="Email (optional)"
              className="h-9 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
            />
            <input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Role label"
              className="h-9 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
            />
            <button
              disabled={busy}
              className="h-9 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] disabled:opacity-50"
            >
              Issue Guest Pass
            </button>
          </form>

          {loading ? (
            <div className="p-4">
              <WmSkeleton variant="table" rows={4} />
            </div>
          ) : passes.length === 0 ? (
            <p className="p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">
              No passes issued in Supabase yet. Every registered user receives a permanent credential automatically.
            </p>
          ) : (
            <div className="divide-y divide-[color:var(--wm-hairline)]">
              {passes.map((pass) => (
                <div key={pass.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[color:var(--wm-ink)]">{pass.holder_name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-[color:var(--wm-ink-secondary)]">
                      {pass.holder_email || pass.role_label} · {pass.category}
                    </p>
                    <p className="mt-1 text-[10px] text-[color:var(--wm-ink-muted)]">
                      {pass.checked_in_at
                        ? `Checked in ${new Date(pass.checked_in_at).toLocaleString()} · ${pass.checked_in_gate}`
                        : 'Not checked in yet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {pass.token_value && (
                      <button
                        type="button"
                        onClick={() => setIssuedPass(pass)}
                        className="rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-2.5 py-1.5 text-[11px] text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)]"
                      >
                        View QR
                      </button>
                    )}
                    <span
                      className={
                        'rounded-md border px-2 py-1 text-[10px] ' +
                        (pass.active
                          ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                          : 'border-rose-400/30 bg-rose-500/10 text-rose-200')
                      }
                    >
                      {pass.active ? 'Active' : 'Revoked'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void setPassActive(pass)}
                      className="rounded-md border border-[color:var(--wm-hairline)] px-2.5 py-1.5 text-[11px] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]"
                    >
                      {pass.active ? 'Revoke' : 'Reactivate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {canManage && mode === 'attendance' && (
        <section className="wm-surface-panel overflow-hidden">
          <div className="border-b border-[color:var(--wm-hairline)] px-4 py-3">
            <h2 className="text-xs font-semibold text-[color:var(--wm-ink)]">Recent Scan Activity</h2>
            <p className="mt-0.5 text-[10px] text-[color:var(--wm-ink-muted)]">Latest 200 scanner events</p>
          </div>
          <div className="divide-y divide-[color:var(--wm-hairline)]">
            {scans.length === 0 ? (
              <p className="p-6 text-center text-xs text-[color:var(--wm-ink-muted)]">No scans recorded.</p>
            ) : (
              scans.map((scan) => (
                <div key={scan.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="text-xs text-[color:var(--wm-ink)]">{scan.holder_name || 'Unknown token'}</p>
                    <p className="mt-0.5 text-[10px] text-[color:var(--wm-ink-muted)]">
                      {scan.gate_location} · {new Date(scan.scanned_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={
                      'rounded-md border px-2 py-1 text-[10px] uppercase ' +
                      (scan.result === 'valid_checkin'
                        ? 'border-emerald-400/25 text-emerald-200'
                        : scan.result === 'duplicate_recent'
                          ? 'border-amber-400/25 text-amber-200'
                          : 'border-rose-400/25 text-rose-200')
                    }
                  >
                    {scan.result.replaceAll('_', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {issuedPass?.token_value && (
        <div
          className="fixed inset-0 z-[130] grid place-items-center bg-[#030906]/82 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Pass QR Credential"
          onClick={() => setIssuedPass(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] p-6 text-center shadow-2xl"
          >
            <div ref={modalCanvasHostRef} className="sr-only" aria-hidden="true">
              <QRCodeCanvas value={issuedPass.token_value} size={360} level="H" includeMargin={false} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-accent)]">
                Conference Pass
              </span>
              <button
                type="button"
                onClick={() => setIssuedPass(null)}
                aria-label="Close QR dialog"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--wm-ink-muted)] hover:bg-[color:var(--wm-inset)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mx-auto mt-4 inline-block rounded-xl bg-white p-3.5 shadow-lg">
              <QRCodeSVG
                value={issuedPass.token_value}
                size={210}
                level="H"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#06110c"
              />
            </div>
            <h3 className="wm-serif mt-4 text-xl font-semibold text-[color:var(--wm-ink)]">
              {issuedPass.holder_name}
            </h3>
            <p className="mt-1 text-xs text-[color:var(--wm-focal)]">{issuedPass.role_label}</p>
            <p className="mt-3 break-all font-mono text-[10px] text-[color:var(--wm-ink-muted)]">
              {issuedPass.token_value}
            </p>
            <button
              type="button"
              onClick={downloadIssuedPassImage}
              className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download PNG
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
