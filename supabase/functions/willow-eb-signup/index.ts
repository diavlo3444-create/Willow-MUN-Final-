import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = "https://willow-mun.vercel.app";
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.headers.get("origin") && req.headers.get("origin") !== allowedOrigin) return json({ error: "This signup page is not authorized." }, 403);
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Signup service is not configured." }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (password.length < 10 || password.length > 128) return json({ error: "Password must be between 10 and 128 characters." }, 400);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: candidate, error: lookupError } = await admin.from("wm_eb_signup_allowlist")
    .select("email,email_aliases,member_key,full_name,title,phone_number,department_id,avatar_url,eb_rank,eb_permissions")
    .or(`email.eq.${email},email_aliases.cs.{${email}}`)
    .maybeSingle();
  if (lookupError) return json({ error: "Could not verify the signup record. Try again later." }, 500);
  if (!candidate) return json({ error: "This email is not on the approved EB roster." }, 403);

  const { data: invite, error: claimError } = await admin.from("wm_eb_signup_allowlist")
    .update({ claim_started_at: new Date().toISOString() })
    .eq("member_key", candidate.member_key)
    .is("claimed_at", null)
    .or(`claim_started_at.is.null,claim_started_at.lt.${cutoff}`)
    .select("email,member_key,full_name,title,phone_number,department_id,avatar_url,eb_rank,eb_permissions")
    .maybeSingle();

  if (claimError) return json({ error: "Could not reserve this signup. Try again later." }, 500);
  if (!invite) return json({ error: "This EB roster entry has already been claimed. Use EB login or contact the Super Admin." }, 409);

  let createdUserId: string | null = null;
  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: invite.full_name, title: invite.title, member_key: invite.member_key },
    });
    if (createError || !created.user) throw createError || new Error("Account creation failed.");
    createdUserId = created.user.id;

    const { error: profileError } = await admin.from("wm_profiles").upsert({
      user_id: createdUserId,
      full_name: invite.full_name,
      role: "executive_board",
      department_id: invite.department_id,
      is_active: true,
      title: invite.title,
      avatar_url: invite.avatar_url,
      eb_rank: invite.eb_rank,
      eb_permissions: invite.eb_permissions,
    }, { onConflict: "user_id" });
    if (profileError) throw profileError;

    const { error: finishError } = await admin.from("wm_eb_signup_allowlist")
      .update({ claimed_at: new Date().toISOString(), claimed_user_id: createdUserId, claim_started_at: null })
      .eq("member_key", invite.member_key)
      .is("claimed_at", null);
    if (finishError) throw finishError;

    return json({ success: true, message: "Your EB account has been created. You can now sign in." }, 201);
  } catch (error) {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
    await admin.from("wm_eb_signup_allowlist").update({ claim_started_at: null }).eq("member_key", invite.member_key).is("claimed_at", null);
    const message = error instanceof Error ? error.message : "Account creation failed.";
    if (/already been registered|already exists|duplicate/i.test(message)) return json({ error: "An account already exists for this email. Use the EB login page or contact the Super Admin." }, 409);
    return json({ error: "We could not create the account. Please try again or contact the Super Admin." }, 400);
  }
});
