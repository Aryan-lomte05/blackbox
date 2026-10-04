import React, { useEffect, useState, useRef } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { scrollTo } from '../../lib/smooth';
import { ArrowUp } from 'lucide-react';

export const ScrollTelemetryHud: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const [scrollPercent, setScrollPercent] = useState(0);
  const [currentSection, setCurrentSection] = useState('HERO');
  const [isVisible, setIsVisible] = useState(false);
  const spotlightRef = useRef<HTMLDivElement>(null);

  // High-performance DOM-level mouse tracking for ambient spotlight (0 React re-renders)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (spotlightRef.current) {
        spotlightRef.current.style.background = `radial-gradient(600px circle at ${e.clientX}px ${e.clientY}px, rgba(56, 189, 248, 0.04), transparent 80%)`;
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Update scroll percentage and active telemetry section
  useEffect(() => {
    return scrollYProgress.on('change', (latest) => {
      setScrollPercent(Math.round(latest * 100));
      setIsVisible(latest > 0.03);

      const y = window.scrollY;
      const sections: { id: string; name: string }[] = [
        { id: 'hero', name: 'TRACE: RECORD' },
        { id: 'story', name: 'ROOT CAUSE ≠ SYMPTOM' },
        { id: 'process', name: 'PILLARS: 4 STAGES' },
        { id: 'forensics', name: 'DAG: CONTAMINATION' },
        { id: 'diagnosis', name: 'GNN + SHAP ATTRIBUTION' },
        { id: 'replay', name: 'COUNTERFACTUAL FORK' },
        { id: 'atlas', name: 'FAILURE CONSTELLATION' },
        { id: 'guardian', name: 'GUARDIAN AUTOPILOT' },
        { id: 'lab', name: 'LIVE LAB PIPELINE' },
        { id: 'capabilities', name: 'SYSTEM ARCHITECTURE' },
        { id: 'faq', name: 'OPERATOR INTEL' },
      ];

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i].id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 250) {
            setCurrentSection(sections[i].name);
            break;
          }
        }
      }
    });
  }, [scrollYProgress]);

  const scrollToTop = () => {
    scrollTo(0);
  };

  return (
    <>
      {/* Interactive Ambient Cursor Spotlight (Desktop only, GPU accelerated, 0 re-render lag) */}
      <div
        ref={spotlightRef}
        className="pointer-events-none fixed inset-0 z-20 transition-opacity duration-300 hidden md:block"
      />

      {/* Top Laser Scroll Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-transparent z-50 pointer-events-none">
        <motion.div
          className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-teal-300 shadow-[0_0_12px_rgba(56,189,248,0.8)]"
          style={{
            scaleX: smoothProgress,
            transformOrigin: '0%',
          }}
        />
      </div>

      {/* Floating Tactical Flight Telemetry HUD Widget */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{
          opacity: isVisible ? 1 : 0,
          y: isVisible ? 0 : 20,
        }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-5 right-5 z-40 hidden sm:flex items-center gap-3 bg-[#080d16]/90 backdrop-blur-md border border-[#1f2937] rounded-full pl-3.5 pr-2 py-1.5 shadow-2xl text-[11px] font-mono select-none"
      >
        {/* Pulsing Flight Sensor */}
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          <span className="text-zinc-500">//</span>
          <span className="text-zinc-300 font-semibold tracking-wider text-[10px]">
            {currentSection}
          </span>
        </div>

        {/* Scroll Depth Counter */}
        <div className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-cyan-300 font-bold text-[10px]">
          {scrollPercent < 10 ? `0${scrollPercent}` : scrollPercent}%
        </div>

        {/* Scroll To Top Quick Action */}
        <button
          onClick={scrollToTop}
          title="Return to Flight Deck (Top)"
          className="w-6 h-6 rounded-full bg-zinc-800 hover:bg-cyan-500 hover:text-black text-zinc-300 transition-all flex items-center justify-center cursor-pointer shadow-sm"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </>
  );
};
