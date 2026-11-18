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
const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.headers.get("origin") && req.headers.get("origin") !== allowedOrigin) return json({ error: "This signup page is not authorized." }, 403);
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Signup service is not configured." }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid signup request." }, 400); }
  const token = String(body?.token || "").trim();
  const email = cleanEmail(body?.email);
  const password = String(body?.password || "");
  if (!token || token.length < 32) return json({ error: "This personal setup link is invalid. Ask the Super Admin for a new one." }, 400);
  if (!email.includes("@")) return json({ error: "Enter the email address assigned to your EB position." }, 400);
  if (password.length < 10) return json({ error: "Use a password with at least 10 characters." }, 400);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const tokenHash = await hashToken(token);
  const { data: match, error: matchError } = await admin.from("wm_eb_signup_allowlist")
    .select("email,email_aliases,member_key,full_name,title,phone_number,department_id,avatar_url,eb_rank,eb_permissions,claimed_at,claimed_user_id")
    .eq("invite_token_hash", tokenHash)
    .maybeSingle();
  if (matchError) return json({ error: "Could not verify this setup link. Try again later." }, 500);
  if (!match || match.claimed_at || match.claimed_user_id) return json({ error: "This personal setup link is invalid, expired or already used. Ask the Super Admin to generate a new one." }, 403);
  const acceptedEmails = [cleanEmail(match.email), ...(match.email_aliases || []).map(cleanEmail)];
  if (!acceptedEmails.includes(email)) return json({ error: "This link is assigned to a different EB email address." }, 403);

  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: invite, error: claimError } = await admin.from("wm_eb_signup_allowlist")
    .update({ claim_started_at: new Date().toISOString() })
    .eq("member_key", match.member_key)
    .eq("invite_token_hash", tokenHash)
    .is("claimed_at", null)
    .or(`claim_started_at.is.null,claim_started_at.lt.${cutoff}`)
    .select("email,email_aliases,member_key,full_name,title,phone_number,department_id,avatar_url,eb_rank,eb_permissions")
    .maybeSingle();
  if (claimError) return json({ error: "Could not reserve this setup link. Try again later." }, 500);
  if (!invite) return json({ error: "This setup link is already being used or has already been claimed. Ask the Super Admin for a fresh link if needed." }, 409);

  let createdUserId: string | null = null;
  let createdAuthUser = false;
  try {
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw usersError;
    const existingAuthUser = (usersData.users || []).find((user: any) => cleanEmail(user.email) === email);
    let userId: string;

    if (existingAuthUser) {
      userId = existingAuthUser.id;
      const { data: existingProfile, error: profileLookupError } = await admin.from("wm_profiles")
        .select("user_id,role")
        .eq("user_id", userId)
        .maybeSingle();
      if (profileLookupError) throw profileLookupError;
      if (existingProfile?.role === "executive_board") {
        throw new Error("An EB account is already connected to this email. Use EB login or ask the Super Admin to reset the setup link.");
      }
      throw new Error("A Willow login already exists for this email. Contact the Super Admin so the existing account can be checked safely; this setup link will not change another account's password.");
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: invite.full_name },
      });
      if (createError) throw createError;
      if (!created.user) throw new Error("The login account could not be created.");
      userId = created.user.id;
      createdUserId = userId;
      createdAuthUser = true;
    }

    const { error: profileError } = await admin.from("wm_profiles").upsert({
      user_id: userId,
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

    const qrBytes = new Uint8Array(16);
    crypto.getRandomValues(qrBytes);
    const qrToken = "WMQR-" + Array.from(qrBytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const { error: qrError } = await admin.from("wm_qr_passes").upsert({
      user_id: userId,
      token_value: qrToken,
      holder_name: invite.full_name,
      role_label: invite.title || "Executive Board",
      category: "Executive",
      department_id: invite.department_id,
      active: true,
    }, { onConflict: "user_id", ignoreDuplicates: true });
    if (qrError) throw qrError;

    const { error: finishError } = await admin.from("wm_eb_signup_allowlist")
      .update({ claimed_at: new Date().toISOString(), claimed_user_id: userId, claim_started_at: null, invite_token_hash: null })
      .eq("member_key", invite.member_key)
      .eq("invite_token_hash", tokenHash)
      .is("claimed_at", null);
    if (finishError) throw finishError;

    return json({ success: true, message: "Your EB account is ready. Sign in with the password you just created." }, 200);
  } catch (error) {
    if (createdAuthUser && createdUserId) await admin.auth.admin.deleteUser(createdUserId);
    await admin.from("wm_eb_signup_allowlist")
      .update({ claim_started_at: null })
      .eq("member_key", invite.member_key)
      .is("claimed_at", null);
    return json({ error: error instanceof Error ? error.message : "We could not connect your EB profile. Please try again." }, 400);
  }
});
