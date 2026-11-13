import { AboutSection } from './components/AboutSection';
import { ApplySection } from './components/ApplySection';
import { BackgroundVideo } from './components/BackgroundVideo';
import { CommitteesSection } from './components/CommitteesSection';
import { ExecutiveBoardSection } from './components/ExecutiveBoardSection';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Navbar } from './components/Navbar';
import { UpdatesSection } from './components/UpdatesSection';

export default function App() {
  return (
    <div className="relative min-h-[100dvh] bg-[#232814] text-[#ede6ca]">
      {/* Fixed full-viewport looping video and scroll-responsive dark olive scrim */}
      <BackgroundVideo />

      {/* Fixed top navigation with vertical fade into the background video */}
      <Navbar />

      {/* Main diplomatic single-page scroll flow */}
      <main className="relative z-10">
        <Hero />

        <div className="space-y-8 sm:space-y-12 pb-6">
          <AboutSection />
          <CommitteesSection />
          <ExecutiveBoardSection />
          <UpdatesSection />
          <ApplySection />
        </div>
      </main>

      <Footer />
    </div>
  );
}
