import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { scrollTo } from '../../lib/smooth';
import { HeroTraceVisual } from './HeroTraceVisual';
import { ArrowRight, ChevronDown, Activity, Sparkles } from 'lucide-react';

interface LandingHeroProps {
  onOpenAuth: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onOpenAuth }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const runwayRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState<number>(0);

  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 1000], [0, 160]);
  const heroHeaderOpacity = useTransform(scrollY, [0, 450, 850], [1, 0.9, 0.2]);
  const heroHeaderY = useTransform(scrollY, [0, 800], [0, 50]);

  // Connect scroll runway to trace progress
  const { scrollYProgress: runwayProgress } = useScroll({
    target: runwayRef,
    offset: ['start start', 'end end'],
  });

  useEffect(() => {
    return runwayProgress.on('change', (latest) => {
      setScrollProgress(latest);
    });
  }, [runwayProgress]);

  const scrollToStory = () => {
    scrollTo('story');
  };

  const metrics = [
    { label: 'RECORDING OVERHEAD', value: '0.0 ms', desc: 'Zero in-loop latency', color: 'text-white' },
    { label: 'DIAGNOSIS ACCURACY', value: 'Top-3 Hit', desc: 'GNN & LightGBM SHAP', color: 'text-cyan-400' },
    { label: 'REPLAY TOKEN REUSE', value: 'Up to 82%', desc: 'Counterfactual fork savings', color: 'text-emerald-400' },
    { label: 'REGRESSION FIREWALL', value: 'Automated', desc: 'Verified across test shards', color: 'text-white' },
  ];

  const STAGES = [
    { id: '01', name: 'STREAM', range: [0, 0.22] },
    { id: '02', name: 'CRASH', range: [0.22, 0.44] },
    { id: '03', name: 'ISOLATE', range: [0.44, 0.66] },
    { id: '04', name: 'FORK', range: [0.66, 0.88] },
    { id: '05', name: 'VERIFY', range: [0.88, 1.0] },
  ];

  const currentStageIdx =
    scrollProgress < 0.22 ? 0 : scrollProgress < 0.44 ? 1 : scrollProgress < 0.66 ? 2 : scrollProgress < 0.88 ? 3 : 4;

  return (
    <section ref={heroRef} id="hero" className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
      {/* Background Architectural Grid Lines & Dynamic Parallax Glow */}
      <motion.div
        style={{ y: bgY }}
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(56,189,248,0.12),rgba(255,255,255,0))] pointer-events-none"
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-6 relative z-10 font-sans">
        {/* HERO HEADER: Headline, Technical Eyebrow & Dispatched CTAs */}
        <motion.div
          style={{ opacity: heroHeaderOpacity, y: heroHeaderY }}
          className="text-center"
        >
          {/* Top Technical Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center justify-center gap-3 mb-6"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0b0f17]/90 backdrop-blur border border-[#1f2937] text-[11px] font-mono text-zinc-300 shadow-md">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400" />
              <span className="font-semibold text-white tracking-wider">BLACK BOX</span>
              <span className="text-zinc-600">//</span>
              <span className="text-zinc-400">AI AGENT FLIGHT RECORDER</span>
            </div>

            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/70 border border-zinc-800 text-[10px] font-mono text-zinc-400">
              <span>[SAVE-POINTS: RESUMABLE]</span>
              <span className="text-zinc-600">//</span>
              <span className="text-cyan-400/90">[DIAGNOSIS: GNN+RANKER]</span>
            </div>
          </motion.div>

          {/* Main Sovereign Headline */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-4xl mx-auto space-y-3 mb-8"
          >
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white uppercase leading-[1.05]">
              RECORD THE RUN.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-500">
                FIND THE CAUSE.
              </span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-teal-400">
                PROVE THE FIX.
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed pt-3 font-normal">
              Multi-step AI agents fail silently. Traditional loggers show the final crash, not the root error.
              Black Box records complete execution save-points, isolates the guilty step with causal graph diagnosis,
              and proves counterfactual fixes without production regressions.
            </p>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="flex flex-wrap items-center justify-center gap-4 mb-10"
          >
            <button
              onClick={() => {
                if (isAuthenticated) {
                  navigate('/overview');
                } else {
                  onOpenAuth();
                }
              }}
              className="group px-6 py-3 rounded bg-white hover:bg-zinc-100 text-zinc-950 font-semibold text-xs tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer shadow-xl shadow-cyan-500/10 hover:shadow-cyan-400/20 hover:scale-[1.03] active:scale-[0.98]"
            >
              <span>INVESTIGATE A RUN</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={scrollToStory}
              className="px-5 py-3 rounded border border-zinc-800 hover:border-zinc-600 bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-300 text-xs font-mono tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer backdrop-blur"
            >
              <span>SEE HOW IT WORKS</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 animate-bounce" />
            </button>
          </motion.div>
        </motion.div>

        {/* INTERACTIVE STICKY SCROLL RUNWAY FOR THE SIGNATURE HERO FLIGHT RECORDER */}
        <div ref={runwayRef} className="relative min-h-[160vh] md:min-h-[220vh] mt-4">
          <div className="sticky top-16 md:top-20 z-20 pt-2 pb-8">
            {/* Mission Telemetry HUD strip right above console */}
            <div className="flex items-center justify-between max-w-5xl mx-auto px-2 mb-2 text-[10px] font-mono text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-zinc-200 font-bold uppercase tracking-wider">
                  MISSION: APAC-SETTLEMENT-09
                </span>
                <span className="text-zinc-600">//</span>
                <span className="text-cyan-400 hidden sm:inline">
                  SCROLL-INTERACTIVE FLIGHT RECORDER DECK
                </span>
              </div>

              {/* Scroll Prompter / Stage Indicator */}
              <div className="flex items-center gap-2 text-zinc-400 bg-zinc-950/80 px-2.5 py-1 rounded border border-zinc-800 shadow-md">
                <span className="text-zinc-500 hidden sm:inline">PROGRESSION:</span>
                <span className="text-cyan-300 font-bold uppercase">
                  {STAGES[currentStageIdx].name} ({currentStageIdx + 1}/5)
                </span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-500 font-mono">{(scrollProgress * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* THE SIGNATURE HERO TRACE VISUAL */}
            <HeroTraceVisual externalProgress={scrollProgress} />

            {/* Interactive Stage Progression Micro-Notches beneath console */}
            <div className="flex flex-wrap items-center justify-between max-w-5xl mx-auto px-2 mt-2 text-[10px] font-mono text-zinc-500 gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-600">STAGE HUD:</span>
                {STAGES.map((s, idx) => (
                  <span
                    key={s.id}
                    className={`px-1.5 py-0.5 rounded text-[9px] transition-all ${
                      idx === currentStageIdx
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold shadow-sm shadow-cyan-500/20'
                        : 'text-zinc-600'
                    }`}
                  >
                    {s.id} {s.name}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-1 text-zinc-500">
                <span className="hidden sm:inline">SCROLL DOWN TO PROGRESS TIMELINE</span>
                <ChevronDown className="w-3 h-3 text-cyan-400 animate-bounce" />
              </div>
            </div>
          </div>
        </div>

        {/* Hairline Metrics Strip with Staggered Scroll-Triggered Reveal */}
        <div className="mt-8 pt-8 border-t border-[#1f2937]/80 grid grid-cols-2 md:grid-cols-4 gap-6 font-mono relative z-10">
          {metrics.map((m, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              whileHover={{ y: -3, scale: 1.02 }}
              className="p-3 rounded-lg border border-transparent hover:border-zinc-800 hover:bg-zinc-900/40 transition-all text-center"
            >
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{m.label}</p>
              <p className={`text-xl font-bold ${m.color} mt-1 tracking-tight`}>{m.value}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{m.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
