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

  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return json({ error: "Verify your email before finishing signup." }, 401);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(bearer);
  const authUser = authData?.user;
  if (authError || !authUser?.id || !authUser.email) return json({ error: "Your signup session is invalid. Start again from the EB signup page." }, 401);
  if (!authUser.email_confirmed_at) return json({ error: "Verify your email using the confirmation message, then return to this page." }, 403);

  const email = authUser.email.trim().toLowerCase();
  const { data: primaryMatch, error: primaryError } = await admin.from("wm_eb_signup_allowlist")
    .select("email,email_aliases,member_key,full_name,title,phone_number,department_id,avatar_url,eb_rank,eb_permissions")
    .eq("email", email)
    .maybeSingle();
  if (primaryError) return json({ error: "Could not verify the EB roster. Try again later." }, 500);

  let candidate = primaryMatch;
  if (!candidate) {
    const { data: aliasMatch, error: aliasError } = await admin.from("wm_eb_signup_allowlist")
      .select("email,email_aliases,member_key,full_name,title,phone_number,department_id,avatar_url,eb_rank,eb_permissions")
      .contains("email_aliases", [email])
      .maybeSingle();
    if (aliasError) return json({ error: "Could not verify the EB roster. Try again later." }, 500);
    candidate = aliasMatch;
  }
  if (!candidate) return json({ error: "This email is not listed in the Willow MUN Executive Board roster. Contact the Super Admin if you believe this is a mistake." }, 403);

  const { data: existingProfile, error: profileLookupError } = await admin.from("wm_profiles")
    .select("user_id,role")
    .eq("user_id", authUser.id)
    .maybeSingle();
  if (profileLookupError) return json({ error: "Could not check your account. Try again later." }, 500);
  if (existingProfile && existingProfile.role !== "executive_board") {
    return json({ error: "This email is already connected to a different Willow portal role. Contact the Super Admin." }, 409);
  }
  if (existingProfile?.role === "executive_board") {
    return json({ success: true, message: "Your EB account is already active." });
  }

  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: invite, error: claimError } = await admin.from("wm_eb_signup_allowlist")
    .update({ claim_started_at: new Date().toISOString() })
    .eq("member_key", candidate.member_key)
    .is("claimed_at", null)
    .or(`claim_started_at.is.null,claim_started_at.lt.${cutoff}`)
    .select("email,email_aliases,member_key,full_name,title,phone_number,department_id,avatar_url,eb_rank,eb_permissions")
    .maybeSingle();

  if (claimError) return json({ error: "Could not reserve this EB roster entry. Try again later." }, 500);
  if (!invite) return json({ error: "This EB roster entry has already been claimed. Use EB login or contact the Super Admin." }, 409);

  try {
    const { error: profileError } = await admin.from("wm_profiles").upsert({
      user_id: authUser.id,
      full_name: invite.full_name,
      role: "executive_board",
      department_id: invite.department_id,
      is_active: true,
      title: invite.title,
      avatar_url: invite.avatar_url || null,
      phone_number: invite.phone_number || null,
      eb_rank: invite.eb_rank || "member",
      eb_permissions: invite.eb_permissions || {},
    }, { onConflict: "user_id" });
    if (profileError) throw profileError;

    const { error: finishError } = await admin.from("wm_eb_signup_allowlist")
      .update({ claimed_at: new Date().toISOString(), claimed_user_id: authUser.id, claim_started_at: null, invite_token_hash: null })
      .eq("member_key", invite.member_key)
      .is("claimed_at", null);
    if (finishError) throw finishError;

    const qrBytes = new Uint8Array(16);
    crypto.getRandomValues(qrBytes);
    const qrToken = "WMQR-" + Array.from(qrBytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const { error: qrError } = await admin.from("wm_qr_passes").upsert({
      user_id: authUser.id,
      token_value: qrToken,
      holder_name: invite.full_name,
      role_label: invite.title || "Executive Board",
      category: invite.department_id === "security" ? "Security" : "Executive",
      department_id: invite.department_id,
      active: true,
    }, { onConflict: "user_id", ignoreDuplicates: true });
    if (qrError) throw qrError;

    return json({ success: true, message: "Your EB account is ready." }, 200);
  } catch (error) {
    await admin.from("wm_eb_signup_allowlist")
      .update({ claim_started_at: null })
      .eq("member_key", invite.member_key)
      .is("claimed_at", null);
    return json({ error: error instanceof Error ? error.message : "We could not connect your EB profile. Please try again." }, 400);
  }
});