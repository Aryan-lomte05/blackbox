import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScroll } from 'framer-motion';
import { startSmoothScroll } from '../lib/smooth';
import { useAuth } from '../context/AuthContext';

import { ArchitecturalFrame } from '../components/landing/ArchitecturalFrame';
import { MasterForensicStage } from '../components/landing/MasterForensicStage';
import { MasterNarrativeOverlay } from '../components/landing/MasterNarrativeOverlay';
import { Terminal, Shield, ArrowUpRight, Github, ExternalLink } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const navigate = useNavigate();

  // Scroll tracking container
  const runwayRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: runwayRef,
    offset: ['start start', 'end end'],
  });

  const [progress, setProgress] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    document.title = 'BLACK BOX — AI Agent Flight Recorder';
    startSmoothScroll();
  }, []);

  useEffect(() => {
    return scrollYProgress.on('change', (latest) => {
      setProgress(latest);
    });
  }, [scrollYProgress]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    setMousePos({ x, y });
  };

  const handleOpenAuth = () => {
    if (isAuthenticated) {
      navigate('/overview');
    } else {
      openAuthModal('/overview');
    }
  };

  const handleExploreRun = () => {
    const el = document.getElementById('ch-02');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="min-h-screen bg-[#05070b] text-[#e5e7eb] relative selection:bg-cyan-500/20 selection:text-cyan-300 font-sans"
    >
      {/* Persistent Architectural Framing Rails & Top Navigation */}
      <ArchitecturalFrame
        onOpenAuth={handleOpenAuth}
        isAuthenticated={isAuthenticated}
      />

      {/* 
        CONTINUOUS SCROLL-DRIVEN RUNWAY:
        Total height: 750vh allows high-precision, buttery scroll scrubbing
        through the 8 forensic acts without jarring cutoffs.
      */}
      <div ref={runwayRef} className="relative h-[750vh]">
        {/* Invisible Anchor Waypoints for Direct Chapter Jumps */}
        <div id="ch-01" className="absolute top-[0%] h-1 w-full pointer-events-none" />
        <div id="ch-02" className="absolute top-[13.5%] h-1 w-full pointer-events-none" />
        <div id="ch-03" className="absolute top-[27%] h-1 w-full pointer-events-none" />
        <div id="ch-04" className="absolute top-[41%] h-1 w-full pointer-events-none" />
        <div id="ch-05" className="absolute top-[55%] h-1 w-full pointer-events-none" />
        <div id="ch-06" className="absolute top-[69%] h-1 w-full pointer-events-none" />
        <div id="ch-07" className="absolute top-[82%] h-1 w-full pointer-events-none" />
        <div id="ch-08" className="absolute top-[93%] h-1 w-full pointer-events-none" />

        {/* Pinned Viewport Scene (Anchored while scroll progress transforms it) */}
        <div className="sticky top-0 h-screen w-full overflow-hidden bg-[#05070b]">
          {/* Continuous Mathematical SVG Forensic Stage */}
          <MasterForensicStage progress={progress} mousePos={mousePos} />

          {/* Continuous Narrative & HUD Telemetry Overlay */}
          <MasterNarrativeOverlay
            progress={progress}
            onOpenAuth={handleOpenAuth}
            onExploreClick={handleExploreRun}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </div>

      {/* Persistent Architectural Technical Footer */}
      <footer className="relative z-30 border-t border-[#1f2937]/80 bg-[#040609] py-16 px-6 sm:px-12 md:px-20 font-sans">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 text-xs">
          {/* Brand & Mission */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
              <span className="font-mono font-bold tracking-widest text-sm text-white uppercase">
                BLACK BOX
              </span>
            </div>
            <p className="text-zinc-400 leading-relaxed font-sans">
              The deterministic flight recorder for autonomous agent networks.
              Record immutable execution traces, mathematically isolate causal anomalies,
              and verify fixes with counterfactual replay.
            </p>
            <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>CORE RUNTIME: OPERATIONAL</span>
            </div>
          </div>

          {/* Technical Specs */}
          <div className="space-y-3 font-mono">
            <h4 className="text-zinc-300 font-bold tracking-wider text-[11px] uppercase">
              SPECIFICATION
            </h4>
            <ul className="space-y-2 text-zinc-500 text-[11px]">
              <li className="flex items-center justify-between border-b border-[#1f2937]/40 pb-1">
                <span>INGESTION PROTOCOL</span>
                <span className="text-zinc-300">OTel / JSON-RPC</span>
              </li>
              <li className="flex items-center justify-between border-b border-[#1f2937]/40 pb-1">
                <span>RECORDING OVERHEAD</span>
                <span className="text-cyan-400">&lt; 0.4ms / step</span>
              </li>
              <li className="flex items-center justify-between border-b border-[#1f2937]/40 pb-1">
                <span>CRYPTOGRAPHIC HASH</span>
                <span className="text-zinc-300">SHA-256 DAG</span>
              </li>
              <li className="flex items-center justify-between border-b border-[#1f2937]/40 pb-1">
                <span>DAG SUBTRACTION</span>
                <span className="text-emerald-400">SHAP CAUSALITY</span>
              </li>
            </ul>
          </div>

          {/* Architecture Modules */}
          <div className="space-y-3 font-mono">
            <h4 className="text-zinc-300 font-bold tracking-wider text-[11px] uppercase">
              SYSTEM MODULES
            </h4>
            <ul className="space-y-2 text-zinc-400 text-[11px]">
              <li>
                <button
                  onClick={() => navigate('/overview')}
                  className="hover:text-cyan-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Forensic Overview</span>
                  <ArrowUpRight className="w-3 h-3 text-zinc-600" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/runs')}
                  className="hover:text-cyan-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Execution DAG Runs</span>
                  <ArrowUpRight className="w-3 h-3 text-zinc-600" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/causal')}
                  className="hover:text-cyan-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Causal Root Analyzer</span>
                  <ArrowUpRight className="w-3 h-3 text-zinc-600" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/atlas')}
                  className="hover:text-cyan-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Fleet Failure Atlas</span>
                  <ArrowUpRight className="w-3 h-3 text-zinc-600" />
                </button>
              </li>
            </ul>
          </div>

          {/* Integration & Security */}
          <div className="space-y-3 font-mono">
            <h4 className="text-zinc-300 font-bold tracking-wider text-[11px] uppercase">
              INTEGRATION
            </h4>
            <div className="p-3 rounded bg-[#090e18] border border-[#1f2937] text-[11px] space-y-2">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-zinc-500">PIP INSTALL</span>
                <span className="text-cyan-300">blackbox-flight</span>
              </div>
              <p className="text-[10px] text-zinc-500 font-sans leading-relaxed">
                Connect your LangGraph, CrewAI, AutoGen, or custom agent pipeline via OpenTelemetry or Python client.
              </p>
            </div>
            <p className="text-[10px] text-zinc-600">
              Cryptographically immutable audit records with local or enterprise self-hosted backends.
            </p>
          </div>
        </div>

        {/* Bottom Baseline Bar */}
        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-[#1f2937]/50 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-zinc-600 gap-4">
          <p>© 2026 BLACK BOX FLIGHT RECORDER SYSTEMS. ALL RIGHTS RESERVED.</p>
          <div className="flex items-center gap-6 text-zinc-500">
            <span>RFC-9122 COMPLIANT</span>
            <span>•</span>
            <span>DETERMINISTIC DAG</span>
            <span>•</span>
            <span className="text-cyan-400">v2.4.0 PROD</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
