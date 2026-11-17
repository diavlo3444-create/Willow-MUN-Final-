import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Activity, Award, BarChart3, BookOpen, Building2, Calendar, ClipboardCheck,
  ClipboardList, Clock, ExternalLink, FileCode, FileText, FlaskConical,
  FolderKanban, Globe, HelpCircle, History, Image as ImageIcon, Inbox,
  KeyRound, LayoutDashboard, Lock, LogOut, Mail, MapPin, Megaphone, Menu,
  QrCode, ScanLine, Search, Server, Settings, Shield, Tag, UserCheck,
  UserCog, Users, X, ChevronRight, Layers,
} from 'lucide-react';
import { useAdminStore } from '../../context/AdminStoreContext';
import type { PortalKey } from '../../types/admin';
import { getNavigationGroups } from '../../utils/adminPermissions';

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
  delegates: Award, 'staff-apps': Users, recommendations: ClipboardCheck,
  forms: ClipboardList, committees: BookOpen, secretariat: UserCheck,
  'executive-board': UserCheck, departments: Building2, department: Building2,
  sponsors: Tag, schedule: Calendar, announcements: Megaphone, documents: FileCode,
  faqs: HelpCircle, gallery: ImageIcon, teams: Users, groups: FolderKanban,
  workspace: FolderKanban, shifts: Clock, deployment: MapPin, attendance: ScanLine,
  qr: QrCode, 'website-editor': Globe, pages: LayoutDashboard, sections: Layers,
  media: ImageIcon, navigation: ExternalLink, seo: Search, versions: History,
  email: Mail, messages: Inbox, notifications: Activity, registration: ClipboardList,
  reports: BarChart3, logs: Activity, settings: Settings, monitoring: Server,
  admins: Shield, heads: UserCog, roles: KeyRound, 'permission-defs': Lock,
  testing: FlaskConical, 'eb-accounts': Users,
};

function initials(name?: string | null, email?: string | null) {
  const source = (name || email || 'WM').trim();
  const parts = source.split(/[\\s._-]+/).filter(Boolean);
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : source.slice(0, 2).toUpperCase();
}

export function AdminShell({ portal, portalLabel, pageTitle, activeNavId, onNavigate, topActions, children }: AdminShellProps) {
  const { currentUser, testModeHeadUser, exitDepartmentTestMode, signOut } = useAdminStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const actingUser = portal === 'department_head' && testModeHeadUser ? testModeHeadUser : currentUser;
  const navGroups = getNavigationGroups(actingUser, portal);

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
      <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-[#d4af37]/35 bg-[#121214]">
        <img src="/assets/logo-transparent.png" alt="" className="h-full w-full object-contain p-1" />
        <span className="absolute inset-0 rounded-[7px] ring-1 ring-inset ring-white/[0.06]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="wm-display block whitespace-nowrap text-[12.5px] tracking-[0.1em] text-[#f4f0e4]">WILLOW MUN <span className="text-[#d4af37]">2027</span></span>
        <span className="mt-1 block text-[8.5px] font-mono uppercase tracking-[0.2em] text-neutral-400">{portalLabel} portal</span>
      </span>
    </div>
  );

  const navigation = (
    <>
      {navGroups.map((group) => (
        <div key={group.id} className="mb-5 last:mb-0">
          <p className="mb-1.5 px-2.5 text-[8.5px] font-mono uppercase tracking-[0.2em] text-neutral-400">{group.label}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = NAV_ICONS[item.id] || FileText;
              const active = item.id === activeNavId;
              return (
                <button key={item.id} type="button" onClick={() => navigate(item.path)} aria-current={active ? 'page' : undefined}
                  className={['group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12px] transition-colors duration-150',
                    active ? 'bg-[#d4af37]/[0.09] font-medium text-[#f1e4bb]' : 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100'].join(' ')}>
                  {active && <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-[#d4af37]" aria-hidden="true" />}
                  <Icon className={'h-[15px] w-[15px] shrink-0 transition-colors ' + (active ? 'text-[#d4af37]' : 'text-neutral-400 group-hover:text-neutral-300')} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.readOnlyHint && <span className="text-[8px] font-mono uppercase text-neutral-500">Read only</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );

  const account = (
    <div className="border-t border-white/[0.06] px-3 py-3.5">
      <div className="flex items-center gap-2.5 rounded-md border border-white/[0.06] bg-white/[0.018] px-2.5 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#d4af37]/25 bg-[#d4af37]/[0.08] text-[9.5px] font-semibold tracking-wide text-[#e2c258]">{initials(displayName, actingUser?.email)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11.5px] font-medium text-neutral-200">{displayName}</span>
          <span className="block truncate text-[9.5px] text-neutral-400">{roleName}</span>
        </span>
        <button type="button" onClick={signOut} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-rose-300" aria-label="Sign out" title="Sign out"><LogOut className="h-3.5 w-3.5" /></button>
      </div>
      <a href="/" target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-between rounded px-1.5 py-1 text-[10px] text-neutral-400 transition-colors hover:text-neutral-300"><span>Conference website</span><ExternalLink className="h-3 w-3" aria-hidden="true" /></a>
    </div>
  );

  return (
    <div className="wm-app min-h-screen">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[#d4af37] focus:px-3 focus:py-2 focus:text-[12px] focus:font-semibold focus:text-black">Skip to main content</a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17.5rem] flex-col border-r border-white/[0.06] bg-[#09090b] lg:flex">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(240px_120px_at_18%_0%,rgba(212,175,55,0.09),transparent_72%)]" aria-hidden="true" />
        <div className="relative px-4 pb-4 pt-5">{brand}</div>
        <div className="mx-4 h-px bg-white/[0.055]" aria-hidden="true" />
        <nav className="wm-scroll relative flex-1 overflow-y-auto px-2.5 py-4" aria-label={portalLabel + ' dashboard'}>{navigation}</nav>
        {account}
      </aside>
      <div className="lg:pl-[17.5rem]">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#070708]/95">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5">
              <button type="button" onClick={() => setMobileOpen(true)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] text-neutral-400 transition-colors hover:bg-white/[0.05] hover:text-white lg:hidden" aria-label="Open navigation" aria-expanded={mobileOpen}><Menu className="h-4 w-4" /></button>
              <span className="wm-display text-[11px] tracking-[0.12em] text-neutral-300 lg:hidden">WILLOW MUN <span className="text-[#d4af37]">2027</span></span>
              <div className="hidden min-w-0 items-center gap-2 lg:flex">
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-400">WILLOW MUN 2027</span>
                <ChevronRight className="h-3 w-3 text-neutral-700" aria-hidden="true" />
                <span className="truncate text-[11px] font-medium text-neutral-300">{pageTitle}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-2 py-1 text-[9px] font-mono uppercase tracking-[0.13em] text-neutral-400 sm:inline-flex"><span className="h-1 w-1 rounded-full bg-[#d4af37]" aria-hidden="true" />{roleName}</span>
              {actingUser?.email && <span className="hidden text-[10px] text-neutral-400 md:inline">{actingUser.email}</span>}
              <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[10.5px] text-neutral-400 transition-colors hover:border-rose-400/25 hover:text-rose-300"><LogOut className="h-3 w-3" aria-hidden="true" /><span className="hidden sm:inline">Sign out</span></button>
            </div>
          </div>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-[1540px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {portal === 'department_head' && testModeHeadUser && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-amber-500/70 bg-[#171108] p-4">
              <div><p className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300">Super Admin test mode</p><p className="mt-1 text-xs text-neutral-300">Previewing as {testModeHeadUser.fullName}</p></div>
              <button type="button" onClick={() => { exitDepartmentTestMode(); onNavigate('/super-admin/testing'); }} className="rounded-md border border-amber-400/40 px-3 py-2 text-[11px] font-medium text-amber-200 hover:bg-amber-400/10">Exit test session</button>
            </div>
          )}
          {topActions && <div className="mb-4 flex flex-wrap justify-end gap-2">{topActions}</div>}
          <div key={activeNavId} className="wm-page-in">{children}</div>
        </main>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="wm-overlay-in absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="wm-drawer-in absolute inset-y-0 left-0 flex w-[17.5rem] max-w-[85vw] flex-col border-r border-white/[0.08] bg-[#0a0a0c] shadow-[20px_0_60px_rgba(0,0,0,0.5)]" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="flex items-center justify-between px-4 pb-4 pt-5">{brand}<button ref={closeButtonRef} type="button" onClick={() => setMobileOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white" aria-label="Close navigation"><X className="h-4 w-4" /></button></div>
            <div className="mx-4 h-px bg-white/[0.055]" aria-hidden="true" />
            <nav className="wm-scroll flex-1 overflow-y-auto px-2.5 py-4" aria-label="Mobile dashboard">{navigation}</nav>
            {account}
          </div>
        </div>
      )}
    </div>
  );
}
