import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ORIGIN = "https://willow-mun.vercel.app";
const allowedOrigins = new Set([
  APP_ORIGIN,
  "https://thenrqgqunwjjsbceayn.supabase.co",
  "https://ais-dev-kkieazvdfq7e6qb6ncnbbe-432410478862.europe-west2.run.app",
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

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    const allowed = !origin || allowedOrigins.has(origin);
    return new Response("ok", { status: allowed ? 200 : 403, headers: corsFor(origin) });
  }
  if (origin && !allowedOrigins.has(origin)) return json({ error: "This signup page is not authorized." }, 403, origin);
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return json({ error: "Signup service is not configured." }, 500, origin);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid signup request." }, 400, origin); }
  const action = String(body?.action || "");
  const email = cleanEmail(body?.email);
  if (!validEmail(email)) return json({ error: "Enter the email address registered with the Executive Board." }, 400, origin);

  const { data: roster, error: rosterError } = await admin.from("wm_eb_signup_allowlist")
    .select("email,email_aliases,member_key,full_name,title,phone_number,department_id,avatar_url,eb_rank,eb_permissions,permissions,claimed_at,claimed_user_id")
    .order("full_name");
  if (rosterError) return json({ error: "Could not check the Executive Board roster. Try again later." }, 500, origin);
  const matches = (roster || []).filter((entry: any) =>
    [cleanEmail(entry.email), ...(entry.email_aliases || []).map(cleanEmail)].includes(email)
  );
  if (matches.length !== 1) {
    return json({ error: "That email is not listed in the approved Executive Board roster. Contact the Super Admin." }, 403, origin);
  }
  const member = matches[0];
  if (member.claimed_at || member.claimed_user_id) {
    return json({ error: "An account has already been created for this EB roster entry. Contact the Super Admin if you need access restored." }, 409, origin);
  }

  if (action === "send_link") {
    const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await authClient.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${APP_ORIGIN}/eb-signup`,
        data: { signup_flow: "willow_eb" },
      },
    });
    if (error) {
      return json({ error: error.message || "Could not send the verification email. Try again later." }, 400, origin);
    }
    return json({ success: true, message: "Check your email and open the Willow verification link on this device. Then return here to set your password." }, 200, origin);
  }

  if (action !== "complete") return json({ error: "Unsupported signup action." }, 400, origin);

  const authorization = req.headers.get("Authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return json({ error: "Verify your email using the link we sent before creating your password." }, 401, origin);
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  const user = authData?.user;
  if (authError || !user || cleanEmail(user.email) !== email || !user.email_confirmed_at) {
    return json({ error: "Your email is not verified yet. Open the verification link sent to your inbox, then try again." }, 403, origin);
  }

  const password = String(body?.password || "");
  if (password.length < 10 || password.length > 128) {
    return json({ error: "Password must be between 10 and 128 characters." }, 400, origin);
  }

  const { data: existingProfile, error: profileLookupError } = await admin.from("wm_profiles")
    .select("user_id,role").eq("user_id", user.id).maybeSingle();
  if (profileLookupError) return json({ error: "Could not verify your Willow account. Try again later." }, 500, origin);
  if (existingProfile && existingProfile.role !== "executive_board") {
    return json({ error: "This email is already connected to a different Willow staff role. Contact the Super Admin." }, 409, origin);
  }

  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const claimStartedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin.from("wm_eb_signup_allowlist")
    .update({ claim_started_at: claimStartedAt })
    .eq("member_key", member.member_key)
    .is("claimed_at", null)
    .or(`claim_started_at.is.null,claim_started_at.lt.${cutoff}`)
    .select("member_key")
    .maybeSingle();
  if (claimError) return json({ error: "Could not reserve your EB roster profile. Try again later." }, 500, origin);
  if (!claimed) return json({ error: "This EB profile is already being connected. Wait a moment and try again." }, 409, origin);

  try {
    const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, { password });
    if (passwordError) throw passwordError;

    const { error: upsertError } = await admin.from("wm_profiles").upsert({
      user_id: user.id,
      full_name: member.full_name,
      role: "executive_board",
      department_id: member.department_id,
      is_active: true,
      title: member.title,
      avatar_url: member.avatar_url || null,
      phone_number: member.phone_number || null,
      eb_rank: member.eb_rank || "member",
      eb_permissions: member.eb_permissions || {},
      permissions: member.permissions && typeof member.permissions === "object" ? member.permissions : {},
    }, { onConflict: "user_id" });
    if (upsertError) throw upsertError;

    const { data: finalized, error: finalizeError } = await admin.from("wm_eb_signup_allowlist")
      .update({ claimed_at: new Date().toISOString(), claimed_user_id: user.id, claim_started_at: null, invite_token_hash: null })
      .eq("member_key", member.member_key)
      .eq("claim_started_at", claimStartedAt)
      .is("claimed_at", null)
      .select("member_key")
      .maybeSingle();
    if (finalizeError) throw finalizeError;
    if (!finalized) throw new Error("Your EB profile could not be finalized. Contact the Super Admin.");

    return json({ success: true, email, message: "Your EB account is ready." }, 200, origin);
  } catch (error) {
    await admin.from("wm_eb_signup_allowlist")
      .update({ claim_started_at: null })
      .eq("member_key", member.member_key)
      .eq("claim_started_at", claimStartedAt)
      .is("claimed_at", null);
    return json({ error: error instanceof Error ? error.message : "We could not complete your EB account. Please try again." }, 400, origin);
  }
});
