import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  Activity, Award, BarChart3, BookOpen, Building2, Calendar, ClipboardCheck,
  ClipboardList, Clock, ExternalLink, FileCode, FileText, FlaskConical,
  FolderKanban, Globe, HelpCircle, History, Image as ImageIcon, Inbox,
  KeyRound, LayoutDashboard, Lock, LogOut, Mail, MapPin, Megaphone, Menu, Link2,
  QrCode, ScanLine, Search, Server, Settings, Shield, Tag, ToggleRight, UserCheck,
  UserCog, Users, X, ChevronRight, Layers,
} from 'lucide-react';
import { useAdminStore } from '../../context/AdminStoreContext';
import type { PortalKey } from '../../types/admin';
import { getNavigationGroups } from '../../utils/adminPermissions';
import { MyQrModal } from './MyQrModal';

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

const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard, overview: LayoutDashboard, applications: FileText,
  'application-management': ToggleRight,
  'hr-accepted': UserCheck, delegates: Award, 'staff-apps': Users, recommendations: ClipboardCheck,
  forms: ClipboardList, committees: BookOpen, secretariat: UserCheck,
  'executive-board': UserCheck, departments: Building2, department: Building2,
  sponsors: Tag, schedule: Calendar, announcements: Megaphone, documents: FileCode,
  faqs: HelpCircle, gallery: ImageIcon, teams: Users, groups: FolderKanban,
  workspace: FolderKanban, shifts: Clock, deployment: MapPin, attendance: ScanLine,
  qr: QrCode, scanner: ScanLine, history: History, 'website-editor': Globe, pages: LayoutDashboard, sections: Layers,
  media: ImageIcon, navigation: ExternalLink, seo: Search, versions: History,
  email: Mail, messages: Inbox, notifications: Activity, registration: ClipboardList,
  reports: BarChart3, logs: Activity, settings: Settings, monitoring: Server,
  admins: Shield, heads: UserCog, 'account-management': UserCog, roles: KeyRound, 'permission-defs': Lock,
  testing: FlaskConical, 'eb-accounts': Users, 'eb-signup-link': Link2,
};

function initials(name?: string | null, email?: string | null) {
  const source = (name || email || 'WM').trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : source.slice(0, 2).toUpperCase();
}

export function AdminShell({
  portal,
  portalLabel,
  pageTitle,
  activeNavId,
  onNavigate,
  topActions,
  children,
}: AdminShellProps) {
  const { data, currentUser, testModeHeadUser, exitDepartmentTestMode, signOut, openMyQrModal } = useAdminStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const actingUser = portal === 'department_head' && testModeHeadUser ? testModeHeadUser : currentUser;
  const navGroups = getNavigationGroups(actingUser, portal, data.departments);

  useEffect(() => setMobileOpen(false), [activeNavId]);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 40);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const navigate = (path: string) => { onNavigate(path); setMobileOpen(false); };
  const displayName = actingUser?.fullName || actingUser?.email?.split('@')[0] || 'Organiser';
  const roleName = actingUser?.role === 'super_admin' ? 'Super Admin'
    : actingUser?.role === 'department_head' ? 'Department Head'
    : actingUser?.role === 'executive_board' ? 'Executive Board' : 'Admin';

  const brand = (
    <div className="flex items-center gap-2.5">
      <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)]">
        <img src="/assets/logo-transparent.png" alt="" className="h-full w-full object-contain p-1" />
        <span className="absolute inset-0 rounded-[8px] ring-1 ring-inset ring-white/[0.05]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="wm-display block whitespace-nowrap text-[12.5px] tracking-[0.1em] text-[color:var(--wm-ink)]">
          WILLOW MUN <span className="text-[color:var(--wm-accent)]">2027</span>
        </span>
        <span className="mt-0.5 block text-[8.5px] font-mono uppercase tracking-[0.2em] text-[color:var(--wm-ink-muted)]">
          {portalLabel} portal
        </span>
      </span>
    </div>
  );

  const navigation = (
    <>
      {navGroups.map((group) => (
        <div key={group.id} className="mb-5 last:mb-0">
          <p className="mb-1.5 px-2.5 text-[9px] font-mono uppercase tracking-[0.2em] text-[color:var(--wm-ink-muted)]">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = NAV_ICONS[item.id] || FileText;
              const active = item.id === activeNavId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.path)}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px] transition-colors duration-150',
                    active
                      ? 'bg-[#2d6a4f]/28 font-medium text-[color:var(--wm-ink)]'
                      : 'text-[color:var(--wm-ink-secondary)] hover:bg-[#132c21]/70 hover:text-[color:var(--wm-ink)]',
                  ].join(' ')}
                >
                  {active && (
                    <motion.span
                      layoutId={`wm-nav-indicator-${portal}`}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-y-1.5 left-0 w-[2.5px] rounded-full bg-[color:var(--wm-accent)]"
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    className={
                      'h-[15px] w-[15px] shrink-0 transition-colors ' +
                      (active ? 'text-[color:var(--wm-focal)]' : 'text-[color:var(--wm-ink-muted)] group-hover:text-[color:var(--wm-focal)]')
                    }
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.readOnlyHint && (
                    <span className="text-[8px] font-mono uppercase text-[color:var(--wm-ink-muted)]">Read only</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );

  const account = (
    <div className="border-t border-[color:var(--wm-hairline)] px-3 py-3.5">
      <div className="flex items-center gap-2.5 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-2.5 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--wm-hairline-strong)] bg-[#2d6a4f]/30 text-[9.5px] font-semibold tracking-wide text-[color:var(--wm-focal)]">
          {initials(displayName, actingUser?.email)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11.5px] font-medium text-[color:var(--wm-ink)]">{displayName}</span>
          <span className="block truncate text-[9.5px] text-[color:var(--wm-ink-muted)]">{actingUser?.title || roleName}</span>
        </span>
        <button
          type="button"
          onClick={signOut}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[color:var(--wm-ink-muted)] transition-colors hover:bg-[color:var(--wm-overlay)] hover:text-rose-300"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex items-center justify-between rounded px-1.5 py-1 text-[10px] text-[color:var(--wm-ink-muted)] transition-colors hover:text-[color:var(--wm-focal)]"
      >
        <span>Conference website</span>
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="wm-admin min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[color:var(--wm-emerald)] focus:px-3 focus:py-2 focus:text-[12px] focus:font-semibold focus:text-[#eef4ef]"
        >
          Skip to main content
        </a>

        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17.5rem] flex-col border-r border-[color:var(--wm-hairline)] bg-[color:var(--wm-rail)] lg:flex">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(240px_120px_at_18%_0%,rgba(45,106,79,0.28),transparent_72%)]"
            aria-hidden="true"
          />
          <div className="relative px-4 pb-4 pt-5">{brand}</div>
          <div className="mx-4 h-px bg-[color:var(--wm-hairline)]" aria-hidden="true" />
          <nav className="wm-scroll relative flex-1 overflow-y-auto px-2.5 py-4" aria-label={portalLabel + ' dashboard'}>
            {navigation}
          </nav>
          {account}
        </aside>

        <div className="lg:pl-[17.5rem]">
          <header className="sticky top-0 z-30 border-b border-[color:var(--wm-hairline)] bg-[color:var(--wm-canvas)]/92 backdrop-blur-md">
            <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--wm-hairline)] text-[color:var(--wm-ink-secondary)] transition-colors hover:bg-[color:var(--wm-inset)] hover:text-[color:var(--wm-ink)] lg:hidden"
                  aria-label="Open navigation"
                  aria-expanded={mobileOpen}
                >
                  <Menu className="h-4 w-4" />
                </button>
                <span className="wm-display text-[11px] tracking-[0.12em] text-[color:var(--wm-ink)] lg:hidden">
                  WILLOW MUN <span className="text-[color:var(--wm-accent)]">2027</span>
                </span>
                <div className="hidden min-w-0 items-center gap-2 lg:flex">
                  <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--wm-ink-muted)]">
                    WILLOW MUN 2027
                  </span>
                  <ChevronRight className="h-3 w-3 text-[color:var(--wm-ink-muted)]/60" aria-hidden="true" />
                  <span className="truncate text-[11.5px] font-medium text-[color:var(--wm-ink)]">{pageTitle}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline)] bg-[color:var(--wm-inset)] px-2.5 py-1 text-[9.5px] font-mono uppercase tracking-[0.13em] text-[color:var(--wm-ink-secondary)] sm:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--wm-accent)]" aria-hidden="true" />
                  {roleName}
                </span>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={openMyQrModal}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[#2d6a4f]/28 px-3 text-[11px] font-semibold text-[color:var(--wm-focal)] transition-colors hover:bg-[#2d6a4f]/45 hover:text-[color:var(--wm-ink)]"
                >
                  <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>My QR</span>
                </motion.button>

                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline)] px-2.5 text-[10.5px] text-[color:var(--wm-ink-secondary)] transition-colors hover:border-rose-400/35 hover:text-rose-200"
                >
                  <LogOut className="h-3 w-3" aria-hidden="true" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            </div>
          </header>

          <main id="main-content" className="mx-auto w-full max-w-[1540px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {portal === 'department_head' && testModeHeadUser && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/45 bg-amber-950/30 p-4">
                <div>
                  <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-200">
                    Super Admin test mode
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--wm-ink-secondary)]">
                    Previewing as {testModeHeadUser.fullName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    exitDepartmentTestMode();
                    onNavigate('/super-admin/testing');
                  }}
                  className="rounded-md border border-amber-400/40 px-3 py-2 text-[11px] font-medium text-amber-200 hover:bg-amber-400/10"
                >
                  Exit test session
                </button>
              </div>
            )}

            {topActions && <div className="mb-4 flex flex-wrap justify-end gap-2">{topActions}</div>}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeNavId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="absolute inset-0 bg-[#030906]/75 backdrop-blur-xs"
                onClick={() => setMobileOpen(false)}
                aria-hidden="true"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-y-0 left-0 flex w-[17.5rem] max-w-[85vw] flex-col border-r border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-rail)] shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation"
              >
                <div className="flex items-center justify-between px-4 pb-4 pt-5">
                  {brand}
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--wm-ink-secondary)] transition-colors hover:bg-[color:var(--wm-inset)] hover:text-[color:var(--wm-ink)]"
                    aria-label="Close navigation"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mx-4 h-px bg-[color:var(--wm-hairline)]" aria-hidden="true" />
                <nav className="wm-scroll flex-1 overflow-y-auto px-2.5 py-4" aria-label="Mobile dashboard">
                  {navigation}
                </nav>
                {account}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <MyQrModal />
      </div>
    </MotionConfig>
  );
}

