import type {
  DailyApplicationTrendPoint,
  DepartmentApplicationBreakdown,
} from '../../utils/applicationFilters';

interface TrendBarChartProps {
  data: DailyApplicationTrendPoint[];
  title?: string;
}

export function ApplicationTrendChart({
  data,
  title = 'Daily Application Submissions',
}: TrendBarChartProps) {
  const maxVal = Math.max(1, ...data.map((d) => d.count));

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-[color:var(--wm-ink-muted)]">
        No submission trend data available yet.
      </div>
    );
  }

  const labelStep = data.length > 10 ? 2 : 1;

  return (
    <div aria-label={title} className="w-full pt-3">
      <div className="relative flex h-44 items-end gap-1.5 sm:gap-2 border-b border-[color:var(--wm-hairline)] pb-1">
        {/* Subtle horizontal reference baselines */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 bottom-1 flex flex-col justify-between"
        >
          <div className="border-t border-dashed border-[color:var(--wm-hairline)]" />
          <div className="border-t border-dashed border-[color:var(--wm-hairline)]" />
          <div className="border-t border-dashed border-[color:var(--wm-hairline)]" />
        </div>

        {data.map((item, idx) => {
          const pct = Math.max(6, Math.round((item.count / maxVal) * 100));
          const isZero = item.count === 0;
          return (
            <div
              key={item.dateKey}
              className="group relative z-10 flex flex-1 flex-col items-center justify-end h-full min-w-0"
            >
              <span
                className={`mb-1 font-mono text-[11px] tabular-nums transition-colors duration-150 ${
                  isZero
                    ? 'text-[color:var(--wm-ink-muted)]/60'
                    : 'text-[color:var(--wm-ink-secondary)] group-hover:text-[color:var(--wm-ink)]'
                }`}
              >
                {item.count}
              </span>
              <div className="flex h-32 w-full items-end px-0.5">
                <div
                  title={`${item.label} (${item.dateKey}): ${item.count} submissions`}
                  style={{ height: `${isZero ? 3 : pct}%` }}
                  className={`w-full rounded-t-[2px] transition-colors duration-150 ${
                    isZero
                      ? 'bg-[#ede6ca]/15'
                      : idx === data.length - 1
                        ? 'bg-[color:var(--wm-focal)] group-hover:bg-white'
                        : 'bg-[color:var(--wm-accent)]/85 group-hover:bg-[color:var(--wm-accent)]'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-1.5 sm:gap-2">
        {data.map((item, idx) => {
          const showLabel =
            idx === 0 || idx === data.length - 1 || idx % labelStep === 0;
          return (
            <span
              key={item.dateKey}
              className="flex-1 truncate text-center font-mono text-[10px] text-[color:var(--wm-ink-muted)] tabular-nums"
            >
              {showLabel ? item.label.replace(' ', '\u00a0') : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

interface DepartmentBarListProps {
  items: DepartmentApplicationBreakdown[];
  onSelectDepartment?: (departmentId: string) => void;
}

export function DepartmentDistributionChart({
  items,
  onSelectDepartment,
}: DepartmentBarListProps) {
  const maxTotal = Math.max(1, ...items.map((i) => i.total));
  const sorted = [...items].sort((a, b) => b.total - a.total);

  return (
    <div className="divide-y divide-[color:var(--wm-hairline)]">
      {sorted.map((item) => {
        const widthPct = Math.round((item.total / maxTotal) * 100);
        const acceptedPct =
          item.total > 0 ? Math.round((item.accepted / item.total) * widthPct) : 0;
        const pendingPct =
          item.total > 0 ? Math.round((item.pending / item.total) * widthPct) : 0;

        return (
          <div key={item.departmentId} className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              {onSelectDepartment ? (
                <button
                  type="button"
                  onClick={() => onSelectDepartment(item.departmentId)}
                  className="truncate font-medium text-[color:var(--wm-ink)] hover:text-[color:var(--wm-accent)] text-left cursor-pointer transition-colors duration-150"
                >
                  {item.departmentName}
                </button>
              ) : (
                <span className="truncate font-medium text-[color:var(--wm-ink)]">
                  {item.departmentName}
                </span>
              )}
              <span className="shrink-0 font-mono text-[11px] text-[color:var(--wm-ink-secondary)] tabular-nums">
                {item.total} apps · {item.accepted}/{item.capacity}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-[2px] bg-[#ede6ca]/[0.08]">
              <div className="flex h-full w-full">
                {acceptedPct > 0 && (
                  <div
                    style={{ width: `${acceptedPct}%` }}
                    className="h-full bg-emerald-400/85"
                    title={`${item.accepted} accepted`}
                  />
                )}
                {pendingPct > 0 && (
                  <div
                    style={{ width: `${pendingPct}%` }}
                    className="h-full bg-[color:var(--wm-accent)]"
                    title={`${item.pending} pending`}
                  />
                )}
                {widthPct > acceptedPct + pendingPct && (
                  <div
                    style={{ width: `${widthPct - acceptedPct - pendingPct}%` }}
                    className="h-full bg-[#ede6ca]/30"
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
