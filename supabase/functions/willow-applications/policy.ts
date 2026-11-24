export interface HeadPolicyActorInput {
  role?: string | null;
  department_id?: string | null;
  title?: string | null;
  division?: string | null;
  gender?: string | null;
  eb_rank?: string | null;
  eb_permissions?: Record<string, unknown> | null;
  permissions?: Record<string, unknown> | null;
}

export interface HeadPolicyApplicationRow {
  status?: string | null;
  application_type?: string | null;
  department_id?: string | null;
  gender?: string | null;
  decision_by?: unknown;
  decision_by_name?: unknown;
  decision_at?: unknown;
  admin_decision_notes?: unknown;
  review_notes?: unknown;
}

export interface ResolvedHeadContext {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isHead: boolean;
  canHeadRecommend: boolean;
  actorDeptSlug: string;
  actorApplicationType: "media" | "press" | null;
  actorGender: "male" | "female" | null;
}

const ALLOWED_HEAD_APPLICATION_DEPTS = new Set([
  "media",
  "press",
  "media-press",
  "security",
  "volunteers",
]);

export function normalizeDeptSlug(value: unknown): string {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "volunteer") return "volunteers";
  return clean;
}

export function mapDepartment(appType: string, explicitDept?: string | null): string {
  const cleanExplicit = normalizeDeptSlug(explicitDept);
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

export function resolveApplicationDepartmentSlug(
  applicationType: string | null | undefined,
  explicitDept: string | null | undefined,
  deptSlugById?: ReadonlyMap<string, string>,
): string {
  const rawExplicit = String(explicitDept || "").trim();
  if (rawExplicit && deptSlugById) {
    const byExact = deptSlugById.get(rawExplicit.toLowerCase());
    if (byExact) return normalizeDeptSlug(byExact);
  }
  return mapDepartment(String(applicationType || ""), explicitDept);
}

export function getActorGender(profile: {
  gender?: string | null;
  title?: string | null;
  division?: string | null;
}): "male" | "female" | null {
  const explicitGender = String(profile.gender || "").trim().toLowerCase();
  if (explicitGender === "female" || explicitGender === "woman" || explicitGender === "women") {
    return "female";
  }
  if (explicitGender === "male" || explicitGender === "man" || explicitGender === "men") {
    return "male";
  }
  const label = `${profile.title || ""} ${profile.division || ""}`.toLowerCase();
  if (/\b(female|women|woman)\b/.test(label)) return "female";
  if (/\b(male|men|man)\b/.test(label)) return "male";
  return null;
}

export function resolveHeadContext(
  actor: HeadPolicyActorInput,
  actorDeptSlugRaw: string | null | undefined,
): ResolvedHeadContext {
  const actorDeptSlug = normalizeDeptSlug(actorDeptSlugRaw);
  const actorLabel = `${actor.title || ""} ${actor.division || ""}`.toLowerCase();
  const labelType: "media" | "press" | null = actorLabel.includes("press")
    ? "press"
    : actorLabel.includes("media")
      ? "media"
      : null;

  const actorApplicationType: "media" | "press" | null =
    actorDeptSlug === "press"
      ? labelType ?? "press"
      : actorDeptSlug === "media"
        ? labelType ?? "media"
        : actorDeptSlug === "media-press"
          ? labelType
          : null;

  const actorPerms = (
    actor.permissions && typeof actor.permissions === "object" ? actor.permissions : {}
  ) as Record<string, unknown>;
  const actorEbPerms = (
    actor.eb_permissions && typeof actor.eb_permissions === "object" ? actor.eb_permissions : {}
  ) as Record<string, unknown>;

  const isSuperAdmin = actor.role === "super_admin";
  const isAdmin = isSuperAdmin || actor.role === "admin";

  const isEbHead =
    actor.role === "executive_board" &&
    (actor.eb_rank === "head" ||
      actor.eb_rank === "co_head" ||
      actorEbPerms.manage_department === true ||
      /\bhead\b/i.test(String(actor.title || "")) ||
      actorPerms["applications.view"] === true);

  const headApplicationDepartmentAllowed =
    ALLOWED_HEAD_APPLICATION_DEPTS.has(actorDeptSlug) &&
    (actorDeptSlug !== "media-press" || actorApplicationType !== null);

  const isHead =
    headApplicationDepartmentAllowed &&
    ((actor.role === "department_head" && actorPerms["applications.view"] !== false) ||
      (isEbHead && actorPerms["applications.view"] !== false));

  const canHeadRecommend =
    isSuperAdmin || (isHead && actorPerms["applications.recommend"] !== false);

  return {
    isAdmin,
    isSuperAdmin,
    isHead,
    canHeadRecommend,
    actorDeptSlug,
    actorApplicationType,
    actorGender: getActorGender(actor),
  };
}

export function isHeadActorScopeMatch(
  ctx: ResolvedHeadContext,
  row: HeadPolicyApplicationRow,
  deptSlugById?: ReadonlyMap<string, string>,
): boolean {
  if (!ctx.isHead || !ctx.actorDeptSlug || !ctx.actorGender) return false;

  const appDeptSlug = resolveApplicationDepartmentSlug(
    row.application_type,
    row.department_id,
    deptSlugById,
  );
  const appType = String(row.application_type || "").trim().toLowerCase();
  const appGender = String(row.gender || "").trim().toLowerCase();

  const matchesDept =
    appDeptSlug === ctx.actorDeptSlug ||
    (ctx.actorDeptSlug === "media-press" &&
      (appDeptSlug === "media" || appDeptSlug === "press" || appDeptSlug === "media-press"));

  if (!matchesDept) return false;

  if (
    ctx.actorDeptSlug === "media" ||
    ctx.actorDeptSlug === "press" ||
    ctx.actorDeptSlug === "media-press"
  ) {
    if (!ctx.actorApplicationType || appType !== ctx.actorApplicationType) {
      return false;
    }
  }

  return appGender === ctx.actorGender;
}

export function canHeadAccessApplication(
  ctx: ResolvedHeadContext,
  row: HeadPolicyApplicationRow,
  deptSlugById?: ReadonlyMap<string, string>,
): boolean {
  if (!isHeadActorScopeMatch(ctx, row, deptSlugById)) return false;
  return String(row.status || "").trim().toLowerCase() === "pending";
}

export function redactApplicationForHead<T extends Record<string, unknown>>(row: T): T {
  return {
    ...row,
    decision_by: null,
    decision_by_name: null,
    decision_at: null,
    admin_decision_notes: null,
    review_notes: null,
  };
}
