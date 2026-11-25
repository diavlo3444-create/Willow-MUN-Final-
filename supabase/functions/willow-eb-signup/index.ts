import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ORIGIN = "https://willow-mun.vercel.app";
const allowedOrigins = new Set([
  APP_ORIGIN,
  "https://thenrqgqunwjjsbceayn.supabase.co",
  "https://ais-dev-kkieazvdfq7e6qb6ncnbbe-432410478862.europe-west2.run.app",
  "https://ais-dev-t4pb3tcvqz2zwsalycrhv3-746878411539.europe-west2.run.app",
  "https://ais-pre-t4pb3tcvqz2zwsalycrhv3-746878411539.europe-west2.run.app",
]);
const corsFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : APP_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsFor(origin), "Content-Type": "application/json", "Cache-Control": "no-store" } });
const cleanEmail = (value: unknown) => String(value || "").trim().toLowerCase();
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+$/.test(value);
const SUPER_IT_ADMIN_EMAIL = "ahmedmagdialkik@gmail.com";
const ALL_PERMISSION_KEYS = [
  "applications.view", "applications.view_confidential", "applications.review", "applications.recommend",
  "applications.bulk_actions", "applications.notes", "applications.export", "applications.signup_links",
  "forms.manage", "departments.view_all", "departments.manage", "departments.assign_head",
  "departments.toggle_registration", "committees.manage", "secretariat.view", "secretariat.manage",
  "executive_board.manage", "sponsors.manage", "schedule.manage", "content.conference_assets",
  "departments.workspace", "operations.teams", "operations.shifts", "operations.deployment",
  "qr.view_pass", "qr.scan", "qr.manage", "website.view", "website.edit", "website.publish",
  "media.manage", "email.view", "email.send", "email.bulk_send", "inquiries.manage",
  "registration.view", "registration.manage", "reports.view", "reports.export", "logs.view",
  "system.settings", "system.monitoring", "accounts.view", "accounts.manage_admins",
  "accounts.manage_heads", "roles.manage", "permissions.manage", "testing.impersonate_head",
];
const buildSuperAdminPermissions = (): Record<string, boolean> =>
  Object.fromEntries(ALL_PERMISSION_KEYS.map((key) => [key, true]));

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { status: !origin || allowedOrigins.has(origin) ? 200 : 403, headers: corsFor(origin) });
  if (origin && !allowedOrigins.has(origin)) return json({ error: "This signup page is not authorized." }, 403, origin);
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Signup service is not configured." }, 500, origin);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid signup request." }, 400, origin); }
  const email = cleanEmail(body?.email);
  const password = String(body?.password || "");
  if (!validEmail(email)) return json({ error: "Enter the email address registered with the Executive Board." }, 400, origin);
  if (password.length < 10 || password.length > 128) return json({ error: "Password must be between 10 and 128 characters." }, 400, origin);

  const { data: roster, error: rosterError } = await admin.from("wm_eb_signup_allowlist")
    .select("email,email_aliases,member_key,full_name,title,phone_number,department_id,avatar_url,eb_rank,eb_permissions,permissions,claimed_at,claimed_user_id")
    .order("full_name");
  if (rosterError) return json({ error: "Could not check the Executive Board roster. Try again later." }, 500, origin);
  const matches = (roster || []).filter((entry: any) => [cleanEmail(entry.email), ...(entry.email_aliases || []).map(cleanEmail)].includes(email));
  if (matches.length !== 1) return json({ error: "That email is not listed in the approved Executive Board roster. Contact the Super Admin." }, 403, origin);
  const member = matches[0];
  if (member.claimed_at || member.claimed_user_id) return json({ error: "An account has already been created for this EB roster entry. Contact the Super Admin if you need access restored." }, 409, origin);

  const claimStartedAt = new Date().toISOString();
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: claimed, error: claimError } = await admin.from("wm_eb_signup_allowlist")
    .update({ claim_started_at: claimStartedAt })
    .eq("member_key", member.member_key).is("claimed_at", null)
    .or(`claim_started_at.is.null,claim_started_at.lt.${cutoff}`)
    .select("member_key").maybeSingle();
  if (claimError) return json({ error: "Could not reserve your EB roster profile. Try again later." }, 500, origin);
  if (!claimed) return json({ error: "This EB profile is already being connected. Try again in a moment." }, 409, origin);

  let createdUserId: string | null = null;
  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { signup_flow: "willow_eb" },
    });
    if (createError || !created.user) throw createError || new Error("Could not create the account.");
    createdUserId = created.user.id;

    const isSuperItAdmin = email === SUPER_IT_ADMIN_EMAIL;
    const assignedRole = isSuperItAdmin ? "super_admin" : "executive_board";
    const assignedTitle = isSuperItAdmin ? "Super IT Admin" : member.title;
    const assignedPermissions = isSuperItAdmin
      ? buildSuperAdminPermissions()
      : (member.permissions && typeof member.permissions === "object" ? member.permissions : {});

    const { error: profileError } = await admin.from("wm_profiles").upsert({
      user_id: createdUserId,
      full_name: member.full_name,
      role: assignedRole,
      department_id: member.department_id,
      is_active: true,
      title: assignedTitle,
      avatar_url: member.avatar_url || null,
      phone_number: member.phone_number || null,
      eb_rank: isSuperItAdmin ? "head" : (member.eb_rank || "member"),
      eb_permissions: isSuperItAdmin
        ? { ...(member.eb_permissions || {}), manage_department: true, manage_committees: true, scan_qr: true }
        : (member.eb_permissions || {}),
      permissions: assignedPermissions,
    }, { onConflict: "user_id" });
    if (profileError) throw profileError;

    const { data: finalized, error: finalizeError } = await admin.from("wm_eb_signup_allowlist")
      .update({ claimed_at: new Date().toISOString(), claimed_user_id: createdUserId, claim_started_at: null, invite_token_hash: null })
      .eq("member_key", member.member_key).eq("claim_started_at", claimStartedAt).is("claimed_at", null)
      .select("member_key").maybeSingle();
    if (finalizeError || !finalized) throw finalizeError || new Error("Could not finalize the EB roster claim.");
    return json({ success: true, email, role: assignedRole, title: assignedTitle, message: isSuperItAdmin ? "Your Super IT Admin account has been created." : "Your EB account has been created." }, 200, origin);
  } catch (error) {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
    await admin.from("wm_eb_signup_allowlist").update({ claim_started_at: null })
      .eq("member_key", member.member_key).eq("claim_started_at", claimStartedAt).is("claimed_at", null);
    const message = error instanceof Error ? error.message : "We could not create your account.";
    const duplicate = /already been registered|already exists|user already/i.test(message);
    return json({ error: duplicate ? "An account already exists for this email. Use EB login or contact the Super Admin." : message }, duplicate ? 409 : 400, origin);
  }
});
