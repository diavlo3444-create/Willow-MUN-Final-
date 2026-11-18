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

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid signup request." }, 400); }
  const email = cleanEmail(body?.email);
  const password = String(body?.password || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (password.length < 10 || password.length > 128) return json({ error: "Password must be between 10 and 128 characters." }, 400);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Signup service is not configured." }, 500);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

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
    return json({ error: "This EB roster entry has already been connected to an account. Contact the Super Admin if you need help." }, 409);
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

  let createdUserId: string | null = null;
  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { signup_flow: "willow_eb" },
    });
    if (createError || !created.user) {
      if (createError?.message.toLowerCase().includes("already")) {
        throw new Error("An account already exists for this email. Use EB login or contact the Super Admin to recover access.");
      }
      throw createError || new Error("Could not create your account.");
    }
    createdUserId = created.user.id;

    const { error: upsertError } = await admin.from("wm_profiles").upsert({
      user_id: createdUserId,
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
      user_id: createdUserId,
      token_value: qrToken,
      holder_name: member.full_name,
      role_label: member.title || "Executive Board",
      category: "Executive",
      department_id: member.department_id,
      active: true,
    }, { onConflict: "user_id", ignoreDuplicates: true });
    if (qrError) throw qrError;

    const { data: finalized, error: finalizeError } = await admin.from("wm_eb_signup_allowlist")
      .update({ claimed_at: new Date().toISOString(), claimed_user_id: createdUserId, claim_started_at: null, invite_token_hash: null })
      .eq("member_key", member.member_key)
      .is("claimed_at", null)
      .select("member_key")
      .maybeSingle();
    if (finalizeError) throw finalizeError;
    if (!finalized) throw new Error("Your EB profile could not be finalized. Contact the Super Admin.");

    return json({ success: true, email, message: "Your EB account is ready." });
  } catch (error) {
    if (createdUserId) {
      await admin.from("wm_profiles").delete().eq("user_id", createdUserId);
      await admin.from("wm_qr_passes").delete().eq("user_id", createdUserId);
      await admin.auth.admin.deleteUser(createdUserId);
    }
    await admin.from("wm_eb_signup_allowlist")
      .update({ claim_started_at: null })
      .eq("member_key", member.member_key)
      .is("claimed_at", null);
    return json({ error: error instanceof Error ? error.message : "We could not create your EB account. Please try again." }, 400);
  }
});
