import { LandingFooter } from './components/LandingFooter';
import { LandingHeader } from './components/LandingHeader';
import { HeroSection } from './components/HeroSection';
import { OverviewSection } from './components/OverviewSection';
import { RoleGridSection } from './components/RoleGridSection';
import { WorkflowSection } from './components/WorkflowSection';
import { ReliabilitySection } from './components/ReliabilitySection';
import { FinalCtaSection } from './components/FinalCtaSection';

export function LandingPage() {
  return (
    <div className="medical-shell min-h-screen text-foreground">
      <LandingHeader />
      <HeroSection />

      <main className="space-y-6 px-4 pb-12 sm:px-6 lg:px-8 lg:pb-16">
        <OverviewSection />
        <RoleGridSection />
        <WorkflowSection />
        <ReliabilitySection />
        <FinalCtaSection />
      </main>

      <LandingFooter />
    </div>
  );
}
