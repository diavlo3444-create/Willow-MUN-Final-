import { useMemo } from 'react';
import { ArrowRight, Building2, CheckCircle2, Clock3, FileText, Globe, Users } from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type { ApplicationStatus } from '../../../types/admin';
import { computeApplicationStats, scopeApplicationsForActor } from '../../../utils/applicationFilters';
import { StatusBadge } from '../StatusBadge';

interface OverviewDashboardViewProps {
  basePath: '/super-admin' | '/admin';
  onNavigate: (path: string) => void;
  onFilterApplications: (status?: ApplicationStatus | 'all', deptId?: string) => void;
  onSelectApplication: (appId: string) => void;
}

export function OverviewDashboardView({ basePath, onNavigate, onFilterApplications, onSelectApplication }: OverviewDashboardViewProps) {
  const { data, currentUser } = useAdminStore();
  const applications = useMemo(() => scopeApplicationsForActor(data.applications, currentUser), [data.applications, currentUser]);
  const stats = useMemo(() => computeApplicationStats(applications), [applications]);
  const recentApps = useMemo(() => [...applications].sort((a,b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0,6), [applications]);
  const departmentNames = useMemo(() => new Map(data.departments.map((d) => [d.id,d.name])), [data.departments]);
  const openDepartments = data.departments.filter((d) => d.registrationOpen).length;
  const readyForReview = applications.filter((a) => a.status === 'pending' && a.headRecommendation === 'recommend_accept').length;
  const draftDiffers = JSON.stringify(data.websiteDraft) !== JSON.stringify(data.websitePublished);

  const quickLinks = [
    { label: 'Review applications', detail: 'Open the application queue', path: `${basePath}/applications`, icon: FileText },
    { label: 'Manage departments', detail: 'Teams, assignments and capacity', path: `${basePath}/departments`, icon: Building2 },
    { label: 'Executive Board', detail: 'View the conference leadership roster', path: `${basePath}/executive-board`, icon: Users },
    { label: 'Edit website', detail: 'Update the public conference site', path: `${basePath}/website-editor`, icon: Globe },
  ];

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Applications', value: stats.total, note: 'All submitted applications', icon: FileText, click: () => onFilterApplications('all') },
          { label: 'Pending review', value: stats.pending, note: readyForReview + ' recommended by heads', icon: Clock3, click: () => onFilterApplications('pending') },
          { label: 'Accepted', value: stats.accepted, note: stats.acceptanceRate + '% acceptance rate', icon: CheckCircle2, click: () => onFilterApplications('accepted') },
          { label: 'Open departments', value: openDepartments + '/' + data.departments.length, note: 'Registration availability', icon: Building2, click: () => onNavigate(`${basePath}/registration`) },
        ].map((item) => {
          const Icon=item.icon;
          return <button key={item.label} type="button" onClick={item.click} className="wm-surface-panel rounded-md p-4 text-left transition-colors hover:border-[#d4af37]/30 hover:bg-white/[0.025]">
            <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium text-neutral-400">{item.label}</span><Icon className="h-4 w-4 text-[#d4af37]" /></div>
            <p className="mt-3 font-serif text-3xl text-neutral-100 tabular-nums">{item.value}</p>
            <p className="mt-1 text-[10px] text-neutral-500">{item.note}</p>
          </button>;
        })}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.85fr)] gap-4">
        <section className="wm-surface-panel overflow-hidden rounded-md">
          <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] px-4 py-3">
            <div><h2 className="text-sm font-semibold text-neutral-100">Recent applications</h2><p className="mt-0.5 text-[10px] text-neutral-500">Latest submissions across the conference</p></div>
            <button type="button" onClick={() => onFilterApplications('all')} className="inline-flex items-center gap-1 text-[11px] text-[#d4af37] hover:text-[#f3e5ab]">View all <ArrowRight className="h-3 w-3" /></button>
          </div>
          {recentApps.length ? <div className="divide-y divide-white/[0.055]">
            {recentApps.map((app) => <button key={app.id} type="button" onClick={() => onSelectApplication(app.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.025]">
              <div className="min-w-0"><p className="truncate text-xs font-medium text-neutral-200">{app.applicantName}</p><p className="mt-1 truncate text-[10px] text-neutral-500">{departmentNames.get(app.departmentId) ?? app.departmentId} · {app.position} · {app.applicationCode}</p></div>
              <StatusBadge status={app.status} />
            </button>)}
          </div> : <p className="px-4 py-8 text-center text-xs text-neutral-500">No applications yet.</p>}
        </section>

        <section className="space-y-4">
          <div className="wm-surface-panel overflow-hidden rounded-md">
            <div className="border-b border-[color:var(--wm-hairline)] px-4 py-3"><h2 className="text-sm font-semibold text-neutral-100">Quick access</h2><p className="mt-0.5 text-[10px] text-neutral-500">The sections used most often</p></div>
            <div className="divide-y divide-white/[0.055]">
              {quickLinks.map((item) => { const Icon=item.icon; return <button key={item.label} type="button" onClick={() => onNavigate(item.path)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.025]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/[0.07] bg-white/[0.025]"><Icon className="h-4 w-4 text-[#d4af37]" /></span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-neutral-200">{item.label}</span><span className="mt-0.5 block text-[10px] text-neutral-500">{item.detail}</span></span>
                <ArrowRight className="h-3.5 w-3.5 text-neutral-600" />
              </button>; })}
            </div>
          </div>
          <div className="wm-surface-panel rounded-md p-4">
            <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-[#d4af37]" /><h2 className="text-xs font-semibold text-neutral-200">Website status</h2></div>
            <p className="mt-2 text-xs text-neutral-400">{draftDiffers ? 'You have unpublished website changes.' : 'The website draft is synced with the live version.'}</p>
            <button type="button" onClick={() => onNavigate(`${basePath}/website-editor`)} className="mt-3 text-[11px] font-medium text-[#d4af37] hover:text-[#f3e5ab]">Open website editor <ArrowRight className="ml-1 inline h-3 w-3" /></button>
          </div>
        </section>
      </div>
    </div>
  );
}
