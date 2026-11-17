import { useCallback, useRef, useState } from 'react';
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

export default function App() {
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
