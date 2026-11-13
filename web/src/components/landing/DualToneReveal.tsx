import React from 'react';
import { ArrowUpRight, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DualToneRevealProps {
  onOpenAuth: () => void;
  isAuthenticated: boolean;
}

export const DualToneReveal: React.FC<DualToneRevealProps> = ({ onOpenAuth, isAuthenticated }) => {
  const navigate = useNavigate();

  return (
    <section className="relative py-32 sm:py-44 bg-[#030407] border-t border-white/[0.08] overflow-hidden font-sans">
      {/* Background Ambient Spotlight */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-emerald-500/10 rounded-full blur-[140px] opacity-70" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center flex flex-col items-center">
        {/* Micro-badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md mb-8">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.9)]" />
          <span className="text-[11px] font-mono tracking-widest text-zinc-300 uppercase">
            The Observability Standard for Autonomous AI
          </span>
        </div>

        {/* Editorial Headline */}
        <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-normal tracking-tight text-white leading-[1.05] mb-8 font-serif">
          In aviation, a flight recorder <br />
          <span className="italic text-zinc-400">is legally mandated.</span> <br />
          <span className="font-sans font-medium text-3xl sm:text-5xl md:text-6xl text-white tracking-tight block mt-4">
            In autonomous AI, it's just common sense.
          </span>
        </h2>

        <p className="max-w-2xl text-base sm:text-lg text-zinc-400 font-light leading-relaxed mb-12">
          Stop wondering why your multi-agent fleet crashed in production.
          Record immutable traces, isolate the culpable step mathematically, and verify fixes without burning tokens.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={onOpenAuth}
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-sm font-mono tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_40px_rgba(255,255,255,0.25)] active:scale-95"
          >
            <span>{isAuthenticated ? 'OPEN FLIGHT CONSOLE' : 'LAUNCH BLACK BOX'}</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate('/lab')}
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.12] text-sm font-mono tracking-wider transition-all cursor-pointer backdrop-blur-md flex items-center justify-center gap-2"
          >
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>ENTER LIVE LAB</span>
          </button>
        </div>

        {/* Attribution */}
        <div className="mt-16 text-zinc-600 font-mono text-[11px] tracking-widest uppercase">
          Built by Team Half a Byte • Aryan Lomte, Radhesh, Aditya, Advay Chavan
        </div>
      </div>
    </section>
  );
};
