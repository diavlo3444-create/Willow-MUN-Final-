import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const cleanEmail = (v: unknown) => String(v || "").trim().toLowerCase();
const hash = async (token: string) => {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, "0")).join("");
};
const newToken = () => {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
};
const normalizeDept = (s: string) => {
  const x = s.trim().toLowerCase();
  if (x === "human-resources" || x === "human_resources") return "hr";
  if (x === "delegate-affairs" || x === "delegate_affairs") return "dcc";
  if (x === "media-press") return "media";
  if (x === "volunteer") return "volunteers";
  return x;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Server configuration incomplete." }, 500);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const action = String(body.action || "");

  if (action === "create_invite") {
    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!bearer) return json({ error: "HR session required." }, 401);
    const { data: userData, error: authErr } = await admin.auth.getUser(bearer);
    if (authErr || !userData.user) return json({ error: "Invalid session." }, 401);
    const { data: profile, error: profileErr } = await admin.from("wm_profiles")
      .select("role,department_id,title,division,is_active").eq("user_id", userData.user.id).maybeSingle();
    if (profileErr || !profile || profile.is_active !== true) return json({ error: "Active staff profile required." }, 403);
    let departmentSlug = normalizeDept(String(profile.department_id || ""));
    if (profile.department_id) {
      const { data: department } = await admin.from("wm_departments").select("slug").eq("id", profile.department_id).maybeSingle();
      if (department?.slug) departmentSlug = normalizeDept(department.slug);
    }
    const label = String(profile.title || "") + " " + String(profile.division || "");
    const isHr = profile.role === "admin" || profile.role === "super_admin" || departmentSlug === "hr" || /\bhr\b|human resources/i.test(label);
    if (!isHr) return json({ error: "HR or Admin access required." }, 403);
    const applicationId = String(body.application_id || "");
    if (!applicationId) return json({ error: "Application ID required." }, 400);
    const { data: app, error: appErr } = await admin.from("wm_applications")
      .select("id,applicant_name,email,application_type,department_id,position,status,gender")
      .eq("id", applicationId).maybeSingle();
    if (appErr || !app) return json({ error: "Applicant record not found." }, 404);
    if (app.status !== "accepted") return json({ error: "Only accepted applicants can receive signup links." }, 409);
    const email = cleanEmail(app.email);
    if (!email) return json({ error: "Application has no valid email." }, 400);
    const { data: previous, error: previousErr } = await admin.from("wm_hr_signup_invites")
      .select("id,claimed_at,token_value").eq("application_id", app.id).maybeSingle();
    if (previousErr) return json({ error: "Could not inspect previous signup link." }, 500);
    if (previous?.claimed_at) return json({ error: "Applicant has already claimed their signup link." }, 409);

    // Reuse the same link whenever possible. For legacy invites, add a second
    // accepted token instead of replacing the original hash, so old emails keep working.
    const token = previous?.token_value || newToken();
    const tokenHash = await hash(token);
    if (previous) {
      if (!previous.token_value) {
        const { error: tokenSaveErr } = await admin.from("wm_hr_signup_invites")
          .update({ token_value: token, issued_by: userData.user.id })
          .eq("id", previous.id);
        if (tokenSaveErr) return json({ error: "Could not preserve signup link." }, 500);
        const { error: aliasErr } = await admin.from("wm_hr_signup_invite_tokens")
          .insert({ invite_id: previous.id, token_hash: tokenHash, token_value: token });
        if (aliasErr) return json({ error: "Could not add resendable signup link." }, 500);
      }
    } else {
      const { error: inviteErr } = await admin.from("wm_hr_signup_invites").insert({
        application_id: app.id, token_hash: tokenHash, token_value: token, issued_by: userData.user.id,
      });
      if (inviteErr) return json({ error: "Could not create signup link." }, 500);
    }
    const origin = String(body.origin || req.headers.get("origin") || "https://willow-mun.vercel.app").replace(/\/$/, "");
    return json({ success: true, signup_url: `${origin}/team-signup?token=${encodeURIComponent(token)}`, email, full_name: app.applicant_name, position: app.position });
  }

  if (action === "signup") {
    const token = String(body.token || "").trim();
    const password = String(body.password || "");
    if (!/^[a-f0-9]{64}$/i.test(token)) return json({ error: "Signup link is invalid." }, 400);
    if (password.length < 10) return json({ error: "Password must be at least 10 characters." }, 400);
    const tokenHash = await hash(token);
    let { data: invite, error: lockErr } = await admin.from("wm_hr_signup_invites")
      .select("id,application_id,claimed_at").eq("token_hash", tokenHash).maybeSingle();
    if (lockErr) return json({ error: "Could not verify signup link. Please try again." }, 500);
    if (!invite) {
      const { data: alias, error: aliasErr } = await admin.from("wm_hr_signup_invite_tokens")
        .select("invite_id").eq("token_hash", tokenHash).maybeSingle();
      if (aliasErr) return json({ error: "Could not verify signup link. Please try again." }, 500);
      if (alias) {
        const parent = await admin.from("wm_hr_signup_invites")
          .select("id,application_id,claimed_at").eq("id", alias.invite_id).maybeSingle();
        invite = parent.data;
        lockErr = parent.error;
      }
    }
    if (lockErr || !invite) return json({ error: "Signup link not found. Ask HR to resend the invitation." }, 404);
    if (invite.claimed_at) return json({ error: "This applicant has already signed up. Please sign in instead." }, 409);
    const { data: claimable, error: claimLockErr } = await admin.from("wm_hr_signup_invites")
      .update({ claim_started_at: new Date().toISOString() })
      .eq("id", invite.id).is("claimed_at", null).select("id").maybeSingle();
    if (claimLockErr || !claimable) return json({ error: "This applicant has already signed up. Please sign in instead." }, 409);
    let createdId: string | null = null;
    try {
      const { data: app, error: appErr } = await admin.from("wm_applications")
        .select("id,applicant_name,email,application_type,department_id,position,status,gender")
        .eq("id", invite.application_id).maybeSingle();
      if (appErr || !app || app.status !== "accepted") throw new Error("Application is no longer accepted.");
      const email = cleanEmail(app.email);
      const { data: exists } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if ((exists?.users || []).some((u: any) => cleanEmail(u.email) === email)) throw new Error("An account already exists for this email. Contact HR.");
      let departmentId: string | null = null;
      const departmentRaw = String(app.department_id || app.application_type || "").trim();
      const deptSlug = normalizeDept(departmentRaw);
      const { data: dept } = await admin.from("wm_departments").select("id,slug,name").eq("slug", deptSlug).maybeSingle();
      if (dept) departmentId = dept.id;
      if (!departmentId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(departmentRaw)) {
        const { data: byId } = await admin.from("wm_departments").select("id,slug,name").eq("id", departmentRaw).maybeSingle();
        if (byId) departmentId = byId.id;
      }
      if (!departmentId) throw new Error("Applicant department is not configured.");
      const position = String(app.position || "Team Member").trim();
      const isHead = /\b(co[- ]?head|department head|head of|head)\b/i.test(position);
      const role = isHead ? "department_head" : "staff";
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: app.applicant_name },
      });
      if (createErr || !created.user) throw new Error("Auth account creation failed: " + (createErr?.message || "No user returned."));
      createdId = created.user.id;
      const { error: profileErr } = await admin.from("wm_profiles").upsert({
        user_id: createdId, full_name: app.applicant_name, role, department_id: departmentId,
        title: position, gender: app.gender || null, division: null, is_active: true, permissions: {}, eb_permissions: {},
      }, { onConflict: "user_id" });
      if (profileErr) throw new Error("Profile creation failed: " + profileErr.message);
      const { error: claimErr } = await admin.from("wm_hr_signup_invites").update({
        claimed_at: new Date().toISOString(), claimed_user_id: createdId, claim_started_at: null,
      }).eq("id", invite.id).is("claimed_at", null);
      if (claimErr) throw new Error("Invite claim update failed: " + claimErr.message);
      return json({ success: true, email, role, department_slug: dept?.slug || deptSlug, message: "Account created. Sign in to your assigned portal." });
    } catch (err) {
      if (createdId) await admin.auth.admin.deleteUser(createdId);
      await admin.from("wm_hr_signup_invites").update({ claim_started_at: null })
        .eq("id", invite.id).is("claimed_at", null);
      return json({ error: err instanceof Error ? err.message : "Signup failed." }, 400);
    }
  }
  return json({ error: "Unsupported action." }, 400);
});
