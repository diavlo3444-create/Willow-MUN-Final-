import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPER_ADMIN_ONLY_KEYS = new Set([
  "accounts.manage_admins",
  "accounts.manage_heads",
  "roles.manage",
  "permissions.manage",
  "testing.impersonate_head",
]);

function sanitizePermissions(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object") return {};
  const clean: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (SUPER_ADMIN_ONLY_KEYS.has(key)) continue;
    if (typeof val === "boolean") {
      clean[key] = val;
    }
  }
  return clean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server configuration is incomplete." }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Authentication required." }, 401);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Invalid or expired session." }, 401);

  const { data: actor, error: actorError } = await admin.from("wm_profiles")
    .select("role,is_active").eq("user_id", authData.user.id).maybeSingle();
  if (actorError || actor?.role !== "super_admin" || actor.is_active !== true) {
    return json({ error: "Only the active Super Admin can manage staff accounts." }, 403);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const action = String(body?.action || "");
  const allowedRoles = new Set(["admin", "department_head", "executive_board"]);
  const cleanEmail = (value: unknown) => String(value || "").trim().toLowerCase();
  const originHeader = req.headers.get("origin");
  const redirectBase = String(body?.redirect_origin || originHeader || "https://willow-mun.vercel.app").replace(/\/$/, "");
  const setupRedirectUrl = `${redirectBase}/head-setup`;

  const makeInviteToken = () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  const hashInviteToken = async (value: string) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  const findUserByEmail = async (email: string) => {
    let page = 1;
    while (page <= 10) {
      const { data: usersPage, error: pageErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (pageErr) throw pageErr;
      const list = usersPage?.users || [];
      const found = list.find((u: any) => cleanEmail(u.email) === email);
      if (found) return found;
      if (list.length < 1000) break;
      page += 1;
    }
    return null;
  };

  const profileFields = (input: any) => ({
    full_name: String(input.full_name || "").trim(),
    role: String(input.role || ""),
    department_id: input.department_id || null,
    title: String(input.title || "").trim(),
    division: input.division ? String(input.division).trim() : null,
    is_active: input.is_active !== false,
    eb_rank: String(input.eb_rank || "member"),
    eb_permissions: input.eb_permissions && typeof input.eb_permissions === "object" ? input.eb_permissions : {},
    permissions: sanitizePermissions(input.permissions),
  });

  try {
    if (action === "list") {
      const [{ data: profiles, error: profileError }, { data: users, error: usersError }, { data: ebRoster, error: ebRosterError }] = await Promise.all([
        admin.from("wm_profiles").select("user_id,full_name,role,department_id,is_active,title,division,avatar_url,phone_number,eb_rank,eb_permissions,permissions,created_at").order("created_at", { ascending: false }),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        admin.from("wm_eb_signup_allowlist")
          .select("email,email_aliases,member_key,full_name,title,phone_number,department_id,avatar_url,eb_rank,eb_permissions,claimed_at,claimed_user_id,invite_sent_at")
          .order("full_name"),
      ]);
      if (profileError || usersError || ebRosterError) throw profileError || usersError || ebRosterError;
      const userById = new Map((users?.users || []).map((u: any) => [u.id, u]));
      const liveProfiles = (profiles || []).map((p: any) => {
        const authUser = userById.get(p.user_id);
        const lastSignIn = authUser?.last_sign_in_at;
        const confirmed = Boolean(authUser?.email_confirmed_at);
        return {
          ...p,
          email: authUser?.email || "",
          permissions: sanitizePermissions(p.permissions),
          signup_status: lastSignIn || confirmed ? "claimed" : "awaiting_signup",
        };
      });
      const claimedIds = new Set(liveProfiles.filter((p: any) => p.role === "executive_board").map((p: any) => p.user_id));
      const pendingEb = (ebRoster || [])
        .filter((entry: any) => !entry.claimed_at && !entry.claimed_user_id)
        .filter((entry: any) => !claimedIds.has(entry.claimed_user_id))
        .map((entry: any) => ({
          user_id: `pending:${entry.member_key}`,
          full_name: entry.full_name,
          email: entry.email,
          email_aliases: entry.email_aliases || [],
          role: "executive_board",
          department_id: entry.department_id,
          is_active: true,
          title: entry.title || "Executive Board",
          division: null,
          avatar_url: entry.avatar_url || null,
          phone_number: entry.phone_number || "",
          eb_rank: entry.eb_rank || "member",
          eb_permissions: entry.eb_permissions || {},
          permissions: {},
          created_at: null,
          signup_status: "awaiting_signup",
          member_key: entry.member_key,
        }));
      return json({ accounts: [...liveProfiles, ...pendingEb] });
    }

    if (action === "create") {
      const email = cleanEmail(body.email);
      const requestedRole = String(body.role || "");
      if (requestedRole === "super_admin") {
        return json({ error: "Super Admin privileges cannot be assigned through Account Management." }, 403);
      }
      const fields = profileFields(body);
      if (!email || !fields.full_name || !allowedRoles.has(fields.role)) {
        return json({ error: "Name, email, and a valid staff role (admin, department_head, or executive_board) are required." }, 400);
      }
      if ((fields.role === "department_head" || fields.role === "executive_board") && !fields.department_id) {
        return json({ error: "Department assignment is required for Department Head and Executive Board accounts." }, 400);
      }

      // Executive Board entries must be added to the database-backed signup roster.
      // The member creates their own Auth account later through /eb-signup.
      if (fields.role === "executive_board") {
        const { data: existingRoster, error: rosterLookupError } = await admin
          .from("wm_eb_signup_allowlist")
          .select("member_key,email,email_aliases");
        if (rosterLookupError) throw rosterLookupError;
        const alreadyListed = (existingRoster || []).some((entry: any) =>
          cleanEmail(entry.email) === email ||
          (entry.email_aliases || []).some((alias: string) => cleanEmail(alias) === email)
        );
        if (alreadyListed) return json({ error: "This email is already listed in the Executive Board roster." }, 409);
        const existingUser = await findUserByEmail(email);
        if (existingUser) return json({ error: "An account already exists for this email. Edit the existing account instead." }, 409);
        const { data: rosterEntry, error: rosterInsertError } = await admin
          .from("wm_eb_signup_allowlist")
          .insert({
            email,
            member_key: crypto.randomUUID(),
            full_name: fields.full_name,
            title: fields.title || "Executive Board",
            department_id: fields.department_id,
            eb_rank: fields.eb_rank,
            eb_permissions: fields.eb_permissions,
            permissions: fields.permissions,
            gender: fields.division,
          })
          .select("member_key,email,full_name,title,department_id,eb_rank,eb_permissions")
          .single();
        if (rosterInsertError) throw rosterInsertError;
        return json({
          account: {
            user_id: `pending:${rosterEntry.member_key}`,
            email: rosterEntry.email,
            full_name: rosterEntry.full_name,
            role: "executive_board",
            department_id: rosterEntry.department_id,
            title: rosterEntry.title,
            eb_rank: rosterEntry.eb_rank,
            eb_permissions: rosterEntry.eb_permissions,
            is_active: true,
            signup_status: "awaiting_signup",
          },
          message: "EB member added to the approved signup roster.",
        }, 201);
      }

      // Duplicate email guard before creating auth user
      const duplicate = await findUserByEmail(email);
      if (duplicate) {
        return json({ error: `An account with email "${email}" already exists. Edit the existing account instead.` }, 409);
      }

      let createdUser: any = null;
      let actionLink: string | null = null;

      if (body.password && String(body.password).trim()) {
        const nextPassword = String(body.password);
        if (nextPassword.length < 10) {
          return json({ error: "Use a password of at least 10 characters." }, 400);
        }
        const result = await admin.auth.admin.createUser({
          email,
          password: nextPassword,
          email_confirm: true,
          user_metadata: { full_name: fields.full_name },
        });
        if (result.error) throw result.error;
        createdUser = result.data.user;
      } else {
        const linkRes = await admin.auth.admin.generateLink({
          type: "invite",
          email,
          options: { redirectTo: setupRedirectUrl, data: { full_name: fields.full_name } },
        });
        if (!linkRes.error && linkRes.data?.user) {
          createdUser = linkRes.data.user;
          actionLink = linkRes.data.properties?.action_link || null;
        } else {
          const inviteRes = await admin.auth.admin.inviteUserByEmail(email, {
            redirectTo: setupRedirectUrl,
            data: { full_name: fields.full_name },
          });
          if (inviteRes.error) throw inviteRes.error;
          createdUser = inviteRes.data.user;
        }
      }

      if (!createdUser) throw new Error("Auth user was not created.");
      const { error: upsertErr } = await admin
        .from("wm_profiles")
        .upsert({ user_id: createdUser.id, ...fields }, { onConflict: "user_id" });
      if (upsertErr) {
        await admin.auth.admin.deleteUser(createdUser.id);
        throw upsertErr;
      }

      return json({ account: { user_id: createdUser.id, email, ...fields }, action_link: actionLink }, 201);
    }

    if (action === "create_eb_invite") {
      const memberKey = String(body.member_key || "").trim();
      if (!memberKey) return json({ error: "member_key is required." }, 400);
      const inviteToken = makeInviteToken();
      const tokenHash = await hashInviteToken(inviteToken);
      const { data: member, error } = await admin.from("wm_eb_signup_allowlist")
        .update({ invite_token_hash: tokenHash, invite_sent_at: new Date().toISOString(), claim_started_at: null })
        .eq("member_key", memberKey)
        .is("claimed_at", null)
        .select("email,full_name,member_key")
        .maybeSingle();
      if (error) throw error;
      if (!member) return json({ error: "This EB entry is already claimed or no longer exists." }, 404);
      const inviteUrl = `https://thenrqgqunwjjsbceayn.supabase.co/functions/v1/willow-eb-signup?token=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(member.email)}`;
      return json({ success: true, url: inviteUrl, full_name: member.full_name, email: member.email });
    }

    const userId = String(body.user_id || "");
    if (!userId) return json({ error: "user_id is required." }, 400);

    // Protect Super Admin accounts from modification/suspension/deletion
    const { data: targetProfile } = await admin
      .from("wm_profiles")
      .select("user_id,role")
      .eq("user_id", userId)
      .maybeSingle();

    if (targetProfile?.role === "super_admin" && action !== "send_setup_link") {
      return json({ error: "Super Admin accounts cannot be altered or removed through Account Management." }, 403);
    }

    if (action === "update") {
      if (body.role === "super_admin") {
        return json({ error: "Cannot escalate an account to Super Admin." }, 403);
      }
      const patch: any = {};
      if (body.full_name !== undefined) patch.full_name = String(body.full_name).trim();
      if (body.role !== undefined) {
        if (!allowedRoles.has(String(body.role))) return json({ error: "Invalid role." }, 400);
        patch.role = String(body.role);
      }
      if (body.department_id !== undefined) patch.department_id = body.department_id || null;
      if (body.title !== undefined) patch.title = String(body.title).trim();
      if (body.division !== undefined) patch.division = body.division ? String(body.division).trim() : null;
      if (body.eb_rank !== undefined) patch.eb_rank = String(body.eb_rank);
      if (body.eb_permissions !== undefined && typeof body.eb_permissions === "object") patch.eb_permissions = body.eb_permissions;
      if (body.permissions !== undefined && typeof body.permissions === "object") {
        patch.permissions = sanitizePermissions(body.permissions);
      }
      if (typeof body.is_active === "boolean") {
        patch.is_active = body.is_active;
      }

      const effectiveRole = patch.role ?? targetProfile?.role;
      if ((effectiveRole === "department_head" || effectiveRole === "executive_board") && patch.department_id === null) {
        return json({ error: "Department assignment is required for Head and Executive Board accounts." }, 400);
      }

      const authPatch: any = {};
      if (body.email !== undefined) {
        const nextEmail = cleanEmail(body.email);
        if (!nextEmail) return json({ error: "Email address cannot be blank." }, 400);
        const dup = await findUserByEmail(nextEmail);
        if (dup && dup.id !== userId) {
          return json({ error: `Another account already uses email "${nextEmail}".` }, 409);
        }
        authPatch.email = nextEmail;
      }
      if (body.password !== undefined && String(body.password).trim()) {
        const nextPassword = String(body.password);
        if (nextPassword.length < 10) return json({ error: "Use a password of at least 10 characters." }, 400);
        authPatch.password = nextPassword;
      }
      if (typeof body.is_active === "boolean") {
        authPatch.ban_duration = body.is_active ? "none" : "876000h";
      }
      if (Object.keys(authPatch).length) {
        const { error } = await admin.auth.admin.updateUserById(userId, authPatch);
        if (error) throw error;
      }

      const { data, error } = await admin.from("wm_profiles").update(patch).eq("user_id", userId).select().single();
      if (error) throw error;

      if (typeof body.is_active === "boolean") {
        await admin.from("wm_qr_passes").update({ active: body.is_active }).eq("user_id", userId);
      }
      return json({ account: data });
    }

    if (action === "suspend" || action === "reactivate") {
      if (userId === authData.user.id) return json({ error: "You cannot deactivate your own active Super Admin account." }, 400);
      const nextActive = action === "reactivate";
      const { error: authBanErr } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: nextActive ? "none" : "876000h",
      });
      if (authBanErr) throw authBanErr;
      const { error } = await admin.from("wm_profiles").update({ is_active: nextActive }).eq("user_id", userId);
      if (error) throw error;
      await admin.from("wm_qr_passes").update({ active: nextActive }).eq("user_id", userId);
      return json({ success: true, is_active: nextActive });
    }

    if (action === "reset_password") {
      const password = String(body.password || "");
      if (password.length < 10) return json({ error: "Use a password of at least 10 characters." }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "send_setup_link") {
      const { data: targetUser, error: userErr } = await admin.auth.admin.getUserById(userId);
      if (userErr || !targetUser?.user?.email) {
        return json({ error: userErr?.message || "Account email could not be found." }, 404);
      }
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: targetUser.user.email,
        options: { redirectTo: setupRedirectUrl },
      });
      if (linkErr || !linkData?.properties?.action_link) {
        return json({ error: linkErr?.message || "Could not generate a password setup link." }, 400);
      }
      return json({ success: true, action_link: linkData.properties.action_link });
    }

    if (action === "delete") {
      if (userId === authData.user.id) return json({ error: "You cannot delete the active Super Admin account." }, 400);

      // Preserve unrelated conference records before removing user account
      await Promise.allSettled([
        admin.from("wm_applications").update({ decision_by: null }).eq("decision_by", userId),
        admin.from("wm_committees").update({ updated_by: null }).eq("updated_by", userId),
        admin.from("wm_qr_scans").update({ scanned_by: null }).eq("scanned_by", userId),
        admin.from("wm_eb_records").update({ created_by: null }).eq("created_by", userId),
        admin.from("wm_eb_records").update({ updated_by: null }).eq("updated_by", userId),
        admin.from("wm_eb_signup_allowlist").update({ claimed_at: null, claimed_user_id: null, claim_started_at: null }).eq("claimed_user_id", userId),
      ]);

      await admin.from("wm_eb_record_acks").delete().eq("user_id", userId);
      await admin.from("wm_qr_passes").delete().eq("user_id", userId);
      await admin.from("wm_profiles").delete().eq("user_id", userId);

      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "resend_invite") {
      const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
      if (targetError || !target.user?.email) throw targetError || new Error("Account email not found.");
      const { error } = await admin.auth.admin.inviteUserByEmail(target.user.email, {
        redirectTo: setupRedirectUrl,
        data: { full_name: target.user.user_metadata?.full_name || "" },
      });
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Account operation failed." }, 400);
  }
});
