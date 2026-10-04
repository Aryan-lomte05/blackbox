import React, { useState, useEffect } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ArrowUpRight, Github } from 'lucide-react';
import { scrollTo } from '../../lib/smooth';

interface AppleNavProps {
  onOpenAuth: () => void;
  isAuthenticated: boolean;
}

export const AppleNav: React.FC<AppleNavProps> = ({ onOpenAuth, isAuthenticated }) => {
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 120, damping: 25, restDelta: 0.001 });
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    return scrollYProgress.on('change', (latest) => {
      setScrolled(latest > 0.02);
    });
  }, [scrollYProgress]);

  return (
    <>
      {/* Top Hairline Scroll Progress Bar */}
      <motion.div
        style={{ scaleX: smoothProgress, transformOrigin: '0%' }}
        className="fixed top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-amber-500 via-cyan-400 to-emerald-400 z-50 pointer-events-none shadow-[0_0_8px_rgba(245,158,11,0.5)]"
      />

      {/* Floating High-Luxury Editorial Navigation Bar */}
      <header
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'h-16 bg-[#08090c]/85 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_10px_30px_rgba(0,0,0,0.8)]'
            : 'h-20 bg-gradient-to-b from-[#08090c]/90 to-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          {/* Brand Monogram in Cormorant Garamond Serif (shantanav.in style) */}
          <button
            onClick={() => scrollTo(0)}
            className="flex items-center gap-3.5 group text-left cursor-pointer"
          >
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full border border-white/20 group-hover:border-amber-400/60 transition-colors bg-white/[0.03]">
              <span className="font-serif italic font-bold text-base text-white tracking-tighter">
                BB
              </span>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)] animate-pulse" />
            </div>

            <div className="flex flex-col">
              <span className="font-serif tracking-[0.2em] text-sm text-white uppercase font-light">
                BLACK BOX
              </span>
              <span className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase -mt-0.5">
                Flight Recorder
              </span>
            </div>
          </button>

          {/* Floating Pill Navigation inspired by shantanav.in */}
          <div className="flex items-center gap-3">
            <nav className="hidden md:flex items-center gap-6 px-5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl text-xs font-mono tracking-wider text-zinc-400">
              <button
                onClick={() => scrollTo('#flight-core')}
                className="hover:text-white transition-colors cursor-pointer uppercase text-[11px]"
              >
                Overview
              </button>
              <button
                onClick={() => scrollTo('#causal-engine')}
                className="hover:text-white transition-colors cursor-pointer uppercase text-[11px]"
              >
                Architecture
              </button>
              <button
                onClick={() => scrollTo('#simulator')}
                className="hover:text-white transition-colors cursor-pointer uppercase text-[11px]"
              >
                Simulator
              </button>
              <button
                onClick={() => scrollTo('#capabilities')}
                className="hover:text-white transition-colors cursor-pointer uppercase text-[11px]"
              >
                Capabilities
              </button>
              <button
                onClick={() => scrollTo('#sdk')}
                className="hover:text-white transition-colors cursor-pointer uppercase text-[11px]"
              >
                SDK
              </button>
            </nav>

            <a
              href="https://github.com/Aryan-lomte05/Half_a_Byte_maharashtra_round"
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-mono transition-all"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>

            <button
              onClick={onOpenAuth}
              className="px-5 py-2 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs font-mono tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.15)] active:scale-95"
            >
              <span>{isAuthenticated ? 'CONSOLE' : 'LAUNCH APP'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
