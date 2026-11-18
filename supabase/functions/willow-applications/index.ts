import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function mapDepartment(appType: string, explicitDept?: string | null): string {
  const cleanExplicit = String(explicitDept || "").trim().toLowerCase();
  if (cleanExplicit) return cleanExplicit;
  switch (String(appType || "").trim().toLowerCase()) {
    case "volunteer":
    case "volunteers":
      return "volunteers";
    case "media":
    case "press":
    case "media-press":
      return "media-press";
    case "security":
      return "security";
    case "delegate":
      return "dcc";
    default:
      return String(appType || "general").trim().toLowerCase();
  }
}

function getActorGender(profile: { title?: string | null; division?: string | null }): "male" | "female" | null {
  const label = `${profile.title || ""} ${profile.division || ""}`.toLowerCase();
  if (/\b(female|women|woman)\b/.test(label)) return "female";
  if (/\b(male|men|man)\b/.test(label)) return "male";
  return null;
}

function isHrProfile(profile: { department_slug?: string | null; title?: string | null; division?: string | null }): boolean {
  const dept = String(profile.department_slug || "").trim().toLowerCase();
  if (dept === "hr" || dept === "human-resources" || dept === "human_resources") return true;
  const label = `${profile.title || ""} ${profile.division || ""}`.toLowerCase();
  return /\b(hr|human\s+resources)\b/.test(label);
}

function makeOpaqueToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `WMQR-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
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
  const action = String(body?.action || "");

  // Public application submission
  if (action === "submit") {
    const applicationType = String(body?.application_type || "").trim().toLowerCase();
    const applicantName = String(body?.applicant_name || "").trim();
    const gender = String(body?.gender || "").trim().toLowerCase();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = String(body?.phone || "").trim();
    const motivation = String(body?.motivation || "").trim();
    if (!applicationType || !applicantName || !email || !phone || motivation.length < 20) {
      return json({ error: "Complete all required application fields." }, 400);
    }
    if (gender !== "male" && gender !== "female") {
      return json({ error: "Please select male or female." }, 400);
    }

    const departmentId = mapDepartment(applicationType, body?.department_id);
    const { data: inserted, error } = await admin
      .from("wm_applications")
      .insert({
        application_type: applicationType,
        department_id: departmentId,
        applicant_name: applicantName,
        gender,
        email,
        phone,
        school: body?.school ? String(body.school).trim() : null,
        age: body?.age ? Number(body.age) : null,
        availability: body?.availability ? String(body.availability).trim() : null,
        motivation,
        experience: body?.experience ? String(body.experience).trim() : null,
        portfolio_url: body?.portfolio_url ? String(body.portfolio_url).trim() : null,
        status: "pending",
      })
      .select("id,application_type,department_id,applicant_name,gender,status,created_at")
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ application: inserted }, 201);
  }

  // Authenticated actions
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Authentication required." }, 401);

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Invalid or expired session." }, 401);

  const { data: actor, error: actorError } = await admin
    .from("wm_profiles")
    .select("user_id,full_name,role,department_id,title,division,eb_rank,eb_permissions,permissions,is_active")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (actorError || !actor || actor.is_active !== true) {
    return json({ error: "Your account is not active." }, 403);
  }

  const { data: actorDepartment } = actor.department_id
    ? await admin.from("wm_departments").select("id,slug").eq("id", actor.department_id).maybeSingle()
    : { data: null };
  const actorDeptSlug = String(actorDepartment?.slug || "").trim().toLowerCase();
  const actorLabel = `${actor.title || ""} ${actor.division || ""}`.toLowerCase();
  const actorApplicationType = actorLabel.includes("press") ? "press" : actorLabel.includes("media") ? "media" : null;
  const actorPerms = (actor.permissions && typeof actor.permissions === "object" ? actor.permissions : {}) as Record<string, boolean>;
  const actorEbPerms = (actor.eb_permissions && typeof actor.eb_permissions === "object" ? actor.eb_permissions : {}) as Record<string, boolean>;

  const isAdmin = actor.role === "super_admin" || actor.role === "admin";
  const isEbHead =
    actor.role === "executive_board" &&
    (actor.eb_rank === "head" ||
      actor.eb_rank === "co_head" ||
      actorEbPerms.manage_department === true ||
      /\bhead\b/i.test(String(actor.title || "")) ||
      actorPerms["applications.view"] === true);
  const isHead =
    (actor.role === "department_head" && actorPerms["applications.view"] !== false) ||
    isEbHead;
  const canHeadDecide = isHead && actorPerms["applications.review"] !== false;
  const isHr = isHrProfile({ ...actor, department_slug: actorDeptSlug });

  if (action === "hr_accepted") {
    if (!isAdmin && !isHr) {
      return json({ error: "Only HR and Administrators can access accepted applicants across departments." }, 403);
    }
    const { data: rows, error } = await admin
      .from("wm_applications")
      .select("*")
      .eq("status", "accepted")
      .order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 400);
    const enriched = (rows || []).map((row: any) => ({
      ...row,
      department_id: mapDepartment(row.application_type, row.department_id),
    }));
    return json({ applications: enriched });
  }

  if (action === "list") {
    if (isAdmin) {
      const { data: rows, error } = await admin
        .from("wm_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({
        applications: (rows || []).map((row: any) => ({
          ...row,
          department_id: mapDepartment(row.application_type, row.department_id),
        })),
      });
    }

    if (isHead) {
      const actorDept = actorDeptSlug;
      const actorGender = getActorGender(actor);
      if (!actorDept || !actorGender) {
        return json({ error: "Department and gender division are required on your Head profile." }, 403);
      }
      const { data: rows, error } = await admin
        .from("wm_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      const scoped = (rows || [])
        .map((row: any) => ({
          ...row,
          department_id: mapDepartment(row.application_type, row.department_id),
        }))
        .filter(
          (row: any) =>
            row.department_id.toLowerCase() === actorDept &&
            (actorDept !== "media-press" || (actorApplicationType !== null && String(row.application_type || "").toLowerCase() === actorApplicationType)) &&
            String(row.gender || "").trim().toLowerCase() === actorGender,
        );
      return json({ applications: scoped });
    }

    return json({ error: "You do not have permission to view applications." }, 403);
  }

  if (action === "update") {
    const id = String(body?.id || "").trim();
    const nextStatus = String(body?.status || "").trim().toLowerCase();
    if (!id) return json({ error: "Application ID is required." }, 400);

    const { data: existing, error: fetchError } = await admin
      .from("wm_applications")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (fetchError || !existing) return json({ error: "Application not found." }, 404);

    const appDept = mapDepartment(existing.application_type, existing.department_id);
    const { data: appDepartment } = await admin.from("wm_departments").select("id").eq("slug", appDept).maybeSingle();

    if (isHead) {
      if (!canHeadDecide) {
        return json({ error: "Your account does not have permission to accept or decline applications." }, 403);
      }
      const actorDept = actorDeptSlug;
      const actorGender = getActorGender(actor);
      const appGender = String(existing.gender || "").trim().toLowerCase();
      if (!actorDept || appDept.toLowerCase() !== actorDept) {
        return json({ error: "Department Heads cannot modify applications outside their department." }, 403);
      }
      if (actorDept === "media-press" && (!actorApplicationType || String(existing.application_type || "").toLowerCase() !== actorApplicationType)) {
        return json({ error: "Media and Press applications are isolated." }, 403);
      }
      if (!actorGender || appGender !== actorGender) {
        return json({ error: "Department Heads cannot modify applications outside their gender division." }, 403);
      }
      if (nextStatus !== "accepted" && nextStatus !== "rejected") {
        return json({ error: "Department Heads can only accept or decline applications." }, 403);
      }
    } else if (isAdmin) {
      if (!["pending", "accepted", "rejected", "waitlisted"].includes(nextStatus)) {
        return json({ error: "Invalid status value." }, 400);
      }
    } else {
      return json({ error: "Unauthorized to review applications." }, 403);
    }

    const patch: Record<string, unknown> = {
      status: nextStatus,
      department_id: appDept,
      decision_by: authData.user.id,
      decision_by_name: actor.full_name,
      decision_at: new Date().toISOString(),
    };
    if (isAdmin && body?.review_notes !== undefined) {
      patch.review_notes = String(body.review_notes);
    }

    const { data: updated, error: updateError } = await admin
      .from("wm_applications")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) return json({ error: updateError.message }, 400);

    // Automatically ensure permanent personal QR pass when applicant is accepted
    if (nextStatus === "accepted") {
      await admin
        .from("wm_qr_passes")
        .upsert(
          {
            application_id: String(updated.id),
            holder_name: updated.applicant_name,
            holder_email: updated.email,
            role_label: updated.position || `${updated.application_type} Participant`,
            category: updated.application_type === "delegate" ? "Delegate" : "Staff",
            department_id: appDepartment?.id ?? null,
            active: true,
            token_value: makeOpaqueToken(),
          },
          { onConflict: "application_id", ignoreDuplicates: true },
        );
    }

    return json({ application: { ...updated, department_id: appDept } });
  }

  return json({ error: "Unsupported action." }, 400);
});
