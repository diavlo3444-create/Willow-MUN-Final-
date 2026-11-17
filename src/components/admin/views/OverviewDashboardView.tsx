import { useMemo } from 'react';
import { ArrowRight, Building2, CheckCircle2, Clock3, FileText, Globe, Inbox, Users, XCircle } from 'lucide-react';
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
  const recent = useMemo(() => [...applications].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 6), [applications]);
  const attention = useMemo(() => [...applications].filter((app) => app.status === 'pending').sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)).slice(0, 4), [applications]);
  const departments = useMemo(() => data.departments.map((department) => {
    const records = applications.filter((app) => app.departmentId === department.id);
    return {
      ...department,
      total: records.length,
      pending: records.filter((app) => app.status === 'pending').length,
      accepted: records.filter((app) => app.status === 'accepted').length,
    };
  }), [data.departments, applications]);
  const statusSegments = [
    { label: 'Accepted', count: applications.filter((app) => app.status === 'accepted').length, color: '#34d399' },
    { label: 'Pending', count: applications.filter((app) => app.status === 'pending').length, color: '#9ca3af' },
    { label: 'Rejected', count: applications.filter((app) => app.status === 'rejected').length, color: '#fb7185' },
    { label: 'Waitlisted', count: applications.filter((app) => app.status === 'waitlisted').length, color: '#fbbf24' },
  ];
  const donut = (() => {
    if (!stats.total) return 'conic-gradient(#242428 0deg 360deg)';
    let cursor = 0;
    const stops: string[] = [];
    statusSegments.forEach((segment) => {
      if (!segment.count) return;
      const start = cursor / stats.total * 360;
      cursor += segment.count;
      const end = cursor / stats.total * 360;
      stops.push(segment.color + ' ' + start.toFixed(2) + 'deg ' + end.toFixed(2) + 'deg');
    });
    return 'conic-gradient(' + stops.join(', ') + ')';
  })();
  const firstName = (currentUser?.fullName || currentUser?.email || 'organiser').split(/[\s@]/)[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const reviewed = applications.filter((app) => ['accepted', 'rejected', 'waitlisted', 'withdrawn'].includes(app.status)).length;
  const completion = stats.total ? Math.round(reviewed / stats.total * 100) : 0;

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#d4af37]">Conference operations</p>
          <h1 className="wm-serif mt-2 text-3xl text-[#f4f0e4]">Overview</h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-neutral-400">Welcome back, {firstName}. Review application intake, department activity and conference operations from one place.</p>
          <p className="mt-3 text-[10px] font-mono uppercase tracking-[0.12em] text-neutral-500">{today}</p>
        </div>
        <button type="button" onClick={() => onFilterApplications('pending')} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-[#d4af37] px-4 text-xs font-semibold text-black hover:bg-[#e6ca75]">
          Review queue <span className="rounded bg-black/15 px-1.5 py-0.5 font-mono text-[10px]">{stats.pending}</span><ArrowRight className="h-3.5 w-3.5" />
        </button>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {label:'Total applications',value:stats.total,helper:'All submitted applications',icon:Users,action:() => onFilterApplications('all')},
          {label:'Awaiting review',value:stats.pending,helper:stats.pending ? 'Oldest unresolved first' : 'Nothing waiting',icon:Clock3,action:() => onFilterApplications('pending')},
          {label:'Accepted',value:stats.accepted,helper:(stats.total ? Math.round(stats.accepted / stats.total * 100) : 0) + '% of applications',icon:CheckCircle2,action:() => onFilterApplications('accepted')},
          {label:'Rejected',value:applications.filter((app) => app.status === 'rejected').length,helper:'Final decisions',icon:XCircle,action:() => onFilterApplications('rejected')},
        ].map((item) => {
          const Icon=item.icon;
          return <button key={item.label} type="button" onClick={item.action} className="rounded-md border border-white/[0.07] bg-[#0c0c0f] p-4 text-left transition-colors hover:border-[#d4af37]/30 hover:bg-white/[0.025]">
            <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-medium text-neutral-400">{item.label}</span><Icon className="h-4 w-4 text-[#d4af37]" /></div>
            <p className="mt-3 font-serif text-3xl tabular-nums text-neutral-100">{item.value}</p>
            <p className="mt-1 text-[10px] text-neutral-500">{item.helper}</p>
          </button>;
        })}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="overflow-hidden rounded-md border border-white/[0.07] bg-[#0c0c0f] xl:col-span-5">
          <div className="border-b border-white/[0.06] px-4 py-3"><h2 className="text-xs font-semibold text-neutral-100">Application pipeline</h2><p className="mt-1 text-[10px] text-neutral-500">Status distribution across the conference</p></div>
          <div className="p-5">
            {stats.total === 0 ? <div className="py-8 text-center"><Inbox className="mx-auto h-7 w-7 text-neutral-600" /><p className="mt-3 text-xs text-neutral-400">No applications have been submitted yet.</p></div> : (
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="relative mx-auto h-[124px] w-[124px] shrink-0 rounded-full" style={{background:donut}}>
                  <div className="absolute inset-[9px] flex flex-col items-center justify-center rounded-full border border-white/[0.05] bg-[#0c0c0f]"><span className="text-2xl font-semibold leading-none tabular-nums text-white">{stats.total}</span><span className="mt-1 text-[8px] font-mono uppercase tracking-[0.16em] text-neutral-500">Total</span></div>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {statusSegments.map((item) => <div key={item.label} className="flex items-center gap-2 text-[11px]"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{backgroundColor:item.color}} /><span className="min-w-0 flex-1 text-neutral-400">{item.label}</span><span className="font-mono text-neutral-200">{item.count}</span></div>)}
                </div>
              </div>
            )}
            <div className="mt-6 border-t border-white/[0.06] pt-4">
              <div className="mb-2 flex items-center justify-between text-[10px]"><span className="text-neutral-400">Review completion</span><span className="font-mono text-neutral-300">{completion}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-[#d4af37]" style={{width:completion + '%'}} /></div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-white/[0.07] bg-[#0c0c0f] xl:col-span-7">
          <div className="border-b border-white/[0.06] px-4 py-3"><h2 className="text-xs font-semibold text-neutral-100">Department intake</h2><p className="mt-1 text-[10px] text-neutral-500">Application volume and registration availability</p></div>
          {departments.length ? <ul className="divide-y divide-white/[0.045]">
            {departments.map((department) => <li key={department.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.025]"><Building2 className="h-4 w-4 text-[#d4af37]" /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-neutral-200">{department.name}</p><p className="mt-0.5 text-[10px] text-neutral-500">{department.pending} pending · {department.accepted} accepted</p></div>
              <div className="text-right"><p className="font-mono text-sm tabular-nums text-neutral-200">{department.total}</p><p className={'text-[8px] font-mono uppercase tracking-wider ' + (department.registrationOpen ? 'text-emerald-300' : 'text-neutral-500')}>{department.registrationOpen ? 'Open' : 'Closed'}</p></div>
            </li>)}
          </ul> : <p className="px-4 py-8 text-center text-xs text-neutral-500">No departments configured.</p>}
          <div className="border-t border-white/[0.06] px-4 py-3"><button type="button" onClick={() => onNavigate(basePath + '/departments')} className="inline-flex items-center gap-1 text-[10px] text-[#d4af37] hover:text-[#f3e5ab]">Manage departments <ArrowRight className="h-3 w-3" /></button></div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="overflow-hidden rounded-md border border-white/[0.07] bg-[#0c0c0f] xl:col-span-7">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3"><div><h2 className="text-xs font-semibold text-neutral-100">Recent applications</h2><p className="mt-1 text-[10px] text-neutral-500">Latest candidates across the conference</p></div><button type="button" onClick={() => onFilterApplications('all')} className="inline-flex items-center gap-1 text-[10px] text-[#d4af37] hover:text-[#f3e5ab]">View all <ArrowRight className="h-3 w-3" /></button></div>
          {recent.length ? <ul className="divide-y divide-white/[0.045]">
            {recent.map((app) => <li key={app.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025]">
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[9px] font-semibold text-neutral-300 sm:flex">{app.applicantName.split(/\s+/).map((part) => part[0]).join('').slice(0,2).toUpperCase()}</span>
              <div className="min-w-0 flex-1"><button type="button" onClick={() => onSelectApplication(app.id)} className="block max-w-full truncate text-left text-xs font-medium text-neutral-100 hover:text-[#d4af37]">{app.applicantName}</button><p className="mt-0.5 truncate text-[10px] text-neutral-500">{app.position} · {app.applicationCode}</p></div>
              <StatusBadge status={app.status} />
            </li>)}
          </ul> : <p className="px-4 py-8 text-center text-xs text-neutral-500">No applications yet.</p>}
        </section>

        <section className="overflow-hidden rounded-md border border-white/[0.07] bg-[#0c0c0f] xl:col-span-5">
          <div className="border-b border-white/[0.06] px-4 py-3"><h2 className="text-xs font-semibold text-neutral-100">Needs attention</h2><p className="mt-1 text-[10px] text-neutral-500">Oldest pending applications first</p></div>
          {attention.length ? <ul className="divide-y divide-white/[0.045]">
            {attention.map((app) => <li key={app.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-xs font-medium text-neutral-200">{app.applicantName}</p><p className="mt-0.5 truncate text-[10px] text-neutral-500">{app.position} · {app.applicationCode}</p></div><button type="button" onClick={() => onSelectApplication(app.id)} className="shrink-0 text-[10px] font-medium text-[#d4af37] hover:text-[#f3e5ab]">Review <ArrowRight className="ml-1 inline h-3 w-3" /></button></li>)}
          </ul> : <p className="px-4 py-8 text-center text-xs text-neutral-500">No pending applications.</p>}
        </section>
      </div>

      <section className="flex items-center justify-between rounded-md border border-white/[0.07] bg-[#0c0c0f] px-4 py-3">
        <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-[#d4af37]" /><div><p className="text-xs font-medium text-neutral-200">Website CMS</p><p className="mt-0.5 text-[10px] text-neutral-500">Edit the public conference website</p></div></div>
        <button type="button" onClick={() => onNavigate(basePath + '/website-editor')} className="inline-flex items-center gap-1 text-[10px] text-[#d4af37] hover:text-[#f3e5ab]">Open editor <ArrowRight className="h-3 w-3" /></button>
      </section>
    </div>
  );
}
