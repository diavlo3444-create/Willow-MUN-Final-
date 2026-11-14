import { useCallback, useRef, useState } from 'react';
import { AboutSection } from './components/AboutSection';
import { AnnouncementBar } from './components/AnnouncementBar';
import { ApplySection } from './components/ApplySection';
import { BackgroundVideo } from './components/BackgroundVideo';
import { CommitteesSection } from './components/CommitteesSection';
import {
  ExecutiveBoardSection,
  type LeafFocusRequest,
} from './components/ExecutiveBoardSection';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { MarqueeStrip } from './components/MarqueeStrip';
import { MeetTeamSection } from './components/MeetTeamSection';
import { Navbar } from './components/Navbar';
import { ScrollProgressBar } from './components/ScrollProgressBar';
import { SecretariatSection } from './components/SecretariatSection';
import { SuggestionsSection } from './components/SuggestionsSection';
import { UpdatesSection } from './components/UpdatesSection';
import {
  WillowIntroEmblem,
  type WillowIntroEmblemHandle,
} from './components/WillowIntroEmblem';

export default function App() {
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [introPlaying, setIntroPlaying] = useState(true);
  const [focusLeafRequest, setFocusLeafRequest] = useState<LeafFocusRequest | null>(null);

  const introEmblemRef = useRef<WillowIntroEmblemHandle | null>(null);

  const handleReplayIntro = useCallback(() => {
    introEmblemRef.current?.replay();
  }, []);

  const handleFindOnTree = useCallback((memberIndex: number) => {
    setFocusLeafRequest((prev) => ({
      index: memberIndex,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  }, []);

  return (
    <div className="relative min-h-[100dvh] text-[#ede6ca]">
      {/* Fixed 2px cream top scroll progress bar */}
      <ScrollProgressBar />

      {/* Fixed full-viewport looping video (#bgVideo) and constant 0.40 -> 0.75 #14180a scrim */}
      <BackgroundVideo
        hasAnnouncementBar={showAnnouncement}
        introPlaying={introPlaying}
      />

      {/* Unified 60 FPS canvas intro that transitions into the background emblem behind WILLOW MUN */}
      <WillowIntroEmblem
        ref={introEmblemRef}
        introPlaying={introPlaying}
        onIntroStateChange={setIntroPlaying}
      />

      {/* Fixed top navigation (.chrome) */}
      <Navbar />

      {/* Main single-page editorial flow */}
      <main className="relative z-10">
        <Hero cursorEffectsActive={!introPlaying} />
        <MarqueeStrip paused={introPlaying} />

        <AboutSection />
        <CommitteesSection />
        <SecretariatSection onFindOnTree={handleFindOnTree} />
        <ExecutiveBoardSection focusLeafRequest={focusLeafRequest} />
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
