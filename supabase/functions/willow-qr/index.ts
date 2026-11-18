import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function makeOpaqueToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `WMQR-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server configuration incomplete." }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Authentication required." }, 401);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Invalid or expired session." }, 401);

  const { data: actor, error: actorError } = await admin
    .from("wm_profiles")
    .select("user_id,full_name,role,department_id,title,is_active")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (actorError || !actor || actor.is_active !== true) {
    return json({ error: "Active staff profile required." }, 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const action = String(body?.action || "");
  const isAdmin = actor.role === "super_admin" || actor.role === "admin";
  const isSecurityScanner = isAdmin || (actor.role === "executive_board" && String(actor.department_id || "").toLowerCase() === "security");

  // Every authenticated user can always retrieve or auto-provision ONLY their own permanent QR pass.
  // Any user_id in request body/query is strictly ignored to prevent URL/payload tampering.
  if (action === "my_pass") {
    const { data: existing, error: fetchError } = await admin
      .from("wm_qr_passes")
      .select("id,user_id,holder_name,holder_email,role_label,category,department_id,active,checked_in_at,checked_in_gate,token_value,created_at")
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
      .select("id,user_id,holder_name,holder_email,role_label,category,department_id,active,checked_in_at,checked_in_gate,token_value,created_at")
      .single();

    if (insertError) return json({ error: insertError.message }, 400);
    return json({ pass: inserted });
  }

  if (action === "scan") {
    if (!isSecurityScanner) {
      return json({ error: "Only Admins or authorized Security scanners can verify QR passes." }, 403);
    }
    const scannedToken = String(body?.token || "").trim();
    const gateLocation = String(body?.gate_location || "Main Entrance").trim();
    if (!scannedToken) return json({ error: "Pass token is required." }, 400);

    const { data: pass } = await admin
      .from("wm_qr_passes")
      .select("id,holder_name,role_label,category,department_id,active,checked_in_at,checked_in_gate")
      .eq("token_value", scannedToken)
      .maybeSingle();

    let result: "valid_checkin" | "duplicate_recent" | "revoked_pass" | "invalid_token" = "invalid_token";
    if (pass) {
      if (!pass.active) {
        result = "revoked_pass";
      } else if (pass.checked_in_at && Date.now() - Date.parse(pass.checked_in_at) <= 5 * 60 * 1000) {
        result = "duplicate_recent";
      } else {
        result = "valid_checkin";
        await admin
          .from("wm_qr_passes")
          .update({ checked_in_at: new Date().toISOString(), checked_in_gate: gateLocation })
          .eq("id", pass.id);
      }
    }

    await admin.from("wm_qr_scans").insert({
      pass_id: pass?.id || null,
      holder_name: pass?.holder_name || null,
      result,
      gate_location: gateLocation,
      scanned_by: authData.user.id,
      scanned_at: new Date().toISOString(),
    });

    return json({
      result,
      holder_name: pass?.holder_name || null,
      role_label: pass?.role_label || null,
      category: pass?.category || null,
      gate_location: gateLocation,
    });
  }

  // Strictly block Department Heads and non-Admin roles from pass registry / mass issuance / revocation
  if (!isAdmin) {
    return json({ error: "Pass registry management is restricted to Administrators." }, 403);
  }

  if (action === "list") {
    const { data: passes, error } = await admin
      .from("wm_qr_passes")
      .select("id,user_id,holder_name,holder_email,role_label,category,department_id,active,checked_in_at,checked_in_gate,token_value,created_at")
      .order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 400);
    return json({ passes: passes || [] });
  }

  if (action === "scan_log") {
    const { data: scans, error } = await admin
      .from("wm_qr_scans")
      .select("id,holder_name,result,gate_location,scanned_at,pass_id")
      .order("scanned_at", { ascending: false })
      .limit(200);
    if (error) return json({ error: error.message }, 400);
    return json({ scans: scans || [] });
  }

  if (action === "issue") {
    const holderName = String(body?.holder_name || "").trim();
    if (!holderName) return json({ error: "Holder name is required." }, 400);
    const { data: inserted, error } = await admin
      .from("wm_qr_passes")
      .insert({
        user_id: body?.user_id || null,
        holder_name: holderName,
        holder_email: body?.holder_email ? String(body.holder_email).trim().toLowerCase() : null,
        role_label: String(body?.role_label || "Conference Participant").trim(),
        category: String(body?.category || "Delegate").trim(),
        department_id: body?.department_id || null,
        active: true,
        token_value: makeOpaqueToken(),
      })
      .select("id,user_id,holder_name,holder_email,role_label,category,department_id,active,checked_in_at,checked_in_gate,token_value,created_at")
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ pass: inserted }, 201);
  }

  if (action === "ensure_profile_passes") {
    const { data: profiles, error } = await admin.from("wm_profiles").select("user_id,full_name,role,department_id,title,is_active");
    if (error) return json({ error: error.message }, 400);
    let createdCount = 0;
    for (const p of profiles || []) {
      const { data: existing } = await admin.from("wm_qr_passes").select("id").eq("user_id", p.user_id).maybeSingle();
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
    return json({ success: true, message: `Verified passes; ${createdCount} new profile pass(es) generated.` });
  }

  if (action === "revoke" || action === "activate") {
    const passId = String(body?.pass_id || "").trim();
    if (!passId) return json({ error: "pass_id is required." }, 400);
    const { data: updated, error } = await admin
      .from("wm_qr_passes")
      .update({ active: action === "activate" })
      .eq("id", passId)
      .select()
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ pass: updated });
  }

  return json({ error: "Unsupported action." }, 400);
});
