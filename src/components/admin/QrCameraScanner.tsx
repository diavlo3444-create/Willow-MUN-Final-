import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Loader2,
  RefreshCw,
  SwitchCamera,
  VideoOff,
} from 'lucide-react';
import { shouldIgnoreRapidCameraFrame } from '../../utils/qrAttendance';


function getCameraPermissionHelp(): string[] {
  if (typeof navigator === 'undefined') return [];
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return [
      'Open the Settings app on your iPhone or iPad.',
      'Find Safari → Camera and choose Ask or Allow. If you use another browser, change its Camera permission instead.',
      'Return to this page, reload it, and tap Retry Camera.',
    ];
  }
  if (/Android/i.test(ua)) {
    return [
      'Open Chrome and return to this website.',
      'Tap the site controls icon beside the address → Permissions → Camera → Allow.',
      'If needed, open Chrome Settings → Site settings → Camera and remove Willow MUN from the blocked list.',
      'Return here and tap Retry Camera.',
    ];
  }
  if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua)) {
    return [
      'In Safari, open Safari → Settings → Websites → Camera.',
      'Find this Willow MUN website and change its permission to Allow.',
      'Return to the scanner and tap Retry Camera.',
    ];
  }
  if (/Firefox/i.test(ua)) {
    return [
      'Click the permissions or lock icon beside the website address.',
      'Open the camera permission and change it to Allow.',
      'If the permission is not shown, open Firefox Settings → Privacy & Security → Permissions → Camera.',
      'Return here and tap Retry Camera.',
    ];
  }
  return [
    'Click the site controls icon beside the website address.',
    'Open Site settings → Camera and change the setting to Allow.',
    'You can also open browser Settings → Privacy and security → Site settings → Camera, then remove this site from the blocked list.',
    'Return here and tap Retry Camera.',
  ];
}

export type CameraScannerState =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'permission_denied'
  | 'no_camera'
  | 'error';

interface QrCameraScannerProps {
  onDetectToken: (token: string) => void | Promise<void>;
  busy?: boolean;
  size?: 'panel' | 'hero';
  autoStart?: boolean;
  pauseWhenLocked?: boolean;
  showManualHint?: boolean;
}

export function QrCameraScanner({
  onDetectToken,
  busy = false,
  size = 'panel',
  autoStart = false,
  pauseWhenLocked = false,
  showManualHint = true,
}: QrCameraScannerProps) {
  const [cameraState, setCameraState] = useState<CameraScannerState>('idle');
  const [statusError, setStatusError] = useState<string>('');
  const [permissionHelp, setPermissionHelp] = useState<string[]>([]);
  const [permissionState, setPermissionState] = useState<PermissionState | 'unknown'>('unknown');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [lastScannedHint, setLastScannedHint] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastReadRef = useRef<{ token: string; at: number }>({ token: '', at: 0 });
  const mountedRef = useRef<boolean>(true);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const pausedRef = useRef(pauseWhenLocked);
  pausedRef.current = pauseWhenLocked;
  const onDetectRef = useRef(onDetectToken);
  onDetectRef.current = onDetectToken;

  const stopStream = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const refreshCameraList = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setCameras(videoDevices);
    } catch {
      // Ignore enumerate failure
    }
  }, []);

  const startCamera = useCallback(
    async (overrideDeviceId?: string, overrideFacing?: 'environment' | 'user') => {
      stopStream();
      setStatusError('');

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraState('error');
        setStatusError(
          showManualHint
            ? 'Live camera access requires a modern browser over HTTPS (or localhost). Use manual token entry below as fallback.'
            : 'Camera access is unavailable in this browser context. Open this page over HTTPS (or localhost) with a device camera.',
        );
        return;
      }

      // Request camera access immediately from the user's click. Permission-query
      // awaits before getUserMedia can consume the browser's activation and prevent
      // some browsers (notably Huawei/Petal variants) from showing the prompt.
      setCameraState('requesting');
      const targetDevice = overrideDeviceId !== undefined ? overrideDeviceId : selectedDeviceId;
      const targetFacing = overrideFacing ?? facingMode;

      const videoConstraint: MediaTrackConstraints = targetDevice
        ? {
            deviceId: { exact: targetDevice },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          audio: false,
        });

        if (!mountedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setPermissionState('granted');
        setCameraState('active');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play().catch(() => undefined);
        }

        const activeTrack = stream.getVideoTracks()[0];
        const activeDeviceId = activeTrack?.getSettings?.().deviceId;
        if (activeDeviceId && !targetDevice) {
          setSelectedDeviceId(activeDeviceId);
        }

        await refreshCameraList();
      } catch (err: any) {
        const name = String(err?.name || '');
        const msg = String(err?.message || '').toLowerCase();
        if (
          name === 'NotAllowedError' ||
          name === 'PermissionDeniedError' ||
          msg.includes('permission') ||
          msg.includes('denied')
        ) {
          setCameraState('permission_denied');
          setPermissionHelp(getCameraPermissionHelp());
          setPermissionState('denied');
          setStatusError(
            'Camera access was blocked by the browser. Change this website’s camera permission to Allow, then return and retry. A website cannot override a blocked browser permission.',
          );
        } else if (
          name === 'NotFoundError' ||
          name === 'DevicesNotFoundError' ||
          name === 'OverconstrainedError'
        ) {
          if (targetDevice) {
            // Selected device disappeared; retry default camera once
            setSelectedDeviceId('');
            setCameraState('idle');
            void startCamera('', targetFacing);
            return;
          }
          setCameraState('no_camera');
          setStatusError(
            showManualHint
              ? 'No usable camera was detected on this device. Enter the QR pass code manually below.'
              : 'No usable camera was detected on this device. Connect or enable a camera to scan Willow MUN QR codes.',
          );
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          setCameraState('error');
          setStatusError(
            'Camera is currently in use by another app or tab. Close the other camera app and try again.',
          );
        } else {
          setCameraState('error');
          setStatusError(err?.message || 'Unable to start camera feed.');
        }
      }
    },
    [facingMode, refreshCameraList, selectedDeviceId, showManualHint, stopStream],
  );

  const stopCamera = useCallback(() => {
    stopStream();
    setCameraState('idle');
    setStatusError('');
  }, [stopStream]);

  useEffect(() => {
    mountedRef.current = true;
    let permStatus: PermissionStatus | null = null;
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((status) => {
          if (!mountedRef.current) return;
          permStatus = status;
          setPermissionState(status.state);
          status.onchange = () => {
            if (mountedRef.current) {
              setPermissionState(status.state);
            }
          };
        })
        .catch(() => undefined);
    }

    if (autoStart) {
      void startCamera();
    }

    return () => {
      mountedRef.current = false;
      if (permStatus) {
        permStatus.onchange = null;
      }
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cross-browser QR scan loop (BarcodeDetector fast path + universal jsQR canvas decoder)
  useEffect(() => {
    if (cameraState !== 'active') return;

    let cancelled = false;
    let lastAttemptMs = 0;
    const NativeDetector = (window as any).BarcodeDetector;
    const detector = NativeDetector ? new NativeDetector({ formats: ['qr_code'] }) : null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const emitDecoded = (rawToken: string) => {
      const cleaned = rawToken.trim();
      if (!cleaned) return;
      const now = Date.now();
      // Prevent repeated duplicate triggers while a QR stays in front of the lens
      if (
        shouldIgnoreRapidCameraFrame(
          lastReadRef.current.token,
          lastReadRef.current.at,
          cleaned,
          now,
          3000,
        )
      ) {
        return;
      }
      lastReadRef.current = { token: cleaned, at: now };
      setLastScannedHint(cleaned);
      window.setTimeout(() => setLastScannedHint(null), 1600);
      void onDetectRef.current(cleaned);
    };

    const tick = async (ts: number) => {
      if (cancelled) return;
      rafRef.current = window.requestAnimationFrame((nextTs) => void tick(nextTs));

      if (ts - lastAttemptMs < 115) return;
      lastAttemptMs = ts;

      if (busyRef.current || pausedRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }

      if (detector) {
        try {
          const codes = await detector.detect(video);
          const raw = codes?.[0]?.rawValue;
          if (raw) {
            emitDecoded(String(raw));
            return;
          }
        } catch {
          // Fall back to jsQR on the frame
        }
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxDim = 640;
      const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.max(1, Math.floor(video.videoWidth * scale));
      const h = Math.max(1, Math.floor(video.videoHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const decoded = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
      if (decoded?.data) {
        emitDecoded(decoded.data);
      }
    };

    rafRef.current = window.requestAnimationFrame((ts) => void tick(ts));
    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [cameraState]);

  const handleSwitchCamera = () => {
    if (cameras.length > 1) {
      const idx = cameras.findIndex((c) => c.deviceId === selectedDeviceId);
      const next = cameras[(idx + 1) % cameras.length];
      setSelectedDeviceId(next.deviceId);
      void startCamera(next.deviceId);
      return;
    }
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    setSelectedDeviceId('');
    void startCamera('', nextFacing);
  };

  const frameHeightClass =
    size === 'hero'
      ? 'aspect-[4/3] sm:aspect-[16/10] min-h-[260px] max-h-[460px]'
      : 'aspect-video min-h-[220px] max-h-[340px]';

  return (
    <div className="space-y-3">
      {/* Camera Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {cameraState === 'active' ? (
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-rose-400/35 bg-rose-950/35 px-3.5 text-xs font-medium text-rose-200 transition-colors hover:bg-rose-950/55"
            >
              <CameraOff className="h-3.5 w-3.5" aria-hidden="true" />
              Stop Camera
            </button>
          ) : (
            <button
              type="button"
              disabled={cameraState === 'requesting'}
              onClick={() => void startCamera()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] transition-colors hover:bg-[#357a5b] disabled:opacity-60"
            >
              {cameraState === 'requesting' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {cameraState === 'requesting'
                ? 'Requesting Camera…'
                : cameraState === 'permission_denied' || cameraState === 'error'
                  ? 'Retry Camera'
                  : 'Start Camera Scanner'}
            </button>
          )}

          {(cameraState === 'active' || cameras.length > 1) && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3.5 text-xs font-medium text-[color:var(--wm-focal)] transition-colors hover:bg-[color:var(--wm-overlay)]"
            >
              <SwitchCamera className="h-3.5 w-3.5" aria-hidden="true" />
              Switch Camera
            </button>
          )}
        </div>

        {cameras.length > 1 && (
          <select
            aria-label="Select camera device"
            value={selectedDeviceId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedDeviceId(id);
              if (cameraState === 'active') void startCamera(id);
            }}
            className="min-h-[44px] max-w-[220px] rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2.5 text-[11px] text-[color:var(--wm-ink)]"
          >
            <option value="">Auto camera ({facingMode === 'environment' ? 'Rear' : 'Front'})</option>
            {cameras.map((cam, idx) => (
              <option key={cam.deviceId || idx} value={cam.deviceId}>
                {cam.label || `Camera ${idx + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Live Video & Viewfinder Stage */}
      <div
        className={`relative w-full overflow-hidden rounded-lg border border-[color:var(--wm-hairline-strong)] bg-[#040906] ${frameHeightClass}`}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`h-full w-full object-cover ${cameraState === 'active' ? 'block' : 'hidden'}`}
        />

        {/* Viewfinder Overlay when active */}
        {cameraState === 'active' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative h-44 w-44 sm:h-52 sm:w-52">
              <span className="absolute left-0 top-0 h-7 w-7 border-l-2 border-t-2 border-[#ede6ca]" />
              <span className="absolute right-0 top-0 h-7 w-7 border-r-2 border-t-2 border-[#ede6ca]" />
              <span className="absolute bottom-0 left-0 h-7 w-7 border-b-2 border-l-2 border-[#ede6ca]" />
              <span className="absolute bottom-0 right-0 h-7 w-7 border-b-2 border-r-2 border-[#ede6ca]" />
              {!pauseWhenLocked && !busy && (
                <div className="willow-scanline absolute inset-x-3 top-1/2 h-[2px] bg-gradient-to-r from-transparent via-[#a7f3c6] to-transparent shadow-[0_0_12px_rgba(116,198,157,0.9)]" />
              )}
            </div>
            <div className="mt-4 rounded-md border border-white/15 bg-black/75 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-[#ede6ca]">
              {busy
                ? 'Checking in pass…'
                : lastScannedHint
                  ? 'QR detected — checking in…'
                  : 'Align Willow MUN QR pass inside frame'}
            </div>
          </div>
        )}

        {/* Idle / Permission / Error States */}
        {cameraState !== 'active' && (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center p-6 text-center">
            {cameraState === 'requesting' ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-[color:var(--wm-accent)]" aria-hidden="true" />
                <p className="mt-3 text-xs font-medium text-[color:var(--wm-ink)]">
                  Requesting camera access…
                </p>
                <p className="mt-1 max-w-xs text-[11px] text-[color:var(--wm-ink-muted)]">
                  Approve the browser prompt to enable live QR code detection.
                </p>
              </>
            ) : cameraState === 'permission_denied' ? (
              <>
                <AlertTriangle className="h-8 w-8 text-amber-300" aria-hidden="true" />
                <p className="mt-3 text-xs font-semibold text-amber-100">Camera Permission Denied</p>
                <p className="mt-1.5 max-w-sm text-[11px] leading-relaxed text-[color:var(--wm-ink-secondary)]">
                  {statusError}
                </p>
                <div className="mt-4 w-full max-w-sm rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-3 text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100">
                    Allow camera access in your browser
                  </p>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-[color:var(--wm-ink-secondary)]">
                    {(permissionHelp.length ? permissionHelp : getCameraPermissionHelp()).map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <p className="mt-2 text-[10px] text-[color:var(--wm-ink-muted)]">
                    Permission status: {permissionState === 'unknown' ? 'not available in this browser' : permissionState}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-500/15 px-3.5 text-[11px] font-medium text-amber-100 hover:bg-amber-500/25"
                >
                  <RefreshCw className="h-3 w-3" aria-hidden="true" /> Check Permission & Retry
                </button>
              </>
            ) : cameraState === 'no_camera' || cameraState === 'error' ? (
              <>
                <VideoOff className="h-8 w-8 text-rose-300" aria-hidden="true" />
                <p className="mt-3 text-xs font-semibold text-rose-100">
                  {cameraState === 'no_camera' ? 'No Camera Available' : 'Camera Unavailable'}
                </p>
                <p className="mt-1.5 max-w-sm text-[11px] leading-relaxed text-[color:var(--wm-ink-secondary)]">
                  {statusError}
                </p>
              </>
            ) : (
              <>
                <Camera className="h-9 w-9 text-[color:var(--wm-accent)]" aria-hidden="true" />
                <p className="mt-3 text-xs font-semibold text-[color:var(--wm-ink)]">
                  Camera Scanner Standby
                </p>
                <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-[color:var(--wm-ink-muted)]">
                  {showManualHint
                    ? 'Works on mobile rear cameras and desktop webcams. Tap Start Camera Scanner above or enter a token manually below.'
                    : 'Works on mobile rear cameras and desktop webcams. Tap Start Camera Scanner above to begin scanning.'}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
