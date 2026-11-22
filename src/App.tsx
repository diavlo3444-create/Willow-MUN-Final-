import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { AboutSection } from './components/AboutSection';
import { AnnouncementBar } from './components/AnnouncementBar';
import { ApplySection } from './components/ApplySection';
import { CommitteesSection } from './components/CommitteesSection';
import { ExecutiveBoardSection } from './components/ExecutiveBoardSection';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { InstagramSection } from './components/InstagramSection';
import { MarqueeStrip } from './components/MarqueeStrip';
import { MascotDog } from './components/MascotDog';
import { Navbar } from './components/Navbar';
import { ScrollProgressBar } from './components/ScrollProgressBar';
import { UpdatesSection } from './components/UpdatesSection';
import { WillowBackground } from './components/WillowBackground';
import {
  WillowIntroEmblem,
  type WillowIntroEmblemHandle,
} from './components/WillowIntroEmblem';
import { PortalAuthView } from './components/admin/PortalAuthView';
import { ExecutiveBoardSignupView } from './components/admin/ExecutiveBoardSignupView';
import { HrApplicantSignupView } from './components/admin/HrApplicantSignupView';
import { HeadPasswordSetupView } from './components/admin/HeadPasswordSetupView';
import { PortalErrorBoundary } from './components/admin/PortalErrorBoundary';
import { AlyaLoginEasterEgg } from './components/admin/AlyaLoginEasterEgg';
import { ToastViewport } from './components/admin/ToastViewport';
import { LegalPages } from './components/LegalPages';
import { AdminPortal } from './components/admin/portals/AdminPortal';
import { DepartmentHeadPortal } from './components/admin/portals/DepartmentHeadPortal';
import { SecurityScannerPortal } from './components/admin/portals/SecurityScannerPortal';
import { StaffPortal } from './components/admin/portals/StaffPortal';
import { SuperAdminPortal } from './components/admin/portals/SuperAdminPortal';
import { AdminStoreProvider, useAdminStore } from './context/AdminStoreContext';
import { canAccessPortal, getPortalHomeRouteForUser } from './utils/adminPermissions';
import { markAlyaIntroSeenInSession, shouldShowAlyaLoginEasterEgg } from './utils/alyaEasterEgg';
import type { PortalKey } from './types/admin';
import { isAdminRoute, usePathname } from './utils/router';

function PublicWebsite({ pathname }: { pathname: string }) {
  if (pathname === '/privacy') return <LegalPages page="privacy" />;
  if (pathname === '/terms') return <LegalPages page="terms" />;
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  // Always show the opening animation on a fresh public-site entry.
  const [introPlaying, setIntroPlaying] = useState(true);

  const introEmblemRef = useRef<WillowIntroEmblemHandle | null>(null);

  const handleReplayIntro = useCallback(() => {
    introEmblemRef.current?.replay();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-[100dvh] pb-[calc(6.5rem+env(safe-area-inset-bottom))] text-[#ede6ca]">
        {/* Fixed 2px cream top scroll progress bar */}
        <ScrollProgressBar />

        {/* Fixed full-screen looping video background */}
        <WillowBackground />

        {/* Opening emblem intro that fades out cleanly to reveal the hero and looping video background */}
        <WillowIntroEmblem
          ref={introEmblemRef}
          introPlaying={introPlaying}
          onIntroStateChange={setIntroPlaying}
        />

        {/* Fixed top navigation (.chrome) */}
        <Navbar />

        {/* Main single-page editorial flow */}
        <main className="relative z-[1] bg-transparent">
          <Hero cursorEffectsActive={!introPlaying} />
          <MarqueeStrip paused={introPlaying} />

          <AboutSection introPlaying={introPlaying} />
          <CommitteesSection />
          <ExecutiveBoardSection />
          <UpdatesSection />
          <InstagramSection />
          <ApplySection />
        </main>

        <Footer onReplayIntro={handleReplayIntro} />

        <MascotDog introPlaying={introPlaying} />

        <AnnouncementBar
          visible={showAnnouncement}
          onDismiss={() => setShowAnnouncement(false)}
        />
      </div>
    </MotionConfig>
  );
}

function AdminRouter({ pathname, navigate }: { pathname: string; navigate: (path: string) => void }) {
  const { currentUser, testModeHeadUser, testModeSessionVersion, authReady, data, signOut } = useAdminStore();
  const [alyaIntroDismissedKey, setAlyaIntroDismissedKey] = useState<string | null>(null);
  const isLegacyEbRoute = pathname === '/eb' || pathname.startsWith('/eb/');
  const requestedPortal: PortalKey | null =
    pathname === '/super-admin' || pathname.startsWith('/super-admin/') ? 'super_admin' :
    pathname === '/admin' || pathname.startsWith('/admin/') ? 'admin' :
    pathname === '/security' || pathname.startsWith('/security/') ? 'security' :
    pathname === '/staff' || pathname.startsWith('/staff/') ? 'staff' :
    pathname === '/head' || pathname.startsWith('/head/') || isLegacyEbRoute ? 'department_head' : null;
  const loginPortal: PortalKey | undefined =
    pathname === '/admin-login' ? 'admin' :
    pathname === '/eb-login' ? 'executive_board' :
    pathname === '/head-login' ? 'department_head' :
    pathname === '/super-admin-login' ? 'super_admin' :
    pathname === '/security-login' ? 'security' :
    pathname === '/staff-login' ? 'staff' : undefined;
  const isEbSignup = pathname === '/eb-signup';
  const isHrSignup = pathname === '/team-signup';
  const isHeadSetup = pathname === '/head-setup';

  useEffect(() => {
    if (!currentUser) {
      setAlyaIntroDismissedKey(null);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!authReady || isHeadSetup) return;
    if (!currentUser && requestedPortal) {
      navigate(
        isLegacyEbRoute ? '/eb-login' :
        requestedPortal === 'department_head' ? '/head-login' :
        requestedPortal === 'super_admin' ? '/super-admin-login' :
        requestedPortal === 'security' ? '/security-login' :
        requestedPortal === 'staff' ? '/staff-login' :
        '/admin-login'
      );
      return;
    }
    if (currentUser && loginPortal) {
      if (loginPortal === 'security' && canAccessPortal(currentUser, 'security', data.departments)) {
        navigate('/security');
      } else {
        navigate(getPortalHomeRouteForUser(currentUser, data.departments));
      }
      return;
    }
    if (currentUser && !requestedPortal && !loginPortal && !isHrSignup && !isEbSignup) {
      navigate(getPortalHomeRouteForUser(currentUser, data.departments));
      return;
    }
    if (currentUser && isLegacyEbRoute && canAccessPortal(currentUser, 'department_head', data.departments)) {
      navigate(pathname.replace(/^\/eb(?=\/|$)/, '/head'));
      return;
    }
    if (currentUser && requestedPortal && !canAccessPortal(currentUser, requestedPortal, data.departments)) {
      navigate(getPortalHomeRouteForUser(currentUser, data.departments));
    }
  }, [authReady, currentUser, data.departments, requestedPortal, loginPortal, navigate, isHeadSetup, isLegacyEbRoute, isHrSignup, isEbSignup, pathname]);

  if (!authReady) {
    return (
      <div className="wm-admin min-h-[100dvh] grid place-items-center bg-[color:var(--wm-canvas)] text-[color:var(--wm-ink)]">
        <div className="text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[color:var(--wm-hairline-strong)] border-t-[color:var(--wm-focal)]" />
          <p className="mt-4 text-xs tracking-wide text-[color:var(--wm-ink-secondary)]">Verifying Willow session</p>
        </div>
      </div>
    );
  }

  if (requestedPortal && !currentUser) {
    const portalForLogin: PortalKey = requestedPortal === 'department_head' ? 'department_head' : requestedPortal;
    return <PortalAuthView portal={portalForLogin} onNavigate={navigate} />;
  }
  if (requestedPortal && currentUser && !canAccessPortal(currentUser, requestedPortal, data.departments)) {
    return (
      <div className="wm-admin min-h-[100dvh] grid place-items-center bg-[color:var(--wm-canvas)] p-6 text-[color:var(--wm-ink)]">
        <div className="wm-surface-panel max-w-md p-6 text-center">
          <h1 className="wm-serif text-xl font-semibold">Opening your assigned portal</h1>
          <p className="mt-2 text-xs text-[color:var(--wm-ink-secondary)]">Your account does not have access to this section. Redirecting you to the correct workspace.</p>
          <button type="button" onClick={() => navigate(getPortalHomeRouteForUser(currentUser, data.departments))} className="mt-5 rounded-md bg-[color:var(--wm-emerald)] px-4 py-2 text-xs font-semibold text-white">Open my portal</button>
        </div>
      </div>
    );
  }
  if (!requestedPortal && currentUser && !isHeadSetup && !isHrSignup && !isEbSignup) {
    const targetHome = getPortalHomeRouteForUser(currentUser, data.departments);
    return (
      <div className="wm-admin min-h-[100dvh] grid place-items-center bg-[color:var(--wm-canvas)] p-6 text-[color:var(--wm-ink)]">
        <div className="wm-surface-panel max-w-md p-6 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--wm-hairline-strong)] border-t-[color:var(--wm-focal)]" />
          <h1 className="wm-serif mt-4 text-xl font-semibold">Opening your Willow MUN portal</h1>
          <p className="mt-2 text-xs text-[color:var(--wm-ink-secondary)]">
            Signed in as {currentUser.fullName}. Redirecting to your assigned workspace.
          </p>
          <button
            type="button"
            onClick={() => navigate(targetHome)}
            className="mt-5 rounded-md bg-[color:var(--wm-emerald)] px-4 py-2 text-xs font-semibold text-white hover:bg-[#357a5b]"
          >
            Open my portal
          </button>
        </div>
      </div>
    );
  }

  const activeAlyaSessionKey = currentUser ? `${testModeSessionVersion}:${currentUser.id}` : null;
  if (
    requestedPortal &&
    currentUser &&
    shouldShowAlyaLoginEasterEgg({
      user: currentUser,
      testModeHeadUser,
      departments: data.departments,
      dismissedUserId:
        activeAlyaSessionKey && alyaIntroDismissedKey === activeAlyaSessionKey
          ? currentUser.id
          : null,
    })
  ) {
    return (
      <AlyaLoginEasterEgg
        user={currentUser}
        onComplete={() => {
          markAlyaIntroSeenInSession(currentUser.id);
          if (activeAlyaSessionKey) setAlyaIntroDismissedKey(activeAlyaSessionKey);
        }}
      />
    );
  }

  return (
    <PortalErrorBoundary onNavigate={navigate} onSignOut={signOut} resetKey={pathname}>
      {requestedPortal === 'super_admin' ? (
        <SuperAdminPortal pathname={pathname} onNavigate={navigate} />
      ) : requestedPortal === 'admin' ? (
        <AdminPortal pathname={pathname} onNavigate={navigate} />
      ) : requestedPortal === 'security' ? (
        <SecurityScannerPortal pathname={pathname} onNavigate={navigate} />
      ) : requestedPortal === 'staff' ? (
        <StaffPortal pathname={pathname} onNavigate={navigate} />
      ) : requestedPortal === 'department_head' ? (
        <DepartmentHeadPortal
          pathname={isLegacyEbRoute ? pathname.replace(/^\/eb(?=\/|$)/, '/head') : pathname}
          onNavigate={navigate}
        />
      ) : isHeadSetup ? (
        <HeadPasswordSetupView onComplete={() => navigate('/head')} />
      ) : isHrSignup ? (
        <HrApplicantSignupView onNavigate={navigate} />
      ) : isEbSignup ? (
        <ExecutiveBoardSignupView onNavigate={navigate} />
      ) : (
        <PortalAuthView portal={loginPortal} onNavigate={navigate} />
      )}
      <ToastViewport />
    </PortalErrorBoundary>
  );
}

export default function App() {
  const [pathname, navigate] = usePathname();
  const inAdminPortal = isAdminRoute(pathname);

  useLayoutEffect(() => {
    if (inAdminPortal) {
      document.body.classList.remove('intro-on', 'intro-transitioning');
    }
  }, [inAdminPortal]);

  if (!inAdminPortal) return <PublicWebsite pathname={pathname} />;

  return (
    <AdminStoreProvider>
      <AdminRouter pathname={pathname} navigate={navigate} />
    </AdminStoreProvider>
  );
}
