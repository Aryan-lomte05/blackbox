import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, Terminal } from 'lucide-react';

interface FinalCtaSectionProps {
  onOpenAuth: () => void;
}

export const FinalCtaSection: React.FC<FinalCtaSectionProps> = ({ onOpenAuth }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <section className="relative py-24 md:py-36 border-t border-[#1f2937]/80 bg-[#05070b] overflow-hidden">
      {/* Background Architectural Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(56,189,248,0.06),transparent)] pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-6 text-center relative z-10 font-sans">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0b0f17] border border-[#1f2937] text-[11px] font-mono text-zinc-300 mb-6">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-semibold text-white tracking-wider">FLIGHT RECORDER READY</span>
        </div>

        {/* Headline */}
        <h2 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.05] uppercase max-w-4xl mx-auto">
          WHEN THE RUN BREAKS,
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-teal-400">
            KNOW WHY.
          </span>
        </h2>

        {/* Supporting Copy */}
        <p className="text-base sm:text-lg text-zinc-400 max-w-xl mx-auto mt-4 font-mono text-xs uppercase tracking-widest text-zinc-500">
          Record. Diagnose. Prove. Fix.
        </p>

        {/* Primary CTA */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => {
              if (isAuthenticated) {
                navigate('/overview');
              } else {
                onOpenAuth();
              }
            }}
            className="px-8 py-3.5 rounded bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer shadow-xl shadow-cyan-500/10 hover:scale-105 active:scale-95"
          >
            <Terminal className="w-4 h-4" />
            <span>OPEN BLACK BOX →</span>
          </button>
        </div>

        {/* Technical Sub-metadata */}
        <p className="text-[11px] font-mono text-zinc-600 mt-6">
          OPEN ACCESS FOR LOCAL EVALUATION · MONGO PERSISTENCE ENABLED
        </p>
      </div>
    </section>
  );
};
