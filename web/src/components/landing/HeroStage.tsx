import React from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { scrollTo } from '../../lib/smooth';
import { HeroFlightCore3D } from '../3d/HeroFlightCore3D';

interface HeroStageProps {
  onOpenAuth: () => void;
  isAuthenticated: boolean;
}

export const HeroStage: React.FC<HeroStageProps> = ({ onOpenAuth, isAuthenticated }) => {
  return (
    <section id="flight-core" className="relative min-h-screen pt-32 sm:pt-36 pb-20 bg-[#08090c] overflow-hidden">
      {/* Editorial Grain Overlay */}
      <div className="absolute inset-0 pointer-events-none noise-bg opacity-30 z-20" />

      {/* Atmospheric Ambient Lighting */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[550px] bg-gradient-to-tr from-amber-500/10 via-cyan-500/5 to-transparent rounded-full blur-[160px]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[300px] bg-white/[0.02] rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
        {/* Editorial Subtitle / Eyebrow */}
        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-md mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
          <span className="text-[11px] font-mono tracking-[0.25em] text-zinc-300 uppercase">
            Aviation-Grade Telemetry for Autonomous Systems
          </span>
        </div>

        {/* Monumental Editorial Headline inspired by shantanav.in */}
        <h1 className="font-serif text-6xl sm:text-8xl md:text-9xl lg:text-[10.5rem] font-light tracking-tight text-white leading-[0.92] select-none uppercase mb-2">
          BLACK <span className="italic font-normal text-zinc-300">BOX</span>
        </h1>
        
        <p className="font-serif italic text-2xl sm:text-3xl md:text-4xl text-zinc-400 font-light tracking-wide max-w-3xl mb-6">
          The flight recorder for autonomous intelligence.
        </p>

        {/* 3D Hardware Core Hovering Freely in Open Space (No card, no borders) */}
        <div className="w-full max-w-5xl -my-4 sm:-my-6 relative z-30">
          <HeroFlightCore3D />
        </div>

        {/* Editorial Narrative & CTA */}
        <div className="max-w-2xl mx-auto space-y-6 mt-4 mb-16 relative z-10">
          <p className="text-base sm:text-lg text-zinc-400 font-light leading-relaxed">
            When autonomous agents fail, the fatal decision happened <span className="text-zinc-100 font-normal">steps before the collapse</span>. Black Box records every model call, tool execution, and state change to isolate the exact causal failure with zero-cost counterfactual replay.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={onOpenAuth}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs sm:text-sm font-mono tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95"
            >
              <span>{isAuthenticated ? 'OPEN DASHBOARD' : 'LAUNCH FLIGHT RECORDER'}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => scrollTo('#simulator')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.12] text-xs sm:text-sm font-mono tracking-wider transition-all cursor-pointer backdrop-blur-md flex items-center justify-center gap-2"
            >
              <span>EXPLORE SIMULATOR</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* High-Impact Stat Strip */}
        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center">
            <div className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
              &lt; 0.2ms
            </div>
            <div className="text-[11px] font-mono text-zinc-500 uppercase mt-2">
              Ingestion Overhead
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center">
            <div className="text-3xl sm:text-4xl font-semibold text-emerald-400 tracking-tight">
              0 Tokens
            </div>
            <div className="text-[11px] font-mono text-zinc-500 uppercase mt-2">
              Burned During Replay
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center">
            <div className="text-3xl sm:text-4xl font-semibold text-cyan-400 tracking-tight">
              100%
            </div>
            <div className="text-[11px] font-mono text-zinc-500 uppercase mt-2">
              Deterministic Replay
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center">
            <div className="text-3xl sm:text-4xl font-semibold text-purple-400 tracking-tight">
              SHA-256
            </div>
            <div className="text-[11px] font-mono text-zinc-500 uppercase mt-2">
              Cryptographic Trace DAG
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
