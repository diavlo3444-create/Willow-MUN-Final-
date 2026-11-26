import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  FileWarning,
  History,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import {
  backfillStaffQrPasses,
  correctQrCheckinRecord,
  fetchAdminQrDashboard,
  issueConferenceQrPass,
  resetAllQrAttendance,
  setQrPassActiveState,
  type AdminQrRegistryMetrics,
  type LiveQrCorrectionLog,
  type LiveQrPassExtended,
  type LiveQrScanEvent,
} from '../../../services/liveBackendService';
import { hasPermission } from '../../../utils/adminPermissions';
import { canResetAllAttendance } from '../../../utils/qrAttendance';
import { ConfirmDialog } from '../ConfirmDialog';
import { LiveQrScannerWorkspace } from '../LiveQrScannerWorkspace';
import { MyQrCard } from '../MyQrModal';
import { WmSkeleton } from '../WmSkeleton';

type AdminQrTab = 'registry' | 'scans' | 'audit' | 'my_qr';

const GATES = [
  'Main Entrance',
  'VIP Entrance',
  'Committee Hall',
  'Registration Desk',
  'Staff Entrance',
  'Admin Desk',
];

export function QrAttendanceView({
  mode,
  actingUserOverride = null,
}: {
  mode: 'qr' | 'attendance';
  actingUserOverride?: ReturnType<typeof useAdminStore>['testModeHeadUser'];
}) {
  const { currentUser, data, pushToast } = useAdminStore();
  const actor = actingUserOverride ?? currentUser;
  const isAdmin = actor?.role === 'admin' || actor?.role === 'super_admin';
  const canScan = isAdmin || hasPermission(actor, 'qr.scan', data.departments);
  const canManage = isAdmin || hasPermission(actor, 'qr.manage', data.departments);
  const isSuperAdmin = canResetAllAttendance(actor);

  const [activeTab, setActiveTab] = useState<AdminQrTab>(() =>
    canManage ? 'registry' : 'my_qr',
  );
  useEffect(() => {
    setActiveTab(canManage ? 'registry' : 'my_qr');
  }, [canManage]);

  const [passes, setPasses] = useState<LiveQrPassExtended[]>([]);
  const [scans, setScans] = useState<LiveQrScanEvent[]>([]);
  const [correctionLogs, setCorrectionLogs] = useState<LiveQrCorrectionLog[]>([]);
  const [metrics, setMetrics] = useState<AdminQrRegistryMetrics>({
    total_issued: 0,
    active_issued: 0,
    checked_in: 0,
    remaining: 0,
    revoked: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'checked_in' | 'remaining' | 'revoked'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [scanResultFilter, setScanResultFilter] = useState<'all' | 'valid' | 'duplicate' | 'failed'>('all');

  // Issue pass form & QR preview modal
  const [newHolder, setNewHolder] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('Conference Participant');
  const [newCategory, setNewCategory] = useState('Delegate');
  const [issuedPass, setIssuedPass] = useState<LiveQrPassExtended | null>(null);
  const modalCanvasHostRef = useRef<HTMLDivElement>(null);

  // Check-in correction modal
  const [correctionPass, setCorrectionPass] = useState<LiveQrPassExtended | null>(null);
  const [correctionAction, setCorrectionAction] = useState<'reset_checkin' | 'manual_checkin' | 'update_gate'>('reset_checkin');
  const [correctionGate, setCorrectionGate] = useState('Admin Desk');
  const [correctionReason, setCorrectionReason] = useState('');

  // Revoke / Activate modal with reason
  const [togglePassTarget, setTogglePassTarget] = useState<LiveQrPassExtended | null>(null);
  const [toggleReason, setToggleReason] = useState('');

  const load = useCallback(async () => {
    if (mode !== 'attendance' || !canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetchAdminQrDashboard();
    if (res.error) {
      pushToast({ tone: 'error', title: 'QR registry unavailable', description: res.error });
    }
    setPasses(res.passes);
    setScans(res.scans);
    setCorrectionLogs(res.correctionLogs);
    setMetrics(res.metrics);
    setLoading(false);
  }, [canManage, mode, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const issueGuestPass = async (event: FormEvent) => {
    event.preventDefault();
    if (!newHolder.trim() || !canManage) return;
    setBusy(true);
    const res = await issueConferenceQrPass({
      holderName: newHolder,
      holderEmail: newEmail,
      roleLabel: newRole,
      category: newCategory,
    });
    setBusy(false);
    if (!res.ok || !res.pass) {
      pushToast({ tone: 'error', title: 'Pass could not be issued', description: res.error });
      return;
    }
    setIssuedPass(res.pass);
    setNewHolder('');
    setNewEmail('');
    pushToast({ tone: 'success', title: 'Conference pass issued', description: res.pass.holder_name });
    await load();
  };

  const handleResetAllAttendance = async () => {
    if (!isSuperAdmin) return;
    setResetDialogOpen(false);
    setBusy(true);
    const res = await resetAllQrAttendance();
    setBusy(false);
    if (!res.ok || !res.result) {
      pushToast({ tone: 'error', title: 'Attendance reset failed', description: res.error });
      return;
    }
    pushToast({
      tone: 'success',
      title: 'All attendance reset',
      description: `${res.result.passes_reset} passes reset · all attendees moved back to Not Checked In`,
    });
    await load();
  };

  const handleBackfill = async () => {
    if (!canManage) return;
    setBusy(true);
    const res = await backfillStaffQrPasses();
    setBusy(false);
    if (!res.ok) {
      pushToast({ tone: 'error', title: 'Could not verify staff passes', description: res.error });
    } else {
      pushToast({ tone: 'success', title: 'Staff passes verified', description: res.message });
    }
    await load();
  };

  const openCorrectionModal = (pass: LiveQrPassExtended) => {
    setCorrectionPass(pass);
    setCorrectionAction(pass.checked_in_at ? 'reset_checkin' : 'manual_checkin');
    setCorrectionGate(pass.checked_in_gate || 'Admin Desk');
    setCorrectionReason('');
  };

  const handleCorrectionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!correctionPass || correctionReason.trim().length < 3) return;
    setBusy(true);
    const res = await correctQrCheckinRecord({
      passId: correctionPass.id,
      correctionAction,
      gateLocation: correctionGate,
      reason: correctionReason,
    });
    setBusy(false);
    if (!res.ok) {
      pushToast({ tone: 'error', title: 'Correction failed', description: res.error });
      return;
    }
    if (res.warning) {
      pushToast({ tone: 'warning', title: 'Check-in updated with note', description: res.warning });
    } else {
      pushToast({
        tone: 'success',
        title: 'Check-in record updated',
        description: `${correctionPass.holder_name} · logged to audit trail`,
      });
    }
    setCorrectionPass(null);
    await load();
  };

  const handleConfirmTogglePass = async (e: FormEvent) => {
    e.preventDefault();
    if (!togglePassTarget) return;
    const activate = !togglePassTarget.active;
    setBusy(true);
    const res = await setQrPassActiveState(togglePassTarget.id, activate, toggleReason);
    setBusy(false);
    if (!res.ok) {
      pushToast({ tone: 'error', title: 'Update failed', description: res.error });
      return;
    }
    pushToast({
      tone: 'success',
      title: activate ? 'Pass reactivated' : 'Pass revoked',
      description: togglePassTarget.holder_name,
    });
    setTogglePassTarget(null);
    setToggleReason('');
    await load();
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

    const slug =
      issuedPass.holder_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'pass';
    const link = document.createElement('a');
    link.href = out.toDataURL('image/png');
    link.download = `willow-mun-pass-${slug}.png`;
    link.click();
  };

  const categories = useMemo(
    () => Array.from(new Set(passes.map((p) => p.category).filter(Boolean))).sort(),
    [passes],
  );

  const filteredPasses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return passes.filter((p) => {
      if (statusFilter === 'checked_in' && !p.checked_in_at) return false;
      if (statusFilter === 'remaining' && (Boolean(p.checked_in_at) || !p.active)) return false;
      if (statusFilter === 'revoked' && p.active) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (!q) return true;
      const haystack = `${p.holder_name} ${p.application_code || ''} ${p.token_value || ''} ${p.role_label} ${p.department_name || ''} ${p.committee_name || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [passes, searchQuery, statusFilter, categoryFilter]);

  const filteredScans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scans.filter((s) => {
      const isValid = s.result === 'valid_checkin' || s.result === 'valid_checkout';
      const isDuplicate = s.result === 'already_checked_in' || s.result === 'duplicate_recent';
      if (scanResultFilter === 'valid' && !isValid) return false;
      if (scanResultFilter === 'duplicate' && !isDuplicate) return false;
      if (scanResultFilter === 'failed' && (isValid || isDuplicate)) return false;
      if (!q) return true;
      return `${s.holder_name || ''} ${s.application_code || ''} ${s.gate_location} ${s.scanned_by_name || ''} ${s.detail_message || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [scans, scanResultFilter, searchQuery]);

  const failedAndDuplicateCount = useMemo(
    () => scans.filter((s) => s.result !== 'valid_checkin' && s.result !== 'valid_checkout').length,
    [scans],
  );

  if (mode === 'qr') {
    return canScan ? (
      <LiveQrScannerWorkspace actor={actor} autoStartCamera />
    ) : (
      <MyQrCard actorOverride={actor} />
    );
  }

  return (
    <div className="space-y-5">
      {/* Live Attendance KPI Summary */}
      {canManage && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="wm-surface-panel p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)]">
                Total Passes Issued
              </span>
              <QrCode className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            </div>
            <p className="wm-serif mt-2 text-2xl font-semibold tabular-nums text-[color:var(--wm-ink)]">
              {metrics.total_issued}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--wm-ink-muted)]">
              {metrics.active_issued} active · {metrics.revoked} revoked
            </p>
          </div>

          <div className="wm-surface-panel p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)]">
                Checked In
              </span>
              <UserCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            </div>
            <p className="wm-serif mt-2 text-2xl font-semibold tabular-nums text-emerald-300">
              {metrics.checked_in}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--wm-ink-muted)]">
              {metrics.active_issued > 0
                ? `${Math.round((metrics.checked_in / metrics.active_issued) * 100)}% of active passes`
                : 'No active passes'}
            </p>
          </div>

          <div className="wm-surface-panel p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)]">
                Remaining Attendees
              </span>
              <Users className="h-4 w-4 text-[#ede6ca]" aria-hidden="true" />
            </div>
            <p className="wm-serif mt-2 text-2xl font-semibold tabular-nums text-[#ede6ca]">
              {metrics.remaining}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--wm-ink-muted)]">
              Active passes not yet scanned
            </p>
          </div>

          <div className="wm-surface-panel p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)]">
                Failed & Duplicate Scans
              </span>
              <AlertTriangle className="h-4 w-4 text-amber-300" aria-hidden="true" />
            </div>
            <p className="wm-serif mt-2 text-2xl font-semibold tabular-nums text-amber-200">
              {failedAndDuplicateCount}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--wm-ink-muted)]">
              Out of {scans.length} logged scan events
            </p>
          </div>
        </section>
      )}

      {/* Workspace Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Attendance Views">
          {canManage && (
            <>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'registry'}
                onClick={() => setActiveTab('registry')}
                className={`inline-flex h-9 items-center gap-2 rounded-md border px-3.5 text-xs font-medium transition-colors ${
                  activeTab === 'registry'
                    ? 'border-[color:var(--wm-accent)] bg-[#2d6a4f]/35 text-[color:var(--wm-ink)]'
                    : 'border-[color:var(--wm-hairline)] bg-[color:var(--wm-surface)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                }`}
              >
                <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Attendee Registry ({passes.length})
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'scans'}
                onClick={() => setActiveTab('scans')}
                className={`inline-flex h-9 items-center gap-2 rounded-md border px-3.5 text-xs font-medium transition-colors ${
                  activeTab === 'scans'
                    ? 'border-[color:var(--wm-accent)] bg-[#2d6a4f]/35 text-[color:var(--wm-ink)]'
                    : 'border-[color:var(--wm-hairline)] bg-[color:var(--wm-surface)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                }`}
              >
                <FileWarning className="h-3.5 w-3.5" aria-hidden="true" />
                Scan Activity & Alerts ({scans.length})
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'audit'}
                onClick={() => setActiveTab('audit')}
                className={`inline-flex h-9 items-center gap-2 rounded-md border px-3.5 text-xs font-medium transition-colors ${
                  activeTab === 'audit'
                    ? 'border-[color:var(--wm-accent)] bg-[#2d6a4f]/35 text-[color:var(--wm-ink)]'
                    : 'border-[color:var(--wm-hairline)] bg-[color:var(--wm-surface)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                }`}
              >
                <History className="h-3.5 w-3.5" aria-hidden="true" />
                Corrections Audit ({correctionLogs.length})
              </button>
            </>
          )}

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'my_qr'}
            onClick={() => setActiveTab('my_qr')}
            className={`inline-flex h-9 items-center gap-2 rounded-md border px-3.5 text-xs font-medium transition-colors ${
              activeTab === 'my_qr'
                ? 'border-[color:var(--wm-accent)] bg-[#2d6a4f]/35 text-[color:var(--wm-ink)]'
                : 'border-[color:var(--wm-hairline)] bg-[color:var(--wm-surface)] text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
            }`}
          >
            <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
            My Personal QR
          </button>
        </div>

        {canManage && activeTab !== 'my_qr' && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        )}
      </div>

      {/* TAB 2: PASS & CHECK-IN REGISTRY */}
      {activeTab === 'registry' && canManage && (
        <section className="wm-surface-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] px-4 py-3.5">
            <div>
              <h2 className="text-xs font-semibold text-[color:var(--wm-ink)]">
                Conference Pass & Attendee Check-In Registry
              </h2>
              <p className="mt-0.5 text-[10px] text-[color:var(--wm-ink-muted)]">
                Search attendees, filter attendance status, and record audited corrections
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleBackfill()}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 text-[11px] text-[color:var(--wm-focal)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                Backfill Missing Staff Passes
              </button>
              {isSuperAdmin && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setResetDialogOpen(true)}
                  className="inline-flex h-8 items-center gap-2 rounded-md border border-rose-400/40 bg-rose-950/25 px-3 text-[11px] font-semibold text-rose-200 hover:bg-rose-950/45 disabled:opacity-50"
                >
                  <RefreshCw className="h-3 w-3" aria-hidden="true" /> Reset All Attendance
                </button>
              )}
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="grid gap-2 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)]/50 p-3 sm:grid-cols-[1fr_auto_auto]">
            <label className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
                aria-hidden="true"
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search attendee name, registration ID (WM-…), or token…"
                className="h-9 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] pl-8 pr-3 text-xs text-[color:var(--wm-ink)]"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              aria-label="Filter check-in status"
              className="h-9 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
            >
              <option value="all">All Statuses</option>
              <option value="checked_in">Checked In</option>
              <option value="remaining">Remaining (Not Checked In)</option>
              <option value="revoked">Revoked</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter pass category"
              className="h-9 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Issue Manual Pass Form */}
          <form
            onSubmit={issueGuestPass}
            className="grid gap-2 border-b border-[color:var(--wm-hairline)] p-4 sm:grid-cols-[1.2fr_1fr_1fr_auto_auto]"
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
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              aria-label="Pass category"
              className="h-9 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
            >
              <option value="Delegate">Delegate</option>
              <option value="Staff">Staff</option>
              <option value="Security">Security</option>
              <option value="Department Head">Department Head</option>
              <option value="Executive">Executive</option>
            </select>
            <button
              disabled={busy}
              className="h-9 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] disabled:opacity-50"
            >
              Issue Pass
            </button>
          </form>

          {loading ? (
            <div className="p-4">
              <WmSkeleton variant="table" rows={5} />
            </div>
          ) : filteredPasses.length === 0 ? (
            <p className="p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">
              No passes match the current search or filter.
            </p>
          ) : (
            <div className="divide-y divide-[color:var(--wm-hairline)]">
              {filteredPasses.map((pass) => (
                <div
                  key={pass.id}
                  className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-xs font-semibold text-[color:var(--wm-ink)]">
                        {pass.holder_name}
                      </p>
                      {pass.application_code && (
                        <span className="rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-1.5 py-0.5 font-mono text-[10px] text-[#ede6ca]">
                          {pass.application_code}
                        </span>
                      )}
                      {pass.application_status && (
                        <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-[color:var(--wm-ink-muted)]">
                          App: {pass.application_status}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-[color:var(--wm-ink-secondary)]">
                      {pass.role_label} · {pass.category}
                      {pass.committee_name
                        ? ` · ${pass.committee_name}`
                        : pass.department_name
                          ? ` · ${pass.department_name}`
                          : ''}
                    </p>
                    <p className="text-[10.5px] text-[color:var(--wm-ink-muted)]">
                      {pass.checked_in_at
                        ? `Checked in ${new Date(pass.checked_in_at).toLocaleString()} · ${pass.checked_in_gate || 'Entrance'}${pass.checked_in_by_name ? ` (by ${pass.checked_in_by_name})` : ''}`
                        : 'Not checked in yet'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md border px-2 py-1 text-[10px] font-mono uppercase ${
                        !pass.active
                          ? 'border-rose-400/35 bg-rose-500/10 text-rose-200'
                          : pass.checked_in_at
                            ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
                            : 'border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] text-[color:var(--wm-ink-secondary)]'
                      }`}
                    >
                      {!pass.active ? 'Revoked' : pass.checked_in_at ? 'Checked In' : 'Pending'}
                    </span>

                    {pass.token_value && (
                      <button
                        type="button"
                        onClick={() => setIssuedPass(pass)}
                        className="rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-2.5 py-1.5 text-[11px] text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)]"
                      >
                        View QR
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openCorrectionModal(pass)}
                      className="inline-flex items-center gap-1 rounded-md border border-[color:var(--wm-accent)]/40 bg-[#2d6a4f]/22 px-2.5 py-1.5 text-[11px] font-medium text-[color:var(--wm-focal)] hover:bg-[#2d6a4f]/40"
                    >
                      <Wrench className="h-3 w-3" aria-hidden="true" />
                      Correct Check-In
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTogglePassTarget(pass);
                        setToggleReason('');
                      }}
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

      {/* TAB 3: SCAN ACTIVITY & FAILED/DUPLICATE ALERTS */}
      {activeTab === 'scans' && canManage && (
        <section className="wm-surface-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] px-4 py-3.5">
            <div>
              <h2 className="text-xs font-semibold text-[color:var(--wm-ink)]">
                Scan Activity, Failed & Duplicate Attempts
              </h2>
              <p className="mt-0.5 text-[10px] text-[color:var(--wm-ink-muted)]">
                Review every checkpoint scan including blocked duplicate, revoked, ineligible, and invalid attempts
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search attendee, gate, scanner…"
                className="h-8 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
              />
              <select
                value={scanResultFilter}
                onChange={(e) => setScanResultFilter(e.target.value as typeof scanResultFilter)}
                aria-label="Filter scan outcome"
                className="h-8 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2.5 text-xs text-[color:var(--wm-ink)]"
              >
                <option value="all">All Scan Events ({scans.length})</option>
                <option value="valid">Valid Check-Ins</option>
                <option value="duplicate">Duplicate / Already Checked In</option>
                <option value="failed">Failed / Invalid / Revoked / Ineligible</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-[color:var(--wm-hairline)]">
            {filteredScans.length === 0 ? (
              <p className="p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">
                No scan events match the selected filter.
              </p>
            ) : (
              filteredScans.map((scan) => {
                const isValid = scan.result === 'valid_checkin';
                const isDup =
                  scan.result === 'already_checked_in' || scan.result === 'duplicate_recent';
                return (
                  <div
                    key={scan.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      {isValid ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      ) : isDup ? (
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      )}
                      <div>
                        <p className="text-xs font-medium text-[color:var(--wm-ink)]">
                          {scan.holder_name || `Unrecognized token (${scan.token_value_masked || 'unknown'})`}
                          {scan.application_code ? ` · ${scan.application_code}` : ''}
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-[color:var(--wm-ink-muted)]">
                          {scan.gate_location} · {new Date(scan.scanned_at).toLocaleString()}
                          {scan.scanned_by_name ? ` · Scanned by ${scan.scanned_by_name}` : ''}
                        </p>
                        {scan.detail_message && (
                          <p className="mt-0.5 text-[10.5px] text-[color:var(--wm-ink-secondary)]">
                            {scan.detail_message}
                          </p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`rounded-md border px-2 py-1 text-[10px] font-mono uppercase ${
                        isValid
                          ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
                          : isDup
                            ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
                            : 'border-rose-400/30 bg-rose-500/10 text-rose-200'
                      }`}
                    >
                      {scan.result.replaceAll('_', ' ')}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* TAB 4: ADMINISTRATIVE CORRECTIONS AUDIT TRAIL */}
      {activeTab === 'audit' && canManage && (
        <section className="wm-surface-panel overflow-hidden">
          <div className="border-b border-[color:var(--wm-hairline)] px-4 py-3.5">
            <h2 className="text-xs font-semibold text-[color:var(--wm-ink)]">
              Check-In Corrections Audit Trail
            </h2>
            <p className="mt-0.5 text-[10px] text-[color:var(--wm-ink-muted)]">
              Immutable record of manual check-ins, resets, gate updates, and pass revocations
            </p>
          </div>

          {correctionLogs.length === 0 ? (
            <p className="p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">
              No administrative check-in corrections have been recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-[color:var(--wm-hairline)]">
              {correctionLogs.map((entry) => (
                <div key={entry.id} className="space-y-1 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[color:var(--wm-ink)]">
                      {entry.holder_name}
                    </p>
                    <span className="rounded border border-[#ede6ca]/25 bg-[#ede6ca]/10 px-2 py-0.5 font-mono text-[10px] uppercase text-[#ede6ca]">
                      {entry.action_type.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-[color:var(--wm-ink-secondary)]">
                    Reason: {entry.reason}
                  </p>
                  <p className="text-[10.5px] text-[color:var(--wm-ink-muted)]">
                    By {entry.corrected_by_name} ({entry.corrected_by_role.replace('_', ' ')}) ·{' '}
                    {new Date(entry.created_at).toLocaleString()}
                    {entry.new_checked_in_gate ? ` · Gate: ${entry.new_checked_in_gate}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 5: PERSONAL MY QR */}
      {activeTab === 'my_qr' && <MyQrCard actorOverride={actor} />}

      {/* Pass Correction Modal (with Mandatory Audit Reason) */}
      {correctionPass && (
        <div
          className="fixed inset-0 z-[130] grid place-items-center bg-[#030906]/84 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Correct Check-In Record"
          onClick={() => setCorrectionPass(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleCorrectionSubmit(e)}
            className="w-full max-w-md space-y-4 rounded-xl border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] p-5"
          >
            <div className="flex items-start justify-between gap-2 border-b border-[color:var(--wm-hairline)] pb-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-accent)]">
                  Audited Check-In Correction
                </p>
                <h3 className="wm-serif mt-1 text-xl font-semibold text-[color:var(--wm-ink)]">
                  {correctionPass.holder_name}
                </h3>
                <p className="text-[11px] text-[color:var(--wm-ink-muted)]">
                  Current status:{' '}
                  {correctionPass.checked_in_at
                    ? `Checked in at ${correctionPass.checked_in_gate} (${new Date(correctionPass.checked_in_at).toLocaleString()})`
                    : 'Not checked in'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCorrectionPass(null)}
                aria-label="Close correction dialog"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--wm-ink-muted)] hover:bg-[color:var(--wm-inset)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <label className="block text-xs text-[color:var(--wm-ink-secondary)]">
              Correction Action
              <select
                value={correctionAction}
                onChange={(e) =>
                  setCorrectionAction(
                    e.target.value as 'reset_checkin' | 'manual_checkin' | 'update_gate',
                  )
                }
                className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
              >
                <option value="reset_checkin">Reset Check-In to Pending (Undo Accidental Scan)</option>
                <option value="manual_checkin">Record Manual Check-In</option>
                <option value="update_gate" disabled={!correctionPass.checked_in_at}>
                  Update Check-In Gate Location
                </option>
              </select>
            </label>

            {correctionAction !== 'reset_checkin' && (
              <label className="block text-xs text-[color:var(--wm-ink-secondary)]">
                Gate / Checkpoint
                <select
                  value={correctionGate}
                  onChange={(e) => setCorrectionGate(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
                >
                  {GATES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block text-xs text-[color:var(--wm-ink-secondary)]">
              Mandatory Audit Reason
              <textarea
                required
                minLength={3}
                rows={3}
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="Explain why this check-in record is being corrected (recorded permanently)…"
                className="mt-1.5 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] p-3 text-xs text-[color:var(--wm-ink)]"
              />
            </label>

            <div className="flex justify-end gap-2 border-t border-[color:var(--wm-hairline)] pt-3">
              <button
                type="button"
                onClick={() => setCorrectionPass(null)}
                className="h-9 rounded-md border border-[color:var(--wm-hairline)] px-3.5 text-xs text-[color:var(--wm-ink-secondary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || correctionReason.trim().length < 3}
                className="h-9 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b] disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save Correction'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Revoke / Reactivate Modal */}
      {togglePassTarget && (
        <div
          className="fixed inset-0 z-[130] grid place-items-center bg-[#030906]/84 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={togglePassTarget.active ? 'Revoke QR Pass' : 'Reactivate QR Pass'}
          onClick={() => setTogglePassTarget(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleConfirmTogglePass(e)}
            className="w-full max-w-md space-y-4 rounded-xl border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] p-5"
          >
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
              <div>
                <h3 className="wm-serif text-lg font-semibold text-[color:var(--wm-ink)]">
                  {togglePassTarget.active ? 'Revoke Pass' : 'Reactivate Pass'} —{' '}
                  {togglePassTarget.holder_name}
                </h3>
                <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                  {togglePassTarget.active
                    ? 'Revoking immediately blocks entrance scanning for this pass without changing the permanent token.'
                    : 'Reactivating restores conference entrance validity for this pass.'}
                </p>
              </div>
            </div>

            <label className="block text-xs text-[color:var(--wm-ink-secondary)]">
              Audit Reason (optional)
              <input
                value={toggleReason}
                onChange={(e) => setToggleReason(e.target.value)}
                placeholder={
                  togglePassTarget.active
                    ? 'e.g. Withdrawn application or lost badge'
                    : 'e.g. Verified re-entry authorization'
                }
                className="mt-1.5 h-10 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)]"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTogglePassTarget(null)}
                className="h-9 rounded-md border border-[color:var(--wm-hairline)] px-3.5 text-xs text-[color:var(--wm-ink-secondary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className={`h-9 rounded-md px-4 text-xs font-semibold text-white ${
                  togglePassTarget.active
                    ? 'bg-rose-700 hover:bg-rose-600'
                    : 'bg-[color:var(--wm-emerald)] hover:bg-[#357a5b]'
                }`}
              >
                {togglePassTarget.active ? 'Confirm Revoke' : 'Confirm Reactivate'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View Issued QR Modal */}
      {issuedPass?.token_value && (
        <div
          className="fixed inset-0 z-[130] grid place-items-center bg-[#030906]/84 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Pass QR Credential"
          onClick={() => setIssuedPass(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] p-6 text-center"
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

      {isSuperAdmin && (
        <ConfirmDialog
          open={resetDialogOpen}
          title="Reset All Conference Attendance?"
          description="This clears every pass check-in status and returns all attendees to Not Checked In across every scanner. This cannot be undone."
          confirmLabel="Reset All Attendance"
          cancelLabel="Cancel"
          tone="danger"
          onConfirm={() => void handleResetAllAttendance()}
          onCancel={() => setResetDialogOpen(false)}
        />
      )}
    </div>
  );
}
