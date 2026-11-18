import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function makeOpaqueToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `WMQR-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

async function fingerprintToken(token: string): Promise<string> {
  const normalized = String(token || "").trim().toLowerCase();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function maskToken(token: string | null | undefined): string {
  const clean = String(token || "").trim();
  if (!clean) return "";
  if (clean.length <= 8) return `${clean.slice(0, 2)}••••`;
  return `${clean.slice(0, 5)}••••${clean.slice(-4)}`;
}

function getCategoryForRole(role: string): string {
  switch (role) {
    case "super_admin":
    case "admin":
      return "Executive";
    case "department_head":
      return "Department Head";
    case "executive_board":
      return "Executive Board";
    default:
      return "Staff";
  }
}

function normalizeDeptSlug(value: string | null | undefined): string {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return "";
  if (clean === "human-resources" || clean === "human_resources") return "hr";
  if (clean === "delegate-affairs" || clean === "delegate_affairs") return "dcc";
  if (clean === "media-press") return "media";
  if (clean === "volunteer") return "volunteers";
  return clean;
}

function extractCommitteeName(app: any): string | null {
  if (!app) return null;
  if (String(app.application_type || "").toLowerCase() !== "delegate") return null;
  const pos = String(app.position || "").trim();
  if (pos && pos.toLowerCase() !== "delegate") return pos;
  if (Array.isArray(app.answers)) {
    const found = app.answers.find((entry: any) =>
      String(entry?.label || "").toLowerCase().includes("committee") && String(entry?.answer || "").trim()
    );
    if (found) return String(found.answer).trim();
  }
  return pos || null;
}

function isRpcMissingError(error: any): boolean {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toUpperCase();
  return (
    code === "42883" ||
    code === "PGRST202" ||
    msg.includes("wm_atomic_qr_checkin") && (msg.includes("does not exist") || msg.includes("could not find"))
  );
}

function isColumnOrTableMissingError(error: any): boolean {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toUpperCase();
  return (
    code === "42703" ||
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the")
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server configuration incomplete." }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Authentication required." }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Invalid or expired session." }, 401);

  const { data: actor, error: actorError } = await admin
    .from("wm_profiles")
    .select("user_id,full_name,role,department_id,title,division,is_active,permissions,eb_permissions")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (actorError || !actor || actor.is_active !== true) {
    return json({ error: "Active staff profile required." }, 403);
  }

  // Load departments so UUID department_id values resolve to canonical slugs reliably
  const { data: deptRows } = await admin
    .from("wm_departments")
    .select("id,slug,name");

  const deptByKey = new Map<string, { id: string; slug: string; name: string }>();
  for (const d of deptRows || []) {
    deptByKey.set(String(d.id), d);
    deptByKey.set(String(d.slug).toLowerCase(), d);
    deptByKey.set(normalizeDeptSlug(d.slug), d);
  }

  const actorDeptRecord = actor.department_id
    ? deptByKey.get(String(actor.department_id)) || deptByKey.get(normalizeDeptSlug(String(actor.department_id)))
    : undefined;
  const actorDeptSlug = actorDeptRecord
    ? normalizeDeptSlug(actorDeptRecord.slug)
    : normalizeDeptSlug(actor.department_id);

  const actorPermissions = (actor.permissions && typeof actor.permissions === "object")
    ? (actor.permissions as Record<string, unknown>)
    : {};
  const actorEbPermissions = (actor.eb_permissions && typeof actor.eb_permissions === "object")
    ? (actor.eb_permissions as Record<string, unknown>)
    : {};

  const isSuperAdmin = actor.role === "super_admin";
  const isAdmin = isSuperAdmin || actor.role === "admin";

  const isSecurityHead =
    actor.role === "department_head" &&
    actorDeptSlug === "security" &&
    actorPermissions["qr.scan"] !== false;

  const isSecurityEb =
    actor.role === "executive_board" &&
    (
      (actorDeptSlug === "security" && actorPermissions["qr.scan"] !== false) ||
      actorPermissions["qr.scan"] === true ||
      actorEbPermissions["scan_qr"] === true
    );

  const canAdminScan = isSuperAdmin || (actor.role === "admin" && actorPermissions["qr.scan"] !== false);
  const canAdminManage = isSuperAdmin || (actor.role === "admin" && actorPermissions["qr.manage"] !== false);
  const canScan = canAdminScan || isSecurityHead || isSecurityEb;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const action = String(body?.action || "");
  const attendanceAction = String(body?.attendance_action || "checkin") === "checkout" ? "checkout" : "checkin";

  // --------------------------------------------------------------------------
  // 1. Personal QR Credential (any active staff user; ignores client user_id)
  // --------------------------------------------------------------------------
  if (action === "my_pass") {
    const { data: existing, error: fetchError } = await admin
      .from("wm_qr_passes")
      .select(
        "id,user_id,application_id,holder_name,holder_email,role_label,category,department_id,active,checked_in_at,checked_in_gate,checked_out_at,checked_out_gate,token_value,created_at",
      )
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (fetchError) return json({ error: fetchError.message }, 400);
    if (existing) return json({ pass: existing });

    const { data: inserted, error: insertError } = await admin
      .from("wm_qr_passes")
      .insert({
        user_id: authData.user.id,
        holder_name: actor.full_name || authData.user.email || "Willow Member",
        holder_email: authData.user.email || null,
        role_label: actor.title || actor.role.replaceAll("_", " "),
        category: getCategoryForRole(actor.role),
        department_id: actor.department_id || null,
        active: true,
        token_value: makeOpaqueToken(),
      })
      .select(
        "id,user_id,application_id,holder_name,holder_email,role_label,category,department_id,active,checked_in_at,checked_in_gate,token_value,created_at",
      )
      .single();

    if (insertError) return json({ error: insertError.message }, 400);
    return json({ pass: inserted });
  }

  // --------------------------------------------------------------------------
  // 2. Live QR Verification & Atomic Check-In (Admin or Security Scanner)
  //    Never trusts QR-encoded claims; validates server-side against Supabase.
  // --------------------------------------------------------------------------
  if (action === "verify" || action === "checkin" || action === "scan") {
    if (!canScan) {
      return json({ error: "Only authorized Administrators or Security accounts may verify QR passes." }, 403);
    }

    const scannedToken = String(body?.token || "").trim();
    const gateLocation = String(body?.gate_location || "Main Entrance").trim() || "Main Entrance";
    const shouldCommit = action !== "verify";

    if (!scannedToken) {
      return json({ error: "QR pass token is required." }, 400);
    }

    const scannerName = actor.full_name || authData.user.email || "Willow Scanner";
    const scannerRole = actor.role;

    const sanitizePayload = (rawPayload: Record<string, any>) => {
      const base = {
        status: rawPayload.status,
        result: rawPayload.result,
        message: rawPayload.message,
        pass_id: rawPayload.pass_id ?? null,
        holder_name: rawPayload.holder_name ?? null,
        role_label: rawPayload.role_label ?? null,
        category: rawPayload.category ?? null,
        department_name: rawPayload.department_name ?? null,
        committee_name: rawPayload.committee_name ?? null,
        application_code: rawPayload.application_code ?? null,
        pass_active: rawPayload.pass_active ?? null,
        checked_in_at: rawPayload.checked_in_at ?? null,
        checked_in_gate: rawPayload.checked_in_gate ?? null,
        checked_in_by_name: rawPayload.checked_in_by_name ?? null,
        checked_out_at: rawPayload.checked_out_at ?? null,
        checked_out_gate: rawPayload.checked_out_gate ?? null,
        prior_checkout_count: rawPayload.prior_checkout_count ?? 0,
        checked_out_at: rawPayload.checked_out_at ?? null,
        checked_out_gate: rawPayload.checked_out_gate ?? null,
        prior_checkout_count: rawPayload.prior_checkout_count ?? 0,
        gate_location: rawPayload.gate_location ?? gateLocation,
        scanned_at: rawPayload.scanned_at ?? new Date().toISOString(),
        committed: shouldCommit,
      };
      if (!isAdmin) {
        // Security receives strictly the minimum fields needed for entrance verification.
        return base;
      }
      return {
        ...base,
        application_id: rawPayload.application_id ?? null,
        application_status: rawPayload.application_status ?? null,
        department_id: rawPayload.department_id ?? null,
        user_id: rawPayload.user_id ?? null,
      };
    };

    // Check-out uses a separate row-locked RPC so repeat departures are confirmed safely.
    if (attendanceAction === "checkout") {
      const { data: checkoutResult, error: checkoutError } = await admin.rpc("wm_atomic_qr_checkout", {
        p_token: scannedToken, p_gate_location: gateLocation, p_scanner_id: authData.user.id,
        p_scanner_name: scannerName, p_scanner_role: scannerRole, p_commit: shouldCommit,
        p_confirm_repeat: body?.confirm_repeat === true,
      });
      if (checkoutError) return json({ error: checkoutError.message || "Check-out failed." }, 400);
      if (checkoutResult) return json(sanitizePayload(checkoutResult as Record<string, any>));
      return json({ error: "Check-out could not be completed." }, 400);
    }

    // Primary path: atomic row-locked PostgreSQL RPC
    const { data: rpcResult, error: rpcError } = await admin.rpc("wm_atomic_qr_checkin", {
      p_token: scannedToken,
      p_gate_location: gateLocation,
      p_scanner_id: authData.user.id,
      p_scanner_name: scannerName,
      p_scanner_role: scannerRole,
      p_commit: shouldCommit,
    });

    if (!rpcError && rpcResult) {
      return json(sanitizePayload(rpcResult as Record<string, any>));
    }

    if (rpcError && !isRpcMissingError(rpcError)) {
      return json({ error: rpcError.message || "Verification failed." }, 400);
    }

    // Fallback path when migration 20261118170000 has not yet been pushed to remote Postgres
    const { data: passRow, error: passFetchErr } = await admin
      .from("wm_qr_passes")
      .select("id,user_id,application_id,holder_name,role_label,category,department_id,active,checked_in_at,checked_in_gate,token_value")
      .ilike("token_value", scannedToken)
      .maybeSingle();

    if (passFetchErr) return json({ error: passFetchErr.message }, 400);

    const nowIso = new Date().toISOString();

    const logScanFallback = async (entry: Record<string, unknown>) => {
      const tokenFingerprint = await fingerprintToken(scannedToken);
      const { error: extErr } = await admin.from("wm_qr_scans").insert({
        ...entry,
        token_fingerprint: tokenFingerprint,
      });
      if (extErr && isColumnOrTableMissingError(extErr)) {
        // Older wm_qr_scans schema fallback
        const safeResult =
          entry.result === "already_checked_in" || entry.result === "not_eligible"
            ? entry.result === "already_checked_in"
              ? "duplicate_recent"
              : "revoked_pass"
            : entry.result;
        await admin.from("wm_qr_scans").insert({
          pass_id: entry.pass_id ?? null,
          holder_name: entry.holder_name ?? null,
          result: safeResult,
          gate_location: entry.gate_location,
          scanned_by: entry.scanned_by,
          scanned_at: entry.scanned_at,
        });
      }
    };

    if (!passRow) {
      await logScanFallback({
        pass_id: null,
        holder_name: null,
        result: "invalid_token",
        gate_location: gateLocation,
        scanned_by: authData.user.id,
        scanned_by_name: scannerName,
        scanner_role: scannerRole,
        scanned_at: nowIso,
        token_value_masked: maskToken(scannedToken),
        detail_message: "No issued pass matches this QR token.",
      });
      return json(
        sanitizePayload({
          status: "invalid",
          result: "invalid_token",
          message: "QR code does not match any issued Willow MUN pass.",
          gate_location: gateLocation,
          scanned_at: nowIso,
        }),
      );
    }

    let appRow: any = null;
    let eligible = true;
    let ineligibleReason: string | null = null;

    if (passRow.application_id) {
      const { data: fetchedApp } = await admin
        .from("wm_applications")
        .select("id,application_code,application_type,department_id,position,answers,status")
        .eq("id", passRow.application_id)
        .maybeSingle();
      appRow = fetchedApp;
      if (!appRow) {
        eligible = false;
        ineligibleReason = "Linked application record could not be found.";
      } else if (String(appRow.status || "").toLowerCase() !== "accepted") {
        eligible = false;
        ineligibleReason = `Applicant status is "${appRow.status || "unknown"}" (accepted required).`;
      }
    }

    if (eligible && passRow.user_id) {
      const { data: staffProfile } = await admin
        .from("wm_profiles")
        .select("user_id,is_active")
        .eq("user_id", passRow.user_id)
        .maybeSingle();
      if (!staffProfile || staffProfile.is_active !== true) {
        eligible = false;
        ineligibleReason = "Staff account is inactive or no longer provisioned.";
      }
    }

    const deptName =
      (passRow.department_id && deptByKey.get(String(passRow.department_id))?.name) ||
      (appRow?.department_id && deptByKey.get(String(appRow.department_id))?.name) ||
      (appRow?.application_type && deptByKey.get(normalizeDeptSlug(String(appRow.application_type)))?.name) ||
      null;
    const committeeName = extractCommitteeName(appRow);

    if (passRow.active !== true) {
      const msg = "This pass has been revoked or deactivated by an administrator.";
      await logScanFallback({
        pass_id: passRow.id,
        holder_name: passRow.holder_name,
        result: "revoked_pass",
        gate_location: gateLocation,
        scanned_by: authData.user.id,
        scanned_by_name: scannerName,
        scanner_role: scannerRole,
        scanned_at: nowIso,
        application_id: passRow.application_id ?? null,
        application_code: appRow?.application_code ?? null,
        department_name: deptName,
        committee_name: committeeName,
        detail_message: msg,
      });
      return json(
        sanitizePayload({
          status: "revoked",
          result: "revoked_pass",
          message: msg,
          pass_id: passRow.id,
          holder_name: passRow.holder_name,
          role_label: passRow.role_label,
          category: passRow.category,
          department_id: passRow.department_id,
          department_name: deptName,
          committee_name: committeeName,
          application_id: passRow.application_id,
          application_code: appRow?.application_code ?? null,
          application_status: appRow?.status ?? null,
          user_id: passRow.user_id,
          pass_active: false,
          checked_in_at: passRow.checked_in_at,
          checked_in_gate: passRow.checked_in_gate,
          gate_location: gateLocation,
          scanned_at: nowIso,
        }),
      );
    }

    if (!eligible) {
      const msg = ineligibleReason || "Applicant is not eligible for conference entry.";
      await logScanFallback({
        pass_id: passRow.id,
        holder_name: passRow.holder_name,
        result: "not_eligible",
        gate_location: gateLocation,
        scanned_by: authData.user.id,
        scanned_by_name: scannerName,
        scanner_role: scannerRole,
        scanned_at: nowIso,
        application_id: passRow.application_id ?? null,
        application_code: appRow?.application_code ?? null,
        department_name: deptName,
        committee_name: committeeName,
        detail_message: msg,
      });
      return json(
        sanitizePayload({
          status: "not_eligible",
          result: "not_eligible",
          message: msg,
          pass_id: passRow.id,
          holder_name: passRow.holder_name,
          role_label: passRow.role_label,
          category: passRow.category,
          department_id: passRow.department_id,
          department_name: deptName,
          committee_name: committeeName,
          application_id: passRow.application_id,
          application_code: appRow?.application_code ?? null,
          application_status: appRow?.status ?? null,
          user_id: passRow.user_id,
          pass_active: true,
          checked_in_at: passRow.checked_in_at,
          checked_in_gate: passRow.checked_in_gate,
          gate_location: gateLocation,
          scanned_at: nowIso,
        }),
      );
    }

    if (passRow.checked_in_at) {
      const msg = `Pass already checked in at ${passRow.checked_in_gate || "Entrance"}.`;
      await logScanFallback({
        pass_id: passRow.id,
        holder_name: passRow.holder_name,
        result: "already_checked_in",
        gate_location: gateLocation,
        scanned_by: authData.user.id,
        scanned_by_name: scannerName,
        scanner_role: scannerRole,
        scanned_at: nowIso,
        application_id: passRow.application_id ?? null,
        application_code: appRow?.application_code ?? null,
        department_name: deptName,
        committee_name: committeeName,
        previous_checked_in_at: passRow.checked_in_at,
        previous_checked_in_gate: passRow.checked_in_gate,
        detail_message: msg,
      });
      return json(
        sanitizePayload({
          status: "already_checked_in",
          result: "already_checked_in",
          message: msg,
          pass_id: passRow.id,
          holder_name: passRow.holder_name,
          role_label: passRow.role_label,
          category: passRow.category,
          department_id: passRow.department_id,
          department_name: deptName,
          committee_name: committeeName,
          application_id: passRow.application_id,
          application_code: appRow?.application_code ?? null,
          application_status: appRow?.status ?? null,
          user_id: passRow.user_id,
          pass_active: true,
          checked_in_at: passRow.checked_in_at,
          checked_in_gate: passRow.checked_in_gate,
          gate_location: gateLocation,
          scanned_at: nowIso,
        }),
      );
    }

    if (!shouldCommit) {
      return json(
        sanitizePayload({
          status: "valid",
          result: "valid_preview",
          message: "Pass verified. Confirm to record entry check-in.",
          pass_id: passRow.id,
          holder_name: passRow.holder_name,
          role_label: passRow.role_label,
          category: passRow.category,
          department_id: passRow.department_id,
          department_name: deptName,
          committee_name: committeeName,
          application_id: passRow.application_id,
          application_code: appRow?.application_code ?? null,
          application_status: appRow?.status ?? null,
          user_id: passRow.user_id,
          pass_active: true,
          checked_in_at: null,
          checked_in_gate: null,
          gate_location: gateLocation,
          scanned_at: nowIso,
        }),
      );
    }

    // Conditional atomic update prevents race-condition duplicate check-ins
    let updatedPass: any = null;
    const { data: extUpdated, error: extUpdErr } = await admin
      .from("wm_qr_passes")
      .update({
        checked_in_at: nowIso,
        checked_in_gate: gateLocation,
        checked_in_by: authData.user.id,
        checked_in_by_name: scannerName,
      })
      .eq("id", passRow.id)
      .eq("active", true)
      .is("checked_in_at", null)
      .select()
      .maybeSingle();

    if (extUpdErr && isColumnOrTableMissingError(extUpdErr)) {
      const { data: baseUpdated } = await admin
        .from("wm_qr_passes")
        .update({ checked_in_at: nowIso, checked_in_gate: gateLocation })
        .eq("id", passRow.id)
        .eq("active", true)
        .is("checked_in_at", null)
        .select()
        .maybeSingle();
      updatedPass = baseUpdated;
    } else if (extUpdErr) {
      return json({ error: extUpdErr.message }, 400);
    } else {
      updatedPass = extUpdated;
    }

    if (!updatedPass) {
      // Another simultaneous scan won the conditional update
      const { data: latestPass } = await admin
        .from("wm_qr_passes")
        .select("checked_in_at,checked_in_gate")
        .eq("id", passRow.id)
        .maybeSingle();
      const msg = "Pass was just checked in at another scanner.";
      await logScanFallback({
        pass_id: passRow.id,
        holder_name: passRow.holder_name,
        result: "already_checked_in",
        gate_location: gateLocation,
        scanned_by: authData.user.id,
        scanned_by_name: scannerName,
        scanner_role: scannerRole,
        scanned_at: nowIso,
        previous_checked_in_at: latestPass?.checked_in_at ?? null,
        previous_checked_in_gate: latestPass?.checked_in_gate ?? null,
        detail_message: msg,
      });
      return json(
        sanitizePayload({
          status: "already_checked_in",
          result: "already_checked_in",
          message: msg,
          pass_id: passRow.id,
          holder_name: passRow.holder_name,
          role_label: passRow.role_label,
          category: passRow.category,
          department_id: passRow.department_id,
          department_name: deptName,
          committee_name: committeeName,
          application_id: passRow.application_id,
          application_code: appRow?.application_code ?? null,
          application_status: appRow?.status ?? null,
          user_id: passRow.user_id,
          pass_active: true,
          checked_in_at: latestPass?.checked_in_at ?? null,
          checked_in_gate: latestPass?.checked_in_gate ?? null,
          gate_location: gateLocation,
          scanned_at: nowIso,
        }),
      );
    }

    await logScanFallback({
      pass_id: passRow.id,
      holder_name: passRow.holder_name,
      result: "valid_checkin",
      gate_location: gateLocation,
      scanned_by: authData.user.id,
      scanned_by_name: scannerName,
      scanner_role: scannerRole,
      scanned_at: nowIso,
      application_id: passRow.application_id ?? null,
      application_code: appRow?.application_code ?? null,
      department_name: deptName,
      committee_name: committeeName,
      detail_message: "Entry approved and check-in recorded.",
    });

    return json(
      sanitizePayload({
        status: "valid",
        result: "valid_checkin",
        message: "Entry approved and check-in recorded.",
        pass_id: updatedPass.id,
        holder_name: updatedPass.holder_name,
        role_label: updatedPass.role_label,
        category: updatedPass.category,
        department_id: updatedPass.department_id,
        department_name: deptName,
        committee_name: committeeName,
        application_id: updatedPass.application_id,
        application_code: appRow?.application_code ?? null,
        application_status: appRow?.status ?? null,
        user_id: updatedPass.user_id,
        pass_active: true,
        checked_in_at: updatedPass.checked_in_at,
        checked_in_gate: updatedPass.checked_in_gate,
        checked_in_by_name: scannerName,
        gate_location: gateLocation,
        scanned_at: nowIso,
      }),
    );
  }

  // --------------------------------------------------------------------------
  // 3. Security Recent Scans Feed (Scoped strictly to authenticated scanner)
  // --------------------------------------------------------------------------
  if (action === "my_scans") {
    if (!canScan) {
      return json({ error: "Scanner permission required." }, 403);
    }

    let rows: any[] = [];
    const { data: extRows, error: extErr } = await admin
      .from("wm_qr_scans")
      .select(
        "id,pass_id,holder_name,result,gate_location,scanned_at,scanned_by_name,application_code,department_name,committee_name,previous_checked_in_at,previous_checked_in_gate,detail_message",
      )
      .eq("scanned_by", authData.user.id)
      .order("scanned_at", { ascending: false })
      .limit(50);

    if (extErr && isColumnOrTableMissingError(extErr)) {
      const { data: baseRows, error: baseErr } = await admin
        .from("wm_qr_scans")
        .select("id,pass_id,holder_name,result,gate_location,scanned_at")
        .eq("scanned_by", authData.user.id)
        .order("scanned_at", { ascending: false })
        .limit(50);
      if (baseErr) return json({ error: baseErr.message }, 400);
      rows = baseRows || [];
    } else if (extErr) {
      return json({ error: extErr.message }, 400);
    } else {
      rows = extRows || [];
    }

    return json({ scans: rows });
  }

  if (action === "reset_all_attendance") {
    if (!isSuperAdmin) return json({ error: "Only the Super Admin can reset all attendance records." }, 403);
    const actorName = actor.full_name || authData.user.email || "Super Admin";
    const { data: attendanceRows, error: scanReadError } = await admin.from("wm_qr_scans").select("id,result").in("result", ["valid_checkin", "valid_checkout"]);
    if (scanReadError) return json({ error: scanReadError.message }, 400);
    const checkinsCleared = (attendanceRows || []).filter((row: any) => row.result === "valid_checkin").length;
    const checkoutsCleared = (attendanceRows || []).filter((row: any) => row.result === "valid_checkout").length;
    const { data: resetPasses, error: resetError } = await admin.from("wm_qr_passes").update({
      checked_in_at: null, checked_in_gate: null, checked_in_by: null, checked_in_by_name: null,
      checked_out_at: null, checked_out_gate: null, checked_out_by: null, checked_out_by_name: null,
    }).not("id", "is", null).select("id");
    if (resetError) return json({ error: resetError.message }, 400);
    const { error: clearError } = await admin.from("wm_qr_scans").delete().in("result", ["valid_checkin", "valid_checkout"]);
    if (clearError) return json({ error: clearError.message }, 400);
    const { error: auditError } = await admin.from("wm_qr_attendance_resets").insert({
      reset_by: authData.user.id, reset_by_name: actorName, reset_by_role: actor.role,
      passes_reset: (resetPasses || []).length, checkins_cleared: checkinsCleared, checkouts_cleared: checkoutsCleared,
    });
    if (auditError) return json({ error: "Attendance reset, but audit write failed: " + auditError.message }, 500);
    return json({ success: true, passes_reset: (resetPasses || []).length, checkins_cleared: checkinsCleared, checkouts_cleared: checkoutsCleared });
  }

  // Strictly block Security, Department Heads, and non-Admin roles from administrative registry & corrections
  if (!canAdminManage) {
    return json({ error: "Pass registry management is restricted to Administrators." }, 403);
  }

  // --------------------------------------------------------------------------
  // 4. Admin Registry & Stats (Passes + Application IDs/Statuses + Metrics)
  // --------------------------------------------------------------------------
  if (action === "list") {
    let passes: any[] = [];
    const { data: extPasses, error: extErr } = await admin
      .from("wm_qr_passes")
      .select(
        "id,user_id,application_id,holder_name,holder_email,role_label,category,department_id,active,checked_in_at,checked_in_gate,checked_out_at,checked_out_gate,checked_out_by,checked_out_by_name,checked_in_by,checked_in_by_name,revoked_at,revoke_reason,token_value,created_at",
      )
      .order("created_at", { ascending: false });

    if (extErr && isColumnOrTableMissingError(extErr)) {
      const { data: basePasses, error: baseErr } = await admin
        .from("wm_qr_passes")
        .select(
          "id,user_id,application_id,holder_name,holder_email,role_label,category,department_id,active,checked_in_at,checked_in_gate,token_value,created_at",
        )
        .order("created_at", { ascending: false });
      if (baseErr) return json({ error: baseErr.message }, 400);
      passes = basePasses || [];
    } else if (extErr) {
      return json({ error: extErr.message }, 400);
    } else {
      passes = extPasses || [];
    }

    const appIds = Array.from(
      new Set(passes.map((p) => p.application_id).filter((id): id is string => Boolean(id))),
    );
    const appById = new Map<string, any>();
    if (appIds.length > 0) {
      const { data: apps } = await admin
        .from("wm_applications")
        .select("id,application_code,application_type,department_id,position,answers,status")
        .in("id", appIds);
      for (const a of apps || []) {
        appById.set(String(a.id), a);
      }
    }

    const enriched = passes.map((p) => {
      const app = p.application_id ? appById.get(String(p.application_id)) : null;
      const deptName =
        (p.department_id && deptByKey.get(String(p.department_id))?.name) ||
        (app?.department_id && deptByKey.get(String(app.department_id))?.name) ||
        (app?.application_type && deptByKey.get(normalizeDeptSlug(String(app.application_type)))?.name) ||
        null;
      return {
        ...p,
        application_code: app?.application_code ?? null,
        application_status: app?.status ?? null,
        department_name: deptName,
        committee_name: extractCommitteeName(app),
      };
    });

    const totalIssued = enriched.length;
    const activePasses = enriched.filter((p) => p.active !== false);
    const checkedInCount = activePasses.filter((p) => Boolean(p.checked_in_at)).length;
    const remainingCount = activePasses.filter((p) => !p.checked_in_at).length;
    const revokedCount = enriched.filter((p) => p.active === false).length;

    return json({
      passes: enriched,
      metrics: {
        total_issued: totalIssued,
        active_issued: activePasses.length,
        checked_in: checkedInCount,
        remaining: remainingCount,
        revoked: revokedCount,
      },
    });
  }

  if (action === "scan_log") {
    let scans: any[] = [];
    const { data: extScans, error: extErr } = await admin
      .from("wm_qr_scans")
      .select(
        "id,pass_id,holder_name,result,gate_location,scanned_at,scanned_by,scanned_by_name,scanner_role,token_value_masked,application_id,application_code,department_name,committee_name,previous_checked_in_at,previous_checked_in_gate,detail_message",
      )
      .order("scanned_at", { ascending: false })
      .limit(300);

    if (extErr && isColumnOrTableMissingError(extErr)) {
      const { data: baseScans, error: baseErr } = await admin
        .from("wm_qr_scans")
        .select("id,holder_name,result,gate_location,scanned_at,scanned_by,pass_id")
        .order("scanned_at", { ascending: false })
        .limit(300);
      if (baseErr) return json({ error: baseErr.message }, 400);
      scans = baseScans || [];
    } else if (extErr) {
      return json({ error: extErr.message }, 400);
    } else {
      scans = extScans || [];
    }

    return json({ scans });
  }

  if (action === "correction_logs") {
    const { data: logs, error: logsErr } = await admin
      .from("wm_qr_correction_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (logsErr) {
      if (isColumnOrTableMissingError(logsErr)) {
        return json({ logs: [], migration_pending: true });
      }
      return json({ error: logsErr.message }, 400);
    }
    return json({ logs: logs || [] });
  }

  // --------------------------------------------------------------------------
  // 5. Administrative Check-In Corrections with Mandatory Reason & Audit Log
  // --------------------------------------------------------------------------
  if (action === "correct_checkin") {
    const passId = String(body?.pass_id || "").trim();
    const correctionAction = String(body?.correction_action || "").trim();
    const reason = String(body?.reason || "").trim();
    const gateLocation = String(body?.gate_location || "Admin Desk").trim() || "Admin Desk";

    if (!passId) return json({ error: "pass_id is required." }, 400);
    if (!["reset_checkin", "manual_checkin", "update_gate"].includes(correctionAction)) {
      return json({ error: "Invalid correction action." }, 400);
    }
    if (reason.length < 3) {
      return json({ error: "A clear audit reason (at least 3 characters) is required." }, 400);
    }

    const { data: existing, error: fetchErr } = await admin
      .from("wm_qr_passes")
      .select("*")
      .eq("id", passId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return json({ error: fetchErr?.message || "Pass not found." }, 404);
    }

    const nowIso = new Date().toISOString();
    const actorName = actor.full_name || authData.user.email || "Administrator";

    let patch: Record<string, unknown> = {};
    if (correctionAction === "reset_checkin") {
      patch = {
        checked_in_at: null,
        checked_in_gate: null,
        checked_in_by: null,
        checked_in_by_name: null,
      };
    } else if (correctionAction === "manual_checkin") {
      if (existing.active !== true) {
        return json({ error: "Cannot check in a revoked pass. Reactivate the pass first." }, 400);
      }
      patch = {
        checked_in_at: existing.checked_in_at || nowIso,
        checked_in_gate: gateLocation,
        checked_in_by: authData.user.id,
        checked_in_by_name: actorName,
      };
    } else if (correctionAction === "update_gate") {
      if (!existing.checked_in_at) {
        return json({ error: "Cannot update gate before attendee has checked in." }, 400);
      }
      patch = {
        checked_in_gate: gateLocation,
      };
    }

    let updated: any = null;
    const { data: extUpdated, error: extUpdErr } = await admin
      .from("wm_qr_passes")
      .update(patch)
      .eq("id", passId)
      .select()
      .single();

    if (extUpdErr && isColumnOrTableMissingError(extUpdErr)) {
      const basePatch: Record<string, unknown> = {
        checked_in_at: patch.checked_in_at !== undefined ? patch.checked_in_at : existing.checked_in_at,
        checked_in_gate: patch.checked_in_gate !== undefined ? patch.checked_in_gate : existing.checked_in_gate,
      };
      const { data: baseUpdated, error: baseUpdErr } = await admin
        .from("wm_qr_passes")
        .update(basePatch)
        .eq("id", passId)
        .select()
        .single();
      if (baseUpdErr) return json({ error: baseUpdErr.message }, 400);
      updated = baseUpdated;
    } else if (extUpdErr) {
      return json({ error: extUpdErr.message }, 400);
    } else {
      updated = extUpdated;
    }

    const { error: auditErr } = await admin.from("wm_qr_correction_logs").insert({
      pass_id: existing.id,
      holder_name: existing.holder_name,
      application_id: existing.application_id ?? null,
      action_type: correctionAction,
      reason,
      previous_checked_in_at: existing.checked_in_at ?? null,
      previous_checked_in_gate: existing.checked_in_gate ?? null,
      previous_active: existing.active,
      new_checked_in_at: updated.checked_in_at ?? null,
      new_checked_in_gate: updated.checked_in_gate ?? null,
      new_active: updated.active,
      corrected_by: authData.user.id,
      corrected_by_name: actorName,
      corrected_by_role: actor.role,
      created_at: nowIso,
    });

    if (auditErr && !isColumnOrTableMissingError(auditErr)) {
      return json({ pass: updated, warning: `Updated pass, but audit log write failed: ${auditErr.message}` });
    }

    return json({ pass: updated });
  }

  if (action === "issue") {
    const holderName = String(body?.holder_name || "").trim();
    if (!holderName) return json({ error: "Holder name is required." }, 400);
    const { data: inserted, error } = await admin
      .from("wm_qr_passes")
      .insert({
        user_id: body?.user_id || null,
        application_id: body?.application_id || null,
        holder_name: holderName,
        holder_email: body?.holder_email ? String(body.holder_email).trim().toLowerCase() : null,
        role_label: String(body?.role_label || "Conference Participant").trim(),
        category: String(body?.category || "Delegate").trim(),
        department_id: body?.department_id || null,
        active: true,
        token_value: makeOpaqueToken(),
      })
      .select(
        "id,user_id,application_id,holder_name,holder_email,role_label,category,department_id,active,checked_in_at,checked_in_gate,token_value,created_at",
      )
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ pass: inserted }, 201);
  }

  if (action === "ensure_profile_passes") {
    const { data: profiles, error } = await admin
      .from("wm_profiles")
      .select("user_id,full_name,role,department_id,title,is_active");
    if (error) return json({ error: error.message }, 400);
    let createdCount = 0;
    for (const p of profiles || []) {
      const { data: existing } = await admin
        .from("wm_qr_passes")
        .select("id")
        .eq("user_id", p.user_id)
        .maybeSingle();
      if (!existing) {
        await admin.from("wm_qr_passes").insert({
          user_id: p.user_id,
          holder_name: p.full_name || "Willow Member",
          role_label: p.title || p.role.replaceAll("_", " "),
          category: getCategoryForRole(p.role),
          department_id: p.department_id || null,
          active: p.is_active !== false,
          token_value: makeOpaqueToken(),
        });
        createdCount += 1;
      }
    }
    return json({
      success: true,
      message: `Verified passes; ${createdCount} new profile pass(es) generated without altering existing tokens.`,
    });
  }

  if (action === "revoke" || action === "activate") {
    const passId = String(body?.pass_id || "").trim();
    const reason = String(body?.reason || "").trim() || (action === "revoke" ? "Revoked by administrator" : "Reactivated by administrator");
    if (!passId) return json({ error: "pass_id is required." }, 400);

    const { data: existing } = await admin
      .from("wm_qr_passes")
      .select("*")
      .eq("id", passId)
      .maybeSingle();
    if (!existing) return json({ error: "Pass not found." }, 404);

    const nowIso = new Date().toISOString();
    const actorName = actor.full_name || authData.user.email || "Administrator";
    const nextActive = action === "activate";

    let updated: any = null;
    const { data: extUpdated, error: extErr } = await admin
      .from("wm_qr_passes")
      .update({
        active: nextActive,
        revoked_at: nextActive ? null : nowIso,
        revoked_by: nextActive ? null : authData.user.id,
        revoke_reason: nextActive ? null : reason,
      })
      .eq("id", passId)
      .select()
      .single();

    if (extErr && isColumnOrTableMissingError(extErr)) {
      const { data: baseUpdated, error: baseErr } = await admin
        .from("wm_qr_passes")
        .update({ active: nextActive })
        .eq("id", passId)
        .select()
        .single();
      if (baseErr) return json({ error: baseErr.message }, 400);
      updated = baseUpdated;
    } else if (extErr) {
      return json({ error: extErr.message }, 400);
    } else {
      updated = extUpdated;
    }

    await admin.from("wm_qr_correction_logs").insert({
      pass_id: existing.id,
      holder_name: existing.holder_name,
      application_id: existing.application_id ?? null,
      action_type: nextActive ? "reactivate_pass" : "revoke_pass",
      reason,
      previous_checked_in_at: existing.checked_in_at ?? null,
      previous_checked_in_gate: existing.checked_in_gate ?? null,
      previous_active: existing.active,
      new_checked_in_at: updated.checked_in_at ?? null,
      new_checked_in_gate: updated.checked_in_gate ?? null,
      new_active: updated.active,
      corrected_by: authData.user.id,
      corrected_by_name: actorName,
      corrected_by_role: actor.role,
      created_at: nowIso,
    }).then(() => undefined, () => undefined);

    return json({ pass: updated });
  }

  return json({ error: "Unsupported action." }, 400);
});
