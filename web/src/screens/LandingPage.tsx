import React, { useEffect } from 'react';
import { startSmoothScroll } from '../lib/smooth';
import { useAuth } from '../context/AuthContext';
import { LandingNav } from '../components/landing/LandingNav';
import { LandingHero } from '../components/landing/LandingHero';
import { FailureSection } from '../components/landing/FailureSection';
import { ProcessSection } from '../components/landing/ProcessSection';
import { ForensicGraphSection } from '../components/landing/ForensicGraphSection';
import { DiagnosisSection } from '../components/landing/DiagnosisSection';
import { ProofReplaySection } from '../components/landing/ProofReplaySection';
import { FailureAtlasSection } from '../components/landing/FailureAtlasSection';
import { GuardianSection } from '../components/landing/GuardianSection';
import { LiveLabPreviewSection } from '../components/landing/LiveLabPreviewSection';
import { CapabilitiesSection } from '../components/landing/CapabilitiesSection';
import { FaqSection } from '../components/landing/FaqSection';
import { FinalCtaSection } from '../components/landing/FinalCtaSection';
import { LandingFooter } from '../components/landing/LandingFooter';
import { ScrollTelemetryHud } from '../components/landing/ScrollTelemetryHud';
import { AuthModal } from '../components/auth/AuthModal';

export const LandingPage: React.FC = () => {
  const { openAuthModal } = useAuth();

  useEffect(() => {
    document.title = 'BLACK BOX — AI Agent Flight Recorder';
    startSmoothScroll();
  }, []);

  return (
    <div className="min-h-screen bg-[#05070b] text-[#e5e7eb] relative selection:bg-cyan-500/20 selection:text-cyan-300 font-sans">
      {/* Hairline Editorial Framing Rails */}
      <div className="fixed inset-y-0 left-0 w-px bg-white/[0.04] pointer-events-none z-30" />
      <div className="fixed inset-y-0 right-0 w-px bg-white/[0.04] pointer-events-none z-30" />

      {/* Real-time Flight Telemetry HUD & Scroll Laser */}
      <ScrollTelemetryHud />

      {/* Top Architectural Navigation */}
      <LandingNav onOpenAuth={() => openAuthModal('/overview')} />

      {/* Main Narrative Progression */}
      <main className="relative z-10">
        {/* Section 1: Hero with Signature Living Trace */}
        <LandingHero onOpenAuth={() => openAuthModal('/overview')} />

        {/* Section 2: The Failure (Error != Cause) */}
        <FailureSection />

        {/* Section 3: Record -> Diagnose -> Prove -> Fix */}
        <ProcessSection />

        {/* Section 4: Forensic Execution Graph */}
        <ForensicGraphSection />

        {/* Section 5: Diagnosis & Evidence */}
        <DiagnosisSection />

        {/* Section 6: Proof & Counterfactual Replay */}
        <ProofReplaySection />

        {/* Section 7: Failure Atlas Constellation */}
        <FailureAtlasSection />

        {/* Section 8: Guardian Autonomous Safety Brake */}
        <GuardianSection />

        {/* Section 9: Live Lab Staged Benchmark Preview */}
        <LiveLabPreviewSection />

        {/* Section 10: System Architecture & Capabilities */}
        <CapabilitiesSection />

        {/* Section 11: Technical FAQ */}
        <FaqSection />

        {/* Section 12: Final Memorable CTA */}
        <FinalCtaSection onOpenAuth={() => openAuthModal('/overview')} />
      </main>

      {/* Minimal Footer */}
      <LandingFooter />

      {/* Global Auth Dialog */}
      <AuthModal />
    </div>
  );
};
