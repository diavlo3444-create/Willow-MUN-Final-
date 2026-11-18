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
const cleanEmail = (value: unknown) => String(value || "").trim().toLowerCase();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.headers.get("origin") && req.headers.get("origin") !== allowedOrigin) return json({ error: "This signup page is not authorized." }, 403);
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Signup service is not configured." }, 500);

  const authorization = req.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!accessToken) return json({ error: "Verify your email before connecting your EB account." }, 401);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  const verifiedUser = authData?.user;
  if (authError || !verifiedUser || !verifiedUser.email || !(verifiedUser.email_confirmed_at || verifiedUser.confirmed_at)) {
    return json({ error: "Verify your email before connecting your EB account." }, 401);
  }
  const email = cleanEmail(verifiedUser.email);

  const { data: roster, error: rosterError } = await admin.from("wm_eb_signup_allowlist")
    .select("email,email_aliases,member_key,full_name,title,phone_number,department_id,avatar_url,eb_rank,eb_permissions,claimed_at,claimed_user_id")
    .order("full_name");
  if (rosterError) return json({ error: "Could not check the Executive Board roster. Try again later." }, 500);
  const matches = (roster || []).filter((entry: any) =>
    [cleanEmail(entry.email), ...(entry.email_aliases || []).map(cleanEmail)].includes(email)
  );
  if (matches.length !== 1) {
    return json({ error: matches.length ? "This email matches more than one EB roster entry. Contact the Super Admin." : "This email is not listed in the Willow Executive Board roster. Use your registered EB email." }, 403);
  }
  const member = matches[0];
  if (member.claimed_at || member.claimed_user_id) {
    if (member.claimed_user_id === verifiedUser.id) return json({ success: true, alreadyConnected: true });
    return json({ error: "This EB roster entry has already been connected to an account. Contact the Super Admin if you need help." }, 409);
  }

  const { data: existingProfile, error: profileLookupError } = await admin.from("wm_profiles")
    .select("user_id,role")
    .eq("user_id", verifiedUser.id)
    .maybeSingle();
  if (profileLookupError) return json({ error: "Could not check your Willow profile. Try again later." }, 500);
  if (existingProfile && existingProfile.role !== "executive_board") {
    return json({ error: "This email is already connected to a different Willow portal role. Contact the Super Admin." }, 409);
  }

  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: claimed, error: claimError } = await admin.from("wm_eb_signup_allowlist")
    .update({ claim_started_at: new Date().toISOString() })
    .eq("member_key", member.member_key)
    .is("claimed_at", null)
    .or(`claim_started_at.is.null,claim_started_at.lt.${cutoff}`)
    .select("member_key")
    .maybeSingle();
  if (claimError) return json({ error: "Could not reserve your EB profile. Try again later." }, 500);
  if (!claimed) return json({ error: "This EB profile is currently being connected. Wait a moment and try again." }, 409);

  try {
    const { error: upsertError } = await admin.from("wm_profiles").upsert({
      user_id: verifiedUser.id,
      full_name: member.full_name,
      role: "executive_board",
      department_id: member.department_id,
      is_active: true,
      title: member.title,
      avatar_url: member.avatar_url || null,
      phone_number: member.phone_number || null,
      eb_rank: member.eb_rank || "member",
      eb_permissions: member.eb_permissions || {},
    }, { onConflict: "user_id" });
    if (upsertError) throw upsertError;

    const qrBytes = new Uint8Array(16);
    crypto.getRandomValues(qrBytes);
    const qrToken = "WMQR-" + Array.from(qrBytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const { error: qrError } = await admin.from("wm_qr_passes").upsert({
      user_id: verifiedUser.id,
      token_value: qrToken,
      holder_name: member.full_name,
      role_label: member.title || "Executive Board",
      category: "Executive",
      department_id: member.department_id,
      active: true,
    }, { onConflict: "user_id", ignoreDuplicates: true });
    if (qrError) throw qrError;

    const { data: finalized, error: finalizeError } = await admin.from("wm_eb_signup_allowlist")
      .update({ claimed_at: new Date().toISOString(), claimed_user_id: verifiedUser.id, claim_started_at: null, invite_token_hash: null })
      .eq("member_key", member.member_key)
      .is("claimed_at", null)
      .select("member_key")
      .maybeSingle();
    if (finalizeError) throw finalizeError;
    if (!finalized) throw new Error("Your EB profile could not be finalized. Please try again.");

    return json({ success: true, message: "Your EB account is ready." });
  } catch (error) {
    await admin.from("wm_eb_signup_allowlist")
      .update({ claim_started_at: null })
      .eq("member_key", member.member_key)
      .is("claimed_at", null);
    return json({ error: error instanceof Error ? error.message : "We could not connect your EB profile. Please try again." }, 400);
  }
});
