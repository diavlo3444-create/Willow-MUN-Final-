import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Camera, CameraOff, Download, Plus, QrCode, RefreshCw, ScanLine, ShieldAlert, XCircle } from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { supabase } from '../../../lib/supabase';
import { hasPermission } from '../../../utils/adminPermissions';

type Pass = {
  id: string; user_id: string | null; holder_name: string; holder_email: string | null;
  role_label: string; category: string; department_id: string | null; active: boolean;
  checked_in_at: string | null; checked_in_gate: string | null; token_value?: string;
  created_at: string;
};
type Scan = { id: string; holder_name: string | null; result: string; gate_location: string; scanned_at: string; pass_id: string | null };

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
  const [personalPass, setPersonalPass] = useState<Pass | null>(null);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [gateLocation, setGateLocation] = useState('Main Entrance');
  const [lastResult, setLastResult] = useState<{ result: string; holder_name?: string | null; role_label?: string | null; gate_location?: string } | null>(null);
  const [scanError, setScanError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [newHolder, setNewHolder] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('Conference Participant');
  const [issuedPass, setIssuedPass] = useState<Pass | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannedTokenRef = useRef('');

  const load = useCallback(async () => {
    setLoading(true);
    const requests: Promise<any>[] = [
      supabase.functions.invoke('willow-qr', { body: { action: 'my_pass' } }),
    ];
    if (canManage) {
      requests.push(supabase.functions.invoke('willow-qr', { body: { action: 'list' } }));
      requests.push(supabase.functions.invoke('willow-qr', { body: { action: 'scan_log' } }));
    }
    const results = await Promise.all(requests);
    const [mine, registry, log] = results;
    if (mine.error) pushToast({ tone: 'error', title: 'Could not load your QR pass', description: mine.error.message });
    else setPersonalPass(mine.data?.pass ?? null);
    if (canManage) {
      if (registry?.error) pushToast({ tone: 'error', title: 'Pass registry unavailable', description: registry.error.message });
      else setPasses(registry?.data?.passes ?? []);
      if (!log?.error) setScans(log?.data?.scans ?? []);
    }
    setLoading(false);
  }, [canManage, pushToast]);

  useEffect(() => { void load(); }, [load]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const scanToken = useCallback(async (token: string) => {
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
    if (response.result === 'valid_checkin') pushToast({ tone: 'success', title: 'Check-in successful', description: response.holder_name + ' · ' + gateLocation });
    else if (response.result === 'duplicate_recent') pushToast({ tone: 'warning', title: 'Already checked in', description: response.holder_name || 'This pass has already been used.' });
    else pushToast({ tone: 'error', title: response.result === 'revoked_pass' ? 'Pass revoked' : 'Invalid QR pass', description: 'Do not admit this pass holder.' });
    await load();
  }, [gateLocation, load, pushToast]);

  useEffect(() => {
    if (!scannerOpen) { stopCamera(); return; }
    let interval = 0;
    let cancelled = false;
    const start = async () => {
      try {
        if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) throw new Error('Camera access is not available in this browser.');
        const Detector = (window as any).BarcodeDetector;
        if (!Detector) throw new Error('Live QR scanning is not supported by this browser. Use the token input below.');
        const detector = new Detector({ formats: ['qr_code'] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
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
              window.setTimeout(() => { scannedTokenRef.current = ''; }, 1200);
            }
          } catch { /* Wait for the next camera frame. */ }
        }, 350);
      } catch (error) {
        setScanError(error instanceof Error ? error.message : 'Could not start camera.');
        setScannerOpen(false);
      }
    };
    void start();
    return () => { cancelled = true; if (interval) window.clearInterval(interval); stopCamera(); };
  }, [scannerOpen, stopCamera, scanToken, busy]);

  const issuePersonalPass = async () => {
    if (!actor) return;
    setBusy(true);
    const { data: response, error } = await supabase.functions.invoke('willow-qr', { body: { action: 'issue', user_id: actor.id } });
    setBusy(false);
    if (error || response?.error) { pushToast({ tone: 'error', title: 'Could not create your pass', description: response?.error || error?.message }); return; }
    setPersonalPass(response.pass);
    setIssuedPass(response.pass);
    await load();
  };

  const issueGuestPass = async (event: FormEvent) => {
    event.preventDefault();
    if (!newHolder.trim()) return;
    setBusy(true);
    const { data: response, error } = await supabase.functions.invoke('willow-qr', {
      body: { action: 'issue', holder_name: newHolder.trim(), holder_email: newEmail.trim() || null, role_label: newRole, category: 'Delegate' },
    });
    setBusy(false);
    if (error || response?.error) { pushToast({ tone: 'error', title: 'Pass could not be issued', description: response?.error || error?.message }); return; }
    setIssuedPass(response.pass);
    setNewHolder(''); setNewEmail('');
    await load();
  };

  const issueMissing = async () => {
    setBusy(true);
    const { data: response, error } = await supabase.functions.invoke('willow-qr', { body: { action: 'ensure_profile_passes' } });
    setBusy(false);
    if (error || response?.error) pushToast({ tone: 'error', title: 'Could not issue account passes', description: response?.error || error?.message });
    else pushToast({ tone: 'success', title: 'QR passes issued', description: response.message });
    await load();
  };

  const setPassActive = async (pass: Pass) => {
    const { data: response, error } = await supabase.functions.invoke('willow-qr', { body: { action: pass.active ? 'revoke' : 'activate', pass_id: pass.id } });
    if (error || response?.error) pushToast({ tone: 'error', title: 'Pass could not be updated', description: response?.error || error?.message });
    else await load();
  };

  const checkedIn = passes.filter(pass => pass.checked_in_at).length;

  return <div className="space-y-5">
    {(mode === 'qr' || personalPass || actor?.role === 'department_head') && <section className="rounded-md border border-white/[0.08] bg-[#0c0c0f] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          {personalPass?.token_value ? <div className="rounded-md bg-white p-2"><QRCodeSVG value={personalPass.token_value} size={144} level="H" includeMargin /></div> : <div className="grid h-36 w-36 place-items-center rounded-md border border-dashed border-white/[0.12] bg-black/20"><QrCode className="h-9 w-9 text-neutral-600"/></div>}
          <div className="min-w-0"><p className="text-[9px] font-mono uppercase tracking-[0.18em] text-[#d4af37]">Willow MUN · Digital pass</p><h2 className="wm-serif mt-2 text-2xl text-neutral-100">{personalPass?.holder_name || actor?.fullName || 'Personal pass'}</h2><p className="mt-1 text-xs text-neutral-400">{personalPass?.role_label || actor?.title || 'Conference participant'}</p><p className="mt-2 font-mono text-[10px] text-neutral-500">{personalPass?.id ? (personalPass.active ? 'Credential active' : 'Credential revoked') : 'No pass issued yet'}</p>
            {personalPass?.checked_in_at && <p className="mt-2 text-[10px] text-emerald-300">Checked in · {new Date(personalPass.checked_in_at).toLocaleString()} · {personalPass.checked_in_gate}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">{!personalPass && <button type="button" disabled={busy || loading} onClick={()=>void issuePersonalPass()} className="inline-flex h-9 items-center gap-2 rounded bg-[#d4af37] px-4 text-xs font-semibold text-black disabled:opacity-50"><Plus className="h-3.5 w-3.5"/> Generate my pass</button>}{personalPass && <button type="button" onClick={()=>window.print()} className="inline-flex h-9 items-center gap-2 rounded border border-white/[0.1] px-3 text-xs text-neutral-300 hover:bg-white/[0.04]"><Download className="h-3.5 w-3.5"/> Print pass</button>}</div>
      </div>
      {!personalPass && <p className="mt-4 text-[10px] text-neutral-500">Generate your unique QR credential. Security can scan it at the entrance.</p>}
    </section>}

    {canScan && <section className="overflow-hidden rounded-md border border-white/[0.08] bg-[#0c0c0f]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3"><div className="flex items-center gap-2"><ScanLine className="h-4 w-4 text-[#d4af37]"/><div><h2 className="text-xs font-semibold text-neutral-100">Security checkpoint scanner</h2><p className="mt-1 text-[10px] text-neutral-500">Camera scan or enter the pass token manually</p></div></div><button type="button" onClick={()=>{setScannerOpen(v=>!v);setScanError('');}} className="inline-flex h-8 items-center gap-2 rounded border border-[#d4af37]/30 px-3 text-[10px] text-[#e4c86c]">{scannerOpen?<><CameraOff className="h-3.5 w-3.5"/> Stop camera</>:<><Camera className="h-3.5 w-3.5"/> Open camera</>}</button></div>
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div className="space-y-3">
          {scannerOpen && <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-md border border-white/[0.08] bg-black object-cover"/>}
          <form onSubmit={(e)=>{e.preventDefault();if(scanInput.trim())void scanToken(scanInput.trim());}} className="space-y-3">
            <label className="block text-[10px] text-neutral-400">QR token<input value={scanInput} onChange={e=>setScanInput(e.target.value)} placeholder="Scan or paste the pass token" className="mt-1 h-10 w-full rounded border border-white/[0.1] bg-black/20 px-3 font-mono text-xs text-neutral-100"/></label>
            <label className="block text-[10px] text-neutral-400">Checkpoint location<select value={gateLocation} onChange={e=>setGateLocation(e.target.value)} className="mt-1 h-10 w-full rounded border border-white/[0.1] bg-[#111114] px-3 text-xs text-neutral-100"><option>Main Entrance</option><option>VIP Entrance</option><option>Committee Hall</option><option>Staff Entrance</option></select></label>
            <button disabled={busy || !scanInput.trim()} className="h-9 w-full rounded bg-[#d4af37] px-4 text-xs font-semibold text-black disabled:opacity-50">{busy?'Verifying…':'Verify & check in'}</button>
          </form>
          {scanError && <p role="alert" className="text-[11px] text-rose-300">{scanError}</p>}
        </div>
        <div className="flex min-h-48 flex-col justify-center rounded-md border border-white/[0.06] bg-black/20 p-4">
          {!lastResult ? <div className="text-center"><ShieldAlert className="mx-auto h-7 w-7 text-neutral-600"/><p className="mt-2 text-xs text-neutral-400">Waiting for a pass to be scanned</p></div> : <div className="text-center">
            {lastResult.result==='valid_checkin'?<CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400"/>:lastResult.result==='duplicate_recent'?<ShieldAlert className="mx-auto h-9 w-9 text-amber-300"/>:<XCircle className="mx-auto h-9 w-9 text-rose-400"/>}
            <p className={'mt-3 text-sm font-semibold '+(lastResult.result==='valid_checkin'?'text-emerald-300':lastResult.result==='duplicate_recent'?'text-amber-200':'text-rose-300')}>{lastResult.result==='valid_checkin'?'CHECK-IN APPROVED':lastResult.result==='duplicate_recent'?'ALREADY CHECKED IN':lastResult.result==='revoked_pass'?'PASS REVOKED':'INVALID PASS'}</p>
            <p className="mt-1 text-xs text-neutral-200">{lastResult.holder_name || 'No matching person found'}</p><p className="mt-1 text-[10px] text-neutral-500">{lastResult.role_label || ''} · {lastResult.gate_location || gateLocation}</p>
          </div>}
        </div>
      </div>
    </section>}

    {canManage && <section className="overflow-hidden rounded-md border border-white/[0.08] bg-[#0c0c0f]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3"><div><h2 className="text-xs font-semibold text-neutral-100">Pass registry</h2><p className="mt-1 text-[10px] text-neutral-500">{passes.length} issued passes · {checkedIn} checked in</p></div><button type="button" disabled={busy} onClick={()=>void issueMissing()} className="inline-flex h-8 items-center gap-2 rounded border border-[#d4af37]/30 px-3 text-[10px] text-[#e4c86c] disabled:opacity-50"><RefreshCw className="h-3 w-3"/> Issue missing staff passes</button></div>
      <form onSubmit={issueGuestPass} className="grid gap-2 border-b border-white/[0.06] p-4 sm:grid-cols-[1fr_1fr_1fr_auto]"><input value={newHolder} onChange={e=>setNewHolder(e.target.value)} required placeholder="Guest / delegate name" className="h-9 rounded border border-white/[0.1] bg-black/20 px-3 text-xs text-neutral-100"/><input value={newEmail} onChange={e=>setNewEmail(e.target.value)} type="email" placeholder="Email (optional)" className="h-9 rounded border border-white/[0.1] bg-black/20 px-3 text-xs text-neutral-100"/><input value={newRole} onChange={e=>setNewRole(e.target.value)} placeholder="Role label" className="h-9 rounded border border-white/[0.1] bg-black/20 px-3 text-xs text-neutral-100"/><button disabled={busy} className="h-9 rounded bg-[#d4af37] px-4 text-xs font-semibold text-black disabled:opacity-50">Issue pass</button></form>
      <div className="divide-y divide-white/[0.05]">{passes.length===0?<p className="p-8 text-center text-xs text-neutral-500">No passes have been issued yet. Use “Issue missing staff passes” to create passes for existing accounts.</p>:passes.map(pass=><div key={pass.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-xs font-medium text-neutral-100">{pass.holder_name}</p><p className="mt-0.5 truncate text-[10px] text-neutral-500">{pass.holder_email || pass.role_label} · {pass.category}</p><p className="mt-1 text-[9px] text-neutral-500">{pass.checked_in_at?'Checked in '+new Date(pass.checked_in_at).toLocaleString()+' · '+pass.checked_in_gate:'Not checked in'}</p></div><div className="flex items-center gap-2">{pass.token_value && <button type="button" onClick={()=>setIssuedPass(pass)} className="rounded border border-white/[0.1] px-2.5 py-1.5 text-[10px] text-neutral-300">View QR</button>}<span className={'rounded border px-2 py-1 text-[9px] '+(pass.active?'border-emerald-400/20 text-emerald-300':'border-rose-400/20 text-rose-300')}>{pass.active?'Active':'Revoked'}</span><button type="button" onClick={()=>void setPassActive(pass)} className="rounded border border-white/[0.1] px-2.5 py-1.5 text-[10px] text-neutral-300">{pass.active?'Revoke':'Reactivate'}</button></div></div>)}</div>
    </section>}

    {canManage && mode==='attendance' && <section className="overflow-hidden rounded-md border border-white/[0.08] bg-[#0c0c0f]"><div className="border-b border-white/[0.06] px-4 py-3"><h2 className="text-xs font-semibold text-neutral-100">Recent scan activity</h2><p className="mt-1 text-[10px] text-neutral-500">Latest 200 scanner events</p></div><div className="divide-y divide-white/[0.05]">{scans.length===0?<p className="p-6 text-center text-xs text-neutral-500">No scans recorded.</p>:scans.map(scan=><div key={scan.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"><div><p className="text-xs text-neutral-200">{scan.holder_name || 'Unknown token'}</p><p className="mt-0.5 text-[10px] text-neutral-500">{scan.gate_location} · {new Date(scan.scanned_at).toLocaleString()}</p></div><span className={'rounded border px-2 py-1 text-[9px] uppercase '+(scan.result==='valid_checkin'?'border-emerald-400/20 text-emerald-300':scan.result==='duplicate_recent'?'border-amber-400/20 text-amber-200':'border-rose-400/20 text-rose-300')}>{scan.result.replaceAll('_',' ')}</span></div>)}</div></section>}

    {issuedPass?.token_value && <div className="fixed inset-0 z-[120] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Issued QR pass"><div className="w-full max-w-sm rounded-lg border border-[#d4af37]/25 bg-[#101012] p-5 text-center"><button type="button" onClick={()=>setIssuedPass(null)} className="ml-auto block text-xs text-neutral-400 hover:text-white">Close</button><div className="mx-auto mt-3 inline-block rounded bg-white p-3"><QRCodeSVG value={issuedPass.token_value} size={220} level="H" includeMargin/></div><h3 className="mt-4 text-lg font-semibold text-neutral-100">{issuedPass.holder_name}</h3><p className="mt-1 text-xs text-neutral-400">{issuedPass.role_label}</p><p className="mt-3 break-all font-mono text-[10px] text-neutral-500">{issuedPass.token_value}</p><button type="button" onClick={()=>window.print()} className="mt-4 inline-flex h-9 items-center gap-2 rounded bg-[#d4af37] px-4 text-xs font-semibold text-black"><Download className="h-3.5 w-3.5"/> Print QR pass</button></div></div>}
  </div>;
}
