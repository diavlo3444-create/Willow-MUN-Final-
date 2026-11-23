import { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Link2,
  Search,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type { ApplicationStatus, RecommendationDecision } from '../../../types/admin';
import { hasPermission } from '../../../utils/adminPermissions';
import {
  buildApplicationsCsv,
  filterAndSortApplications,
  paginateItems,
  scopeApplicationsForActor,
  type CategoryFilterValue,
  type SortDirection,
  type SortField,
} from '../../../utils/applicationFilters';
import { ConfirmDialog } from '../ConfirmDialog';
import { RecommendationBadge, StatusBadge } from '../StatusBadge';
import { ApplicationDetailView } from './ApplicationDetailView';

interface ApplicationsViewProps {
  viewMode?: 'all' | 'delegate' | 'staff_group' | 'recommendations';
  lockedDepartmentId?: string | null;
  initialDepartmentFilter?: string;
  initialStatusFilter?: ApplicationStatus | 'all';
  externalSearch?: string;
  selectedApplicationIdFromRoute?: string | null;
  onSelectApplicationId?: (id: string | null) => void;
  onNavigateToEmailWithIds?: (ids: string[]) => void;
  actingUserOverride?: ReturnType<typeof useAdminStore>['testModeHeadUser'];
}

const PAGE_SIZE = 10;

export function ApplicationsView({
  viewMode = 'all',
  lockedDepartmentId = null,
  initialDepartmentFilter = 'all',
  initialStatusFilter = 'all',
  externalSearch = '',
  selectedApplicationIdFromRoute = null,
  onSelectApplicationId,
  onNavigateToEmailWithIds,
  actingUserOverride = null,
}: ApplicationsViewProps) {
  const {
    data,
    currentUser,
    pushToast,
    updateApplicationStatus,
    overrideApplicationDecision,
    bulkUpdateApplicationStatus,
    bulkApproveRecommended,
    bulkGenerateSignupLinks,
  } = useAdminStore();

  const effectiveActor = actingUserOverride ?? currentUser;

  const [search, setSearch] = useState(externalSearch);
  const [departmentFilter, setDepartmentFilter] = useState<string>(
    lockedDepartmentId ?? initialDepartmentFilter,
  );
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>(
    viewMode === 'delegate'
      ? 'delegate'
      : viewMode === 'staff_group'
        ? 'staff_group'
        : 'all',
  );
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>(
    viewMode === 'recommendations' ? 'pending' : initialStatusFilter,
  );
  const [recommendationFilter, setRecommendationFilter] = useState<RecommendationDecision | 'all'>(
    viewMode === 'recommendations' ? 'recommend_accept' : 'all',
  );
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateControls, setShowDateControls] = useState(false);
  const [sortField, setSortField] = useState<SortField>('submittedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalAppId, setModalAppId] = useState<string | null>(null);
  const [overrideAppId, setOverrideAppId] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<ApplicationStatus>('pending');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<{
    status: ApplicationStatus;
    label: string;
  } | null>(null);

  const effectiveSearch = externalSearch || search;
  const effectiveDeptFilter = lockedDepartmentId ?? departmentFilter;

  const scopedAll = useMemo(
    () => scopeApplicationsForActor(data.applications, effectiveActor),
    [data.applications, effectiveActor],
  );

  const availablePositions = useMemo(() => {
    const set = new Set<string>();
    for (const app of scopedAll) {
      if (effectiveDeptFilter === 'all' || app.departmentId === effectiveDeptFilter) {
        set.add(app.position);
      }
    }
    return Array.from(set).sort();
  }, [effectiveDeptFilter, scopedAll]);

  const filtered = useMemo(
    () =>
      filterAndSortApplications(data.applications, effectiveActor, {
        search: effectiveSearch,
        departmentId: effectiveDeptFilter,
        category:
          viewMode === 'delegate'
            ? 'delegate'
            : viewMode === 'staff_group'
              ? categoryFilter === 'all'
                ? 'staff_group'
                : categoryFilter
              : categoryFilter,
        position: positionFilter,
        status: statusFilter,
        recommendation: recommendationFilter,
        dateFrom,
        dateTo,
        sortField,
        sortDirection,
      }),
    [
      categoryFilter,
      data.applications,
      dateFrom,
      dateTo,
      effectiveActor,
      effectiveDeptFilter,
      effectiveSearch,
      positionFilter,
      recommendationFilter,
      sortDirection,
      sortField,
      statusFilter,
      viewMode,
    ],
  );

  const paginated = useMemo(() => paginateItems(filtered, page, PAGE_SIZE), [filtered, page]);
  const deptNameById = useMemo(
    () => new Map(data.departments.map((d) => [d.id, d.name])),
    [data.departments],
  );

  const canReview =
    hasPermission(effectiveActor, 'applications.review') &&
    effectiveActor?.role !== 'department_head';
  const canBulk =
    hasPermission(effectiveActor, 'applications.bulk_actions') &&
    effectiveActor?.role !== 'department_head';
  const canExport = hasPermission(effectiveActor, 'applications.export');
  const canManageLinks =
    hasPermission(effectiveActor, 'applications.signup_links') &&
    effectiveActor?.role !== 'department_head';

  const activeRouteAppId = selectedApplicationIdFromRoute ?? modalAppId;
  if (activeRouteAppId) {
    const found = data.applications.find((a) => a.id === activeRouteAppId);
    return (
      <ApplicationDetailView
        application={found}
        isStandaloneRoute={Boolean(selectedApplicationIdFromRoute)}
        actingUserOverride={actingUserOverride}
        onClose={() => {
          setModalAppId(null);
          onSelectApplicationId?.(null);
        }}
        onPrepareEmail={
          onNavigateToEmailWithIds ? (id) => onNavigateToEmailWithIds([id]) : undefined
        }
      />
    );
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const allOnPageSelected =
    paginated.items.length > 0 && paginated.items.every((a) => selectedIds.includes(a.id));

  const togglePageAll = () => {
    if (allOnPageSelected) {
      const pageSet = new Set(paginated.items.map((a) => a.id));
      setSelectedIds((prev) => prev.filter((id) => !pageSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...paginated.items.map((a) => a.id)]);
      setSelectedIds(Array.from(merged));
    }
  };

  const handleDownloadCsv = () => {
    const csv = buildApplicationsCsv(filtered, data.departments);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `willow-mun-applications-${viewMode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    pushToast({ tone: 'success', title: `Exported ${filtered.length} application rows to CSV` });
  };

  const recommendedCount = filtered.filter(
    (a) => a.status === 'pending' && a.headRecommendation === 'recommend_accept',
  ).length;

  return (
    <div className="space-y-4">
      {viewMode === 'recommendations' && (
        <div className="wm-surface-panel bg-[#1b2210] px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--wm-ink)]">
              Stage 2 Administrative Review Queue
            </p>
            <p className="text-xs text-[color:var(--wm-ink-secondary)] mt-0.5">
              Department Heads have screened candidates in Stage 1. Confirm or reject recommendations
              here; no applicant becomes Accepted until Stage 2 approval.
            </p>
          </div>
          {canBulk && recommendedCount > 0 && (
            <button
              type="button"
              onClick={() => bulkApproveRecommended(effectiveDeptFilter)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer transition-colors duration-150"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>Bulk Approve {recommendedCount} Recommended</span>
            </button>
          )}
        </div>
      )}

      {/* Compact Filter Ledger Bar */}
      <div className="wm-surface-panel p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, email, ID..."
              className="h-9 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]/70 focus:border-[color:var(--wm-focal)] focus:outline-none"
            />
          </div>

          {!lockedDepartmentId && (
            <select
              aria-label="Filter by department"
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPositionFilter('all');
                setPage(1);
              }}
              className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)] focus:border-[color:var(--wm-focal)] focus:outline-none"
            >
              <option value="all">All Departments</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          {viewMode !== 'delegate' && (
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value as CategoryFilterValue);
                setPage(1);
              }}
              className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)] focus:border-[color:var(--wm-focal)] focus:outline-none"
            >
              {viewMode === 'staff_group' ? (
                <>
                  <option value="staff_group">All Non-Delegate Staff</option>
                  <option value="staff">Organizing Staff</option>
                  <option value="media">Media</option>
                  <option value="press">Press</option>
                  <option value="volunteer">Volunteers</option>
                  <option value="security">Security Corps</option>
                </>
              ) : (
                <>
                  <option value="all">All Categories</option>
                  <option value="delegate">Delegates &amp; Chairs</option>
                  <option value="staff">Organizing Staff</option>
                  <option value="media">Media</option>
                  <option value="press">Press</option>
                  <option value="volunteer">Volunteers</option>
                  <option value="security">Security Corps</option>
                </>
              )}
            </select>
          )}

          <select
            aria-label="Filter by position"
            value={positionFilter}
            onChange={(e) => {
              setPositionFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)] focus:border-[color:var(--wm-focal)] focus:outline-none"
          >
            <option value="all">All Positions</option>
            {availablePositions.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ApplicationStatus | 'all');
              setPage(1);
            }}
            className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)] focus:border-[color:var(--wm-focal)] focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="waitlisted">Waitlisted</option>
            <option value="withdrawn">Withdrawn</option>
          </select>

          <select
            aria-label="Filter by Stage 1 recommendation"
            value={recommendationFilter}
            onChange={(e) => {
              setRecommendationFilter(e.target.value as RecommendationDecision | 'all');
              setPage(1);
            }}
            className="h-9 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-3 text-xs text-[color:var(--wm-ink)] focus:border-[color:var(--wm-focal)] focus:outline-none"
          >
            <option value="all">All Recommendations</option>
            <option value="recommend_accept">Recommend Accept</option>
            <option value="recommend_reject">Recommend Reject</option>
            <option value="none">Awaiting Stage 1</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-[color:var(--wm-hairline)] text-xs text-[color:var(--wm-ink-secondary)]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="tabular-nums">
              Showing <strong className="text-[color:var(--wm-ink)]">{filtered.length}</strong>{' '}
              record{filtered.length === 1 ? '' : 's'}
            </span>

            <button
              type="button"
              onClick={() => setShowDateControls((p) => !p)}
              aria-expanded={showDateControls}
              className="inline-flex h-7 items-center gap-1.5 rounded border border-[color:var(--wm-hairline)] px-2.5 text-[11px] font-medium text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)] cursor-pointer"
            >
              <Calendar className="h-3 w-3 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <span>{dateFrom || dateTo ? 'Date Range Active' : 'Filter by Dates'}</span>
            </button>

            {(showDateControls || dateFrom || dateTo) && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5">
                  <span className="text-[color:var(--wm-ink-muted)]">From:</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-7 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2 text-xs text-[color:var(--wm-ink)]"
                  />
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <span className="text-[color:var(--wm-ink-muted)]">To:</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-7 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] px-2 text-xs text-[color:var(--wm-ink)]"
                  />
                </label>
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="text-[color:var(--wm-accent)] hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {canExport && (
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer transition-colors duration-150"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Contextual Bulk Action Strip */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--wm-accent)]/45 bg-[color:var(--wm-overlay)] px-4 py-3 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--wm-ink)]">
            <CheckSquare className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
            <span className="tabular-nums">{selectedIds.length} selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canBulk && (
              <>
                <button
                  type="button"
                  onClick={() => setBulkConfirm({ status: 'accepted', label: 'Accept Selected' })}
                  className="min-h-[34px] rounded border border-emerald-400/35 bg-emerald-500/15 px-3 text-xs font-medium text-emerald-100 hover:bg-emerald-500/25 cursor-pointer"
                >
                  Bulk Accept
                </button>
                <button
                  type="button"
                  onClick={() => setBulkConfirm({ status: 'waitlisted', label: 'Waitlist Selected' })}
                  className="min-h-[34px] rounded border border-sky-400/35 bg-sky-500/10 px-3 text-xs font-medium text-sky-200 hover:bg-sky-500/20 cursor-pointer"
                >
                  Waitlist
                </button>
                <button
                  type="button"
                  onClick={() => setBulkConfirm({ status: 'rejected', label: 'Reject Selected' })}
                  className="min-h-[34px] rounded border border-rose-400/35 bg-rose-500/15 px-3 text-xs font-medium text-rose-100 hover:bg-rose-500/25 cursor-pointer"
                >
                  Bulk Reject
                </button>
              </>
            )}
            {canManageLinks && (
              <button
                type="button"
                onClick={() => {
                  bulkGenerateSignupLinks(selectedIds);
                  setSelectedIds([]);
                }}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded border border-[color:var(--wm-hairline-strong)] px-3 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
              >
                <Link2 className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
                <span>Generate Signup Links</span>
              </button>
            )}
            {onNavigateToEmailWithIds && (
              <button
                type="button"
                onClick={() => onNavigateToEmailWithIds(selectedIds)}
                className="min-h-[34px] rounded bg-[color:var(--wm-focal)] px-3 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
              >
                Email Selected
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="min-h-[34px] rounded px-2.5 text-xs text-[color:var(--wm-ink-muted)] hover:text-[color:var(--wm-ink)] cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* High-Density Ledger Table */}
      <div className="wm-surface-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wm-ink-muted)]">
              <tr>
                <th className="py-3 pl-4 pr-2 w-9">
                  <input
                    type="checkbox"
                    aria-label="Select all applications on page"
                    checked={allOnPageSelected}
                    onChange={togglePageAll}
                    className="h-4 w-4 accent-[#a9b47e] cursor-pointer"
                  />
                </th>
                <th
                  aria-sort={
                    sortField === 'applicantName'
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  className="py-3 px-3"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort('applicantName')}
                    className="inline-flex items-center gap-1 font-semibold hover:text-[color:var(--wm-ink)] cursor-pointer"
                  >
                    <span>Applicant</span>
                    <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
                  </button>
                </th>
                <th className="py-3 px-3">Track & Role</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">Stage 1</th>
                <th className="py-3 px-3">Stage 2 Status</th>
                <th className="py-3 px-3">Signup Invite</th>
                <th
                  aria-sort={
                    sortField === 'submittedAt'
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  className="py-3 px-3"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort('submittedAt')}
                    className="inline-flex items-center gap-1 font-semibold hover:text-[color:var(--wm-ink)] cursor-pointer"
                  >
                    <span>Submitted</span>
                    <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
                  </button>
                </th>
                <th className="py-3 pl-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--wm-hairline)]">
              {paginated.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-12 text-center text-sm text-[color:var(--wm-ink-muted)]"
                  >
                    No applications match the active filter criteria.
                  </td>
                </tr>
              ) : (
                paginated.items.map((app) => {
                  const deptName = deptNameById.get(app.departmentId) ?? app.departmentId;
                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-[#ede6ca]/[0.03] transition-colors duration-150"
                    >
                      <td className="py-3 pl-4 pr-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${app.applicantName}`}
                          checked={selectedIds.includes(app.id)}
                          onChange={() => toggleRow(app.id)}
                          className="h-4 w-4 accent-[#a9b47e] cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() =>
                            onSelectApplicationId ? onSelectApplicationId(app.id) : setModalAppId(app.id)
                          }
                          className="font-semibold text-[color:var(--wm-ink)] hover:text-[color:var(--wm-accent)] text-left cursor-pointer"
                        >
                          {app.applicantName}
                        </button>
                        <p className="mt-0.5 font-mono text-[11px] text-[color:var(--wm-ink-muted)]">
                          {app.applicationCode} · {app.schoolOrUniversity}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--wm-accent)]">
                          {app.category}
                        </p>
                        <p className="text-[color:var(--wm-ink)]">{app.position}</p>
                      </td>
                      <td className="py-3 px-3 text-[color:var(--wm-ink-secondary)]">{deptName}</td>
                      <td className="py-3 px-3">
                        <RecommendationBadge decision={app.headRecommendation} />
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="py-3 px-3">
                        {app.signupLinkToken ? (
                          <button
                            type="button"
                            onClick={() => {
                              const url = `${window.location.origin}/portal?invite=${app.signupLinkToken}`;
                              navigator.clipboard?.writeText(url).catch(() => undefined);
                              pushToast({
                                tone: 'success',
                                title: `Copied ${app.signupLinkToken}`,
                                description: `Status: ${app.signupLinkStatus}`,
                              });
                            }}
                            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[color:var(--wm-accent)] hover:text-[color:var(--wm-ink)] cursor-pointer"
                          >
                            <Copy className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span>{app.signupLinkStatus}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-[color:var(--wm-ink-muted)]/60">
                            Not issued
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-[color:var(--wm-ink-secondary)] tabular-nums whitespace-nowrap">
                        {new Date(app.submittedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3 pl-3 pr-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              onSelectApplicationId
                                ? onSelectApplicationId(app.id)
                                : setModalAppId(app.id)
                            }
                            className="inline-flex h-8 items-center gap-1 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-xs font-medium text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Open</span>
                          </button>
                          {(effectiveActor?.role === 'super_admin' || effectiveActor?.title?.trim().toLowerCase() === 'super admin') && (
                            <button
                              type="button"
                              onClick={() => {
                                setOverrideAppId(app.id);
                                setOverrideStatus(app.status);
                                setOverrideReason('');
                              }}
                              className="h-8 rounded border border-amber-400/40 bg-amber-500/10 px-2.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20 cursor-pointer"
                            >
                              Override
                            </button>
                          )}
                          {canReview && app.status !== 'accepted' && (
                            <button
                              type="button"
                              onClick={() => updateApplicationStatus(app.id, 'accepted')}
                              className="h-8 rounded border border-emerald-400/35 bg-emerald-500/12 px-2.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                            >
                              Accept
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-4 py-3 text-xs text-[color:var(--wm-ink-secondary)]">
          <span className="tabular-nums">
            Page <strong className="text-[color:var(--wm-ink)]">{paginated.page}</strong> of{' '}
            <strong className="text-[color:var(--wm-ink)]">{paginated.totalPages}</strong> (
            {paginated.totalItems} records)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={paginated.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink)] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={paginated.page >= paginated.totalPages}
              onClick={() => setPage((p) => Math.min(paginated.totalPages, p + 1))}
              aria-label="Next page"
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-[color:var(--wm-hairline-strong)] text-[color:var(--wm-ink)] disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {overrideAppId && (() => {
        const target = data.applications.find((item) => item.id === overrideAppId);
        if (!target) return null;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-amber-400/30 bg-[color:var(--wm-surface)] p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[color:var(--wm-ink)]">Override Admin Decision</h2>
                  <p className="mt-1 text-sm text-[color:var(--wm-ink-muted)]">{target.applicantName} · {target.applicationCode}</p>
                </div>
                <span className="rounded border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">Super Admin</span>
              </div>
              <div className="mt-4 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] p-3 text-sm text-[color:var(--wm-ink-secondary)]">
                Current decision: <strong className="text-[color:var(--wm-ink)]">{target.status}</strong>
              </div>
              <label className="mt-4 block text-xs font-medium text-[color:var(--wm-ink-secondary)]">New decision</label>
              <select value={overrideStatus} onChange={(e) => setOverrideStatus(e.target.value as ApplicationStatus)} className="mt-1 w-full rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-sm text-[color:var(--wm-ink)]">
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="waitlisted">Waitlisted</option>
              </select>
              <label className="mt-4 block text-xs font-medium text-[color:var(--wm-ink-secondary)]">Override reason (required)</label>
              <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={3} placeholder="Explain why the original decision is being overridden..." className="mt-1 w-full resize-y rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-2 text-sm text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]" />
              <p className="mt-2 text-xs text-[color:var(--wm-ink-muted)]">The previous and new decisions, reason, Super Admin identity, and timestamp will be saved in the override audit history.</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={overrideSaving} onClick={() => setOverrideAppId(null)} className="rounded border border-[color:var(--wm-hairline-strong)] px-3 py-2 text-sm text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 disabled:opacity-50">Cancel</button>
                <button type="button" disabled={overrideSaving || overrideReason.trim().length < 8} onClick={async () => {
                  setOverrideSaving(true);
                  const success = await overrideApplicationDecision(overrideAppId, overrideStatus, overrideReason.trim());
                  setOverrideSaving(false);
                  if (success) setOverrideAppId(null);
                }} className="rounded border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40">{overrideSaving ? 'Saving...' : 'Confirm Override'}</button>
              </div>
            </div>
          </div>
        );
      })()}
      <ConfirmDialog
        open={bulkConfirm !== null}
        title={bulkConfirm?.label ?? 'Confirm Bulk Action'}
        description={`Apply Stage 2 final decision (${bulkConfirm?.status}) across ${selectedIds.length} selected application(s)?`}
        confirmLabel={bulkConfirm?.label ?? 'Confirm'}
        tone={bulkConfirm?.status === 'rejected' ? 'danger' : 'primary'}
        onConfirm={() => {
          if (!bulkConfirm) return;
          bulkUpdateApplicationStatus(selectedIds, bulkConfirm.status);
          setSelectedIds([]);
          setBulkConfirm(null);
        }}
        onCancel={() => setBulkConfirm(null)}
      />
    </div>
  );
}
