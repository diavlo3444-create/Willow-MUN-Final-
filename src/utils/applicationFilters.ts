import type {
  AdminUser,
  Application,
  ApplicationCategory,
  ApplicationStatus,
  Department,
  RecommendationDecision,
} from '../types/admin';
import {
  canAccessApplication,
  hasPermission,
  isHrActor,
  normalizeDepartmentSlug,
} from './adminPermissions';

export type SortField =
  | 'submittedAt'
  | 'applicantName'
  | 'departmentId'
  | 'status'
  | 'position'
  | 'category';

export type SortDirection = 'asc' | 'desc';

export type CategoryFilterValue = ApplicationCategory | 'all' | 'staff_group';

export interface ApplicationFilterOptions {
  search?: string;
  departmentId?: string;
  gender?: 'male' | 'female' | 'all';
  category?: CategoryFilterValue;
  position?: string;
  status?: ApplicationStatus | 'all';
  recommendation?: RecommendationDecision | 'all';
  dateFrom?: string;
  dateTo?: string;
  sortField?: SortField;
  sortDirection?: SortDirection;
}

export interface PaginatedResult<T> {
  items: T[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function scopeApplicationsForActor(
  applications: Application[],
  actor: AdminUser | null | undefined,
  departments?: Department[],
): Application[] {
  if (!actor || !actor.isActive || actor.status !== 'active') return [];
  if (!hasPermission(actor, 'applications.view', departments)) return [];

  if (actor.role === 'department_head' || actor.role === 'executive_board') {
    return applications.filter((app) => canAccessApplication(actor, app, departments));
  }
  return applications;
}

export function scopeAcceptedApplicationsForHr(
  applications: Application[],
  actor: AdminUser | null | undefined,
  filters?: { search?: string; departmentId?: string; gender?: 'male' | 'female' | 'all' },
  departments?: Department[],
): Application[] {
  if (!isHrActor(actor, departments)) return [];
  const search = (filters?.search ?? '').trim().toLowerCase();
  const rawDept = filters?.departmentId && filters.departmentId !== 'all' ? filters.departmentId : null;
  const matchedDept = rawDept && departments?.length
    ? departments.find((d) => d.id === rawDept || normalizeDepartmentSlug(d.slug) === normalizeDepartmentSlug(rawDept))
    : null;
  const deptSlug = matchedDept ? normalizeDepartmentSlug(matchedDept.slug) : rawDept ? normalizeDepartmentSlug(rawDept) : null;
  const gender = filters?.gender && filters.gender !== 'all' ? filters.gender : null;

  return applications
    .filter((app) => app.status === 'accepted')
    .filter((app) => {
      if (!rawDept) return true;
      if (app.departmentId === rawDept) return true;
      return normalizeDepartmentSlug(app.departmentId) === deptSlug;
    })
    .filter((app) => (gender ? (app.gender || '').toLowerCase() === gender : true))
    .filter((app) => {
      if (!search) return true;
      const hay = `${app.applicantName} ${app.email} ${app.applicationCode} ${app.schoolOrUniversity} ${app.position} ${app.departmentId}`.toLowerCase();
      return hay.includes(search);
    })
    .sort((a, b) => (b.finalDecisionAt || b.updatedAt || b.submittedAt).localeCompare(a.finalDecisionAt || a.updatedAt || a.submittedAt));
}

export function filterAndSortApplications(
  applications: Application[],
  actor: AdminUser | null | undefined,
  options: ApplicationFilterOptions = {},
): Application[] {
  const scoped = scopeApplicationsForActor(applications, actor);
  const query = (options.search ?? '').trim().toLowerCase();
  const deptFilter = options.departmentId && options.departmentId !== 'all' ? options.departmentId : null;
  const genderFilter = options.gender && options.gender !== 'all' ? options.gender : null;
  const catFilter = options.category && options.category !== 'all' ? options.category : null;
  const posFilter = options.position && options.position !== 'all' ? options.position : null;
  const statusFilter = options.status && options.status !== 'all' ? options.status : null;
  const recFilter =
    options.recommendation && options.recommendation !== 'all' ? options.recommendation : null;
  const dateFromMs = options.dateFrom ? Date.parse(`${options.dateFrom}T00:00:00Z`) : null;
  const dateToMs = options.dateTo ? Date.parse(`${options.dateTo}T23:59:59.999Z`) : null;

  const filtered = scoped.filter((app) => {
    if (deptFilter && app.departmentId !== deptFilter) return false;
    if (genderFilter && (app.gender || '').toLowerCase() !== genderFilter) return false;
    if (catFilter === 'staff_group') {
      if (app.category === 'delegate') return false;
    } else if (catFilter && app.category !== catFilter) {
      return false;
    }
    if (posFilter && app.position !== posFilter) return false;
    if (statusFilter && app.status !== statusFilter) return false;
    if (recFilter && app.headRecommendation !== recFilter) return false;

    if (dateFromMs !== null || dateToMs !== null) {
      const subMs = Date.parse(app.submittedAt);
      if (dateFromMs !== null && !Number.isNaN(dateFromMs) && subMs < dateFromMs) return false;
      if (dateToMs !== null && !Number.isNaN(dateToMs) && subMs > dateToMs) return false;
    }

    if (query) {
      const hay = `${app.applicantName} ${app.email} ${app.applicationCode} ${app.position} ${app.schoolOrUniversity} ${app.category}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  const sortField: SortField = options.sortField ?? 'submittedAt';
  const sortDirection: SortDirection = options.sortDirection ?? 'desc';
  const dir = sortDirection === 'asc' ? 1 : -1;

  return [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'submittedAt':
        cmp = a.submittedAt.localeCompare(b.submittedAt);
        break;
      case 'applicantName':
        cmp = a.applicantName.localeCompare(b.applicantName);
        break;
      case 'departmentId':
        cmp = a.departmentId.localeCompare(b.departmentId);
        break;
      case 'position':
        cmp = a.position.localeCompare(b.position);
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      case 'category':
        cmp = a.category.localeCompare(b.category);
        break;
    }
    if (cmp === 0) return a.id.localeCompare(b.id);
    return cmp * dir;
  });
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const safePageSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    totalItems,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}

export interface ApplicationStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  waitlisted: number;
  withdrawn: number;
  recommended: number;
  recommendedAccept: number;
  recommendedReject: number;
  acceptanceRate: number;
}

export function computeApplicationStats(applications: Application[]): ApplicationStats {
  let pending = 0;
  let accepted = 0;
  let rejected = 0;
  let waitlisted = 0;
  let withdrawn = 0;
  let recommendedAccept = 0;
  let recommendedReject = 0;

  for (const app of applications) {
    switch (app.status) {
      case 'pending':
        pending++;
        break;
      case 'accepted':
        accepted++;
        break;
      case 'rejected':
        rejected++;
        break;
      case 'waitlisted':
        waitlisted++;
        break;
      case 'withdrawn':
        withdrawn++;
        break;
    }
    if (app.headRecommendation === 'recommend_accept') recommendedAccept++;
    if (app.headRecommendation === 'recommend_reject') recommendedReject++;
  }

  const decided = accepted + rejected;
  const acceptanceRate = decided > 0 ? Math.round((accepted / decided) * 100) : 0;

  return {
    total: applications.length,
    pending,
    accepted,
    rejected,
    waitlisted,
    withdrawn,
    recommended: recommendedAccept + recommendedReject,
    recommendedAccept,
    recommendedReject,
    acceptanceRate,
  };
}

export interface DepartmentApplicationBreakdown {
  departmentId: string;
  departmentName: string;
  cluster: string;
  total: number;
  pending: number;
  recommended: number;
  accepted: number;
  rejected: number;
  waitlisted: number;
  capacity: number;
  registrationOpen: boolean;
}

export function computeDepartmentBreakdown(
  applications: Application[],
  departments: Department[],
): DepartmentApplicationBreakdown[] {
  return departments.map((dept) => {
    const deptApps = applications.filter((a) => a.departmentId === dept.id);
    const stats = computeApplicationStats(deptApps);
    return {
      departmentId: dept.id,
      departmentName: dept.name,
      cluster: dept.cluster,
      total: stats.total,
      pending: stats.pending,
      recommended: stats.recommendedAccept,
      accepted: stats.accepted,
      rejected: stats.rejected,
      waitlisted: stats.waitlisted,
      capacity: dept.capacity,
      registrationOpen: dept.registrationOpen,
    };
  });
}

export interface DailyApplicationTrendPoint {
  dateKey: string;
  label: string;
  count: number;
}

export function computeDailyApplicationTrend(
  applications: Application[],
  days = 14,
): DailyApplicationTrendPoint[] {
  const byDate = new Map<string, number>();
  for (const app of applications) {
    const key = app.submittedAt.slice(0, 10);
    byDate.set(key, (byDate.get(key) ?? 0) + 1);
  }

  // Build continuous 14-day window ending on the latest submission day (or today)
  const sortedExisting = Array.from(byDate.keys()).sort();
  const anchorIso = sortedExisting[sortedExisting.length - 1] ?? new Date().toISOString().slice(0, 10);
  const anchorDate = new Date(`${anchorIso}T00:00:00Z`);

  const points: DailyApplicationTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(anchorDate);
    d.setUTCDate(anchorDate.getUTCDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    points.push({
      dateKey,
      label,
      count: byDate.get(dateKey) ?? 0,
    });
  }
  return points;
}

function csvEscape(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildApplicationsCsv(
  applications: Application[],
  departments: Department[],
): string {
  const deptNameById = new Map(departments.map((d) => [d.id, d.name]));
  const headers = [
    'Application ID',
    'Category',
    'Applicant Name',
    'Email',
    'Phone',
    'Guardian Phone',
    'Department',
    'Position',
    'Status',
    'Head Recommendation',
    'Institution',
    'Grade',
    'Camera Model',
    'Submitted At',
  ];
  const rows = applications.map((app) =>
    [
      app.applicationCode,
      app.category,
      app.applicantName,
      app.email,
      app.phone,
      app.guardianPhone || '',
      deptNameById.get(app.departmentId) ?? app.departmentId,
      app.position,
      app.status,
      app.headRecommendation,
      app.schoolOrUniversity,
      app.gradeOrYear,
      app.cameraModel || '',
      app.submittedAt,
    ]
      .map(csvEscape)
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

export const exportApplicationsToCsv = buildApplicationsCsv;
