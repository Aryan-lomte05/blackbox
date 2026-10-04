import React, { useEffect } from 'react';
import { startSmoothScroll } from '../lib/smooth';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from '../components/auth/AuthModal';

import { ArchitecturalFrame } from '../components/landing/ArchitecturalFrame';
import { Chapter01Trace } from '../components/landing/Chapter01Trace';
import { Chapter02Run } from '../components/landing/Chapter02Run';
import { Chapter03Failure } from '../components/landing/Chapter03Failure';
import { Chapter04Cause } from '../components/landing/Chapter04Cause';
import { Chapter05Proof } from '../components/landing/Chapter05Proof';
import { Chapter06Pattern } from '../components/landing/Chapter06Pattern';
import { Chapter07Control } from '../components/landing/Chapter07Control';
import { Chapter08Destination } from '../components/landing/Chapter08Destination';

export const LandingPage: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useAuth();

  useEffect(() => {
    document.title = 'BLACK BOX — AI Agent Flight Recorder';
    startSmoothScroll();
  }, []);

  const handleOpenAuth = () => {
    openAuthModal('/overview');
  };

  const handleExploreRun = () => {
    const el = document.getElementById('ch-02');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#05070b] text-[#e5e7eb] relative selection:bg-cyan-500/20 selection:text-cyan-300 font-sans">
      {/* Persistent Architectural Framing Rails & Top Navigation */}
      <ArchitecturalFrame
        onOpenAuth={handleOpenAuth}
        isAuthenticated={isAuthenticated}
      />

      {/* Unified 8-Chapter Continuous Forensic Investigation Sequence */}
      <main className="relative z-10">
        <Chapter01Trace onOpenAuth={handleOpenAuth} onExploreClick={handleExploreRun} />
        <Chapter02Run />
        <Chapter03Failure />
        <Chapter04Cause />
        <Chapter05Proof />
        <Chapter06Pattern />
        <Chapter07Control />
        <Chapter08Destination onOpenAuth={handleOpenAuth} isAuthenticated={isAuthenticated} />
      </main>

      {/* Global Auth Modal Dialog */}
      <AuthModal />
    </div>
  );
};
