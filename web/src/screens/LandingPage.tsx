import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { startSmoothScroll } from '../lib/smooth';
import { useAuth } from '../context/AuthContext';

import { GrainOverlay } from '../components/landing/GrainOverlay';
import { AppleNav } from '../components/landing/AppleNav';
import { HeroStage } from '../components/landing/HeroStage';
import { DeconstructedEngineStage } from '../components/landing/DeconstructedEngineStage';
import { InteractiveFlightSimulator } from '../components/landing/InteractiveFlightSimulator';
import { CausalConstellationStage } from '../components/landing/CausalConstellationStage';
import { BentoCapabilities } from '../components/landing/BentoCapabilities';
import { DeveloperTerminal } from '../components/landing/DeveloperTerminal';
import { DualToneReveal } from '../components/landing/DualToneReveal';
import { AerospaceFooter } from '../components/landing/AerospaceFooter';

export const LandingPage: React.FC = () => {
  const { isAuthenticated, openAuthModal, authStatus, devLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'BLACK BOX — AI Agent Flight Recorder';
    startSmoothScroll();
  }, []);

  const handleOpenAuth = async () => {
    if (isAuthenticated) {
      navigate('/overview');
      return;
    }
    // If Google OAuth is not configured on the backend, activate operator mode and navigate directly
    if (!authStatus?.google_configured) {
      await devLogin('Demo Operator', 'operator@localhost');
      navigate('/overview');
      return;
    }
    openAuthModal('/overview');
  };

  return (
    <div className="min-h-screen bg-[#030407] text-[#e5e7eb] relative selection:bg-amber-500/20 selection:text-amber-300 font-sans overflow-x-hidden">
      {/* Subtle Cinematic Film Grain Overlay (shantanav.in inspiration) */}
      <GrainOverlay />

      {/* Persistent Frosted Glass Apple Navigation Bar */}
      <AppleNav onOpenAuth={handleOpenAuth} isAuthenticated={isAuthenticated} />

      {/* ACT I: Pinned Scroll-Driven Hardware Flight Core Reveal (320vh) */}
      <HeroStage onOpenAuth={handleOpenAuth} isAuthenticated={isAuthenticated} />

      {/* ACT II: The Causal Silicon Core & Micro-Architecture */}
      <DeconstructedEngineStage />

      {/* ACT III: Tactile Interactive Flight Simulator (Apple "Try It" Widget) */}
      <InteractiveFlightSimulator />

      {/* ACT IV: 3D Holographic DAG & Mathematical Causality */}
      <CausalConstellationStage />

      {/* ACT V: Apple Pro Bento Grid (Fleet Firewall, Crash Test, Guardian, MCP) */}
      <BentoCapabilities />

      {/* ACT VI: Developer Integration (3 Lines of Python + Live Terminal) */}
      <DeveloperTerminal />

      {/* ACT VII: High-Luxury Editorial Closing Statement (Cormorant Garamond) */}
      <DualToneReveal onOpenAuth={handleOpenAuth} isAuthenticated={isAuthenticated} />

      {/* ACT VIII: Aerospace Engineering Technical Footer */}
      <AerospaceFooter />
    </div>
  );
};

export default LandingPage;
