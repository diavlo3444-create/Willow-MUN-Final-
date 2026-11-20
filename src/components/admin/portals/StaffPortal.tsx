import { useMemo } from 'react';
import { ArrowRight, CalendarClock, ClipboardList, LogOut, Users } from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import { normalizeDepartmentSlug } from '../../../utils/adminPermissions';
import { MyQrCard } from '../MyQrModal';

interface StaffPortalProps {
  pathname: string;
  onNavigate: (path: string) => void;
}

export function StaffPortal({ pathname, onNavigate }: StaffPortalProps) {
  const { currentUser, data, signOut } = useAdminStore();
  const department = useMemo(() => {
    if (!currentUser) return null;
    return data.departments.find((item) =>
      item.id === currentUser.departmentId ||
      item.slug === currentUser.departmentId ||
      normalizeDepartmentSlug(item.slug) === normalizeDepartmentSlug(currentUser.departmentSlug || ''),
    ) ?? null;
  }, [currentUser, data.departments]);

  if (!currentUser || currentUser.role !== 'staff') return null;
  if (!department) {
    return (
      <div className="wm-admin min-h-[100dvh] grid place-items-center bg-[color:var(--wm-canvas)] p-6 text-[color:var(--wm-ink)]">
        <section className="wm-surface-panel max-w-md p-6 text-center">
          <h1 className="wm-serif text-xl font-semibold">Department assignment required</h1>
          <p className="mt-2 text-sm text-[color:var(--wm-ink-secondary)]">Your account is active, but it has not been assigned to a department. Contact the Super Admin to correct your assignment.</p>
          <button onClick={signOut} className="mt-5 rounded-md border border-[color:var(--wm-hairline-strong)] px-4 py-2 text-xs">Sign out</button>
        </section>
      </div>
    );
  }

  const base = '/staff';
  const section = pathname.replace(/^\/staff\/?/, '').split('/')[0] || 'overview';
  const workspace = data.workspaceRecords.filter((item) => item.departmentId === department.id);
  const teams = data.teamGroups.filter((item) => item.departmentId === department.id);
  const shifts = data.shifts.filter((item) => item.departmentId === department.id);
  const nav = [
    { id: 'overview', label: 'Overview', path: base, icon: ClipboardList },
    { id: 'workspace', label: 'Department work', path: base + '/workspace', icon: ClipboardList },
    { id: 'teams', label: 'Team roster', path: base + '/teams', icon: Users },
    { id: 'shifts', label: 'Shifts', path: base + '/shifts', icon: CalendarClock },
    { id: 'qr', label: 'My QR', path: base + '/qr', icon: ArrowRight },
  ];
  const active = nav.find((item) => item.id === section) ?? nav[0];

  const card = (title: string, description: string, icon: typeof ClipboardList, onClick: () => void) => {
    const Icon = icon;
    return (
      <button onClick={onClick} className="wm-surface-panel group flex min-h-32 flex-col justify-between p-4 text-left transition hover:border-[color:var(--wm-accent)]">
        <Icon className="h-4 w-4 text-[color:var(--wm-accent)]" />
        <span>
          <span className="block text-sm font-semibold text-[color:var(--wm-ink)]">{title}</span>
          <span className="mt-1 block text-xs text-[color:var(--wm-ink-secondary)]">{description}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="wm-admin min-h-[100dvh] bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img src="/assets/logo-transparent.png" alt="" className="h-9 w-9 rounded border border-[color:var(--wm-hairline)] object-contain p-1" />
            <div>
              <p className="text-xs font-semibold tracking-[0.14em]">WILLOW MUN <span className="text-[color:var(--wm-accent)]">STAFF</span></p>
              <p className="mt-1 text-[10px] text-[color:var(--wm-ink-muted)]">{department.name} · {currentUser.fullName}</p>
            </div>
          </div>
          <button onClick={signOut} className="inline-flex items-center gap-2 rounded-md border border-[color:var(--wm-hairline-strong)] px-3 py-2 text-xs text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto border-t border-[color:var(--wm-hairline)] px-4 py-2 sm:px-6">
          {nav.map((item) => (
            <button key={item.id} onClick={() => onNavigate(item.path)} className={`shrink-0 rounded-md px-3 py-2 text-xs ${active.id === item.id ? 'bg-[#2d6a4f]/35 text-[color:var(--wm-ink)]' : 'text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-inset)]'}`}>
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--wm-accent)]">{department.name}</p>
          <h1 className="wm-serif mt-2 text-2xl font-semibold">{active.label}</h1>
          <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">Your department workspace. Information shown here is limited to your assigned department.</p>
        </div>

        {section === 'qr' ? (
          <div className="mx-auto max-w-xl"><MyQrCard actorOverride={currentUser} /></div>
        ) : section === 'workspace' ? (
          <section className="wm-surface-panel divide-y divide-[color:var(--wm-hairline)]">
            {workspace.length ? workspace.map((item) => (
              <article key={item.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{item.title}</h2>
                  <span className="rounded border border-[color:var(--wm-hairline-strong)] px-2 py-1 text-[10px]">{item.status.replace('_', ' ')}</span>
                </div>
                {item.description && <p className="mt-2 text-xs text-[color:var(--wm-ink-secondary)]">{item.description}</p>}
                <p className="mt-2 text-[10px] text-[color:var(--wm-ink-muted)]">Priority: {item.priority} · Due: {item.deadline || 'Not set'}</p>
              </article>
            )) : <p className="p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">No department work items have been published yet.</p>}
          </section>
        ) : section === 'teams' ? (
          <section className="grid gap-3 md:grid-cols-2">
            {teams.length ? teams.map((team) => (
              <article key={team.id} className="wm-surface-panel p-4">
                <h2 className="text-sm font-semibold">{team.name}</h2>
                <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">Supervisor: {team.supervisorName || 'Not assigned'}</p>
                <p className="mt-2 text-xs text-[color:var(--wm-ink-secondary)]">{team.responsibility}</p>
                <p className="mt-3 text-[10px] text-[color:var(--wm-ink-muted)]">{team.memberAssignments.length} assigned member(s)</p>
              </article>
            )) : <p className="wm-surface-panel p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">No team groups are available yet.</p>}
          </section>
        ) : section === 'shifts' ? (
          <section className="wm-surface-panel divide-y divide-[color:var(--wm-hairline)]">
            {shifts.length ? shifts.map((shift) => (
              <article key={shift.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div><h2 className="text-sm font-semibold">{shift.title}</h2><p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">{shift.location} · {shift.startTime}–{shift.endTime}</p></div>
                <span className="rounded border border-[color:var(--wm-hairline-strong)] px-2 py-1 text-[10px]">{shift.status.replace('_', ' ')}</span>
              </article>
            )) : <p className="p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">No shifts have been assigned yet.</p>}
          </section>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              {card('Department work', `${workspace.length} active work item(s)`, ClipboardList, () => onNavigate(base + '/workspace'))}
              {card('Team roster', `${teams.length} team group(s)`, Users, () => onNavigate(base + '/teams'))}
              {card('Shifts', `${shifts.length} department shift(s)`, CalendarClock, () => onNavigate(base + '/shifts'))}
            </section>
            <section className="wm-surface-panel p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)]">Your account</p>
              <p className="mt-2 text-sm font-semibold">{currentUser.title}</p>
              <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">{currentUser.email}</p>
              <p className="mt-3 text-xs text-[color:var(--wm-ink-secondary)]">Your access is scoped to {department.name}.</p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
