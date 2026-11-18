import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function isDccOrAdmin(profile: { role: string; department_slug?: string | null; title?: string | null; division?: string | null; eb_permissions?: Record<string, boolean> | null; permissions?: Record<string, boolean> | null }): boolean {
  if (profile.role === "super_admin" || profile.role === "admin") return true;
  const dept = String(profile.department_slug || "").trim().toLowerCase();
  if (dept === "dcc" || dept === "delegate-affairs" || dept === "delegate_affairs") return true;
  if (profile.eb_permissions?.manage_committees === true) return true;
  if (profile.permissions?.["committees.manage"] === true) return true;
  const label = `${profile.title || ""} ${profile.division || ""}`.toLowerCase();
  return /\b(dcc|delegate\s+affairs|delegate\s+care)\b/.test(label);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server configuration incomplete." }, 500);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const action = String(body?.action || "list_public");

  if (action === "list_public") {
    const { data, error } = await admin
      .from("wm_committees")
      .select("id,chamber,name,abbreviation,difficulty,description,topics,chair_name,vice_chair_name,capacity,published,sort_order")
      .eq("published", true)
      .order("sort_order", { ascending: true });
    if (error) return json({ error: error.message }, 400);
    return json({ committees: data || [] });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Authentication required." }, 401);

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Invalid or expired session." }, 401);

  const { data: actor, error: actorError } = await admin
    .from("wm_profiles")
    .select("user_id,role,department_id,title,division,eb_permissions,permissions,is_active")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  const { data: actorDepartment } = actor?.department_id
    ? await admin.from("wm_departments").select("slug").eq("id", actor.department_id).maybeSingle()
    : { data: null };
  const scopedActor = actor ? { ...actor, department_slug: actorDepartment?.slug || null } : null;
  if (actorError || !scopedActor || scopedActor.is_active !== true || !isDccOrAdmin(scopedActor)) {
    return json({ error: "Committee management is restricted to DCC, Admins, and Super Admins." }, 403);
  }

  if (action === "list") {
    const { data, error } = await admin
      .from("wm_committees")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) return json({ error: error.message }, 400);
    return json({ committees: data || [] });
  }

  if (action === "upsert") {
    const item = body?.committee;
    if (!item || !String(item.name || "").trim() || !String(item.chamber || "").trim()) {
      return json({ error: "Chamber and committee name are required." }, 400);
    }
    const id = String(item.id || "").trim() || `chamber-${Date.now().toString(36)}`;
    const payload = {
      id,
      chamber: String(item.chamber).trim(),
      name: String(item.name).trim(),
      abbreviation: String(item.abbreviation || "").trim(),
      difficulty: ["Beginner", "Intermediate", "Advanced", "Crisis"].includes(item.difficulty) ? item.difficulty : "Intermediate",
      description: String(item.description || "").trim(),
      topics: Array.isArray(item.topics) ? item.topics.map((t: unknown) => String(t).trim()).filter(Boolean) : [],
      chair_name: String(item.chair_name || item.chairName || "TBA").trim(),
      vice_chair_name: String(item.vice_chair_name || item.viceChairName || "TBA").trim(),
      capacity: Math.max(1, Number(item.capacity) || 40),
      published: Boolean(item.published),
      sort_order: Number(item.sort_order ?? item.order) || 1,
      updated_by: authData.user.id,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await admin
      .from("wm_committees")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ committee: data });
  }

  if (action === "delete") {
    const id = String(body?.id || "").trim();
    if (!id) return json({ error: "Committee ID is required." }, 400);
    const { error } = await admin.from("wm_committees").delete().eq("id", id);
    if (error) return json({ error: error.message }, 400);
    return json({ success: true });
  }

  return json({ error: "Unsupported action." }, 400);
});
