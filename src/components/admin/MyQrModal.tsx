import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import {
  CheckCircle2,
  Download,
  Maximize2,
  Minimize2,
  QrCode,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAdminStore } from '../../context/AdminStoreContext';
import { fetchPersonalQrPass, type LiveQrPass } from '../../services/liveBackendService';
import type { AdminUser } from '../../types/admin';
import { getRoleLabel } from '../../utils/adminPermissions';
import { WmSkeleton } from './WmSkeleton';

interface MyQrCardProps {
  actorOverride?: AdminUser | null;
  compact?: boolean;
}

export function MyQrCard({ actorOverride = null, compact = false }: MyQrCardProps) {
  const { currentUser, testModeHeadUser, data, pushToast } = useAdminStore();
  const actor = actorOverride ?? testModeHeadUser ?? currentUser;
  const [pass, setPass] = useState<LiveQrPass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enlarged, setEnlarged] = useState(false);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!actor) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const result = await fetchPersonalQrPass(actor);
    if (result.pass) {
      setPass(result.pass);
    } else {
      setError(result.error || 'Could not retrieve your QR credential.');
    }
    setLoading(false);
  }, [actor]);

  useEffect(() => {
    void load();
  }, [load]);

  const targetDeptRef = pass?.department_id || actor?.departmentId || actor?.departmentSlug;
  const departmentName = targetDeptRef
    ? data.departments.find(
        (d) =>
          d.id === targetDeptRef ||
          d.slug === targetDeptRef ||
          (actor?.departmentSlug && d.slug === actor.departmentSlug),
      )?.name || targetDeptRef
    : 'Conference Secretariat';

  const holderName = pass?.holder_name || actor?.fullName || 'Registered Member';
  const roleLabel = pass?.role_label || actor?.title || (actor ? getRoleLabel(actor.role) : 'Participant');

  const downloadPngBadge = useCallback(() => {
    if (!pass?.token_value) return;
    const qrCanvas = canvasHostRef.current?.querySelector('canvas');
    if (!qrCanvas) {
      pushToast({ tone: 'error', title: 'QR renderer not ready yet' });
      return;
    }

    const width = 760;
    const height = 960;
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    if (!ctx) return;

    // Deep forest green conference badge backdrop
    ctx.fillStyle = '#06110c';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(148, 191, 165, 0.32)';
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, width - 48, height - 48);

    // Header band
    ctx.fillStyle = '#0b1c15';
    ctx.fillRect(26, 26, width - 52, 130);

    ctx.fillStyle = '#74c69d';
    ctx.font = '600 18px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WILLOW MUN · OFFICIAL CREDENTIAL', width / 2, 76);

    ctx.fillStyle = '#eef4ef';
    ctx.font = '600 30px Georgia, serif';
    ctx.fillText('Personal Access Pass', width / 2, 124);

    // White high-contrast QR container
    const qrBoxSize = 460;
    const qrBoxX = (width - qrBoxSize) / 2;
    const qrBoxY = 196;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 18);
    ctx.fill();

    ctx.drawImage(qrCanvas, qrBoxX + 30, qrBoxY + 30, qrBoxSize - 60, qrBoxSize - 60);

    // Holder identity underneath QR
    ctx.fillStyle = '#eef4ef';
    ctx.font = '600 34px Georgia, serif';
    ctx.fillText(holderName, width / 2, 725, width - 96);

    ctx.fillStyle = '#95d5b2';
    ctx.font = '500 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(roleLabel, width / 2, 768, width - 96);

    ctx.fillStyle = '#b4cbbd';
    ctx.font = '500 18px system-ui, -apple-system, sans-serif';
    ctx.fillText(departmentName ?? 'Conference Secretariat', width / 2, 804, width - 96);

    ctx.fillStyle = '#7fa08c';
    ctx.font = '500 16px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(`CREDENTIAL ID · ${pass.token_value.slice(0, 14)}…`, width / 2, 868);

    const slug = holderName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pass';
    const url = out.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `willow-mun-qr-${slug}.png`;
    link.click();

    pushToast({
      tone: 'success',
      title: 'QR image downloaded',
      description: `Saved willow-mun-qr-${slug}.png`,
    });
  }, [departmentName, holderName, pass, pushToast, roleLabel]);

  const downloadSvg = useCallback(() => {
    const svgEl = svgContainerRef.current?.querySelector('svg');
    if (!svgEl || !pass?.token_value) return;
    const serialized = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const slug = holderName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pass';
    const link = document.createElement('a');
    link.href = url;
    link.download = `willow-mun-qr-${slug}.svg`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [holderName, pass?.token_value]);

  if (loading) return <WmSkeleton variant="qr" />;

  if (error || !pass?.token_value) {
    return (
      <div className="wm-surface-panel p-6 text-center">
        <QrCode className="mx-auto h-9 w-9 text-[color:var(--wm-ink-muted)]" />
        <h3 className="mt-3 text-sm font-semibold text-[color:var(--wm-ink)]">Personal QR Unavailable</h3>
        <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
          {error || 'Your account does not have an active credential yet.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="wm-surface-panel relative overflow-hidden p-5 sm:p-7">
        {/* Hidden high-resolution canvas solely used for crisp PNG badge export */}
        <div ref={canvasHostRef} className="sr-only" aria-hidden="true">
          <QRCodeCanvas value={pass.token_value} size={420} level="H" includeMargin={false} />
        </div>

        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center">
            <div
              ref={svgContainerRef}
              className="rounded-xl border-2 border-[color:var(--wm-hairline-strong)] bg-white p-3"
            >
              <QRCodeSVG
                value={pass.token_value}
                size={compact ? 168 : 196}
                level="H"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#06110c"
              />
            </div>
            <span className="mt-2.5 inline-flex items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--wm-focal)]">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              {pass.active ? 'Permanent · Verified' : 'Revoked'}
            </span>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[color:var(--wm-accent)]">
              Willow MUN · Personal Credential
            </p>
            <h3 className="wm-serif mt-2 text-2xl font-semibold text-[color:var(--wm-ink)]">
              {holderName}
            </h3>
            <p className="mt-1 text-sm font-medium text-[color:var(--wm-focal)]">{roleLabel}</p>
            <p className="mt-0.5 text-xs text-[color:var(--wm-ink-secondary)]">
              {departmentName} · {pass.category}
            </p>

            <div className="mt-4 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-3.5 py-2.5 text-left">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[color:var(--wm-ink-muted)]">
                Permanent Credential Token
              </p>
              <p className="mt-0.5 break-all font-mono text-xs text-[color:var(--wm-ink)]">
                {pass.token_value}
              </p>
            </div>

            {pass.checked_in_at && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[color:var(--wm-focal)]">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Checked in {new Date(pass.checked_in_at).toLocaleString()}
                {pass.checked_in_gate ? ` · ${pass.checked_in_gate}` : ''}
              </p>
            )}

            <div className="mt-5 flex flex-wrap justify-center gap-2.5 sm:justify-start">
              <button
                type="button"
                onClick={() => setEnlarged(true)}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3.5 text-xs font-medium text-[color:var(--wm-ink)] transition-colors hover:bg-[color:var(--wm-overlay)]"
              >
                <Maximize2 className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
                Enlarge QR
              </button>
              <button
                type="button"
                onClick={downloadPngBadge}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] transition-colors hover:bg-[#357a5b]"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download Image
              </button>
              <button
                type="button"
                onClick={downloadSvg}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-md border border-[color:var(--wm-hairline)] px-3 text-xs text-[color:var(--wm-ink-secondary)] transition-colors hover:border-[color:var(--wm-hairline-strong)] hover:text-[color:var(--wm-ink)]"
              >
                SVG
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen High-Contrast Enlarge Overlay */}
      <AnimatePresence>
        {enlarged && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-label="Enlarged personal QR code"
            onClick={() => setEnlarged(false)}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-[#030906]/92 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-xl border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] p-6 text-center"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">
                  Willow MUN · Scan Ready
                </span>
                <button
                  type="button"
                  onClick={() => setEnlarged(false)}
                  aria-label="Exit enlarged QR view"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--wm-hairline)] text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-inset)] hover:text-[color:var(--wm-ink)]"
                >
                  <Minimize2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mx-auto mt-5 inline-block rounded-2xl bg-white p-5">
                <QRCodeSVG
                  value={pass.token_value}
                  size={280}
                  level="H"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#06110c"
                />
              </div>
              <h4 className="wm-serif mt-5 text-2xl font-semibold text-[color:var(--wm-ink)]">
                {holderName}
              </h4>
              <p className="mt-1 text-sm font-medium text-[color:var(--wm-focal)]">{roleLabel}</p>
              <p className="mt-0.5 text-xs text-[color:var(--wm-ink-secondary)]">{departmentName}</p>
              <p className="mt-3 break-all font-mono text-[11px] text-[color:var(--wm-ink-muted)]">
                {pass.token_value}
              </p>
              <div className="mt-5 flex justify-center gap-2.5">
                <button
                  type="button"
                  onClick={downloadPngBadge}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Download PNG
                </button>
                <button
                  type="button"
                  onClick={() => setEnlarged(false)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] px-4 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-inset)]"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function MyQrModal() {
  const { myQrModalOpen, closeMyQrModal } = useAdminStore();
  const titleId = useId();

  useEffect(() => {
    if (!myQrModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMyQrModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [myQrModalOpen, closeMyQrModal]);

  return (
    <AnimatePresence>
      {myQrModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={closeMyQrModal}
          className="wm-admin fixed inset-0 z-[130] flex items-center justify-center bg-[#030906]/84 p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-xl border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-surface)] p-5 sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] text-[color:var(--wm-accent)]">
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 id={titleId} className="text-sm font-semibold text-[color:var(--wm-ink)]">
                    My QR Credential
                  </h2>
                  <p className="text-[11px] text-[color:var(--wm-ink-muted)]">
                    Unique permanent access pass bound to your Willow MUN account
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMyQrModal}
                aria-label="Close My QR modal"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--wm-ink-secondary)] transition-colors hover:bg-[color:var(--wm-inset)] hover:text-[color:var(--wm-ink)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <MyQrCard />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
