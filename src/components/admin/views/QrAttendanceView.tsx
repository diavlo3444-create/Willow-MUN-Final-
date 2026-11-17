import { useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Plus,
  QrCode,
  ScanLine,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type { QrPassRecord } from '../../../types/admin';
import { hasPermission } from '../../../utils/adminPermissions';

function DeterministicQrSvg({ token }: { token: string }) {
  const cells: boolean[] = [];
  for (let i = 0; i < 81; i++) {
    const code = token.charCodeAt(i % Math.max(1, token.length)) || 42;
    const row = Math.floor(i / 9);
    const col = i % 9;
    const isCornerFinder =
      (row < 3 && col < 3) || (row < 3 && col >= 6) || (row >= 6 && col < 3);
    cells.push(isCornerFinder || ((code + i * 7) % 3 === 0));
  }

  return (
    <svg
      width={108}
      height={108}
      viewBox="0 0 90 90"
      aria-label={`QR Code for ${token}`}
      className="rounded border border-[color:var(--wm-hairline-strong)] bg-[#ede6ca] p-1.5 shrink-0"
    >
      {cells.map((filled, idx) =>
        filled ? (
          <rect
            key={idx}
            x={(idx % 9) * 10}
            y={Math.floor(idx / 9) * 10}
            width={9}
            height={9}
            fill="#14180a"
          />
        ) : null,
      )}
    </svg>
  );
}

export function QrAttendanceView({
  mode,
  actingUserOverride = null,
}: {
  mode: 'qr' | 'attendance';
  actingUserOverride?: ReturnType<typeof useAdminStore>['testModeHeadUser'];
}) {
  const { data, currentUser, saveQrPass, scanQrToken } = useAdminStore();
  const effectiveActor = actingUserOverride ?? currentUser;

  const [scanInput, setScanInput] = useState('WM26-HD-MUAZ-010');
  const [gateLocation, setGateLocation] = useState('Main Atrium Gate A');
  const [lastScanResult, setLastScanResult] = useState<string | null>(null);
  const [newHolder, setNewHolder] = useState('');
  const [newRoleLabel, setNewRoleLabel] = useState('Staff');

  const canScan = hasPermission(effectiveActor, 'qr.scan') || hasPermission(effectiveActor, 'qr.manage');
  const canManage = hasPermission(effectiveActor, 'qr.manage');

  const personalPass =
    data.qrPasses.find((p) => p.holderName === effectiveActor?.fullName) ?? data.qrPasses[0];

  const handleScanSubmit = (e: FormEvent) => {
    e.preventDefault();
    const res = scanQrToken(scanInput, gateLocation);
    setLastScanResult(
      res.ok
        ? `VALID CHECK-IN: ${res.data?.holderName} at ${gateLocation}`
        : res.error ?? 'Scan rejected',
    );
  };

  const handleIssuePass = (e: FormEvent) => {
    e.preventDefault();
    if (!newHolder.trim()) return;
    const prefix = newHolder.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'WM';
    const pass: QrPassRecord = {
      id: '',
      token: `WM26-${prefix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      holderName: newHolder.trim(),
      roleLabel: newRoleLabel,
      departmentId: effectiveActor?.departmentId ?? null,
      category: 'Staff',
      active: true,
      checkedIn: false,
      lastScannedAt: null,
    };
    if (saveQrPass(pass)) setNewHolder('');
  };

  const checkedInCount = data.qrPasses.filter((p) => p.checkedIn).length;

  return (
    <div className="space-y-6">
      {/* Personal Conference Credential Dossier Strip */}
      {personalPass && (
        <section className="wm-surface-panel p-5 sm:p-6 flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            <DeterministicQrSvg token={personalPass.token} />
            <div className="space-y-1">
              <p className="wm-section-kicker text-[color:var(--wm-accent)]">
                Personal Conference Credential
              </p>
              <h2 className="font-serif text-2xl font-medium text-[color:var(--wm-ink)]">
                {personalPass.holderName}
              </h2>
              <p className="text-xs text-[color:var(--wm-ink-secondary)]">
                {personalPass.roleLabel}
              </p>
              <p className="font-mono text-xs text-[color:var(--wm-accent)] pt-0.5 select-all">
                {personalPass.token}
              </p>
            </div>
          </div>
          <div className="text-xs text-right">
            <span
              className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-medium ${
                personalPass.checkedIn
                  ? 'border-emerald-400/35 bg-emerald-500/[0.1] text-emerald-200'
                  : 'border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink-secondary)]'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{personalPass.checkedIn ? 'Checked In On Venue' : 'Not Yet Scanned Today'}</span>
            </span>
          </div>
        </section>
      )}

      {/* Security Checkpoint Scanner */}
      {canScan && (
        <section className="wm-surface-panel overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                Venue QR Security Scanner
              </h2>
            </div>
            <span className="font-mono text-xs text-[color:var(--wm-ink-secondary)] tabular-nums">
              {checkedInCount}/{data.qrPasses.length} passes checked in
            </span>
          </div>

          <div className="p-5 space-y-4">
            <form onSubmit={handleScanSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
              <div className="md:col-span-5">
                <label className="text-[color:var(--wm-ink-secondary)]">
                  Scan or Enter QR Token
                </label>
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="e.g. WM26-HD-MUAZ-010"
                  className="mt-1 h-10 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 font-mono text-[color:var(--wm-ink)]"
                />
              </div>
              <div className="md:col-span-4">
                <label className="text-[color:var(--wm-ink-secondary)]">Checkpoint Gate</label>
                <select
                  value={gateLocation}
                  onChange={(e) => setGateLocation(e.target.value)}
                  className="mt-1 h-10 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-3 text-[color:var(--wm-ink)]"
                >
                  <option value="Main Atrium Gate A">Main Atrium Gate A</option>
                  <option value="VIP Operations Entrance">VIP Operations Entrance</option>
                  <option value="Chambers North Desk">Chambers North Desk</option>
                </select>
              </div>
              <div className="md:col-span-3 flex items-end">
                <button
                  type="submit"
                  className="h-10 w-full rounded bg-[color:var(--wm-focal)] px-4 font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
                >
                  Verify & Check In
                </button>
              </div>
            </form>

            {lastScanResult && (
              <div className="border-t border-[color:var(--wm-hairline)] pt-3 text-xs font-mono text-[color:var(--wm-ink)]">
                {lastScanResult}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Attendance Roster & Verification Log */}
      {(mode === 'attendance' || canManage) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-7 wm-surface-panel overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[color:var(--wm-ink)] inline-flex items-center gap-2">
                <QrCode className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
                <span>Issued Conference Passes ({data.qrPasses.length})</span>
              </h2>
              {canManage && (
                <form onSubmit={handleIssuePass} className="flex flex-wrap gap-2 text-xs">
                  <input
                    type="text"
                    value={newHolder}
                    onChange={(e) => setNewHolder(e.target.value)}
                    placeholder="Issue pass for name..."
                    className="h-8 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-[color:var(--wm-ink)]"
                  />
                  <input
                    type="text"
                    value={newRoleLabel}
                    onChange={(e) => setNewRoleLabel(e.target.value)}
                    placeholder="Role label"
                    className="h-8 w-28 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-[color:var(--wm-ink)]"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center gap-1 rounded bg-[color:var(--wm-focal)] px-3 font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Issue</span>
                  </button>
                </form>
              )}
            </div>

            <div className="divide-y divide-[color:var(--wm-hairline)] text-xs">
              {data.qrPasses.map((p) => (
                <div
                  key={p.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-[#ede6ca]/[0.02]"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[color:var(--wm-ink)] truncate">
                      {p.holderName}
                    </p>
                    <p className="mt-0.5 text-[11px] font-mono text-[color:var(--wm-accent)]">
                      {p.token}{' '}
                      <span className="font-sans text-[color:var(--wm-ink-secondary)]">
                        · {p.roleLabel}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canScan && (
                      <button
                        type="button"
                        onClick={() => setScanInput(p.token)}
                        className="h-7 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-[11px] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/8 cursor-pointer"
                      >
                        Load Token
                      </button>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => saveQrPass({ ...p, active: !p.active })}
                        className={`h-7 rounded border px-2.5 text-[11px] font-medium cursor-pointer ${
                          p.active
                            ? 'border-rose-400/35 text-rose-200 hover:bg-rose-500/15'
                            : 'border-emerald-400/35 text-emerald-200 hover:bg-emerald-500/15'
                        }`}
                      >
                        {p.active ? 'Revoke' : 'Reactivate'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-5 wm-surface-panel overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] flex items-center gap-2">
              <Users className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                Gate Verification Feed
              </h2>
            </div>
            <div className="divide-y divide-[color:var(--wm-hairline)] max-h-[28rem] overflow-y-auto text-xs">
              {data.attendanceScans.map((scan) => (
                <div key={scan.id} className="px-5 py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[color:var(--wm-ink)]">
                      {scan.holderName}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                        scan.result === 'valid_checkin'
                          ? 'border-emerald-400/35 text-emerald-200'
                          : scan.result === 'duplicate_recent'
                            ? 'border-amber-400/35 text-amber-200'
                            : 'border-rose-400/35 text-rose-200'
                      }`}
                    >
                      {scan.result}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-[color:var(--wm-ink-secondary)]">
                    {scan.gateLocation} · {scan.tokenScanned}
                  </p>
                  <p className="text-[11px] text-[color:var(--wm-ink-muted)] tabular-nums">
                    By {scan.scannedBy} · {new Date(scan.scannedAt).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {!canScan && !canManage && mode === 'attendance' && (
        <div className="rounded-md border border-amber-400/30 bg-amber-500/[0.08] p-5 text-xs text-amber-100 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Full venue attendance controls are restricted to Security & Executive leadership.</span>
        </div>
      )}
    </div>
  );
}
