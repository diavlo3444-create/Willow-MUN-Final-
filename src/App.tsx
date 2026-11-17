import { useCallback, useLayoutEffect, useRef, useState } from 'react';
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
import { ToastViewport } from './components/admin/ToastViewport';
import { AdminPortal } from './components/admin/portals/AdminPortal';
import { DepartmentHeadPortal } from './components/admin/portals/DepartmentHeadPortal';
import { SuperAdminPortal } from './components/admin/portals/SuperAdminPortal';
import { AdminStoreProvider } from './context/AdminStoreContext';
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

export default function App() {
  const [pathname, navigate] = usePathname();
  const inAdminPortal = isAdminRoute(pathname);

  useLayoutEffect(() => {
    if (inAdminPortal) {
      document.body.classList.remove('intro-on', 'intro-transitioning');
    }
  }, [inAdminPortal]);

  if (!inAdminPortal) {
    return <PublicWebsite />;
  }

  return (
    <AdminStoreProvider>
      {pathname === '/super-admin' || pathname.startsWith('/super-admin/') ? (
        <SuperAdminPortal pathname={pathname} onNavigate={navigate} />
      ) : pathname === '/admin' || pathname.startsWith('/admin/') ? (
        <AdminPortal pathname={pathname} onNavigate={navigate} />
      ) : pathname === '/head' || pathname.startsWith('/head/') ? (
        <DepartmentHeadPortal pathname={pathname} onNavigate={navigate} />
      ) : (
        <PortalAuthView onNavigate={navigate} />
      )}
      <ToastViewport />
    </AdminStoreProvider>
  );
}
