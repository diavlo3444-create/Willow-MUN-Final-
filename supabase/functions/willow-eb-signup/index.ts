import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://willow-mun.vercel.app",
  "https://thenrqgqunwjjsbceayn.supabase.co",
  "https://ais-dev-kkieazvdfq7e6qb6ncnbbe-432410478862.europe-west2.run.app",
]);
const corsFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://willow-mun.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
});
const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsFor(origin), "Content-Type": "application/json" } });
const cleanEmail = (value: unknown) => String(value || "").trim().toLowerCase();

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    const allowed = !origin || allowedOrigins.has(origin);
    return new Response("ok", { status: allowed ? 200 : 403, headers: corsFor(origin) });
  }
  if (origin && !allowedOrigins.has(origin)) return json({ error: "This signup page is not authorized." }, 403, origin);

  if (req.method === "GET") {
    const pageUrl = new URL(req.url);
    const inviteToken = String(pageUrl.searchParams.get("token") || "").trim().toLowerCase();
    const email = cleanEmail(pageUrl.searchParams.get("email"));
    if (!/^[a-f0-9]{64}$/.test(inviteToken) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "This invitation link is missing required details. Ask the Super Admin for a new link." }, 400, origin);
    }
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char] || char);
    const safeEmail = escapeHtml(email);
    const safeToken = escapeHtml(inviteToken);
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>Willow MUN — Executive Board Setup</title>
<style>
:root{color-scheme:dark;--bg:#10130d;--panel:#191e15;--line:#3b4432;--ink:#eee8d3;--muted:#b9b79f;--accent:#b5b98a;--green:#3f7656}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 0%,#283020 0%,var(--bg) 58%);color:var(--ink);font:15px/1.6 system-ui,-apple-system,Segoe UI,sans-serif}
.panel{width:min(100%,480px);padding:34px;border:1px solid var(--line);background:rgba(25,30,21,.96);box-shadow:0 24px 80px #0008}
.kicker{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent)}h1{font:32px/1.12 Georgia,serif;font-weight:500;margin:12px 0}p{color:var(--muted);font-size:13px}
label{display:block;margin:18px 0 7px;font-size:12px;color:var(--muted)}input{width:100%;height:46px;padding:0 12px;border:1px solid var(--line);background:#10140e;color:var(--ink);border-radius:3px;font-size:14px}
input[readonly]{color:#c9c5ac;background:#151a12}button{width:100%;height:46px;margin-top:22px;border:0;border-radius:3px;background:var(--green);color:white;font-weight:650;cursor:pointer}button:disabled{opacity:.55;cursor:wait}
#message{min-height:22px;margin-top:14px;color:#e5c3a8;font-size:12px}.small{font-size:11px;color:#989984;margin-top:16px}
a{color:var(--accent)}@media(max-width:520px){.panel{padding:25px 20px}}
</style></head><body><main class="panel" id="panel">
<div class="kicker">Willow MUN 2027 · Executive Board</div><h1>Create your EB account</h1>
<p>This private invitation is tied to the email address below. Your roster entry supplies your name, role, department and permissions.</p>
<form id="signup"><input id="token" type="hidden" value="${safeToken}">
<label for="email">Invited email</label><input id="email" type="email" value="${safeEmail}" readonly>
<label for="password">Create password</label><input id="password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required>
<label for="confirm">Confirm password</label><input id="confirm" type="password" minlength="10" maxlength="128" autocomplete="new-password" required>
<button id="submit" type="submit">Create EB account</button><div id="message" role="alert"></div></form>
<div class="small">Keep your password private. Invitation links can only be used once.</div>
</main><script>
const form=document.getElementById('signup');
form.addEventListener('submit',async(event)=>{
 event.preventDefault();
 const password=document.getElementById('password').value;
 const confirm=document.getElementById('confirm').value;
 const message=document.getElementById('message');
 const button=document.getElementById('submit');
 if(password.length<10||password.length>128){message.textContent='Use a password between 10 and 128 characters.';return;}
 if(password!==confirm){message.textContent='The passwords do not match.';return;}
 button.disabled=true;button.textContent='Creating account…';message.textContent='';
 try{
  const response=await fetch(window.location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('email').value,password,token:document.getElementById('token').value})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.success)throw new Error(data.error||'Could not create your account.');
  document.getElementById('panel').innerHTML='<div class="kicker">Willow MUN 2027 · Executive Board</div><h1>Account created</h1><p>Your EB account is ready. Sign in using the email and password you just created.</p><p><a href="https://willow-mun.vercel.app/eb-login">Continue to EB login</a></p>';
 }catch(error){message.textContent=error instanceof Error?error.message:'Could not create your account.';button.disabled=false;button.textContent='Create EB account';}
});
</script></body></html>`;
    return new Response(html, { status: 200, headers: { ...corsFor(origin), "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid signup request." }, 400, origin); }
  const email = cleanEmail(body?.email);
  const password = String(body?.password || "");
  const inviteToken = String(body?.token || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400, origin);
  if (password.length < 10 || password.length > 128) return json({ error: "Password must be between 10 and 128 characters." }, 400, origin);
  if (!/^[a-f0-9]{64}$/.test(inviteToken)) return json({ error: "A valid private EB invitation link is required." }, 403, origin);
  const tokenDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inviteToken));
  const tokenHash = Array.from(new Uint8Array(tokenDigest), (byte) => byte.toString(16).padStart(2, "0")).join("");

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Signup service is not configured." }, 500, origin);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: roster, error: rosterError } = await admin.from("wm_eb_signup_allowlist")
    .select("email,email_aliases,member_key,full_name,title,phone_number,department_id,avatar_url,eb_rank,eb_permissions,permissions,claimed_at,claimed_user_id,invite_token_hash")
    .order("full_name");
  if (rosterError) return json({ error: "Could not check the Executive Board roster. Try again later." }, 500, origin);
  const matches = (roster || []).filter((entry: any) =>
    [cleanEmail(entry.email), ...(entry.email_aliases || []).map(cleanEmail)].includes(email) &&
    typeof entry.invite_token_hash === "string" &&
    entry.invite_token_hash.toLowerCase() === tokenHash
  );
  if (matches.length !== 1) {
    return json({ error: "This invitation link is invalid, has been replaced, or has already been used. Ask the Super Admin for a new link." }, 403, origin);
  }
  const member = matches[0];
  if (member.claimed_at || member.claimed_user_id) {
    return json({ error: "This EB roster entry has already been connected to an account. Contact the Super Admin if you need help." }, 409, origin);
  }

  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const claimStartedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin.from("wm_eb_signup_allowlist")
    .update({ claim_started_at: claimStartedAt })
    .eq("member_key", member.member_key)
    .eq("invite_token_hash", tokenHash)
    .is("claimed_at", null)
    .or(`claim_started_at.is.null,claim_started_at.lt.${cutoff}`)
    .select("member_key")
    .maybeSingle();
  if (claimError) return json({ error: "Could not reserve your EB profile. Try again later." }, 500, origin);
  if (!claimed) return json({ error: "This EB profile is currently being connected. Wait a moment and try again." }, 409, origin);

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
      permissions: member.permissions && typeof member.permissions === "object" ? member.permissions : {},
    }, { onConflict: "user_id" });
    if (upsertError) throw upsertError;

    const { data: finalized, error: finalizeError } = await admin.from("wm_eb_signup_allowlist")
      .update({ claimed_at: new Date().toISOString(), claimed_user_id: createdUserId, claim_started_at: null, invite_token_hash: null })
      .eq("member_key", member.member_key)
      .eq("invite_token_hash", tokenHash)
      .eq("claim_started_at", claimStartedAt)
      .is("claimed_at", null)
      .select("member_key")
      .maybeSingle();
    if (finalizeError) throw finalizeError;
    if (!finalized) throw new Error("Your EB profile could not be finalized. Contact the Super Admin.");

    return json({ success: true, email, message: "Your EB account is ready." }, 200, origin);
  } catch (error) {
    if (createdUserId) {
      await admin.from("wm_profiles").delete().eq("user_id", createdUserId);
      await admin.from("wm_qr_passes").delete().eq("user_id", createdUserId);
      await admin.auth.admin.deleteUser(createdUserId);
    }
    await admin.from("wm_eb_signup_allowlist")
      .update({ claim_started_at: null })
      .eq("member_key", member.member_key)
      .eq("invite_token_hash", tokenHash)
      .eq("claim_started_at", claimStartedAt)
      .is("claimed_at", null);
    return json({ error: error instanceof Error ? error.message : "We could not create your EB account. Please try again." }, 400, origin);
  }
});
