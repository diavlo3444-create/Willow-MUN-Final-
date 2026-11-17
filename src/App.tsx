import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AboutSection } from './components/AboutSection';
import { AnnouncementBar } from './components/AnnouncementBar';
import { ApplySection } from './components/ApplySection';
import { CommitteesSection } from './components/CommitteesSection';
import { ExecutiveBoardSection } from './components/ExecutiveBoardSection';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { MarqueeStrip } from './components/MarqueeStrip';
import { MeetTeamSection } from './components/MeetTeamSection';
import { Navbar } from './components/Navbar';
import { ScrollProgressBar } from './components/ScrollProgressBar';
import { SuggestionsSection } from './components/SuggestionsSection';
import { UpdatesSection } from './components/UpdatesSection';
import { WillowBackground } from './components/WillowBackground';
import {
  WillowIntroEmblem,
  type WillowIntroEmblemHandle,
} from './components/WillowIntroEmblem';
import { PortalAuthView } from './components/admin/PortalAuthView';
import { ExecutiveBoardSignupView } from './components/admin/ExecutiveBoardSignupView';
import { ToastViewport } from './components/admin/ToastViewport';
import { AdminPortal } from './components/admin/portals/AdminPortal';
import { DepartmentHeadPortal } from './components/admin/portals/DepartmentHeadPortal';
import { SuperAdminPortal } from './components/admin/portals/SuperAdminPortal';
import { ExecutiveBoardPortal } from './components/admin/portals/ExecutiveBoardPortal';
import { AdminStoreProvider, useAdminStore } from './context/AdminStoreContext';
import { canAccessPortal, getPortalHomeRoute } from './utils/adminPermissions';
import type { PortalKey } from './types/admin';
import { isAdminRoute, usePathname } from './utils/router';

function PublicWebsite() {
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [introPlaying, setIntroPlaying] = useState(true);
  const [motionPaused, setMotionPaused] = useState(false);

  const introEmblemRef = useRef<WillowIntroEmblemHandle | null>(null);

  const handleReplayIntro = useCallback(() => {
    introEmblemRef.current?.replay();
  }, []);

  const handleTogglePause = useCallback(() => {
    setMotionPaused((prev) => !prev);
  }, []);

  return (
    <div className="relative min-h-[100dvh] pb-[calc(6.5rem+env(safe-area-inset-bottom))] text-[#ede6ca]">
      {/* Fixed 2px cream top scroll progress bar */}
      <ScrollProgressBar />

      {/* Fixed full-screen looping video background */}
      <WillowBackground
        hasAnnouncementBar={showAnnouncement}
        introPlaying={introPlaying}
        paused={motionPaused}
        onTogglePause={handleTogglePause}
      />

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

        <AboutSection />
        <CommitteesSection />
        <ExecutiveBoardSection />
        <MeetTeamSection />
        <UpdatesSection />
        <ApplySection />
        <SuggestionsSection />
      </main>

      <Footer onReplayIntro={handleReplayIntro} />

      <AnnouncementBar
        visible={showAnnouncement}
        onDismiss={() => setShowAnnouncement(false)}
      />
    </div>
  );
}

function AdminRouter({ pathname, navigate }: { pathname: string; navigate: (path: string) => void }) {
  const { currentUser, authReady } = useAdminStore();
  const requestedPortal: PortalKey | null =
    pathname === '/super-admin' || pathname.startsWith('/super-admin/') ? 'super_admin' :
    pathname === '/admin' || pathname.startsWith('/admin/') ? 'admin' :
    pathname === '/head' || pathname.startsWith('/head/') ? 'department_head' :
    pathname === '/eb' || pathname.startsWith('/eb/') ? 'executive_board' : null;
  const loginPortal: PortalKey | undefined = pathname === '/admin-login' ? 'admin' : pathname === '/eb-login' ? 'executive_board' : pathname === '/head-login' ? 'department_head' : pathname === '/super-admin-login' ? 'super_admin' : undefined;
  const isEbSignup = pathname === '/eb-signup';

  useEffect(() => {
    if (!authReady) return;
    if (!currentUser && requestedPortal) {
      navigate(requestedPortal === 'executive_board' ? '/eb-login' : requestedPortal === 'department_head' ? '/head-login' : requestedPortal === 'super_admin' ? '/super-admin-login' : '/admin-login');
      return;
    }
    if (currentUser && loginPortal) {
      navigate(getPortalHomeRoute(currentUser.role));
      return;
    }
    if (currentUser && !requestedPortal && !loginPortal) {
      navigate(getPortalHomeRoute(currentUser.role));
      return;
    }
    if (currentUser && requestedPortal && !canAccessPortal(currentUser, requestedPortal)) {
      navigate(getPortalHomeRoute(currentUser.role));
    }
  }, [authReady, currentUser, requestedPortal, loginPortal, navigate]);

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

  if (requestedPortal && (!currentUser || !canAccessPortal(currentUser, requestedPortal))) return null;
  if (!requestedPortal && currentUser) return null;

  return (
    <>
      {requestedPortal === 'super_admin' ? (
        <SuperAdminPortal pathname={pathname} onNavigate={navigate} />
      ) : requestedPortal === 'admin' ? (
        <AdminPortal pathname={pathname} onNavigate={navigate} />
      ) : requestedPortal === 'department_head' ? (
        <DepartmentHeadPortal pathname={pathname} onNavigate={navigate} />
      ) : requestedPortal === 'executive_board' ? (
        <ExecutiveBoardPortal pathname={pathname} onNavigate={navigate} />
      ) : isEbSignup ? (
        <ExecutiveBoardSignupView onNavigate={navigate} />
      ) : (
        <PortalAuthView portal={loginPortal} onNavigate={navigate} />
      )}
      <ToastViewport />
    </>
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

  if (!inAdminPortal) return <PublicWebsite />;

  return (
    <AdminStoreProvider>
      <AdminRouter pathname={pathname} navigate={navigate} />
    </AdminStoreProvider>
  );
}
