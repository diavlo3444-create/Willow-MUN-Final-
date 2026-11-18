import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  PauseCircle,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import type {
  ApplicationStatus,
  RecommendationDecision,
  RoleType,
} from '../../types/admin';
import { getRoleLabel } from '../../utils/adminPermissions';

const STATUS_STYLE_MAP: Record<
  ApplicationStatus,
  { label: string; classes: string; Icon: typeof Clock }
> = {
  pending: {
    label: 'Pending',
    classes: 'border-amber-400/30 bg-amber-500/[0.09] text-amber-200',
    Icon: Clock,
  },
  accepted: {
    label: 'Accepted',
    classes: 'border-emerald-400/30 bg-emerald-500/[0.1] text-emerald-200',
    Icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    classes: 'border-rose-400/30 bg-rose-500/[0.1] text-rose-200',
    Icon: XCircle,
  },
  waitlisted: {
    label: 'Waitlisted',
    classes: 'border-sky-400/30 bg-sky-500/[0.09] text-sky-200',
    Icon: PauseCircle,
  },
  withdrawn: {
    label: 'Withdrawn',
    classes: 'border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] text-[color:var(--wm-ink-secondary)]',
    Icon: Ban,
  },
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const cfg = STATUS_STYLE_MAP[status];
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap transition-all duration-200 ${cfg.classes}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{cfg.label}</span>
    </span>
  );
}

export function RecommendationBadge({ decision }: { decision: RecommendationDecision }) {
  if (decision === 'recommend_accept') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-500/[0.1] px-2.5 py-0.5 text-[11px] font-medium text-emerald-200 whitespace-nowrap">
        <ThumbsUp className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>Recommend Accept</span>
      </span>
    );
  }
  if (decision === 'recommend_reject') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-rose-400/30 bg-rose-500/[0.1] px-2.5 py-0.5 text-[11px] font-medium text-rose-200 whitespace-nowrap">
        <ThumbsDown className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>Recommend Reject</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[11px] font-medium text-[color:var(--wm-ink-muted)] whitespace-nowrap">
      Pending Review
    </span>
  );
}

export function RoleBadge({ role }: { role: RoleType }) {
  const styleMap: Record<RoleType, string> = {
    super_admin: 'border-[#74c69d]/35 bg-[#2d6a4f]/30 text-[#d8f3dc]',
    admin: 'border-emerald-400/30 bg-emerald-500/[0.12] text-emerald-200',
    department_head: 'border-teal-400/30 bg-teal-500/[0.1] text-teal-200',
    executive_board: 'border-sky-400/30 bg-sky-500/[0.1] text-sky-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap ${styleMap[role]}`}
    >
      {getRoleLabel(role)}
    </span>
  );
}

export function HealthBadge({ status }: { status: 'operational' | 'degraded' | 'maintenance' }) {
  if (status === 'operational') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-500/[0.09] px-2 py-0.5 text-[11px] font-medium text-emerald-200 whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
        Operational
      </span>
    );
  }
  if (status === 'degraded') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-500/[0.09] px-2 py-0.5 text-[11px] font-medium text-amber-200 whitespace-nowrap">
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
        Degraded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--wm-ink-secondary)] whitespace-nowrap">
      <PauseCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
      Maintenance
    </span>
  );
}
