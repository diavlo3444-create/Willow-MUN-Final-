import { useMemo, useState } from 'react';
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Search,
  Send,
  Square,
  X,
} from 'lucide-react';
import type {
  ApplicantDecisionStatus,
  ApplicantEmailStatus,
  EmailApplicantRecord,
  EmailDecisionType,
} from './types';

interface ApplicantsBulkTabProps {
  applicants: EmailApplicantRecord[];
  selectedIds: string[];
  onToggleOne: (id: string) => void;
  onSelectMany: (ids: string[]) => void;
  onClearSelection: () => void;
  onRequestSendSelected: (recipients: EmailApplicantRecord[], preferredType?: EmailDecisionType) => void;
  onResend: (applicant: EmailApplicantRecord) => void;
}

const APP_STATUS_BADGE: Record<
  ApplicantDecisionStatus,
  { label: string; classes: string }
> = {
  accepted: {
    label: 'Accepted',
    classes: 'border-emerald-400/30 bg-emerald-500/[0.1] text-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    classes: 'border-rose-400/30 bg-rose-500/[0.1] text-rose-200',
  },
  pending: {
    label: 'Pending',
    classes: 'border-amber-400/30 bg-amber-500/[0.09] text-amber-200',
  },
};

const EMAIL_STATUS_BADGE: Record<
  ApplicantEmailStatus,
  { label: string; classes: string }
> = {
  not_sent: {
    label: 'Not sent',
    classes: 'border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] text-[color:var(--wm-ink-secondary)]',
  },
  sent: {
    label: 'Sent',
    classes: 'border-emerald-400/30 bg-emerald-500/[0.1] text-emerald-200',
  },
  failed: {
    label: 'Failed',
    classes: 'border-rose-400/30 bg-rose-500/[0.1] text-rose-200',
  },
};

export function ApplicantsBulkTab({
  applicants,
  selectedIds,
  onToggleOne,
  onSelectMany,
  onClearSelection,
  onRequestSendSelected,
  onResend,
}: ApplicantsBulkTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [appStatusFilter, setAppStatusFilter] = useState<ApplicantDecisionStatus | 'all'>('all');
  const [emailStatusFilter, setEmailStatusFilter] = useState<ApplicantEmailStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const departments = useMemo(
    () => Array.from(new Set(applicants.map((a) => a.department))).sort(),
    [applicants],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return applicants.filter((item) => {
      if (departmentFilter !== 'all' && item.department !== departmentFilter) return false;
      if (appStatusFilter !== 'all' && item.applicationStatus !== appStatusFilter) return false;
      if (emailStatusFilter !== 'all' && item.emailStatus !== emailStatusFilter) return false;
      if (!q) return true;
      return (
        item.applicantName.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q)
      );
    });
  }, [applicants, searchQuery, departmentFilter, appStatusFilter, emailStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedApplicants = useMemo(
    () => applicants.filter((a) => selectedSet.has(a.id)),
    [applicants, selectedSet],
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((item) => selectedSet.has(item.id));
  const allCurrentPageSelected =
    paginatedRows.length > 0 && paginatedRows.every((item) => selectedSet.has(item.id));

  const toggleAllMatchingFilters = () => {
    if (allFilteredSelected) {
      const filteredIdSet = new Set(filtered.map((f) => f.id));
      onSelectMany(selectedIds.filter((id) => !filteredIdSet.has(id)));
    } else {
      const merged = Array.from(new Set([...selectedIds, ...filtered.map((f) => f.id)]));
      onSelectMany(merged);
    }
  };

  const toggleCurrentPage = () => {
    const pageIds = paginatedRows.map((p) => p.id);
    if (allCurrentPageSelected) {
      const pageSet = new Set(pageIds);
      onSelectMany(selectedIds.filter((id) => !pageSet.has(id)));
    } else {
      onSelectMany(Array.from(new Set([...selectedIds, ...pageIds])));
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('all');
    setAppStatusFilter('all');
    setEmailStatusFilter('all');
    setPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    departmentFilter !== 'all' ||
    appStatusFilter !== 'all' ||
    emailStatusFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* Search & Multi-Filter Controls */}
      <section
        aria-label="Filter applicants"
        className="wm-surface-panel p-4 space-y-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <label htmlFor="emails-applicant-search" className="sr-only">
              Search by applicant name or email
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
                aria-hidden="true"
              />
              <input
                id="emails-applicant-search"
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search applicant name or email..."
                className="h-9 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] pl-9 pr-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)]"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="emails-dept-filter" className="sr-only">
              Filter by department
            </label>
            <select
              id="emails-dept-filter"
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-xs text-[color:var(--wm-ink)]"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="emails-app-status-filter" className="sr-only">
              Filter by application status
            </label>
            <select
              id="emails-app-status-filter"
              value={appStatusFilter}
              onChange={(e) => {
                setAppStatusFilter(e.target.value as ApplicantDecisionStatus | 'all');
                setPage(1);
              }}
              className="h-9 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-xs text-[color:var(--wm-ink)]"
            >
              <option value="all">All App Statuses</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="lg:col-span-3 flex items-center gap-2">
            <label htmlFor="emails-delivery-status-filter" className="sr-only">
              Filter by email status
            </label>
            <select
              id="emails-delivery-status-filter"
              value={emailStatusFilter}
              onChange={(e) => {
                setEmailStatusFilter(e.target.value as ApplicantEmailStatus | 'all');
                setPage(1);
              }}
              className="h-9 flex-1 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2.5 text-xs text-[color:var(--wm-ink)]"
            >
              <option value="all">All Email Statuses</option>
              <option value="not_sent">Not sent</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-[color:var(--wm-hairline-strong)] px-2.5 text-[11px] text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-overlay)] hover:text-[color:var(--wm-ink)] cursor-pointer whitespace-nowrap"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--wm-hairline)] pt-3 text-[11px] text-[color:var(--wm-ink-muted)]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="tabular-nums">
              Showing <strong className="text-[color:var(--wm-ink)]">{filtered.length}</strong> matching applicant
              {filtered.length === 1 ? '' : 's'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums" data-testid="selected-applicants-counter">
              <strong className="text-[color:var(--wm-focal)]">{selectedIds.length}</strong> selected
            </span>
          </div>

          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={toggleAllMatchingFilters}
            className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)] disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            {allFilteredSelected ? (
              <CheckSquare className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
            ) : (
              <Square className="h-3.5 w-3.5 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
            )}
            <span>
              {allFilteredSelected
                ? `Deselect all matching (${filtered.length})`
                : `Select all matching (${filtered.length})`}
            </span>
          </button>
        </div>
      </section>

      {/* Bulk Actions Toolbar (Appears when >= 1 applicant is selected) */}
      {selectedApplicants.length > 0 && (
        <section
          aria-label="Bulk actions toolbar"
          data-testid="bulk-actions-toolbar"
          className="wm-surface-panel flex flex-wrap items-center justify-between gap-3 border-[color:var(--wm-accent)]/40 bg-[#10261c] px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-[color:var(--wm-ink)] tabular-nums">
              {selectedApplicants.length} applicant{selectedApplicants.length === 1 ? '' : 's'} selected
            </span>
            <span className="text-[color:var(--wm-ink-muted)]">
              ({selectedApplicants.filter((a) => a.applicationStatus === 'accepted').length} accepted ·{' '}
              {selectedApplicants.filter((a) => a.applicationStatus === 'rejected').length} rejected ·{' '}
              {selectedApplicants.filter((a) => a.applicationStatus === 'pending').length} pending)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onRequestSendSelected(selectedApplicants, 'accepted')}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[color:var(--wm-emerald)] px-3 text-[11px] font-semibold text-[#eef4ef] hover:bg-[#357a5b] cursor-pointer whitespace-nowrap"
            >
              <Send className="h-3 w-3" aria-hidden="true" />
              <span>Send Acceptance ({selectedApplicants.length})</span>
            </button>

            <button
              type="button"
              onClick={() => onRequestSendSelected(selectedApplicants, 'rejected')}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-400/40 bg-rose-500/[0.12] px-3 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/[0.2] cursor-pointer whitespace-nowrap"
            >
              <Send className="h-3 w-3" aria-hidden="true" />
              <span>Send Rejection ({selectedApplicants.length})</span>
            </button>

            <button
              type="button"
              onClick={onClearSelection}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-[color:var(--wm-hairline-strong)] px-2.5 text-[11px] text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-overlay)] hover:text-[color:var(--wm-ink)] cursor-pointer whitespace-nowrap"
            >
              Clear selection
            </button>
          </div>
        </section>
      )}

      {/* Main Applicants Table (Desktop) + Stacked Cards (Mobile) */}
      <section className="wm-surface-panel overflow-hidden">
        {paginatedRows.length === 0 ? (
          <div className="p-10 text-center text-xs space-y-2">
            <p className="font-medium text-[color:var(--wm-ink)]">No matching applicants found</p>
            <p className="text-[color:var(--wm-ink-muted)]">
              Adjust your search term or status filters to view applicants.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] text-[10px] font-mono uppercase tracking-[0.12em] text-[color:var(--wm-ink-muted)]">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allCurrentPageSelected}
                        onChange={toggleCurrentPage}
                        aria-label="Select all applicants on current page"
                        className="h-4 w-4 accent-[#74c69d] cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-3 font-medium">Applicant</th>
                    <th className="px-3 py-3 font-medium">Email Address</th>
                    <th className="px-3 py-3 font-medium">Department</th>
                    <th className="px-3 py-3 font-medium">Applied Position</th>
                    <th className="px-3 py-3 font-medium">Application Status</th>
                    <th className="px-3 py-3 font-medium">Email Status</th>
                    <th className="px-3 py-3 font-medium">Email Action</th>
                    <th className="px-4 py-3 font-medium text-right">Application Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--wm-hairline)]">
                  {paginatedRows.map((row) => {
                    const checked = selectedSet.has(row.id);
                    const appBadge = APP_STATUS_BADGE[row.applicationStatus];
                    const emailBadge = EMAIL_STATUS_BADGE[row.emailStatus];
                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          checked
                            ? 'bg-[#2d6a4f]/16'
                            : 'hover:bg-[color:var(--wm-inset)]/65'
                        }`}
                      >
                        <td className="px-4 py-3 align-middle">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleOne(row.id)}
                            aria-label={`Select ${row.applicantName}`}
                            className="h-4 w-4 accent-[#74c69d] cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <p className="font-medium text-[color:var(--wm-ink)] whitespace-nowrap">
                            {row.applicantName}
                          </p>
                        </td>
                        <td className="px-3 py-3 align-middle font-mono text-[11px] text-[color:var(--wm-ink-secondary)]">
                          {row.email}
                        </td>
                        <td className="px-3 py-3 align-middle text-[color:var(--wm-ink)] whitespace-nowrap">
                          {row.department}
                        </td>
                        <td className="px-3 py-3 align-middle text-[color:var(--wm-ink-secondary)]">
                          {row.appliedPosition}
                        </td>
                        <td className="px-3 py-3 align-middle whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${appBadge.classes}`}
                          >
                            {appBadge.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-middle whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${emailBadge.classes}`}
                          >
                            {emailBadge.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          {row.applicationStatus !== 'pending' && (
                            <button type="button" onClick={() => onResend(row)} className="inline-flex h-7 items-center gap-1 rounded border border-[color:var(--wm-hairline-strong)] px-2 text-[10px] font-medium text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)]">
                              <Send className="h-3 w-3" aria-hidden="true" /> Resend
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle text-right font-mono text-[11px] text-[color:var(--wm-ink-muted)] tabular-nums whitespace-nowrap">
                          {new Date(row.applicationDate).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="divide-y divide-[color:var(--wm-hairline)] md:hidden">
              {paginatedRows.map((row) => {
                const checked = selectedSet.has(row.id);
                const appBadge = APP_STATUS_BADGE[row.applicationStatus];
                const emailBadge = EMAIL_STATUS_BADGE[row.emailStatus];
                return (
                  <label
                    key={row.id}
                    className={`flex items-start gap-3 p-4 text-xs cursor-pointer ${
                      checked ? 'bg-[#2d6a4f]/16' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleOne(row.id)}
                      className="mt-1 h-4 w-4 accent-[#74c69d]"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-[color:var(--wm-ink)] truncate">
                            {row.applicantName}
                          </p>
                          <p className="font-mono text-[11px] text-[color:var(--wm-ink-muted)] truncate">
                            {row.email}
                          </p>
                        </div>
                        <span className="font-mono text-[10px] text-[color:var(--wm-ink-muted)] tabular-nums shrink-0">
                          {new Date(row.applicationDate).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-[color:var(--wm-ink-secondary)]">
                        {row.department} · {row.appliedPosition}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${appBadge.classes}`}
                        >
                          {appBadge.label}
                        </span>
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${emailBadge.classes}`}
                        >
                          Email: {emailBadge.label}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)]/60 px-4 py-3 text-xs">
          <div className="flex items-center gap-2 text-[11px] text-[color:var(--wm-ink-muted)] tabular-nums">
            <span>Rows per page</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-7 rounded border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] px-2 text-[11px] text-[color:var(--wm-ink)]"
            >
              <option value={8}>8</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
            </select>
            <span>
              · Page <strong className="text-[color:var(--wm-ink)]">{currentPage}</strong> of{' '}
              <strong className="text-[color:var(--wm-ink)]">{totalPages}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
              className="inline-flex h-8 items-center gap-1 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-[11px] text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-overlay)] hover:text-[color:var(--wm-ink)] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
              className="inline-flex h-8 items-center gap-1 rounded border border-[color:var(--wm-hairline-strong)] px-2.5 text-[11px] text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-overlay)] hover:text-[color:var(--wm-ink)] disabled:opacity-40 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
