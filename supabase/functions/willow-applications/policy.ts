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

export function normalizeDeptSlug(value: unknown): string {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return "";
  if (clean === "volunteer" || clean === "volunteering" || clean === "volunteers") return "volunteers";
  if (clean === "human-resources" || clean === "human_resources" || clean === "human resources") return "hr";
  if (clean === "delegate-affairs" || clean === "delegate_affairs" || clean === "delegate affairs" || clean === "delegate") return "dcc";
  if (clean === "public-relations" || clean === "public_relations" || clean === "public relations") return "pr";
  if (clean === "information-technology" || clean === "information_technology" || clean === "information technology") return "it";
  if (clean === "ceremonies" || clean === "ceremony") return "ceremony";
  if (clean === "media_press") return "media-press";
  return clean;
}

export function inferDeptSlugFromLabel(labelRaw: string): string {
  const label = String(labelRaw || "").toLowerCase();
  if (!label) return "";
  if (/\b(hr|human\s+resources)\b/.test(label)) return "hr";
  if (/\b(dcc|delegate\s+affairs|delegate\s+care)\b/.test(label)) return "dcc";
  if (/\bpress\b/.test(label) && !/\bmedia\b/.test(label)) return "press";
  if (/\bmedia\b/.test(label) && !/\bpress\b/.test(label)) return "media";
  if (/\b(press|journalis[tm]|reporter|correspondent|editorial)\b/.test(label)) return "press";
  if (/\b(media|photograph(y|er)|videograph(y|er)|broadcast|reel)\b/.test(label)) return "media";
  if (/\b(security|guard|checkpoint|entrance\s+control)\b/.test(label)) return "security";
  if (/\b(volunteers?|volunteering|usher|floor\s+team)\b/.test(label)) return "volunteers";
  if (/\b(pr|public\s+relations)\b/.test(label)) return "pr";
  if (/\b(marketing|outreach)\b/.test(label)) return "marketing";
  if (/\b(logistics)\b/.test(label)) return "logistics";
  if (/\b(ceremon(y|ies))\b/.test(label)) return "ceremony";
  if (/\b(finance|treasury)\b/.test(label)) return "finance";
  if (/\b(it|information\s+technology|technical|systems)\b/.test(label)) return "it";
  if (/\b(design|creative|visual)\b/.test(label)) return "design";
  return "";
}

export function mapDepartment(appType: string, explicitDept?: string | null): string {
  const normalizedType = normalizeDeptSlug(appType);
  const rawExplicit = String(explicitDept || "").trim();
  const cleanExplicit = normalizeDeptSlug(rawExplicit);
  const looksLikeUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawExplicit) ||
    /^legacy-/i.test(rawExplicit);

  if (
    cleanExplicit &&
    !looksLikeUuid &&
    !(
      (normalizedType === "media" || normalizedType === "press") &&
      (cleanExplicit === "media-press" || cleanExplicit === "general")
    )
  ) {
    return cleanExplicit;
  }
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
    case "dcc":
      return "dcc";
    case "hr":
      return "hr";
    case "pr":
      return "pr";
    case "marketing":
      return "marketing";
    case "design":
      return "design";
    case "logistics":
      return "logistics";
    case "ceremony":
    case "ceremonies":
      return "ceremony";
    case "finance":
      return "finance";
    case "it":
      return "it";
    default:
      return normalizedType || String(appType || "general").trim().toLowerCase();
  }
}

export function resolveApplicationDepartmentSlug(
  applicationType: string | null | undefined,
  explicitDept: string | null | undefined,
  deptSlugById?: ReadonlyMap<string, string>,
): string {
  const normalizedType = normalizeDeptSlug(applicationType);
  const rawExplicit = String(explicitDept || "").trim();
  if (rawExplicit && deptSlugById) {
    const byExact = deptSlugById.get(rawExplicit.toLowerCase());
    if (byExact) {
      const normalizedMatched = normalizeDeptSlug(byExact);
      if (
        !(
          (normalizedType === "media" || normalizedType === "press") &&
          (normalizedMatched === "media-press" || normalizedMatched === "general")
        )
      ) {
        return normalizedMatched;
      }
    }
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
  if (/\b(female|women|woman|girls?)\b/.test(label)) return "female";
  if (/\b(male|men|man|boys?)\b/.test(label)) return "male";
  return null;
}

export function resolveHeadContext(
  actor: HeadPolicyActorInput,
  actorDeptSlugRaw: string | null | undefined,
): ResolvedHeadContext {
  const actorLabel = `${actor.title || ""} ${actor.division || ""}`.toLowerCase();
  const normalizedRawDept = normalizeDeptSlug(actorDeptSlugRaw);
  const actorDeptSlug =
    (normalizedRawDept &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedRawDept)
      ? normalizedRawDept
      : "") || inferDeptSlugFromLabel(actorLabel);

  const hasPressWord = /\bpress\b/.test(actorLabel);
  const hasMediaWord = /\bmedia\b/.test(actorLabel);
  const exclusiveLabelType: "media" | "press" | null =
    hasPressWord && !hasMediaWord
      ? "press"
      : hasMediaWord && !hasPressWord
        ? "media"
        : null;
  const combinedLabelType: "media" | "press" | null = hasPressWord
    ? "press"
    : hasMediaWord
      ? "media"
      : null;

  const actorApplicationType: "media" | "press" | null =
    actorDeptSlug === "press" || actorDeptSlug === "media"
      ? exclusiveLabelType ?? actorDeptSlug
      : actorDeptSlug === "media-press"
        ? combinedLabelType
        : null;

  const actorPerms = (
    actor.permissions && typeof actor.permissions === "object" ? actor.permissions : {}
  ) as Record<string, unknown>;
  const actorEbPerms = (
    actor.eb_permissions && typeof actor.eb_permissions === "object" ? actor.eb_permissions : {}
  ) as Record<string, unknown>;

  const isSuperAdmin = actor.role === "super_admin";
  const isAdmin = isSuperAdmin || actor.role === "admin";

  const normalizedRank = String(actor.eb_rank || "").trim().toLowerCase().replace(/-/g, "_");
  const isEbHead =
    actor.role === "executive_board" &&
    (normalizedRank === "head" ||
      normalizedRank === "co_head" ||
      normalizedRank === "cohead" ||
      actorEbPerms.manage_department === true ||
      /\b(head|co-head|cohead|director|lead)\b/i.test(String(actor.title || "")) ||
      actorPerms["applications.view"] === true);

  const headApplicationDepartmentAllowed =
    Boolean(actorDeptSlug) &&
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
  if (!ctx.isHead || !ctx.actorDeptSlug) return false;

  const appDeptSlug = resolveApplicationDepartmentSlug(
    row.application_type,
    row.department_id,
    deptSlugById,
  );
  const appType = String(row.application_type || "").trim().toLowerCase();
  const rawAppGender = String(row.gender || "").trim().toLowerCase();
  const appGender =
    rawAppGender === "female" || rawAppGender === "woman" || rawAppGender === "women"
      ? "female"
      : rawAppGender === "male" || rawAppGender === "man" || rawAppGender === "men"
        ? "male"
        : rawAppGender;

  const matchesDept =
    appDeptSlug === ctx.actorDeptSlug ||
    (ctx.actorDeptSlug === "media-press" &&
      (appDeptSlug === "media" || appDeptSlug === "press" || appDeptSlug === "media-press")) ||
    ((ctx.actorDeptSlug === "media" || ctx.actorDeptSlug === "press") &&
      (appDeptSlug === "media-press" || appType === ctx.actorDeptSlug));

  if (!matchesDept) return false;

  if (
    ctx.actorDeptSlug === "media" ||
    ctx.actorDeptSlug === "press" ||
    ctx.actorDeptSlug === "media-press"
  ) {
    const effectiveTrack =
      appType === "media" || appType === "press"
        ? appType
        : appDeptSlug === "media" || appDeptSlug === "press"
          ? appDeptSlug
          : "";
    if (!ctx.actorApplicationType || !effectiveTrack || effectiveTrack !== ctx.actorApplicationType) {
      return false;
    }
  }

  if (ctx.actorGender) {
    return Boolean(appGender) && appGender === ctx.actorGender;
  }

  return true;
}

export function canHeadAccessApplication(
  ctx: ResolvedHeadContext,
  row: HeadPolicyApplicationRow,
  deptSlugById?: ReadonlyMap<string, string>,
): boolean {
  return isHeadActorScopeMatch(ctx, row, deptSlugById);
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
