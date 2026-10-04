import React, { useState, useEffect } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface ArchitecturalFrameProps {
  onOpenAuth: () => void;
  isAuthenticated: boolean;
}

const CHAPTERS = [
  { id: 'ch-01', num: '01', name: 'THE TRACE' },
  { id: 'ch-02', num: '02', name: 'THE RUN' },
  { id: 'ch-03', num: '03', name: 'THE FAILURE' },
  { id: 'ch-04', num: '04', name: 'THE CAUSE' },
  { id: 'ch-05', num: '05', name: 'THE PROOF' },
  { id: 'ch-06', num: '06', name: 'THE PATTERN' },
  { id: 'ch-07', num: '07', name: 'THE CONTROL' },
  { id: 'ch-08', num: '08', name: 'OPEN BLACK BOX' },
];

export const ArchitecturalFrame: React.FC<ArchitecturalFrameProps> = ({
  onOpenAuth,
  isAuthenticated,
}) => {
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 120, damping: 25, restDelta: 0.001 });

  const [activeChapter, setActiveChapter] = useState(CHAPTERS[0]);

  useEffect(() => {
    return scrollYProgress.on('change', () => {
      for (let i = CHAPTERS.length - 1; i >= 0; i--) {
        const el = document.getElementById(CHAPTERS[i].id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= window.innerHeight * 0.45) {
            setActiveChapter(CHAPTERS[i]);
            break;
          }
        }
      }
    });
  }, [scrollYProgress]);

  const scrollToChapter = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Hairline Progress Rule (Top Edge) */}
      <motion.div
        style={{ scaleX: smoothProgress, transformOrigin: '0%' }}
        className="fixed top-0 left-0 right-0 h-[2px] bg-cyan-400 z-50 pointer-events-none"
      />

      {/* Persistent Architectural Top Rail */}
      <header className="fixed top-0 inset-x-0 h-14 bg-[#05070b]/90 backdrop-blur-md border-b border-[#1f2937]/70 z-40 flex items-center justify-between px-4 sm:px-6 md:px-8 font-sans">
        {/* Left: Brand Identity & Monospace Subtitle */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => scrollToChapter('ch-01')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 group-hover:scale-125 transition-transform shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            <span className="font-extrabold text-white tracking-widest text-xs uppercase font-mono">
              BLACK BOX
            </span>
          </div>
          <span className="text-[#1f2937] hidden sm:inline">/</span>
          <span className="text-zinc-500 text-[11px] font-mono hidden sm:inline">
            AI AGENT FLIGHT RECORDER
          </span>
        </div>

        {/* Center: Dynamic Active Chapter Indicator */}
        <div className="hidden md:flex items-center gap-2 font-mono text-[11px] text-zinc-400 bg-[#090d15] px-3 py-1 rounded border border-[#1f2937]/80">
          <span className="text-cyan-400 font-bold">{activeChapter.num}</span>
          <span className="text-zinc-600">/ 08</span>
          <span className="text-zinc-500 font-semibold">{activeChapter.name}</span>
        </div>

        {/* Right: Technical Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenAuth}
            className="px-3.5 py-1.5 rounded bg-white hover:bg-zinc-200 text-black font-semibold text-xs font-mono tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-cyan-500/10 active:scale-[0.98]"
          >
            <span>{isAuthenticated ? 'OPEN APP' : 'OPEN BLACK BOX'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Left Hairline Framing Rail with Chapter Ticks (Desktop only) */}
      <aside className="fixed inset-y-0 left-0 w-12 pointer-events-none z-30 hidden lg:flex flex-col justify-between py-24 px-3 border-r border-[#1f2937]/40 text-[9px] font-mono text-zinc-600 select-none">
        <span className="rotate-180 [writing-mode:vertical-rl] tracking-widest text-zinc-500 uppercase">
          FORENSIC TIMELINE
        </span>

        <div className="flex flex-col gap-3 pointer-events-auto">
          {CHAPTERS.map((ch) => {
            const isActive = ch.id === activeChapter.id;
            return (
              <button
                key={ch.id}
                onClick={() => scrollToChapter(ch.id)}
                className={`text-left transition-colors cursor-pointer ${
                  isActive ? 'text-cyan-400 font-bold' : 'text-zinc-700 hover:text-zinc-400'
                }`}
                title={`Chapter ${ch.num}: ${ch.name}`}
              >
                {ch.num}
              </button>
            );
          })}
        </div>

        <span className="text-[8px] text-zinc-700">0.0MS</span>
      </aside>

      {/* Right Hairline Framing Rail with Telemetry Metadata (Desktop only) */}
      <aside className="fixed inset-y-0 right-0 w-12 pointer-events-none z-30 hidden lg:flex flex-col justify-between py-24 px-3 border-l border-[#1f2937]/40 text-[9px] font-mono text-zinc-600 select-none text-right">
        <span className="[writing-mode:vertical-rl] tracking-widest text-zinc-500 uppercase">
          SHARD: LIVE-RUN
        </span>

        <div className="space-y-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 mx-auto animate-pulse" />
          <p className="text-[8px] text-zinc-600 text-center">PASS</p>
        </div>

        <span className="text-[8px] text-zinc-700">100%</span>
      </aside>
    </>
  );
};
