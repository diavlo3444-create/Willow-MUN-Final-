import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useAdminStore } from '../../../context/AdminStoreContext';
import type { ApplicationStatus } from '../../../types/admin';
import {
  canAccessPortal,
  canManageAccountsOrRoles,
  hasPermission,
} from '../../../utils/adminPermissions';
import { AdminShell } from '../AdminShell';
import { PortalAuthView } from '../PortalAuthView';
import { AccountsView } from '../views/AccountsView';
import { HeadAccountsView } from '../views/HeadAccountsView';
import { ActivityLogsView } from '../views/ActivityLogsView';
import { ApplicationsView } from '../views/ApplicationsView';
import { LiveStaffAccountsView } from '../views/LiveStaffAccountsView';
import { LiveApplicationsView } from '../views/LiveApplicationsView';
import {
  EmailManagementView,
  MessagesInquiriesView,
  NotificationsCenterView,
} from '../views/CommunicationViews';
import { ConferenceCmsView } from '../views/ConferenceCmsView';
import { DepartmentsView } from '../views/DepartmentsView';
import { FormBuilderView } from '../views/FormBuilderView';
import { OperationsView } from '../views/OperationsView';
import { OverviewDashboardView } from '../views/OverviewDashboardView';
import { QrAttendanceView } from '../views/QrAttendanceView';
import {
  ConferenceSettingsView,
  RegistrationControlsView,
  ReportsStatisticsView,
  SystemMonitoringView,
} from '../views/ReportsAndAdminViews';
import { DepartmentTestingView, RolesPermissionsView } from '../views/RolesPermissionsView';
import { SecretariatView } from '../views/SecretariatView';
import { WebsiteCmsView } from '../views/WebsiteCmsView';
import { WorkspaceModulesView } from '../views/WorkspaceModulesView';
import { ExecutiveBoardAccountsView } from '../views/ExecutiveBoardAccountsView';

interface ExecutivePortalProps {
  portal: 'super_admin' | 'admin';
  pathname: string;
  onNavigate: (path: string) => void;
}

const SECTION_META: Record<string, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Executive Overview',
    subtitle: 'Conference-wide metrics, intake trends, and governance shortcuts.',
  },
  applications: {
    title: 'All Applications',
    subtitle: 'Review Stage 1 Head Recommendations and finalize Stage 2 decisions.',
  },
  delegates: {
    title: 'Delegate Applications',
    subtitle: 'Dedicated intake queue for MUN Committee delegate applicants.',
  },
  'staff-apps': {
    title: 'Staff Applications',
    subtitle: 'Review Volunteer, Media, Press, and Security applications.',
  },
  recommendations: {
    title: 'Stage 1 Department Recommendations',
    subtitle: 'Applications recommended by Department Heads awaiting Stage 2 Admin confirmation.',
  },
  forms: {
    title: 'Application Form Builder',
    subtitle: 'Configure category-specific intake questions, conditional branches, and deadlines.',
  },
  committees: {
    title: 'Committees Management',
    subtitle: 'Create and edit diplomatic chambers, topics, chairs, and capacities.',
  },
  secretariat: {
    title: 'Secretariat Roster',
    subtitle: 'Manage conference Secretariat profiles, photos, biographies, and ordering.',
  },
  'executive-board': {
    title: 'Executive Board Tree Roster',
    subtitle: 'Configure Executive Board structure across organizing clusters.',
  },
  departments: {
    title: 'Department Management',
    subtitle: 'Manage departments, registration availability, instructions, and head assignments.',
  },
  sponsors: {
    title: 'Sponsors & Partners',
    subtitle: 'Manage Title, Gold, Silver, and Community partners with tier visibility.',
  },
  schedule: {
    title: 'Conference Schedule',
    subtitle: 'Maintain the official ceremony, session, and briefing calendar.',
  },
  announcements: {
    title: 'Announcements & Banners',
    subtitle: 'Control live updates cards and homepage top/bottom announcement strip.',
  },
  documents: {
    title: 'Conference Documents',
    subtitle: 'Manage Study Guides, Rules of Procedure, handbooks, and policies.',
  },
  faqs: {
    title: 'Frequently Asked Questions',
    subtitle: 'Organize delegate, fee, and dress code Q&A.',
  },
  gallery: {
    title: 'Conference Gallery',
    subtitle: 'Curate photography folders displayed on conference channels.',
  },
  teams: {
    title: 'Team Management',
    subtitle: 'Organize department units, supervisors, and accepted staff assignments.',
  },
  groups: {
    title: 'Department Workspace & Modules',
    subtitle: 'Cross-department access to all 13 conference operational modules.',
  },
  shifts: {
    title: 'Shift Scheduling',
    subtitle: 'Plan duty time windows, station headcounts, and staff shifts.',
  },
  deployment: {
    title: 'Venue Deployment Planner',
    subtitle: 'Coordinate gate stations, hall assignments, and supervisor coverage.',
  },
  rosters: {
    title: 'Staff & Unit Rosters',
    subtitle: 'Assigned department members mapped to active conference teams.',
  },
  attendance: {
    title: 'Live Venue Attendance & QR Scanner',
    subtitle: 'Scan passes at checkpoints and review gate check-in timestamps.',
  },
  qr: {
    title: 'QR Pass Registry & Personal ID',
    subtitle: 'Inspect digital passes, issue credentials, and toggle pass activation.',
  },
  'website-editor': {
    title: 'Website CMS: Draft & Live Preview',
    subtitle: 'Edit draft website content and publish live updates with responsive previews.',
  },
  pages: {
    title: 'Website Pages',
    subtitle: 'Configure page visibility, slugs, and publishing states.',
  },
  sections: {
    title: 'Website Sections',
    subtitle: 'Edit headings, body copy, CTAs, and imagery for every public landing section.',
  },
  media: {
    title: 'Media Library',
    subtitle: 'Upload, organize, and pick high-resolution assets for website and CMS records.',
  },
  navigation: {
    title: 'Navigation & Footer',
    subtitle: 'Edit top navigation links and official conference footer metadata.',
  },
  seo: {
    title: 'SEO & Search Preview',
    subtitle: 'Customize meta titles, descriptions, social preview cards, and indexing flags.',
  },
  versions: {
    title: 'Website Version History & Rollback',
    subtitle: 'Compare published snapshots and safely restore previous versions.',
  },
  email: {
    title: 'Email Center',
    subtitle: 'Compose and dispatch templated individual or bulk applicant communications.',
  },
  messages: {
    title: 'Messages & Public Inquiries',
    subtitle: 'Triage submissions from the public Suggestions & Accessibility form.',
  },
  notifications: {
    title: 'Notifications Center',
    subtitle: 'System notices, Stage 1 recommendations, and incoming inquiries.',
  },
  registration: {
    title: 'Registration Controls',
    subtitle: 'Global conference registration gate, windows, and department intake toggles.',
  },
  reports: {
    title: 'Statistics & CSV Reports',
    subtitle: 'Filter conference metrics and export structured CSV datasets.',
  },
  logs: {
    title: 'Activity & Security Audit Logs',
    subtitle: 'Complete audit history of actions across applications, CMS, and security.',
  },
  settings: {
    title: 'Conference Settings',
    subtitle: 'Manage dates, venue, delegate fees, terms, privacy policy, and demo state.',
  },
  monitoring: {
    title: 'Platform Health & Monitoring',
    subtitle: 'Diagnostic probes, error alert triage, and runtime security parameters.',
  },
  admins: {
    title: 'Staff Accounts',
    subtitle: 'Live staff account directory loaded directly from Supabase.'
  },
  heads: {
    title: 'Department Head Directory',
    subtitle: 'Department Head accounts and department linkages (Read-Only for Admin role).',
  },
  roles: {
    title: 'Role Management',
    subtitle: 'Reusable conference role definitions (Read-Only for Admin role).',
  },
  'permission-defs': {
    title: 'Permission Definitions',
    subtitle: 'Global RBAC capability catalog and Super Admin enforcement rules.',
  },
  'eb-accounts': {
    title: 'Executive Board Accounts',
    subtitle: 'Create EB logins and assign department-specific responsibilities and access levels.',
  },
  testing: {
    title: 'Department Access Testing Mode',
    subtitle: 'Preview /head isolated as any selected Department Head account.',
  },
};

export function ExecutivePortal({ portal, pathname, onNavigate }: ExecutivePortalProps) {
  const { currentUser, recordSecurityViolation } = useAdminStore();

  const [globalSearch, setGlobalSearch] = useState('');
  const [appFilterDept, setAppFilterDept] = useState<string>('all');
  const [appFilterStatus, setAppFilterStatus] = useState<ApplicationStatus | 'all'>('all');
  const [preselectedEmailIds, setPreselectedEmailIds] = useState<string[]>([]);

  const basePath = portal === 'super_admin' ? '/super-admin' : '/admin';
  const subPath = pathname.replace(new RegExp(`^/${portal === 'super_admin' ? 'super-admin' : 'admin'}/?`), '');
  const segments = subPath ? subPath.split('/').filter(Boolean) : [];
  const section = segments[0] || 'dashboard';
  const paramId = segments[1] || null;

  const authorizedForPortal = currentUser !== null && canAccessPortal(currentUser, portal);
  const isSuperAdmin = canManageAccountsOrRoles(currentUser);

  // Record security violation if an Admin directly visits a Super Admin-only route
  const isSuperOnlyRoute = section === 'admins' || section === 'testing' || section === 'eb-accounts';
  const attemptedForbiddenSuperRoute = authorizedForPortal && !isSuperAdmin && isSuperOnlyRoute;
  const westPortalSections = new Set([
    'dashboard', 'applications', 'staff-apps', 'executive-board', 'heads', 'departments', 'reports',
    'attendance', 'qr', 'website-editor', 'committees', 'secretariat', 'sponsors',
    'schedule', 'announcements', 'documents', 'faqs', 'messages', 'settings',
    'admins', 'eb-accounts', 'testing',
  ]);
  const unsupportedPortalSection = !westPortalSections.has(section);

  const loggedViolationRef = useRef<string | null>(null);
  useEffect(() => {
    if (attemptedForbiddenSuperRoute && currentUser) {
      const key = `${currentUser.id}:${pathname}`;
      if (loggedViolationRef.current === key) return;
      loggedViolationRef.current = key;
      recordSecurityViolation(
        'super_admin_route',
        section,
        `Blocked non-Super-Admin access to ${pathname}.`,
      );
    } else {
      loggedViolationRef.current = null;
    }
  }, [attemptedForbiddenSuperRoute, currentUser, pathname, recordSecurityViolation, section]);

  if (!authorizedForPortal || !currentUser) {
    return <PortalAuthView portal={portal} onNavigate={onNavigate} />;
  }

  const meta = SECTION_META[section] ?? SECTION_META.dashboard;
  const portalLabel = portal === 'super_admin' ? 'Super Admin' : 'Admin';
  const searchableSection =
    section === 'applications' ||
    section === 'delegates' ||
    section === 'staff-apps' ||
    section === 'recommendations';

  const renderDenied = (reason: string) => (
    <div
      role="alert"
      className="rounded-md border border-rose-400/35 bg-rose-500/[0.08] p-8 text-center space-y-3"
    >
      <ShieldAlert className="mx-auto h-10 w-10 text-rose-200" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-rose-100">Access Restricted</h2>
      <p className="mx-auto max-w-md text-xs text-[color:var(--wm-ink-secondary)]">{reason}</p>
      <button
        type="button"
        onClick={() => onNavigate(basePath)}
        className="inline-flex min-h-[38px] items-center gap-1.5 rounded bg-[color:var(--wm-focal)] px-4 text-xs font-semibold text-[#12170c] hover:bg-[#dad3b4] cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Return to {portalLabel} Dashboard</span>
      </button>
    </div>
  );

  const navigateFilteredApps = (status: ApplicationStatus | 'all' = 'all', deptId = 'all') => {
    setAppFilterStatus(status);
    setAppFilterDept(deptId);
    onNavigate(`${basePath}/applications`);
  };

  return (
    <AdminShell
      portal={portal}
      portalLabel={portalLabel}
      pageTitle={
        portal === 'super_admin' && section === 'dashboard'
          ? 'Super Admin Command Dashboard'
          : meta.title
      }
      pageSubtitle={meta.subtitle}
      activeNavId={section}
      onNavigate={onNavigate}
      topActions={
        <>
          <a href={basePath + '/qr'} className="rounded-md border border-[#d4af37]/35 px-3 py-2 text-xs font-medium text-[#bfa04a] hover:bg-[#d4af37]/10">My QR Pass</a>
          {isSuperAdmin && <a href={basePath + '/eb-accounts'} className="rounded-md border border-[#d4af37]/35 px-3 py-2 text-xs font-medium text-[#bfa04a] hover:bg-[#d4af37]/10">EB Signup & Accounts</a>}
        </>
      }
      globalSearch={searchableSection ? globalSearch : undefined}
      onGlobalSearchChange={searchableSection ? setGlobalSearch : undefined}
    >
      {unsupportedPortalSection ? (
        renderDenied('This section is not part of the WEST-style Willow management portal.')
      ) : attemptedForbiddenSuperRoute ? (
        renderDenied(
          'This governance area is strictly restricted to Super Admin accounts. This navigation attempt has been recorded in the security audit log.',
        )
      ) : section === 'dashboard' ? (
        <OverviewDashboardView
          basePath={basePath}
          onNavigate={onNavigate}
          onFilterApplications={navigateFilteredApps}
          onSelectApplication={(appId) => onNavigate(`${basePath}/applications/${appId}`)}
        />
      ) : section === 'applications' || section === 'staff-apps' ? (
        hasPermission(currentUser, 'applications.view') ? (
          <LiveApplicationsView selectedId={paramId} onClose={() => onNavigate(basePath + '/applications')} />
        ) : (
          renderDenied('Your account lacks applications.view permission.')
        )
      ) : section === 'delegates' || section === 'recommendations' ? (
        hasPermission(currentUser, 'applications.view') ? (
          <ApplicationsView
            key={`${section}-${appFilterDept}-${appFilterStatus}`}
            viewMode={section === 'delegates' ? 'delegate' : 'recommendations'}
            initialDepartmentFilter="all"
            initialStatusFilter={section === 'recommendations' ? 'pending' : 'all'}
            externalSearch={globalSearch}
            selectedApplicationIdFromRoute={null}
            onSelectApplicationId={(appId) =>
              onNavigate(appId ? `${basePath}/applications/${appId}` : `${basePath}/${section}`)
            }
            onNavigateToEmailWithIds={(ids) => {
              setPreselectedEmailIds(ids);
              onNavigate(`${basePath}/email`);
            }}
          />
        ) : (
          renderDenied('Your account lacks applications.view permission.')
        )
      ) : section === 'forms' ? (
        hasPermission(currentUser, 'forms.manage') ? (
          <FormBuilderView />
        ) : (
          renderDenied('Your account lacks forms.manage permission.')
        )
      ) : section === 'committees' ||
        section === 'executive-board' ||
        section === 'sponsors' ||
        section === 'schedule' ||
        section === 'announcements' ||
        section === 'documents' ||
        section === 'faqs' ||
        section === 'gallery' ? (
        <ConferenceCmsView section={section} />
      ) : section === 'secretariat' ? (
        <SecretariatView />
      ) : section === 'departments' ? (
        <DepartmentsView
          onInspectDepartmentApps={(deptId) => navigateFilteredApps('all', deptId)}
        />
      ) : section === 'teams' ||
        section === 'shifts' ||
        section === 'deployment' ||
        section === 'rosters' ? (
        <OperationsView mode={section} />
      ) : section === 'groups' ? (
        <WorkspaceModulesView />
      ) : section === 'attendance' || section === 'qr' ? (
        <QrAttendanceView mode={section} />
      ) : section === 'website-editor' ||
        section === 'pages' ||
        section === 'sections' ||
        section === 'media' ||
        section === 'navigation' ||
        section === 'seo' ||
        section === 'versions' ? (
        <WebsiteCmsView mode={section} />
      ) : section === 'email' ? (
        <EmailManagementView preselectedApplicationIds={preselectedEmailIds} />
      ) : section === 'messages' ? (
        <MessagesInquiriesView />
      ) : section === 'notifications' ? (
        <NotificationsCenterView />
      ) : section === 'registration' ? (
        <RegistrationControlsView />
      ) : section === 'reports' ? (
        <ReportsStatisticsView />
      ) : section === 'logs' ? (
        <ActivityLogsView />
      ) : section === 'settings' ? (
        <ConferenceSettingsView />
      ) : section === 'monitoring' ? (
        <SystemMonitoringView />
      ) : section === 'admins' ? (
        <LiveStaffAccountsView />
      ) : section === 'heads' ? (
        <HeadAccountsView />
      ) : section === 'roles' ? (
        <RolesPermissionsView section="roles" />
      ) : section === 'permission-defs' ? (
        <RolesPermissionsView section="permission-defs" />
      ) : section === 'eb-accounts' ? (
        <ExecutiveBoardAccountsView />
      ) : section === 'testing' ? (
        <DepartmentTestingView />
      ) : (
        <OverviewDashboardView
          basePath={basePath}
          onNavigate={onNavigate}
          onFilterApplications={navigateFilteredApps}
          onSelectApplication={(appId) => onNavigate(`${basePath}/applications/${appId}`)}
        />
      )}
    </AdminShell>
  );
}
