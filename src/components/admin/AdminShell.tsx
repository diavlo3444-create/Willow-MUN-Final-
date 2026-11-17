import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Command,
  CornerDownLeft,
  ExternalLink,
  FileCode,
  FileText,
  FlaskConical,
  FolderKanban,
  Globe,
  HelpCircle,
  History,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  Navigation,
  QrCode,
  ScanLine,
  Search,
  Server,
  Settings,
  Shield,
  Tag,
  UserCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useAdminStore } from '../../context/AdminStoreContext';
import type { PortalKey } from '../../types/admin';
import { getPortalBasePath, getNavigationGroups } from '../../utils/adminPermissions';
import { scopeApplicationsForActor } from '../../utils/applicationFilters';
import { RoleBadge, StatusBadge } from './StatusBadge';

interface AdminShellProps {
  portal: PortalKey;
  portalLabel: string;
  pageTitle: string;
  pageSubtitle?: string;
  activeNavId: string;
  onNavigate: (path: string) => void;
  globalSearch?: string;
  onGlobalSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  topActions?: ReactNode;
  children: ReactNode;
}

function getNavIcon(id: string) {
  const cls = 'h-4 w-4 shrink-0';
  switch (id) {
    case 'dashboard':
    case 'overview':
      return <LayoutDashboard className={cls} aria-hidden="true" />;
    case 'applications':
      return <FileText className={cls} aria-hidden="true" />;
    case 'delegates':
      return <Award className={cls} aria-hidden="true" />;
    case 'staff-apps':
      return <Users className={cls} aria-hidden="true" />;
    case 'recommendations':
      return <ClipboardCheck className={cls} aria-hidden="true" />;
    case 'forms':
      return <ClipboardList className={cls} aria-hidden="true" />;
    case 'committees':
      return <BookOpen className={cls} aria-hidden="true" />;
    case 'secretariat':
    case 'executive-board':
      return <UserCheck className={cls} aria-hidden="true" />;
    case 'departments':
    case 'department':
      return <Building2 className={cls} aria-hidden="true" />;
    case 'sponsors':
      return <Tag className={cls} aria-hidden="true" />;
    case 'schedule':
      return <Calendar className={cls} aria-hidden="true" />;
    case 'announcements':
      return <Megaphone className={cls} aria-hidden="true" />;
    case 'documents':
      return <FileCode className={cls} aria-hidden="true" />;
    case 'faqs':
      return <HelpCircle className={cls} aria-hidden="true" />;
    case 'gallery':
      return <ImageIcon className={cls} aria-hidden="true" />;
    case 'teams':
    case 'rosters':
      return <Users className={cls} aria-hidden="true" />;
    case 'groups':
    case 'workspace':
      return <FolderKanban className={cls} aria-hidden="true" />;
    case 'shifts':
      return <Clock className={cls} aria-hidden="true" />;
    case 'deployment':
      return <MapPin className={cls} aria-hidden="true" />;
    case 'attendance':
      return <ScanLine className={cls} aria-hidden="true" />;
    case 'qr':
      return <QrCode className={cls} aria-hidden="true" />;
    case 'website-editor':
      return <Globe className={cls} aria-hidden="true" />;
    case 'pages':
      return <LayoutGrid className={cls} aria-hidden="true" />;
    case 'sections':
      return <Layers className={cls} aria-hidden="true" />;
    case 'media':
      return <ImageIcon className={cls} aria-hidden="true" />;
    case 'navigation':
      return <Navigation className={cls} aria-hidden="true" />;
    case 'seo':
      return <Search className={cls} aria-hidden="true" />;
    case 'versions':
      return <History className={cls} aria-hidden="true" />;
    case 'email':
      return <Mail className={cls} aria-hidden="true" />;
    case 'messages':
      return <Inbox className={cls} aria-hidden="true" />;
    case 'notifications':
      return <Bell className={cls} aria-hidden="true" />;
    case 'registration':
      return <ClipboardList className={cls} aria-hidden="true" />;
    case 'reports':
      return <BarChart3 className={cls} aria-hidden="true" />;
    case 'logs':
      return <Activity className={cls} aria-hidden="true" />;
    case 'settings':
      return <Settings className={cls} aria-hidden="true" />;
    case 'monitoring':
      return <Server className={cls} aria-hidden="true" />;
    case 'admins':
      return <Shield className={cls} aria-hidden="true" />;
    case 'heads':
      return <UserCog className={cls} aria-hidden="true" />;
    case 'roles':
      return <KeyRound className={cls} aria-hidden="true" />;
    case 'permission-defs':
      return <Lock className={cls} aria-hidden="true" />;
    case 'testing':
      return <FlaskConical className={cls} aria-hidden="true" />;
    default:
      return <FileText className={cls} aria-hidden="true" />;
  }
}

export function AdminShell({
  portal,
  portalLabel,
  pageTitle,
  pageSubtitle,
  activeNavId,
  onNavigate,
  globalSearch,
  onGlobalSearchChange,
  searchPlaceholder = 'Search applications, people, logs...',
  topActions,
  children,
}: AdminShellProps) {
  const {
    currentUser,
    testModeHeadUser,
    exitDepartmentTestMode,
    data,
    notifications,
    markNotificationsRead,
    signOut,
  } = useAdminStore();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const paletteInputRef = useRef<HTMLInputElement | null>(null);

  const actingUser =
    portal === 'department_head' && testModeHeadUser ? testModeHeadUser : currentUser;
  const navGroups = getNavigationGroups(actingUser, portal);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const assignedDepartment = actingUser?.departmentId
    ? data.departments.find((d) => d.id === actingUser.departmentId) ?? null
    : null;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => {
          const next = !prev;
          if (next) {
            setPaletteQuery('');
            setNotifOpen(false);
            setAccountOpen(false);
          }
          return next;
        });
      } else if (e.key === 'Escape') {
        setMobileNavOpen(false);
        setNotifOpen(false);
        setAccountOpen(false);
        setPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (paletteOpen) {
      const id = window.setTimeout(() => paletteInputRef.current?.focus(), 20);
      return () => window.clearTimeout(id);
    }
  }, [paletteOpen]);

  const enabledPermCount = actingUser
    ? Object.values(actingUser.permissions).filter(Boolean).length
    : 0;

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const basePath = getPortalBasePath(portal);

  const commandResults = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    const flatNav = navGroups.flatMap((g) =>
      g.items.map((item) => ({ ...item, groupLabel: g.label })),
    );
    const matchingNav = flatNav
      .filter(
        (item) =>
          !q ||
          item.label.toLowerCase().includes(q) ||
          item.groupLabel.toLowerCase().includes(q),
      )
      .slice(0, 8);

    const scopedApps = actingUser ? scopeApplicationsForActor(data.applications, actingUser) : [];
    const matchingApps = scopedApps
      .filter(
        (app) =>
          !q ||
          app.applicantName.toLowerCase().includes(q) ||
          app.applicationCode.toLowerCase().includes(q) ||
          app.position.toLowerCase().includes(q),
      )
      .slice(0, q ? 5 : 3);

    return { matchingNav, matchingApps };
  }, [actingUser, data.applications, navGroups, paletteQuery]);

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[color:var(--wm-rail)] text-[color:var(--wm-ink)]">
      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)] px-4">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2.5 text-left cursor-pointer min-h-[40px]"
          >
            <img
              src="/assets/logo-transparent.png"
              alt=""
              width={26}
              height={26}
              className="h-6 w-6 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="font-serif text-[17px] font-medium leading-none tracking-wide text-[color:var(--wm-ink)] whitespace-nowrap">
                Willow MUN
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wm-accent)] whitespace-nowrap">
                {portalLabel}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/10 lg:hidden cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {actingUser?.role === 'department_head' && assignedDepartment && (
          <div className="mx-3 mt-3 rounded bg-[color:var(--wm-inset)] px-3 py-2.5 border-l-2 border-[color:var(--wm-accent)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--wm-accent)]">
              Department Scope
            </p>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--wm-ink)] truncate">
              {assignedDepartment.name}
            </p>
          </div>
        )}

        <nav aria-label={`${portalLabel} navigation`} className="mt-3 space-y-4 px-2.5 pb-6">
          {navGroups.map((group) => {
            const collapsed = Boolean(collapsedGroups[group.id]);
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)] hover:text-[color:var(--wm-ink)] cursor-pointer transition-colors duration-150"
                >
                  <span className="truncate">{group.label}</span>
                  <ChevronDown
                    className={`h-3 w-3 shrink-0 transition-transform duration-150 ${
                      collapsed ? '-rotate-90' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {!collapsed && (
                  <div className="mt-0.5 space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = item.id === activeNavId;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onNavigate(item.path);
                            setMobileNavOpen(false);
                          }}
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex w-full min-h-[40px] lg:min-h-[34px] items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                            isActive
                              ? 'bg-[#ede6ca]/12 text-[color:var(--wm-ink)]'
                              : 'text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/[0.05] hover:text-[color:var(--wm-ink)]'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span className={isActive ? 'text-[color:var(--wm-accent)]' : 'opacity-75'}>
                              {getNavIcon(item.id)}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.readOnlyHint && (
                            <span
                              title="Read-Only for Admin role"
                              className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--wm-ink-muted)]"
                            >
                              RO
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)] p-2.5 space-y-0.5">
        <button
          type="button"
          onClick={() => onNavigate('/portal')}
          className="flex w-full min-h-[38px] items-center justify-between rounded px-2.5 py-1.5 text-xs font-medium text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/[0.06] hover:text-[color:var(--wm-ink)] cursor-pointer transition-colors duration-150"
        >
          <span>Switch Portal</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="flex w-full min-h-[38px] items-center justify-between rounded px-2.5 py-1.5 text-xs font-medium text-[color:var(--wm-ink-secondary)] hover:bg-[#ede6ca]/[0.06] hover:text-[color:var(--wm-ink)] cursor-pointer transition-colors duration-150"
        >
          <span>Public Website</span>
          <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="wm-admin min-h-[100dvh] bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)] flex">
      <aside className="hidden lg:block w-[268px] shrink-0 border-r border-[color:var(--wm-hairline)] sticky top-0 h-[100dvh] overflow-hidden">
        {sidebarContent}
      </aside>

      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Portal navigation drawer"
        >
          <div className="fixed inset-0 bg-black/75" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative z-10 w-[280px] max-w-[85vw] h-full border-r border-[color:var(--wm-hairline-strong)]">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {portal === 'department_head' && testModeHeadUser && (
          <div className="border-b border-amber-400/35 bg-amber-500/12 px-4 sm:px-6 lg:px-8 py-2">
            <div className="mx-auto max-w-[1440px] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-100">
                <FlaskConical className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                <span>
                  <strong className="font-semibold">Testing Mode:</strong> Previewing{' '}
                  <span className="font-mono">/head</span> isolated as{' '}
                  <strong className="font-semibold">{testModeHeadUser.fullName}</strong> (
                  {assignedDepartment?.name}).
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  exitDepartmentTestMode();
                  onNavigate('/super-admin/testing');
                }}
                className="min-h-[32px] rounded border border-amber-200/35 bg-[#12170c] px-3 text-xs font-medium text-amber-100 hover:bg-[#1e2414] cursor-pointer transition-colors duration-150"
              >
                Exit Testing Mode
              </button>
            </div>
          </div>
        )}

        <header className="sticky top-0 z-30 h-14 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)]/95 backdrop-blur-md">
          <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation sidebar"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded border border-[color:var(--wm-hairline)] text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 lg:hidden cursor-pointer"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>

              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs min-w-0">
                <button
                  type="button"
                  onClick={() => onNavigate(basePath)}
                  className="hidden sm:inline font-medium text-[color:var(--wm-ink-muted)] hover:text-[color:var(--wm-ink)] truncate cursor-pointer"
                >
                  {portalLabel}
                </button>
                <ChevronRight
                  className="hidden sm:inline h-3.5 w-3.5 shrink-0 text-[color:var(--wm-ink-muted)]"
                  aria-hidden="true"
                />
                <span className="font-semibold text-[color:var(--wm-ink)] truncate">
                  {pageTitle}
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onGlobalSearchChange && (
                <div className="relative hidden md:block w-56 lg:w-64">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--wm-ink-muted)]"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={globalSearch ?? ''}
                    onChange={(e) => onGlobalSearchChange(e.target.value)}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="h-9 w-full rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-surface)] pl-8 pr-3 text-xs text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)] focus:border-[color:var(--wm-focal)] focus:outline-none"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setPaletteOpen(true);
                  setPaletteQuery('');
                }}
                aria-label="Open Quick Jump command palette"
                className="inline-flex h-9 items-center gap-2 rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-surface)] px-2.5 text-xs text-[color:var(--wm-ink-secondary)] hover:border-[color:var(--wm-hairline-strong)] hover:text-[color:var(--wm-ink)] cursor-pointer transition-colors duration-150"
              >
                <Command className="h-3.5 w-3.5 text-[color:var(--wm-accent)]" aria-hidden="true" />
                <span className="hidden sm:inline">Quick Jump</span>
                <kbd className="hidden xl:inline font-mono text-[10px] text-[color:var(--wm-ink-muted)]">
                  Ctrl K
                </kbd>
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen((p) => !p);
                    setAccountOpen(false);
                  }}
                  aria-label="Toggle notifications"
                  aria-expanded={notifOpen}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-surface)] text-[color:var(--wm-ink)] hover:border-[color:var(--wm-hairline-strong)] cursor-pointer transition-colors duration-150"
                >
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[color:var(--wm-focal)] px-1 font-mono text-[10px] font-semibold text-[#12170c] tabular-nums">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] shadow-2xl z-50">
                    <div className="flex items-center justify-between border-b border-[color:var(--wm-hairline)] px-4 py-2.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--wm-ink)]">
                        Notifications
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markNotificationsRead}
                          className="text-xs font-medium text-[color:var(--wm-accent)] hover:underline cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-[color:var(--wm-hairline)]">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-xs text-[color:var(--wm-ink-muted)]">
                          No notifications right now.
                        </p>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`px-4 py-3 ${n.read ? 'opacity-70' : 'bg-[#ede6ca]/[0.03]'}`}
                          >
                            <p className="text-xs font-medium text-[color:var(--wm-ink)]">
                              {n.title}
                            </p>
                            <p className="mt-0.5 text-xs text-[color:var(--wm-ink-secondary)]">
                              {n.message}
                            </p>
                            <p className="mt-1 font-mono text-[10px] text-[color:var(--wm-ink-muted)] tabular-nums">
                              {new Date(n.createdAt).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {currentUser && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen((p) => !p);
                      setNotifOpen(false);
                    }}
                    aria-expanded={accountOpen}
                    aria-label="Account menu"
                    className="inline-flex h-9 items-center gap-2 rounded border border-[color:var(--wm-hairline)] bg-[color:var(--wm-surface)] px-2.5 text-left hover:border-[color:var(--wm-hairline-strong)] cursor-pointer transition-colors duration-150"
                  >
                    {currentUser.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6b7547]/45 text-[11px] font-semibold text-[color:var(--wm-ink)] shrink-0">
                        {currentUser.fullName.charAt(0)}
                      </span>
                    )}
                    <span className="hidden sm:inline text-xs font-medium text-[color:var(--wm-ink)] max-w-[130px] truncate">
                      {currentUser.fullName}
                    </span>
                    <ChevronDown
                      className="h-3.5 w-3.5 text-[color:var(--wm-ink-muted)]"
                      aria-hidden="true"
                    />
                  </button>

                  {accountOpen && (
                    <div className="absolute right-0 mt-2 w-72 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] p-4 shadow-2xl z-50">
                      <div className="space-y-1.5 border-b border-[color:var(--wm-hairline)] pb-3">
                        <p className="text-sm font-semibold text-[color:var(--wm-ink)]">
                          {currentUser.fullName}
                        </p>
                        <p className="font-mono text-[11px] text-[color:var(--wm-ink-secondary)] truncate">
                          {currentUser.email}
                        </p>
                        <div className="pt-1 flex flex-wrap items-center gap-2">
                          <RoleBadge role={currentUser.role} />
                          <span className="font-mono text-[11px] text-[color:var(--wm-ink-muted)] tabular-nums">
                            {enabledPermCount} perms
                          </span>
                        </div>
                        {assignedDepartment && (
                          <p className="text-xs text-[color:var(--wm-accent)]">
                            Department: {assignedDepartment.name}
                          </p>
                        )}
                      </div>

                      <div className="mt-2.5 space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAccountOpen(false);
                            onNavigate('/portal');
                          }}
                          className="flex w-full min-h-[36px] items-center justify-between rounded px-2.5 text-xs text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
                        >
                          <span>Switch Role / Portal</span>
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAccountOpen(false);
                            onNavigate('/');
                          }}
                          className="flex w-full min-h-[36px] items-center justify-between rounded px-2.5 text-xs text-[color:var(--wm-ink)] hover:bg-[#ede6ca]/10 cursor-pointer"
                        >
                          <span>Public Conference Site</span>
                          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAccountOpen(false);
                            signOut();
                          }}
                          className="flex w-full min-h-[36px] items-center justify-between rounded px-2.5 text-xs text-rose-200 hover:bg-rose-500/15 cursor-pointer"
                        >
                          <span>Sign Out</span>
                          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-[color:var(--wm-hairline)] pb-4">
            <div className="min-w-0">
              <h1 className="font-serif text-2xl sm:text-[28px] font-medium leading-tight tracking-tight text-[color:var(--wm-ink)]">
                {pageTitle}
              </h1>
              {pageSubtitle && (
                <p className="mt-1 text-xs sm:text-[13px] text-[color:var(--wm-ink-secondary)] max-w-3xl">
                  {pageSubtitle}
                </p>
              )}
            </div>
            {topActions && <div className="flex flex-wrap items-center gap-2 shrink-0">{topActions}</div>}
          </div>

          {children}
        </main>
      </div>

      {/* Quick Jump Command Palette */}
      {paletteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quick Jump navigation palette"
          className="fixed inset-0 z-[115] flex items-start justify-center bg-black/75 px-4 pt-20 pb-8"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-overlay)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-[color:var(--wm-hairline)] px-4 py-3">
              <Search className="h-4 w-4 text-[color:var(--wm-accent)]" aria-hidden="true" />
              <input
                ref={paletteInputRef}
                type="search"
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Jump to workspace section or applicant dossier..."
                className="w-full bg-transparent text-sm text-[color:var(--wm-ink)] placeholder:text-[color:var(--wm-ink-muted)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                aria-label="Close quick jump"
                className="rounded px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--wm-ink-muted)] border border-[color:var(--wm-hairline)] hover:text-[color:var(--wm-ink)] cursor-pointer"
              >
                ESC
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-[color:var(--wm-hairline)]">
              <div className="p-2">
                <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
                  Portal Sections
                </p>
                {commandResults.matchingNav.length === 0 ? (
                  <p className="px-2.5 py-2 text-xs text-[color:var(--wm-ink-muted)]">
                    No matching sections.
                  </p>
                ) : (
                  commandResults.matchingNav.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onNavigate(item.path);
                        setPaletteOpen(false);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded px-2.5 py-2 text-left text-xs hover:bg-[#ede6ca]/10 cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 text-[color:var(--wm-ink)]">
                        <span className="text-[color:var(--wm-accent)]">{getNavIcon(item.id)}</span>
                        <span className="font-medium">{item.label}</span>
                        <span className="text-[color:var(--wm-ink-muted)]">· {item.groupLabel}</span>
                      </span>
                      <CornerDownLeft
                        className="h-3.5 w-3.5 text-[color:var(--wm-ink-muted)]"
                        aria-hidden="true"
                      />
                    </button>
                  ))
                )}
              </div>

              {commandResults.matchingApps.length > 0 && (
                <div className="p-2">
                  <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--wm-ink-muted)]">
                    Scoped Applications
                  </p>
                  {commandResults.matchingApps.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => {
                        onNavigate(`${basePath}/applications/${app.id}`);
                        setPaletteOpen(false);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded px-2.5 py-2 text-left text-xs hover:bg-[#ede6ca]/10 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[color:var(--wm-ink)] truncate">
                          {app.applicantName}
                        </p>
                        <p className="font-mono text-[11px] text-[color:var(--wm-ink-muted)] truncate">
                          {app.applicationCode} · {app.position}
                        </p>
                      </div>
                      <StatusBadge status={app.status} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
