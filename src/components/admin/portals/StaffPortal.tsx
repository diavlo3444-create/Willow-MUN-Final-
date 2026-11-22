import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Camera,
  ClipboardList,
  FileText,
  LogOut,
  Newspaper,
  QrCode,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type { Department } from '../../../types/admin';
import {
  canAccessPortal,
  getActorDepartmentSlug,
  getPortalHomeRouteForUser,
  hasPermission,
  isSecurityAccount,
  normalizeDepartmentSlug,
} from '../../../utils/adminPermissions';
import { MyQrCard } from '../MyQrModal';
import { PortalAuthView } from '../PortalAuthView';
import { DepartmentQrSectionView } from '../views/DepartmentQrSectionView';

interface StaffPortalProps {
  pathname: string;
  onNavigate: (path: string) => void;
}

type StaffSection = 'overview' | 'workspace' | 'teams' | 'shifts' | 'qr';
const SECTION_KEYS = new Set<string>(['overview', 'workspace', 'teams', 'shifts', 'qr']);

interface DepartmentCopy {
  deskLabel: string;
  overviewHeading: string;
  overviewSummary: string;
  workspaceLabel: string;
  workspaceEmpty: string;
  teamsLabel: string;
  teamsEmpty: string;
  shiftsLabel: string;
  shiftsEmpty: string;
  icon: typeof ClipboardList;
}

function getDepartmentCopy(slug: string | null, departmentName: string): DepartmentCopy {
  switch (slug) {
    case 'volunteers':
      return {
        deskLabel: 'Volunteer Operations Desk',
        overviewHeading: 'Floor Coverage & Delegate Support',
        overviewSummary:
          'Coordinate hall logistics, delegate assistance desks, room runner duties, and shift coverage assigned to the Volunteers team.',
        workspaceLabel: 'Floor Assignments',
        workspaceEmpty: 'No floor assignments have been published for the Volunteers team yet.',
        teamsLabel: 'Volunteer Squads',
        teamsEmpty: 'No volunteer squad rosters have been published yet.',
        shiftsLabel: 'Shift Schedule',
        shiftsEmpty: 'No volunteer shift deployments are scheduled yet.',
        icon: Users,
      };
    case 'media':
      return {
        deskLabel: 'Media Production Hub',
        overviewHeading: 'Coverage Desk & Production Queue',
        overviewSummary:
          'Track photography, videography, daily reel deliverables, crew rosters, and session coverage slots for Willow MUN.',
        workspaceLabel: 'Deliverables & Briefs',
        workspaceEmpty: 'No media production deliverables or shot briefs have been published yet.',
        teamsLabel: 'Media Crew',
        teamsEmpty: 'No media crew rosters have been published yet.',
        shiftsLabel: 'Coverage Schedule',
        shiftsEmpty: 'No camera or editing coverage shifts are scheduled yet.',
        icon: Camera,
      };
    case 'press':
      return {
        deskLabel: 'Press & Editorial Desk',
        overviewHeading: 'Editorial Beat Desk & Dispatches',
        overviewSummary:
          'Manage committee reporting beats, conference dispatches, interview schedules, and editorial team assignments.',
        workspaceLabel: 'Story Assignments',
        workspaceEmpty: 'No story assignments or editorial briefs have been published yet.',
        teamsLabel: 'Editorial Roster',
        teamsEmpty: 'No editorial desk groups have been published yet.',
        shiftsLabel: 'Press Shifts',
        shiftsEmpty: 'No press coverage shifts are scheduled yet.',
        icon: Newspaper,
      };
    default:
      return {
        deskLabel: `${departmentName} Staff Workspace`,
        overviewHeading: `${departmentName} Operations`,
        overviewSummary:
          'Review active tasks, team coordination groups, assigned shifts, and your conference QR pass.',
        workspaceLabel: 'Assignments',
        workspaceEmpty: `No work items have been published for ${departmentName} yet.`,
        teamsLabel: 'Team Roster',
        teamsEmpty: `No team groups have been published for ${departmentName} yet.`,
        shiftsLabel: 'Shifts',
        shiftsEmpty: `No shifts have been scheduled for ${departmentName} yet.`,
        icon: ClipboardList,
      };
  }
}

function formatDepartmentNameFromSlug(slug: string): string {
  switch (slug) {
    case 'volunteers':
      return 'Volunteers';
    case 'media':
      return 'Media';
    case 'press':
      return 'Press';
    case 'security':
      return 'Security';
    case 'hr':
      return 'Human Resources';
    case 'dcc':
      return 'Delegate Affairs (DCC)';
    case 'it':
      return 'IT & Technical';
    case 'design':
      return 'Design';
    case 'marketing':
      return 'Marketing';
    default:
      return slug
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(' ');
  }
}

export function StaffPortal({ pathname, onNavigate }: StaffPortalProps) {
  const { currentUser, data, signOut, recordSecurityViolation } = useAdminStore();
  const [workStatusFilter, setWorkStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'completed' | 'blocked'>('all');
  const [workSearch, setWorkSearch] = useState('');
  const loggedViolationRef = useRef<string>('');

  const departmentSlug = getActorDepartmentSlug(currentUser, data.departments);

  const matchedDepartment = useMemo<Department | null>(() => {
    if (!currentUser) return null;
    const found = data.departments.find(
      (item) =>
        item.id === currentUser.departmentId ||
        item.slug === currentUser.departmentId ||
        (departmentSlug !== null && normalizeDepartmentSlug(item.slug) === departmentSlug),
    );
    if (found) return found;
    if (!departmentSlug) return null;
    return {
      id: currentUser.departmentId || departmentSlug,
      slug: departmentSlug,
      name: formatDepartmentNameFromSlug(departmentSlug),
      description: '',
      cluster: 'Logistics & Administration',
      headUserIds: [],
      registrationOpen: true,
      capacity: 0,
      positions: [],
      instructions: '',
      updatedAt: '',
    };
  }, [currentUser, data.departments, departmentSlug]);

  const parsedRoute = useMemo(() => {
    const raw = pathname.replace(/^\/staff\/?/, '');
    const segments = raw.split('/').filter(Boolean);
    if (segments.length === 0) {
      return { requestedDeptSlug: null as string | null, section: 'overview' as StaffSection };
    }
    if (SECTION_KEYS.has(segments[0])) {
      return {
        requestedDeptSlug: null as string | null,
        section: segments[0] as StaffSection,
      };
    }
    const candidateDept = normalizeDepartmentSlug(segments[0]);
    const maybeSection = segments[1] && SECTION_KEYS.has(segments[1]) ? (segments[1] as StaffSection) : 'overview';
    return {
      requestedDeptSlug: candidateDept || null,
      section: maybeSection,
    };
  }, [pathname]);

  const crossDepartmentMismatch = Boolean(
    currentUser &&
      departmentSlug &&
      parsedRoute.requestedDeptSlug &&
      parsedRoute.requestedDeptSlug !== departmentSlug,
  );

  useEffect(() => {
    if (!crossDepartmentMismatch || !parsedRoute.requestedDeptSlug) return;
    const sig = `${currentUser?.id}:${parsedRoute.requestedDeptSlug}`;
    if (loggedViolationRef.current === sig) return;
    loggedViolationRef.current = sig;
    recordSecurityViolation(
      'department_route',
      parsedRoute.requestedDeptSlug,
      `Blocked staff portal access to /staff/${parsedRoute.requestedDeptSlug} (assigned: ${departmentSlug}).`,
    );
  }, [crossDepartmentMismatch, currentUser?.id, departmentSlug, parsedRoute.requestedDeptSlug, recordSecurityViolation]);

  if (!currentUser) {
    return <PortalAuthView portal="staff" onNavigate={onNavigate} />;
  }

  if (isSecurityAccount(currentUser, data.departments)) {
    return (
      <div className="wm-admin min-h-[100dvh] grid place-items-center bg-[color:var(--wm-canvas)] p-6 text-[color:var(--wm-ink)]">
        <section className="wm-surface-panel max-w-md p-6 text-center">
          <ShieldAlert className="mx-auto h-9 w-9 text-[color:var(--wm-accent)]" aria-hidden="true" />
          <h1 className="wm-serif mt-3 text-xl font-semibold">Security Entrance Terminal</h1>
          <p className="mt-2 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
            Your account is assigned to the Security department. Use the dedicated Security Scanner terminal for gate verification and your QR credential.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('/security')}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
            >
              Open Security Scanner
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] px-3 text-xs text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]"
            >
              Sign out
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!canAccessPortal(currentUser, 'staff', data.departments)) {
    return (
      <div className="wm-admin min-h-[100dvh] grid place-items-center bg-[color:var(--wm-canvas)] p-6 text-[color:var(--wm-ink)]">
        <section className="wm-surface-panel max-w-md border-rose-400/35 p-6 text-center">
          <ShieldAlert className="mx-auto h-9 w-9 text-rose-300" aria-hidden="true" />
          <h1 className="wm-serif mt-3 text-xl font-semibold text-rose-100">Staff Workspace Restricted</h1>
          <p className="mt-2 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
            This account does not use the Department Staff portal. Open your assigned workspace or sign out.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate(getPortalHomeRouteForUser(currentUser, data.departments))}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Open My Portal
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] px-3 text-xs text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]"
            >
              Sign out
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!matchedDepartment || !departmentSlug) {
    return (
      <div className="wm-admin min-h-[100dvh] grid place-items-center bg-[color:var(--wm-canvas)] p-6 text-[color:var(--wm-ink)]">
        <section className="wm-surface-panel max-w-md p-6 text-center">
          <AlertTriangle className="mx-auto h-9 w-9 text-amber-300" aria-hidden="true" />
          <h1 className="wm-serif mt-3 text-xl font-semibold">Department assignment required</h1>
          <p className="mt-2 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
            Your account is active, but it has not been linked to a conference department yet. Contact the Super Admin to assign your department.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={signOut}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] px-4 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-inset)]"
            >
              Sign out
            </button>
          </div>
        </section>
      </div>
    );
  }

  const basePath = `/staff/${departmentSlug}`;

  if (crossDepartmentMismatch) {
    return (
      <div className="wm-admin min-h-[100dvh] grid place-items-center bg-[color:var(--wm-canvas)] p-6 text-[color:var(--wm-ink)]">
        <section role="alert" className="wm-surface-panel max-w-md border-rose-400/35 p-6 text-center">
          <ShieldAlert className="mx-auto h-9 w-9 text-rose-300" aria-hidden="true" />
          <h1 className="wm-serif mt-3 text-xl font-semibold text-rose-100">Department Access Restricted</h1>
          <p className="mt-2 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
            Your account is assigned strictly to {matchedDepartment.name}. Cross-department routes are blocked.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate(basePath)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Return to {matchedDepartment.name}
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] px-3 text-xs text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]"
            >
              Sign out
            </button>
          </div>
        </section>
      </div>
    );
  }

  const isSimplifiedQrStaffDepartment =
    departmentSlug === 'media' ||
    departmentSlug === 'press' ||
    departmentSlug === 'media-press' ||
    departmentSlug === 'press-media' ||
    departmentSlug === 'volunteers';

  if (isSimplifiedQrStaffDepartment) {
    const qrSection = departmentSlug === 'volunteers' ? 'volunteers' : 'press_media';
    const portalSubtitle = departmentSlug === 'volunteers' ? 'Volunteering' : 'Press & Media';
    return (
      <div className="wm-admin min-h-[100dvh] bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)]">
        <header className="sticky top-0 z-30 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)]/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
            <div className="flex shrink-0 items-center gap-2.5">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)]">
                <img src="/assets/logo-transparent.png" alt="" className="h-full w-full object-contain p-1" />
              </span>
              <div className="min-w-0">
                <p className="wm-display whitespace-nowrap text-[12.5px] tracking-[0.12em] text-[color:var(--wm-ink)]">
                  WILLOW MUN <span className="text-[color:var(--wm-accent)]">2027</span>
                </p>
                <p className="truncate text-[10px] text-[color:var(--wm-ink-muted)]">
                  {portalSubtitle} · {currentUser.fullName}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-[color:var(--wm-hairline-strong)] px-3.5 text-xs font-medium text-[color:var(--wm-ink-secondary)] transition-colors hover:border-rose-400/40 hover:text-rose-200"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <section className="mx-auto max-w-xl space-y-4">
            <header className="border-b border-[color:var(--wm-hairline)] pb-4">
              <h1 className="wm-serif text-2xl font-semibold text-[color:var(--wm-ink)] sm:text-3xl">
                My QR Code
              </h1>
              <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                Your personal Willow MUN 2027 access pass. Only your own QR code is shown here.
              </p>
            </header>
            <MyQrCard actorOverride={currentUser} />
          </section>
        </main>
      </div>
    );
  }

  const copy = getDepartmentCopy(departmentSlug, matchedDepartment.name);
  const DeptIcon = copy.icon;

  const canWorkspace = hasPermission(currentUser, 'departments.workspace', data.departments);
  const canTeams = hasPermission(currentUser, 'operations.teams', data.departments);
  const canShifts = hasPermission(currentUser, 'operations.shifts', data.departments);
  const canQr = hasPermission(currentUser, 'qr.view_pass', data.departments);

  const belongsToDepartment = (itemDepartmentId: string | null | undefined) =>
    Boolean(
      itemDepartmentId &&
        (itemDepartmentId === matchedDepartment.id ||
          normalizeDepartmentSlug(itemDepartmentId) === departmentSlug),
    );

  const workspace = data.workspaceRecords.filter((item) => belongsToDepartment(item.departmentId));
  const teams = data.teamGroups.filter((item) => belongsToDepartment(item.departmentId));
  const shifts = data.shifts.filter((item) => belongsToDepartment(item.departmentId));

  const filteredWorkspace = workspace.filter((item) => {
    if (workStatusFilter !== 'all' && item.status !== workStatusFilter) return false;
    const q = workSearch.trim().toLowerCase();
    if (!q) return true;
    return `${item.title} ${item.description} ${item.module} ${item.assignedTo || ''}`
      .toLowerCase()
      .includes(q);
  });

  const nav = [
    { id: 'overview' as const, label: 'Overview', path: basePath, icon: DeptIcon, allowed: true },
    { id: 'workspace' as const, label: copy.workspaceLabel, path: `${basePath}/workspace`, icon: FileText, allowed: canWorkspace },
    { id: 'teams' as const, label: copy.teamsLabel, path: `${basePath}/teams`, icon: Users, allowed: canTeams },
    { id: 'shifts' as const, label: copy.shiftsLabel, path: `${basePath}/shifts`, icon: CalendarClock, allowed: canShifts },
    { id: 'qr' as const, label: 'My QR', path: `${basePath}/qr`, icon: QrCode, allowed: canQr },
  ].filter((item) => item.allowed);

  const section = parsedRoute.section;
  const currentTabAllowed =
    section === 'overview' ||
    (section === 'workspace' && canWorkspace) ||
    (section === 'teams' && canTeams) ||
    (section === 'shifts' && canShifts) ||
    (section === 'qr' && canQr);

  const activeNav = nav.find((item) => item.id === section) ?? nav[0];

  const completedCount = workspace.filter((w) => w.status === 'completed').length;
  const openCount = workspace.length - completedCount;
  const upcomingShiftsCount = shifts.filter((s) => s.status !== 'completed').length;

  return (
    <div className="wm-admin min-h-[100dvh] bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)]">
              <img src="/assets/logo-transparent.png" alt="" className="h-full w-full object-contain p-1" />
            </span>
            <div className="min-w-0">
              <p className="wm-display whitespace-nowrap text-[12.5px] tracking-[0.12em] text-[color:var(--wm-ink)]">
                WILLOW MUN <span className="text-[color:var(--wm-accent)]">2027</span>
              </p>
              <p className="truncate text-[10px] text-[color:var(--wm-ink-muted)]">
                {copy.deskLabel} · {currentUser.fullName}
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex" aria-label={`${matchedDepartment.name} portal navigation`}>
            {nav.map((item) => {
              const active = activeNav.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.path)}
                  className={`whitespace-nowrap shrink-0 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#2d6a4f]/35 text-[color:var(--wm-ink)]'
                      : 'text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-inset)] hover:text-[color:var(--wm-ink)]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={signOut}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-[color:var(--wm-hairline-strong)] px-3.5 text-xs font-medium text-[color:var(--wm-ink-secondary)] transition-colors hover:border-rose-400/40 hover:text-rose-200"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sign out
          </button>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto border-t border-[color:var(--wm-hairline)] px-4 py-2 md:hidden" aria-label="Mobile navigation">
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.path)}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium ${
                activeNav.id === item.id
                  ? 'bg-[#2d6a4f]/35 text-[color:var(--wm-ink)]'
                  : 'text-[color:var(--wm-ink-secondary)] hover:bg-[color:var(--wm-inset)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="border-b border-[color:var(--wm-hairline)] pb-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--wm-ink-muted)]">
            <span>{matchedDepartment.name}</span>
            <span aria-hidden="true">·</span>
            <span>{matchedDepartment.cluster}</span>
            {currentUser.division && (
              <>
                <span aria-hidden="true">·</span>
                <span className="capitalize">{currentUser.division} division</span>
              </>
            )}
          </div>
          <h1 className="wm-serif mt-2 text-2xl font-semibold text-[color:var(--wm-ink)] sm:text-3xl">
            {section === 'overview' ? copy.overviewHeading : activeNav.label}
          </h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
            {copy.overviewSummary}
          </p>
        </div>

        {!currentTabAllowed ? (
          <section className="wm-surface-panel p-6 text-center">
            <ShieldAlert className="mx-auto h-7 w-7 text-amber-300" aria-hidden="true" />
            <h2 className="wm-serif mt-3 text-lg font-semibold">Section Access Restricted</h2>
            <p className="mt-1.5 text-xs text-[color:var(--wm-ink-secondary)]">
              Your account permissions do not include this department tab.
            </p>
            <button
              type="button"
              onClick={() => onNavigate(basePath)}
              className="mt-4 inline-flex h-9 items-center rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef]"
            >
              Return to Overview
            </button>
          </section>
        ) : section === 'qr' ? (
          <div className="mx-auto max-w-xl">
            <MyQrCard actorOverride={currentUser} />
          </div>
        ) : section === 'workspace' ? (
          <section className="wm-surface-panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--wm-hairline)] p-4">
              <label className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--wm-ink-muted)]" aria-hidden="true" />
                <input
                  value={workSearch}
                  onChange={(e) => setWorkSearch(e.target.value)}
                  placeholder={`Search ${copy.workspaceLabel.toLowerCase()}…`}
                  className="h-9 w-full rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-canvas)] pl-8 pr-3 text-xs text-[color:var(--wm-ink)]"
                />
              </label>
              <div className="flex items-center gap-1 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] p-1">
                {(['all', 'open', 'in_progress', 'completed', 'blocked'] as const).map((statusKey) => (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => setWorkStatusFilter(statusKey)}
                    className={`whitespace-nowrap rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      workStatusFilter === statusKey
                        ? 'bg-[#2d6a4f] text-[#eef4ef]'
                        : 'text-[color:var(--wm-ink-secondary)] hover:text-[color:var(--wm-ink)]'
                    }`}
                  >
                    {statusKey === 'all' ? 'All' : statusKey.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {filteredWorkspace.length ? (
              <div className="divide-y divide-[color:var(--wm-hairline)]">
                {filteredWorkspace.map((item) => (
                  <article key={item.id} className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">{item.title}</h2>
                      <span className="font-mono text-[11px] tabular-nums text-[color:var(--wm-focal)]">
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                    {item.description && (
                      <p className="mt-2 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--wm-ink-muted)]">
                      <span>Type: {item.module.replace('_', ' ')}</span>
                      <span aria-hidden="true">·</span>
                      <span>Priority: {item.priority}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">Due: {item.deadline || 'Not set'}</span>
                      {item.assignedTo && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Lead: {item.assignedTo}</span>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">
                {workspace.length === 0 ? copy.workspaceEmpty : 'No items match the current search or filter.'}
              </p>
            )}
          </section>
        ) : section === 'teams' ? (
          <section className="grid gap-4 md:grid-cols-2">
            {teams.length ? (
              teams.map((team) => (
                <article key={team.id} className="wm-surface-panel p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">{team.name}</h2>
                    <span className="font-mono text-[11px] tabular-nums text-[color:var(--wm-ink-muted)]">
                      {team.memberAssignments.length} members
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[color:var(--wm-ink-secondary)]">
                    Supervisor: {team.supervisorName || 'Not assigned'}
                  </p>
                  {team.responsibility && (
                    <p className="mt-2 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
                      {team.responsibility}
                    </p>
                  )}
                  {team.memberAssignments.length > 0 && (
                    <ul className="mt-3 divide-y divide-[color:var(--wm-hairline)] border-t border-[color:var(--wm-hairline)] pt-2">
                      {team.memberAssignments.map((member) => (
                        <li key={member.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                          <span className="text-[color:var(--wm-ink)]">{member.memberName}</span>
                          <span className="text-[color:var(--wm-ink-muted)]">
                            {member.position || 'Staff'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))
            ) : (
              <p className="wm-surface-panel col-span-full p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">
                {copy.teamsEmpty}
              </p>
            )}
          </section>
        ) : section === 'shifts' ? (
          <section className="wm-surface-panel divide-y divide-[color:var(--wm-hairline)]">
            {shifts.length ? (
              shifts.map((shift) => (
                <article key={shift.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                  <div>
                    <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">{shift.title}</h2>
                    <p className="mt-1 text-xs tabular-nums text-[color:var(--wm-ink-secondary)]">
                      {shift.location || 'Venue TBD'}
                      {shift.station ? ` · ${shift.station}` : ''} · {shift.startTime}–{shift.endTime}
                    </p>
                    {shift.assignedPersonnel.length > 0 && (
                      <p className="mt-1 text-[11px] text-[color:var(--wm-ink-muted)]">
                        Assigned: {shift.assignedPersonnel.join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--wm-focal)]">
                    {shift.status.replace('_', ' ')}
                  </span>
                </article>
              ))
            ) : (
              <p className="p-8 text-center text-xs text-[color:var(--wm-ink-muted)]">
                {copy.shiftsEmpty}
              </p>
            )}
          </section>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="wm-surface-panel p-4">
                <p className="text-[11px] text-[color:var(--wm-ink-muted)]">Open {copy.workspaceLabel}</p>
                <p className="wm-serif mt-2 text-2xl font-semibold tabular-nums text-[color:var(--wm-ink)]">
                  {openCount}
                </p>
                <p className="mt-1 text-[11px] tabular-nums text-[color:var(--wm-ink-muted)]">
                  {completedCount} completed · {workspace.length} total
                </p>
              </div>
              <div className="wm-surface-panel p-4">
                <p className="text-[11px] text-[color:var(--wm-ink-muted)]">{copy.teamsLabel}</p>
                <p className="wm-serif mt-2 text-2xl font-semibold tabular-nums text-[color:var(--wm-ink)]">
                  {teams.length}
                </p>
                <p className="mt-1 text-[11px] text-[color:var(--wm-ink-muted)]">
                  Active department groups
                </p>
              </div>
              <div className="wm-surface-panel p-4">
                <p className="text-[11px] text-[color:var(--wm-ink-muted)]">Active {copy.shiftsLabel}</p>
                <p className="wm-serif mt-2 text-2xl font-semibold tabular-nums text-[color:var(--wm-ink)]">
                  {upcomingShiftsCount}
                </p>
                <p className="mt-1 text-[11px] tabular-nums text-[color:var(--wm-ink-muted)]">
                  {shifts.length} total scheduled
                </p>
              </div>
              <div className="wm-surface-panel p-4">
                <p className="text-[11px] text-[color:var(--wm-ink-muted)]">Conference Credential</p>
                <p className="wm-serif mt-2 text-lg font-semibold text-[color:var(--wm-focal)]">
                  {currentUser.title}
                </p>
                <p className="mt-1 truncate text-[11px] text-[color:var(--wm-ink-muted)]">
                  {currentUser.email}
                </p>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
              <div className="wm-surface-panel p-5">
                <div className="flex items-center justify-between gap-2 border-b border-[color:var(--wm-hairline)] pb-3">
                  <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">
                    Recent {copy.workspaceLabel}
                  </h2>
                  {canWorkspace && (
                    <button
                      type="button"
                      onClick={() => onNavigate(`${basePath}/workspace`)}
                      className="text-xs font-medium text-[color:var(--wm-accent)] hover:underline"
                    >
                      View all
                    </button>
                  )}
                </div>
                {workspace.length > 0 ? (
                  <div className="divide-y divide-[color:var(--wm-hairline)]">
                    {workspace.slice(0, 4).map((item) => (
                      <div key={item.id} className="py-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-xs font-semibold text-[color:var(--wm-ink)]">{item.title}</p>
                          <span className="font-mono text-[10px] text-[color:var(--wm-ink-muted)]">
                            {item.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[color:var(--wm-ink-secondary)]">
                          Priority: {item.priority} · Due: {item.deadline || 'Not set'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-xs text-[color:var(--wm-ink-muted)]">{copy.workspaceEmpty}</p>
                )}
              </div>

              <div className="space-y-4">
                <section className="wm-surface-panel p-5">
                  <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">Department Briefing</h2>
                  <p className="mt-2 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
                    {matchedDepartment.instructions ||
                      matchedDepartment.description ||
                      `All records shown here are scoped strictly to ${matchedDepartment.name}. Check your assigned shifts and keep your personal QR pass ready at venue checkpoints.`}
                  </p>
                  {canQr && (
                    <button
                      type="button"
                      onClick={() => onNavigate(`${basePath}/qr`)}
                      className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
                    >
                      <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                      Open My QR Pass
                    </button>
                  )}
                </section>

                <section className="wm-surface-panel p-5">
                  <div className="flex items-center justify-between gap-2 border-b border-[color:var(--wm-hairline)] pb-3">
                    <h2 className="text-sm font-semibold text-[color:var(--wm-ink)]">Next {copy.shiftsLabel}</h2>
                    {canShifts && (
                      <button
                        type="button"
                        onClick={() => onNavigate(`${basePath}/shifts`)}
                        className="text-xs font-medium text-[color:var(--wm-accent)] hover:underline"
                      >
                        Full schedule
                      </button>
                    )}
                  </div>
                  {shifts.length > 0 ? (
                    <div className="divide-y divide-[color:var(--wm-hairline)]">
                      {shifts.slice(0, 3).map((shift) => (
                        <div key={shift.id} className="py-2.5">
                          <p className="text-xs font-medium text-[color:var(--wm-ink)]">{shift.title}</p>
                          <p className="mt-0.5 text-[11px] tabular-nums text-[color:var(--wm-ink-muted)]">
                            {shift.location || 'Venue TBD'} · {shift.startTime}–{shift.endTime}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-xs text-[color:var(--wm-ink-muted)]">{copy.shiftsEmpty}</p>
                  )}
                </section>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
