import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
  const profileFields = (input: any) => ({
    full_name: String(input.full_name || "").trim(),
    role: String(input.role || ""),
    department_id: input.department_id || null,
    title: String(input.title || "").trim(),
    division: input.division ? String(input.division).trim() : null,
    is_active: input.is_active !== false,
    eb_rank: String(input.eb_rank || "member"),
    eb_permissions: input.eb_permissions && typeof input.eb_permissions === "object" ? input.eb_permissions : {},
  });

  try {
    if (action === "list") {
      const [{ data: profiles, error: profileError }, { data: users, error: usersError }] = await Promise.all([
        admin.from("wm_profiles").select("user_id,full_name,role,department_id,is_active,title,division,avatar_url,eb_rank,eb_permissions,created_at").order("created_at", { ascending: false }),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);
      if (profileError || usersError) throw profileError || usersError;
      const emailById = new Map((users?.users || []).map((u: any) => [u.id, u.email || ""]));
      return json({ accounts: (profiles || []).map((p: any) => ({ ...p, email: emailById.get(p.user_id) || "" })) });
    }

    if (action === "create") {
      const email = cleanEmail(body.email);
      const fields = profileFields(body);
      if (!email || !fields.full_name || !allowedRoles.has(fields.role)) return json({ error: "Name, email, and a valid staff role are required." }, 400);
      if ((fields.role === "department_head" || fields.role === "executive_board") && !fields.department_id) return json({ error: "Department assignment is required for this role." }, 400);
      let createdUser: any;
      if (body.password) {
        const result = await admin.auth.admin.createUser({ email, password: String(body.password), email_confirm: true, user_metadata: { full_name: fields.full_name } });
        if (result.error) throw result.error;
        createdUser = result.data.user;
      } else {
        const result = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fields.full_name } });
        if (result.error) throw result.error;
        createdUser = result.data.user;
      }
      if (!createdUser) throw new Error("Auth user was not created.");
      const { error } = await admin.from("wm_profiles").upsert({ user_id: createdUser.id, ...fields }, { onConflict: "user_id" });
      if (error) {
        await admin.auth.admin.deleteUser(createdUser.id);
        throw error;
      }
      return json({ account: { user_id: createdUser.id, email, ...fields } }, 201);
    }

    const userId = String(body.user_id || "");
    if (!userId) return json({ error: "user_id is required." }, 400);

    if (action === "update") {
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
      if (body.email !== undefined) {
        const email = cleanEmail(body.email);
        const { error } = await admin.auth.admin.updateUserById(userId, { email });
        if (error) throw error;
      }
      const { data, error } = await admin.from("wm_profiles").update(patch).eq("user_id", userId).select().single();
      if (error) throw error;
      return json({ account: data });
    }

    if (action === "suspend" || action === "reactivate") {
      const { error } = await admin.from("wm_profiles").update({ is_active: action === "reactivate" }).eq("user_id", userId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "reset_password") {
      const password = String(body.password || "");
      if (password.length < 10) return json({ error: "Use a password of at least 10 characters." }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "delete") {
      if (userId === authData.user.id) return json({ error: "You cannot delete the active Super Admin account." }, 400);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "resend_invite") {
      const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
      if (targetError || !target.user?.email) throw targetError || new Error("Account email not found.");
      const { error } = await admin.auth.admin.inviteUserByEmail(target.user.email, { data: { full_name: target.user.user_metadata?.full_name || "" } });
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Account operation failed." }, 400);
  }
});
