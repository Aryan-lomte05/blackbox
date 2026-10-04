import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Terminal, Shield, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Chapter08Props {
  onOpenAuth: () => void;
  isAuthenticated: boolean;
}

export const Chapter08Destination: React.FC<Chapter08Props> = ({ onOpenAuth, isAuthenticated }) => {
  const navigate = useNavigate();

  const handleAction = () => {
    if (isAuthenticated) {
      navigate('/overview');
    } else {
      onOpenAuth();
    }
  };

  return (
    <footer id="ch-08" className="relative pt-28 pb-16 px-6 sm:px-12 md:px-20 font-sans bg-[#05070b]">
      <div className="max-w-6xl mx-auto">
        {/* Monolithic Destination Statement */}
        <div className="text-center py-16 md:py-24 border-b border-[#1f2937]/60">
          <div className="inline-flex items-center gap-2 mb-6 text-xs font-mono text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="uppercase">CHAPTER 08 // DESTINATION</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">AUTONOMOUS RUNTIME OBSERVABILITY</span>
          </div>

          <h2 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight uppercase leading-[1.05] mb-6">
            When the run breaks, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-teal-400">
              know why.
            </span>
          </h2>

          <div className="flex items-center justify-center gap-4 text-xs font-mono text-zinc-400 tracking-widest uppercase mb-10">
            <span>RECORD</span>
            <span className="text-zinc-600">//</span>
            <span>DIAGNOSE</span>
            <span className="text-zinc-600">//</span>
            <span>PROVE</span>
          </div>

          {/* Primary CTA */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={handleAction}
              className="px-8 py-4 rounded bg-white hover:bg-zinc-200 text-black font-semibold text-xs font-mono tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-xl shadow-cyan-500/10 active:scale-[0.98]"
            >
              <span>{isAuthenticated ? 'ENTER BLACK BOX CONSOLE' : 'OPEN BLACK BOX'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Minimal Architectural Footer Navigation */}
        <div className="pt-12 flex flex-col md:flex-row items-center justify-between gap-6 text-xs font-mono text-zinc-500">
          {/* Left: System Status */}
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-400 font-semibold">ALL SYSTEMS OPERATIONAL</span>
            <span className="text-zinc-700">//</span>
            <span>OVERHEAD: 0.0MS</span>
          </div>

          {/* Center: Internal Application Route Links */}
          <div className="flex flex-wrap items-center gap-4 text-zinc-400">
            <button onClick={() => navigate('/overview')} className="hover:text-white transition-colors cursor-pointer">
              OVERVIEW
            </button>
            <button onClick={() => navigate('/incidents')} className="hover:text-white transition-colors cursor-pointer">
              INCIDENTS
            </button>
            <button onClick={() => navigate('/causal')} className="hover:text-white transition-colors cursor-pointer">
              CAUSAL ENGINE
            </button>
            <button onClick={() => navigate('/fix')} className="hover:text-white transition-colors cursor-pointer">
              FLEET FIX
            </button>
            <button onClick={() => navigate('/live')} className="hover:text-white transition-colors cursor-pointer">
              LIVE LAB
            </button>
          </div>

          {/* Right: Copyright */}
          <div className="text-zinc-600 text-[11px]">
            &copy; 2026 BLACK BOX // IMMUTABLE RUN RECORDER
          </div>
        </div>
      </div>
    </footer>
  );
};
