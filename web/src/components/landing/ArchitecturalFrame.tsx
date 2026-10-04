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
  { id: 'ch-08', num: '08', name: 'ENTER BLACK BOX' },
];

export const ArchitecturalFrame: React.FC<ArchitecturalFrameProps> = ({
  onOpenAuth,
  isAuthenticated,
}) => {
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 120, damping: 25, restDelta: 0.001 });

  const [activeChapter, setActiveChapter] = useState(CHAPTERS[0]);
  const [scrollPercent, setScrollPercent] = useState(0);

  useEffect(() => {
    return scrollYProgress.on('change', (p) => {
      setScrollPercent(Math.round(p * 100));
      if (p < 0.12) setActiveChapter(CHAPTERS[0]);
      else if (p < 0.25) setActiveChapter(CHAPTERS[1]);
      else if (p < 0.38) setActiveChapter(CHAPTERS[2]);
      else if (p < 0.52) setActiveChapter(CHAPTERS[3]);
      else if (p < 0.66) setActiveChapter(CHAPTERS[4]);
      else if (p < 0.79) setActiveChapter(CHAPTERS[5]);
      else if (p < 0.91) setActiveChapter(CHAPTERS[6]);
      else setActiveChapter(CHAPTERS[7]);
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
        className="fixed top-0 left-0 right-0 h-[2px] bg-cyan-400 z-50 pointer-events-none shadow-[0_0_8px_rgba(34,211,238,0.8)]"
      />

      {/* Persistent Architectural Top Rail */}
      <header className="fixed top-0 inset-x-0 h-14 bg-[#05070b]/95 backdrop-blur-md border-b border-[#1f2937]/70 z-40 flex items-center justify-between px-4 sm:px-6 md:px-8 font-sans">
        {/* Left: Brand Identity */}
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

        {/* Center: Top Navigation Links from reference */}
        <nav className="hidden md:flex items-center gap-8 font-mono text-xs text-zinc-400">
          <button
            onClick={() => scrollToChapter('ch-02')}
            className="hover:text-cyan-400 transition-colors cursor-pointer"
          >
            Product
          </button>
          <button
            onClick={() => scrollToChapter('ch-04')}
            className="hover:text-cyan-400 transition-colors cursor-pointer"
          >
            How It Works
          </button>
          <button
            onClick={() => scrollToChapter('ch-06')}
            className="hover:text-cyan-400 transition-colors cursor-pointer"
          >
            Docs
          </button>
        </nav>

        {/* Right: Technical Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenAuth}
            className="px-4 py-1.5 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs font-mono tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-cyan-500/10 active:scale-[0.98]"
          >
            <span>{isAuthenticated ? 'OPEN APP' : 'OPEN BLACK BOX'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Persistent Sub-Bar Indicators directly under Header */}
      <div className="fixed top-14 inset-x-0 h-9 z-35 flex items-center justify-between px-6 sm:px-12 md:px-16 pointer-events-none">
        {/* Left: Active Chapter Pill Badge */}
        <div className="pointer-events-auto inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#080d16]/90 border border-cyan-500/40 text-[10px] font-mono text-cyan-400 backdrop-blur-md shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-bold text-white">{activeChapter.num}</span>
          <span className="text-zinc-600">/ 08</span>
          <span className="text-zinc-500">//</span>
          <span className="font-semibold tracking-wider">{activeChapter.name}</span>
        </div>

        {/* Right: Scroll Navigation Progress */}
        <div className="inline-flex items-center gap-2 font-mono text-[11px] text-zinc-400 bg-[#060a10]/80 px-2.5 py-0.5 rounded border border-[#1f2937]/80 backdrop-blur-md">
          <span className="text-zinc-500 tracking-wider uppercase text-[10px]">SCROLL NAVIGATION</span>
          <span className="text-cyan-400 font-bold">{scrollPercent}%</span>
        </div>
      </div>

      {/* Left Hairline Framing Rail with Chapter Ticks (Desktop only) */}
      <aside className="fixed inset-y-0 left-0 w-12 pointer-events-none z-30 hidden lg:flex flex-col justify-between py-24 px-3 border-r border-[#1f2937]/40 text-[9px] font-mono text-zinc-600 select-none">
        <span className="rotate-180 [writing-mode:vertical-rl] tracking-widest text-zinc-500 uppercase">
          FORENSIC TIMELINE
        </span>

        <div className="flex flex-col gap-2 pointer-events-auto">
          {CHAPTERS.map((ch) => {
            const isActive = ch.id === activeChapter.id;
            return (
              <button
                key={ch.id}
                onClick={() => scrollToChapter(ch.id)}
                className={`w-6 h-6 rounded flex items-center justify-center transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/60 font-bold shadow-[0_0_8px_rgba(34,211,238,0.3)]'
                    : 'text-zinc-600 hover:text-zinc-300 hover:bg-[#111827]/50'
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
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 mx-auto animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
          <p className="text-[8px] text-zinc-600 text-center">PASS</p>
        </div>

        <span className="text-[8px] text-zinc-700">100%</span>
      </aside>
    </>
  );
};
