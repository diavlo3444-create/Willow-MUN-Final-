import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => {
  if (status >= 400) {
    const details = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    console.warn("[willow-applications] request rejected", {
      status,
      action: typeof details.action === "string" ? details.action : undefined,
      reason: typeof details.error === "string" ? details.error : "unspecified",
    });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

const STORAGE_BUCKET = "wm-application-files";
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ALLOWED_DOC_MIME_TYPES = new Set([
  ...ALLOWED_IMAGE_MIME_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "pdf",
  "doc",
  "docx",
  "txt",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_E164_REGEX = /^\+[1-9]\d{6,14}$/;
const CURRENT_PRIVACY_POLICY_VERSION = "2026-11-22";
const CURRENT_TERMS_VERSION = "2026-11-22";

function mapDepartment(appType: string, explicitDept?: string | null): string {
  const cleanExplicit = String(explicitDept || "").trim().toLowerCase();
  if (cleanExplicit) return cleanExplicit;
  switch (String(appType || "").trim().toLowerCase()) {
    case "volunteer":
    case "volunteers":
      return "volunteers";
    case "media":
    case "media-press":
      return "media";
    case "press":
      return "press";
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

function isHrProfile(profile: {
  department_slug?: string | null;
  title?: string | null;
  division?: string | null;
}): boolean {
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

function normalizeUploadedFiles(
  rawList: unknown,
  applicationType: string,
  expectedCategory: string,
): Array<{
  id: string;
  name: string;
  category: string;
  fileType: string;
  sizeBytes: number;
  sizeLabel: string;
  storageBucket: string;
  storagePath: string;
  uploadedAt: string;
}> {
  if (!Array.isArray(rawList)) return [];
  const results: Array<{
    id: string;
    name: string;
    category: string;
    fileType: string;
    sizeBytes: number;
    sizeLabel: string;
    storageBucket: string;
    storagePath: string;
    uploadedAt: string;
  }> = [];

  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const storagePath = String(rec.storagePath || rec.storage_path || "").trim();
    if (
      !storagePath ||
      storagePath.includes("..") ||
      !storagePath.startsWith(`${applicationType}/`)
    ) {
      continue;
    }
    const sizeBytes = Number(rec.sizeBytes ?? rec.size_bytes ?? 0);
    results.push({
      id: String(rec.id || crypto.randomUUID()),
      name: String(rec.name || "attachment").slice(0, 180),
      category: String(rec.category || expectedCategory),
      fileType: String(rec.fileType || rec.file_type || "application/octet-stream").slice(0, 120),
      sizeBytes: Number.isFinite(sizeBytes) ? Math.max(0, sizeBytes) : 0,
      sizeLabel: String(rec.sizeLabel || rec.size_label || "").slice(0, 40),
      storageBucket: STORAGE_BUCKET,
      storagePath,
      uploadedAt: String(rec.uploadedAt || new Date().toISOString()),
    });
  }

  return results;
}

function sanitizeAnswers(raw: unknown): Array<{
  questionId: string;
  section: string;
  label: string;
  answer: string;
}> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry, idx) => ({
      questionId: String(entry.questionId || `q_${idx + 1}`).slice(0, 80),
      section: String(entry.section || "Role Questions").slice(0, 80),
      label: String(entry.label || "").slice(0, 320),
      answer: String(entry.answer || "").trim().slice(0, 5000),
    }))
    .filter((entry) => entry.label && entry.answer);
}

async function resolveTargetDepartment(admin: any, departmentId: string) {
  let { data: targetDepartment, error } = await admin
    .from("wm_departments")
    .select("id,slug,registration_open")
    .eq("slug", departmentId)
    .maybeSingle();

  if (
    !targetDepartment &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(departmentId)
  ) {
    const byId = await admin
      .from("wm_departments")
      .select("id,slug,registration_open")
      .eq("id", departmentId)
      .maybeSingle();
    targetDepartment = byId.data;
    error = byId.error;
  }

  return { targetDepartment, error };
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

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const action = String(body?.action || "");

  // ---------------------------------------------------------------------------
  // 0. Public Application Availability Status
  // ---------------------------------------------------------------------------
  if (action === "get_availability") {
    const { data: deptRows, error: deptErr } = await admin
      .from("wm_departments")
      .select("slug,registration_open,updated_at")
      .in("slug", ["media", "press", "volunteers", "security"]);

    if (deptErr) return json({ error: "Could not load application availability." }, 500);

    const availability: Record<string, boolean> = {};
    for (const row of deptRows || []) {
      const slug = String(row.slug || "").trim().toLowerCase();
      if (slug) availability[slug] = row.registration_open === true;
    }

    return json({ availability });
  }

  // ---------------------------------------------------------------------------
  // 1. Public File Upload Initializer (Signed Upload URL into private bucket)
  // ---------------------------------------------------------------------------
  if (action === "init_upload") {
    const applicationType = String(body?.application_type || "").trim().toLowerCase();
    const fieldKind = String(body?.field_kind || "").trim().toLowerCase();
    const fileName = String(body?.file_name || "file").trim();
    const mimeType = String(body?.mime_type || "").trim().toLowerCase();
    const sizeBytes = Number(body?.size_bytes ?? 0);
    const sessionKeyRaw = String(body?.draft_session_id || crypto.randomUUID())
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 48);
    const sessionKey = sessionKeyRaw || crypto.randomUUID();

    if (!["media", "press", "volunteer", "security"].includes(applicationType)) {
      return json({ error: "Unsupported application track for uploads." }, 400);
    }
    if (!["proof_files", "media_photos", "writing_samples"].includes(fieldKind)) {
      return json({ error: "Unsupported upload field category." }, 400);
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
      return json({ error: "Each file must be 100 MB or smaller." }, 400);
    }

    const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return json({ error: "Unsupported file extension." }, 400);
    }

    if (fieldKind === "media_photos") {
      if (mimeType && !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
        return json({ error: "Media portfolio only accepts JPG, PNG, WEBP, or HEIC images." }, 400);
      }
      if (!["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext)) {
        return json({ error: "Media portfolio only accepts image files." }, 400);
      }
    } else if (mimeType && !ALLOWED_DOC_MIME_TYPES.has(mimeType)) {
      return json({ error: "Unsupported file format. Accepted: PDF, DOC, DOCX, TXT, JPG, PNG, WEBP." }, 400);
    }

    const departmentId = mapDepartment(applicationType, body?.department_id);
    const { targetDepartment, error: deptErr } = await resolveTargetDepartment(admin, departmentId);
    if (deptErr) return json({ error: "Could not verify registration status." }, 500);
    if (!targetDepartment || targetDepartment.registration_open !== true) {
      return json({ error: "Registration for this department is currently closed." }, 403);
    }

    const storagePath = `${applicationType}/${sessionKey}/${fieldKind}/${crypto.randomUUID()}.${ext}`;
    const { data: signed, error: signErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signErr || !signed) {
      return json(
        { error: signErr?.message || "Could not prepare upload channel." },
        500,
      );
    }

    return json({
      bucket: STORAGE_BUCKET,
      path: storagePath,
      signedUrl: signed.signedUrl,
      token: signed.token,
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Public Application Submission (Media, Press, Volunteers, Security)
  // ---------------------------------------------------------------------------
  if (action === "submit") {
    const applicationType = String(body?.application_type || "").trim().toLowerCase();
    const applicantName = String(body?.applicant_name || "").trim();
    const gender = String(body?.gender || "").trim().toLowerCase();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = String(body?.phone || "").trim();
    const guardianPhone = String(body?.guardian_phone || "").trim();
    const grade = String(body?.grade || "").trim();
    const school = String(body?.school || "").trim();
    const experience = String(body?.experience || "").trim();
    const motivation = String(body?.motivation || "").trim();
    const cameraModel = String(body?.camera_model || "").trim();
    const attendsAllDays =
      typeof body?.attends_all_days === "boolean" ? body.attends_all_days : null;
    const absenceReason = String(body?.absence_reason || "").trim();
    const hasMedicalCondition = body?.has_medical_condition === true;
    const medicalDetails = hasMedicalCondition
      ? String(body?.medical_details || "").trim().slice(0, 2000)
      : null;

    if (!["volunteer", "media", "press", "security"].includes(applicationType)) {
      return json({ error: "Unsupported application track." }, 400);
    }
    if (applicantName.length < 2 || !EMAIL_REGEX.test(email) || !grade || school.length < 2) {
      return json({ error: "Complete all required personal and academic fields." }, 400);
    }
    if (!PHONE_E164_REGEX.test(phone) || !PHONE_E164_REGEX.test(guardianPhone)) {
      return json({ error: "Enter valid international phone numbers for both you and your guardian." }, 400);
    }
    if (gender !== "male" && gender !== "female") {
      return json({ error: "Please select male or female." }, 400);
    }
    if (typeof body?.has_medical_condition !== "boolean") {
      return json({ error: "Please indicate whether you have any medical conditions or regular medication." }, 400);
    }
    if (attendsAllDays === false && absenceReason.length < 5) {
      return json({ error: "Please explain why you cannot attend all three conference days (March 18, March 19, and March 20, 2027)." }, 400);
    }

    const privacyPolicyAccepted = body?.privacy_policy_accepted === true;
    const termsAccepted = body?.terms_accepted === true;
    if (!privacyPolicyAccepted && !termsAccepted) {
      return json(
        {
          error:
            "You must confirm that you have read and understood the Privacy Policy and agree to the Terms and Conditions before submitting.",
        },
        400,
      );
    }
    if (!privacyPolicyAccepted) {
      return json(
        { error: "Please confirm that you have read and understood the Privacy Policy before submitting." },
        400,
      );
    }
    if (!termsAccepted) {
      return json(
        { error: "Please confirm that you have read and agree to the Terms and Conditions before submitting." },
        400,
      );
    }

    const privacyPolicyVersion =
      String(body?.privacy_policy_version || "").trim().slice(0, 64) ||
      CURRENT_PRIVACY_POLICY_VERSION;
    const termsVersion =
      String(body?.terms_version || "").trim().slice(0, 64) ||
      CURRENT_TERMS_VERSION;
    const rawConsentAcceptedAt =
      typeof body?.consent_accepted_at === "string" ? body.consent_accepted_at.trim() : "";
    const parsedConsentTime = rawConsentAcceptedAt ? Date.parse(rawConsentAcceptedAt) : NaN;
    const consentAcceptedAt = Number.isFinite(parsedConsentTime)
      ? new Date(parsedConsentTime).toISOString()
      : new Date().toISOString();

    const answers = sanitizeAnswers(body?.answers);
    const proofFiles = normalizeUploadedFiles(body?.proof_files, applicationType, "other");
    const mediaPhotos = normalizeUploadedFiles(body?.media_photos, applicationType, "photo");
    const writingSamples = normalizeUploadedFiles(body?.writing_samples, applicationType, "portfolio");

    if (applicationType === "media") {
      if (!cameraModel) {
        return json({ error: "Please specify your camera model or equipment type." }, 400);
      }
      if (answers.length < 5 || motivation.length < 20) {
        return json({ error: "Please answer all five Media application questions." }, 400);
      }
    } else if (applicationType === "press" || applicationType === "volunteer") {
      if (answers.length < 5 || motivation.length < 20) {
        return json({ error: "Please answer all five role questions thoroughly." }, 400);
      }
    } else if (motivation.length < 20) {
      return json({ error: "Complete all required application fields." }, 400);
    }

    const departmentId = mapDepartment(applicationType, body?.department_id);
    const { targetDepartment, error: departmentLookupError } = await resolveTargetDepartment(
      admin,
      departmentId,
    );
    if (departmentLookupError) return json({ error: "Could not verify registration status." }, 500);
    if (!targetDepartment) return json({ error: "Registration is not configured for this application type." }, 400);
    if (targetDepartment.registration_open !== true) {
      return json({ error: "Registration for this department is currently closed." }, 403);
    }

    // Duplicate protection: block duplicate pending submissions for the same track & email
    const { data: existingPending } = await admin
      .from("wm_applications")
      .select("id")
      .ilike("application_type", applicationType)
      .ilike("email", email)
      .eq("status", "pending")
      .limit(1);
    if (existingPending && existingPending.length > 0) {
      return json(
        {
          error:
            "An active pending application for this email and track has already been submitted. Please contact the Secretariat if you need to update it.",
        },
        409,
      );
    }

    const { data: inserted, error } = await admin
      .from("wm_applications")
      .insert({
        application_type: applicationType,
        department_id: departmentId,
        applicant_name: applicantName,
        gender,
        email,
        phone,
        guardian_phone: guardianPhone,
        grade,
        school,
        age: body?.age ? Number(body.age) : null,
        availability: body?.availability ? String(body.availability).trim() : null,
        motivation,
        experience,
        portfolio_url: body?.portfolio_url ? String(body.portfolio_url).trim() : null,
        camera_model: applicationType === "media" ? cameraModel : null,
        attends_all_days: attendsAllDays,
        absence_reason: attendsAllDays === false ? absenceReason : null,
        answers,
        proof_files: proofFiles,
        media_photos: applicationType === "media" ? mediaPhotos : [],
        writing_samples: applicationType === "press" ? writingSamples : [],
        privacy_policy_accepted: true,
        terms_accepted: true,
        privacy_policy_version: privacyPolicyVersion,
        terms_version: termsVersion,
        consent_accepted_at: consentAcceptedAt,
        status: "pending",
      })
      .select("id,application_type,department_id,applicant_name,gender,status,privacy_policy_accepted,terms_accepted,privacy_policy_version,terms_version,consent_accepted_at,created_at")
      .single();

    if (error || !inserted) return json({ error: error?.message || "Could not submit application." }, 400);

    // Store private medical info in isolated table (admin confidential access only)
    const { error: medErr } = await admin
      .from("wm_application_medical")
      .upsert(
        {
          application_id: inserted.id,
          has_medical_condition: hasMedicalCondition,
          medical_details: medicalDetails,
        },
        { onConflict: "application_id" },
      );

    if (medErr) {
      await admin.from("wm_applications").delete().eq("id", inserted.id);
      return json({ error: "Could not securely store confidential application details." }, 500);
    }

    return json({ application: inserted }, 201);
  }

  // ---------------------------------------------------------------------------
  // 3. Authenticated Staff / Head / HR / Admin Endpoints
  // ---------------------------------------------------------------------------
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
  const actorApplicationType = actorLabel.includes("press")
    ? "press"
    : actorLabel.includes("media")
      ? "media"
      : null;
  const actorPerms = (
    actor.permissions && typeof actor.permissions === "object" ? actor.permissions : {}
  ) as Record<string, boolean>;
  const actorEbPerms = (
    actor.eb_permissions && typeof actor.eb_permissions === "object" ? actor.eb_permissions : {}
  ) as Record<string, boolean>;

  const isAdmin = actor.role === "super_admin" || actor.role === "admin";
  const canViewMedical =
    actor.role === "super_admin" ||
    (actor.role === "admin" && actorPerms["applications.view_confidential"] === true);

  const isEbHead =
    actor.role === "executive_board" &&
    (actor.eb_rank === "head" ||
      actor.eb_rank === "co_head" ||
      actorEbPerms.manage_department === true ||
      /\bhead\b/i.test(String(actor.title || "")) ||
      actorPerms["applications.view"] === true);
  const headApplicationDepartmentAllowed =
    ["media-press", "security", "volunteers"].includes(actorDeptSlug) &&
    (actorDeptSlug !== "media-press" || actorApplicationType !== null);
  const isHead =
    headApplicationDepartmentAllowed &&
    ((actor.role === "department_head" && actorPerms["applications.view"] !== false) || isEbHead);
  // Super Admin inherits every Head capability from the same account.
  const isSuperAdmin = actor.role === "super_admin";
  const canHeadRecommend = isSuperAdmin || (isHead && actorPerms["applications.recommend"] !== false);
  const isHr = isHrProfile({ ...actor, department_slug: actorDeptSlug });

  async function enrichRowsWithConfidentialMedical(rows: any[]) {
    if (!rows.length) return [];
    if (!canViewMedical) {
      return rows.map((row) => ({
        ...row,
        department_id: mapDepartment(row.application_type, row.department_id),
        medical_has_conditions: null,
        medical_details: null,
        medical_restricted: true,
      }));
    }

    const ids = rows.map((r) => r.id);
    const { data: medicalRows } = await admin
      .from("wm_application_medical")
      .select("application_id,has_medical_condition,medical_details")
      .in("application_id", ids);

    const medMap = new Map<string, { has_medical_condition: boolean; medical_details: string | null }>();
    for (const m of medicalRows || []) {
      medMap.set(m.application_id, {
        has_medical_condition: Boolean(m.has_medical_condition),
        medical_details: m.medical_details ?? null,
      });
    }

    return rows.map((row) => {
      const med = medMap.get(row.id);
      return {
        ...row,
        department_id: mapDepartment(row.application_type, row.department_id),
        medical_has_conditions: med ? med.has_medical_condition : null,
        medical_details: med ? med.medical_details : null,
        medical_restricted: false,
      };
    });
  }

  async function enrichRecommenderNames(rows: any[]) {
    if (!rows.length) return rows;
    const missingUserIds = Array.from(
      new Set(
        rows
          .filter((row) => row.recommended_by && !String(row.recommended_by_name || "").trim())
          .map((row) => String(row.recommended_by)),
      ),
    );
    if (missingUserIds.length === 0) return rows;
    const { data: profiles } = await admin
      .from("wm_profiles")
      .select("user_id,full_name")
      .in("user_id", missingUserIds);
    const nameMap = new Map<string, string>();
    for (const p of profiles || []) {
      if (p.user_id && p.full_name) nameMap.set(String(p.user_id), String(p.full_name));
    }
    return rows.map((row) => {
      if (row.recommended_by && !String(row.recommended_by_name || "").trim()) {
        const resolvedName = nameMap.get(String(row.recommended_by));
        if (resolvedName) {
          return { ...row, recommended_by_name: resolvedName };
        }
      }
      return row;
    });
  }

  // Generate short-lived signed URLs for applicant attachments after verifying strict authorization
  if (action === "sign_files") {
    const applicationId = String(body?.application_id || "").trim();
    if (!applicationId) return json({ error: "Application ID is required." }, 400);

    const { data: existing, error: fetchError } = await admin
      .from("wm_applications")
      .select("id,application_type,department_id,gender,status,proof_files,media_photos,writing_samples")
      .eq("id", applicationId)
      .maybeSingle();

    if (fetchError || !existing) return json({ error: "Application not found." }, 404);

    const appDept = mapDepartment(existing.application_type, existing.department_id);
    let authorized = false;

    if (isAdmin) {
      authorized = true;
    } else if (isHr && existing.status === "accepted") {
      authorized = true;
    } else if (isHead) {
      const actorGender = getActorGender(actor);
      const appGender = String(existing.gender || "").trim().toLowerCase();
      const matchesDept = appDept.toLowerCase() === actorDeptSlug;
      const matchesMediaPress =
        actorDeptSlug !== "media-press" ||
        (actorApplicationType !== null &&
          String(existing.application_type || "").toLowerCase() === actorApplicationType);
      const matchesGender = Boolean(actorGender && appGender && actorGender === appGender);
      authorized = matchesDept && matchesMediaPress && matchesGender;
    }

    if (!authorized) {
      return json({ error: "You are not authorized to access files for this application." }, 403);
    }

    const collectPaths = (list: unknown): string[] => {
      if (!Array.isArray(list)) return [];
      return list
        .map((f) => (f && typeof f === "object" ? String((f as any).storagePath || "") : ""))
        .filter((p) => Boolean(p && !p.includes("..")));
    };

    const allPaths = Array.from(
      new Set([
        ...collectPaths(existing.proof_files),
        ...collectPaths(existing.media_photos),
        ...collectPaths(existing.writing_samples),
      ]),
    );

    if (allPaths.length === 0) return json({ urls: {} });

    const { data: signedList, error: signErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(allPaths, 3600);

    if (signErr) return json({ error: signErr.message }, 500);

    const urls: Record<string, string> = {};
    for (const item of signedList || []) {
      if (item.path && item.signedUrl) {
        urls[item.path] = item.signedUrl;
      }
    }

    return json({ urls });
  }

  if (action === "hr_accepted") {
    if (!isAdmin && !isHr) {
      return json(
        { error: "Only HR and Administrators can access accepted applicants across departments." },
        403,
      );
    }
    const { data: rows, error } = await admin
      .from("wm_applications")
      .select("*")
      .eq("status", "accepted")
      .order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 400);
    const enriched = await enrichRowsWithConfidentialMedical(rows || []);
    return json({ applications: enriched });
  }

  if (action === "head_recommended") {
    const canAdminReview =
      isSuperAdmin ||
      (actor.role === "admin" &&
        actorPerms["applications.view"] !== false &&
        actorPerms["applications.review"] !== false);
    if (!canAdminReview) {
      return json(
        { error: "Only authorized Administrators can view cross-department Head recommendations." },
        403,
      );
    }
    const { data: rows, error } = await admin
      .from("wm_applications")
      .select("*")
      .in("head_recommendation", ["recommend_accept", "recommend_reject"])
      .order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 400);
    const withNames = await enrichRecommenderNames(rows || []);
    const enriched = await enrichRowsWithConfidentialMedical(withNames);
    return json({ applications: enriched });
  }

  if (action === "list") {
    if (isAdmin) {
      if (!isSuperAdmin && actorPerms["applications.view"] === false) {
        return json({ error: "You do not have permission to view applications." }, 403);
      }
      const { data: rows, error } = await admin
        .from("wm_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      const withNames = await enrichRecommenderNames(rows || []);
      const enriched = await enrichRowsWithConfidentialMedical(withNames);
      return json({ applications: enriched });
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
            (actorDept !== "media-press" ||
              (actorApplicationType !== null &&
                String(row.application_type || "").toLowerCase() === actorApplicationType)) &&
            String(row.gender || "").trim().toLowerCase() === actorGender,
        );
      const redacted = await enrichRowsWithConfidentialMedical(scoped);
      return json({ applications: redacted });
    }

    return json({ error: "You do not have permission to view applications." }, 403);
  }

  if (action === "recommend") {
    if (!canHeadRecommend) return json({ error: "You do not have permission to submit recommendations." }, 403);
    const id = String(body?.id || "").trim();
    const recommendation = String(body?.recommendation || "").trim().toLowerCase();
    const headNotes = String(body?.head_notes || "").trim().slice(0, 5000);
    if (!id) return json({ error: "Application ID is required." }, 400);
    if (!["recommend_accept", "recommend_reject"].includes(recommendation)) return json({ error: "Choose recommend acceptance or recommend rejection." }, 400);
    const { data: existing, error: fetchError } = await admin.from("wm_applications").select("*").eq("id", id).maybeSingle();
    if (fetchError || !existing) return json({ error: "Application not found." }, 404);
    const appDept = mapDepartment(existing.application_type, existing.department_id);
    // Assigned Heads remain scoped to their department, track, and gender division.
    // Super Admin may perform the same review action across all applications.
    if (!isSuperAdmin) {
      const actorGender = getActorGender(actor);
      const appGender = String(existing.gender || "").trim().toLowerCase();
      if (!actorDeptSlug || appDept.toLowerCase() !== actorDeptSlug) return json({ error: "You cannot recommend applications outside your assigned department." }, 403);
      if (actorDeptSlug === "media-press" && (!actorApplicationType || String(existing.application_type || "").toLowerCase() !== actorApplicationType)) return json({ error: "Media and Press applications are isolated." }, 403);
      if (!actorGender || appGender !== actorGender) return json({ error: "You cannot recommend applications outside your gender division." }, 403);
    }
    if (existing.status !== "pending") return json({ error: "Only pending applications can receive or change a recommendation." }, 409);
    if (!isSuperAdmin && existing.recommended_by && existing.recommended_by !== authData.user.id) return json({ error: "A Department Head has already submitted this recommendation. Contact an Admin if it needs to be changed." }, 409);
    const { data: updated, error: updateError } = await admin.from("wm_applications").update({ head_recommendation: recommendation, head_notes: headNotes, recommended_by: authData.user.id, recommended_by_name: actor.full_name, recommended_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select("*").maybeSingle();
    if (updateError) return json({ error: updateError.message }, 400);
    if (!updated) return json({ error: "The application changed while you were submitting. Refresh and try again." }, 409);
    const [enriched] = await enrichRowsWithConfidentialMedical([{ ...updated, department_id: appDept }]);
    return json({ application: enriched });
  }
  if (action === "override_decision") {
    if (actor.role !== "super_admin") {
      return json({ error: "Only Super Admin can override application decisions." }, 403);
    }
    const id = String(body?.id || "").trim();
    const nextStatus = String(body?.status || "").trim().toLowerCase();
    const reason = String(body?.reason || "").trim();
    if (!id) return json({ error: "Application ID is required." }, 400);
    if (!["pending", "accepted", "rejected", "waitlisted"].includes(nextStatus)) {
      return json({ error: "Invalid override status." }, 400);
    }
    if (reason.length < 8) {
      return json({ error: "Override reason must be at least 8 characters." }, 400);
    }

    const { data: existing, error: fetchError } = await admin
      .from("wm_applications")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (fetchError || !existing) return json({ error: "Application not found." }, 404);

    const previousStatus = String(existing.status || "pending");
    const appDept = mapDepartment(existing.application_type, existing.department_id);
    const { data: appDepartment } = await admin
      .from("wm_departments")
      .select("id")
      .eq("slug", appDept)
      .maybeSingle();

    const patch: Record<string, unknown> = {
      status: nextStatus,
      department_id: appDept,
      decision_by: authData.user.id,
      decision_by_name: actor.full_name,
      decision_at: new Date().toISOString(),
      admin_decision_notes: reason,
      review_notes: reason,
    };

    const { data: updated, error: updateError } = await admin
      .from("wm_applications")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) return json({ error: updateError.message }, 400);

    if (nextStatus === "accepted") {
      const { data: existingPass } = await admin
        .from("wm_qr_passes")
        .select("id,active")
        .eq("application_id", String(updated.id))
        .maybeSingle();
      if (existingPass) {
        if (!existingPass.active) {
          await admin.from("wm_qr_passes").update({ active: true }).eq("id", existingPass.id);
        }
      } else {
        await admin.from("wm_qr_passes").insert({
          application_id: String(updated.id),
          holder_name: updated.applicant_name,
          holder_email: updated.email,
          role_label: updated.position || `${updated.application_type} Participant`,
          category: updated.application_type === "delegate" ? "Delegate" : "Staff",
          department_id: appDepartment?.id ?? null,
          active: true,
          token_value: makeOpaqueToken(),
        });
      }
    } else if (previousStatus === "accepted") {
      await admin
        .from("wm_qr_passes")
        .update({ active: false })
        .eq("application_id", String(updated.id));
    }

    const { error: auditError } = await admin.from("wm_application_decision_overrides").insert({
      application_id: id,
      previous_status: previousStatus,
      new_status: nextStatus,
      reason,
      actor_user_id: authData.user.id,
      actor_name: actor.full_name,
      actor_role: actor.role,
    });

    const [withRecommender] = await enrichRecommenderNames([{ ...updated, department_id: appDept }]);
    const [enriched] = await enrichRowsWithConfidentialMedical([withRecommender]);

    if (auditError) {
      return json(
        {
          application: enriched,
          override: { previous_status: previousStatus, new_status: nextStatus, reason },
          warning: "Decision changed, but audit record failed: " + auditError.message,
        },
        200,
      );
    }

    return json({
      application: enriched,
      override: { previous_status: previousStatus, new_status: nextStatus, reason },
    });
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
    const { data: appDepartment } = await admin
      .from("wm_departments")
      .select("id")
      .eq("slug", appDept)
      .maybeSingle();

    if (!isAdmin) {
      return json({ error: "Only Administrators can make final application decisions. Department Heads submit recommendations." }, 403);
    }
    if (!["pending", "accepted", "rejected", "waitlisted"].includes(nextStatus)) {
      return json({ error: "Invalid status value." }, 400);
    }

    // Lock accepted/rejected decisions to their original decision-maker.
    // Only that admin or a Super Admin may change a locked decision.
    const lockedDecision = ["accepted", "rejected"].includes(String(existing.status || "").toLowerCase());
    const originalDecisionMaker = String(existing.decision_by || "");
    if (lockedDecision && !isSuperAdmin && originalDecisionMaker && originalDecisionMaker !== authData.user.id) {
      return json({
        error: "This decision is locked. Only the admin who made it or a Super Admin can change it.",
        locked: true,
        decision_by_name: existing.decision_by_name || null,
      }, 403);
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
      patch.admin_decision_notes = String(body.review_notes);
    }

    // Guard the write against a decision being changed between the read and update.
    let updateQuery = admin
      .from("wm_applications")
      .update(patch)
      .eq("id", id)
      .eq("status", existing.status);
    if (existing.decision_by) {
      updateQuery = updateQuery.eq("decision_by", existing.decision_by);
    } else {
      updateQuery = updateQuery.is("decision_by", null);
    }
    const { data: updated, error: updateError } = await updateQuery.select("*").maybeSingle();
    if (updateError) return json({ error: updateError.message }, 400);
    if (!updated) {
      return json({ error: "Another admin changed this application just now. Refresh to see the latest decision.", locked: true }, 409);
    }

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

    const [withRecommender] = await enrichRecommenderNames([
      { ...updated, department_id: appDept },
    ]);
    const [enriched] = await enrichRowsWithConfidentialMedical([withRecommender]);
    return json({ application: enriched });
  }

  if (action === "delete") {
    if (!isSuperAdmin) return json({ error: "Only Super Admins can permanently delete applications." }, 403);
    const id = String(body?.id || "").trim();
    if (!id) return json({ error: "Application ID is required." }, 400);
    const { data: existing, error: fetchError } = await admin.from("wm_applications").select("id,application_type,proof_files,media_photos,writing_samples").eq("id", id).maybeSingle();
    if (fetchError) return json({ error: fetchError.message }, 400);
    if (!existing) return json({ error: "Application not found." }, 404);
    const storagePaths = new Set<string>();
    for (const field of ["proof_files", "media_photos", "writing_samples"] as const) {
      const list = (existing as any)[field];
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const path = String((item as any).storagePath || (item as any).storage_path || "").trim();
        if (path && !path.includes("..") && !path.includes("\\") && path.startsWith(String(existing.application_type || "").trim().toLowerCase() + "/")) storagePaths.add(path);
      }
    }
    const relatedDeletes = await Promise.all([
      admin.from("wm_application_medical").delete().eq("application_id", id),
      admin.from("wm_hr_signup_invites").delete().eq("application_id", id),
      admin.from("wm_qr_passes").delete().eq("application_id", id),
    ]);
    const relatedError = relatedDeletes.find((result) => result.error)?.error;
    if (relatedError) return json({ error: relatedError.message }, 400);
    const { error: deleteError } = await admin.from("wm_applications").delete().eq("id", id);
    if (deleteError) return json({ error: deleteError.message }, 400);
    if (storagePaths.size > 0) {
      const { error: storageError } = await admin.storage.from(STORAGE_BUCKET).remove(Array.from(storagePaths));
      if (storageError) return json({ success: true, storage_cleanup_warning: storageError.message });
    }
    return json({ success: true });
  }
  if (action === "list_manual_email_confirmations") {
    const canViewEmails =
      isSuperAdmin ||
      isHr ||
      (actor.role === "admin" && actorPerms["email.view"] !== false);
    if (!canViewEmails) {
      return json({ error: "Only Admins or HR can access email delivery confirmations." }, 403);
    }

    const { data: rows, error } = await admin
      .from("wm_email_manual_confirmations")
      .select("*")
      .order("sent_at", { ascending: false });

    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("does not exist") || msg.includes("could not find")) {
        return json({ confirmations: [] });
      }
      return json({ error: error.message }, 400);
    }

    return json({ confirmations: rows || [] });
  }

  if (action === "mark_email_sent") {
    const canDispatchEmail =
      isSuperAdmin ||
      isHr ||
      (actor.role === "admin" &&
        actorPerms["email.view"] !== false &&
        actorPerms["email.send"] !== false);
    if (!canDispatchEmail) {
      return json({ error: "Only authorized Admins or HR staff can mark emails as sent." }, 403);
    }

    const rawApplicationId = String(body?.application_id || "").trim();
    const rawRecipientEmail = String(body?.recipient_email || "").trim().toLowerCase();
    const rawRecipientName = String(body?.recipient_name || "").trim() || "Applicant";
    const rawDepartmentId = String(body?.department_id || "general").trim() || "general";
    const decisionStatus = String(body?.decision_status || "").trim().toLowerCase() === "rejected"
      ? "rejected"
      : "accepted";
    const subject = String(body?.subject || "").trim() || "Willow MUN Application Decision";
    const bodyText = String(body?.body_text || "");
    const attemptCount = Math.max(1, Number(body?.attempt_count || 1) || 1);
    const serverDeliveryId = body?.server_delivery_id ? String(body.server_delivery_id).trim() : null;

    if (!rawRecipientEmail || !EMAIL_REGEX.test(rawRecipientEmail)) {
      return json({ error: "A valid recipient email address is required before marking as sent." }, 400);
    }

    const appKey = rawApplicationId || `email:${rawRecipientEmail}`;
    const confirmedAt = new Date().toISOString();
    const confirmedByName = String(actor.full_name || "").trim() || "Administrator";
    const confirmedByEmail = authData.user.email ? String(authData.user.email).trim().toLowerCase() : null;

    const { data: confirmation, error: confirmErr } = await admin
      .from("wm_email_manual_confirmations")
      .upsert(
        {
          application_id: appKey,
          decision_status: decisionStatus,
          server_delivery_id: serverDeliveryId,
          recipient_name: rawRecipientName,
          recipient_email: rawRecipientEmail,
          department_id: rawDepartmentId,
          subject,
          body_text: bodyText,
          attempt_count: attemptCount,
          sent_at: confirmedAt,
          confirmed_by: authData.user.id,
          confirmed_by_name: confirmedByName,
          confirmed_by_email: confirmedByEmail,
          delivery_method: "manual_gmail",
          updated_at: confirmedAt,
        },
        { onConflict: "application_id,decision_status" },
      )
      .select("*")
      .single();

    if (confirmErr) {
      return json({ error: confirmErr.message || "Could not persist manual send confirmation." }, 400);
    }

    // Also update wm_email_deliveries in-place when available so automated history stays synced
    let updatedDelivery: Record<string, unknown> | null = null;
    try {
      const fullPatch = {
        status: "sent",
        sent_at: confirmedAt,
        error_message: null,
        delivery_method: "manual_gmail",
        manual_sent_at: confirmedAt,
        manual_sent_by: authData.user.id,
        manual_sent_by_name: confirmedByName,
        updated_at: confirmedAt,
      };
      const basePatch = {
        status: "sent",
        sent_at: confirmedAt,
        error_message: null,
        updated_at: confirmedAt,
      };

      const applyDeliveryUpdate = async (patch: Record<string, unknown>) => {
        if (serverDeliveryId) {
          const res = await admin
            .from("wm_email_deliveries")
            .update(patch)
            .eq("id", serverDeliveryId)
            .select("*")
            .maybeSingle();
          if (!res.error && res.data) return res;
          if (res.error) return res;
        }
        return await admin
          .from("wm_email_deliveries")
          .update(patch)
          .eq("application_id", appKey)
          .eq("decision_status", decisionStatus)
          .neq("status", "sent")
          .select("*")
          .maybeSingle();
      };

      let updateRes = await applyDeliveryUpdate(fullPatch);
      if (updateRes.error) {
        const msg = String(updateRes.error.message || "").toLowerCase();
        if (msg.includes("column") || msg.includes("does not exist")) {
          updateRes = await applyDeliveryUpdate(basePatch);
        }
      }
      if (!updateRes.error && updateRes.data) {
        updatedDelivery = updateRes.data as Record<string, unknown>;
      }
    } catch {
      // wm_email_deliveries may use a custom schema or not be present; wm_email_manual_confirmations remains authoritative
    }

    return json({
      success: true,
      confirmation,
      delivery: updatedDelivery,
    });
  }

  return json({ error: "Unsupported action." }, 400);
});
