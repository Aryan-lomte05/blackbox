import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll } from 'framer-motion';
import { GitFork, CheckCircle2, XCircle, ArrowRight, Zap, Clock, Coins, ShieldCheck, Repeat, Sliders, RotateCcw } from 'lucide-react';

export const ProofReplaySection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [divergeStep, setDivergeStep] = useState<number>(3);
  const [isManual, setIsManual] = useState<boolean>(false);
  const [scrubPercent, setScrubPercent] = useState<number>(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 75%', 'end 25%'],
  });

  useEffect(() => {
    return scrollYProgress.on('change', (v) => {
      setScrubPercent(Math.round(v * 100));
      if (isManual) return;

      if (v < 0.25) setDivergeStep(1);
      else if (v < 0.50) setDivergeStep(2);
      else if (v < 0.75) setDivergeStep(3);
      else setDivergeStep(4);
    });
  }, [scrollYProgress, isManual]);

  const handleForkClick = (stepNum: number) => {
    setIsManual(true);
    setDivergeStep(stepNum);
  };

  const handleResume = () => {
    setIsManual(false);
    const v = scrollYProgress.get();
    if (v < 0.25) setDivergeStep(1);
    else if (v < 0.50) setDivergeStep(2);
    else if (v < 0.75) setDivergeStep(3);
    else setDivergeStep(4);
  };

  // Dynamic calculations based on divergence point
  const totalTokens = 1830;
  const stepTokens = [65, 380, 520, 210, 560, 95];
  const reusedTokens = stepTokens.slice(0, divergeStep).reduce((a, b) => a + b, 0);
  const savingsPct = Math.round((reusedTokens / totalTokens) * 100);

  return (
    <section ref={sectionRef} id="replay" className="relative py-20 md:py-32 border-t border-[#1f2937]/80 bg-[#05070b] overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[300px] bg-emerald-500/5 blur-[130px] pointer-events-none rounded-full" />

      <div className="max-w-[1400px] mx-auto px-6 font-sans relative z-10">
        {/* Section Eyebrow */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 mb-3 font-mono text-xs text-emerald-400"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="tracking-widest uppercase font-semibold">06 // COUNTERFACTUAL FORK ENGINE</span>
        </motion.div>

        {/* Section Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mb-12"
        >
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1] uppercase">
            PROVE THE FIX.
            <br />
            <span className="text-zinc-400">REUSE THE UNCHANGED TRACE.</span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 mt-4 leading-relaxed">
            Rerunning an entire multi-step agent from scratch is expensive, slow, and stochastic.
            Black Box branches counterfactual forks from exact save-points, substituting candidate repairs
            and re-executing only what the fix touches.
          </p>
        </motion.div>

        {/* Interactive Divergence Scrubber Control Bar */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          className="mb-8 p-4 rounded-lg bg-[#080d16] border border-[#1f2937] flex flex-wrap items-center justify-between gap-4 font-mono text-xs shadow-lg"
        >
          <div className="flex items-center gap-2 text-zinc-300">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="font-bold">SCRUB DIVERGENCE POINT:</span>
            <span className="text-cyan-400 font-bold">STEP #{divergeStep}</span>
          </div>

          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((stepNum) => (
              <button
                key={stepNum}
                onClick={() => handleForkClick(stepNum)}
                className={`px-3 py-1 rounded text-xs transition-all cursor-pointer ${
                  divergeStep === stepNum
                    ? 'bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Fork at #{stepNum}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono">
            {isManual ? (
              <button
                onClick={handleResume}
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Resume Scroll Scrub</span>
              </button>
            ) : (
              <span className="text-zinc-500">
                SCROLL SCRUBBER: <span className="text-cyan-400 font-bold">{scrubPercent}%</span>
              </span>
            )}
            <div className="text-zinc-400 pl-2 border-l border-zinc-800">
              ACTIVE SAVINGS: <strong className="text-emerald-400 font-bold">{savingsPct}%</strong> PRESERVED
            </div>
          </div>
        </motion.div>

        {/* Interactive Before & After Visual Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Original Failed Run (6 cols) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-6 bg-[#0b0f17] border border-[#1f2937] rounded-lg p-6 flex flex-col justify-between font-mono shadow-2xl"
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#1f2937] text-xs">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="font-bold text-white">ORIGINAL RECORDED RUN</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-red-950/80 border border-red-800 text-red-300 text-[10px] font-bold">
                  OUTCOME: FAILED
                </span>
              </div>

              {/* Step Sequence Breakdown */}
              <div className="py-5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800">
                  <span className="text-zinc-300">#0 INPUT: Task Dispatch</span>
                  <span className="text-zinc-500">12ms · OK</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800">
                  <span className="text-zinc-300">#1 RETRIEVAL: Vector Search</span>
                  <span className="text-zinc-500">84ms · OK</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800">
                  <span className="text-zinc-300">#2 LLM: Execution Planner</span>
                  <span className="text-zinc-500">410ms · OK</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-red-950/60 border border-red-700 text-red-200">
                  <span className="font-bold">#3 TOOL: Warehouse SQL Query</span>
                  <span className="text-red-400 font-bold">GUILTY CAUSE</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-amber-950/40 border border-amber-800/60 text-amber-200">
                  <span>#4 LLM: Parse Ledger & Calc</span>
                  <span className="text-amber-400">CONTAMINATED</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-zinc-900/80 border border-zinc-800 text-red-400">
                  <span>#5 FINAL: Schedule Generation</span>
                  <span className="font-bold">CRASHED (500)</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1f2937] flex items-center justify-between text-[11px] text-zinc-500">
              <span>STEPS EXECUTED: 6 / 6</span>
              <span>TOTAL TOKENS: {totalTokens}</span>
            </div>
          </motion.div>

          {/* Forked Replay with Proven Fix (6 cols) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-6 bg-[#0b0f17] border border-emerald-900/80 rounded-lg p-6 flex flex-col justify-between font-mono ring-1 ring-emerald-500/20 shadow-2xl"
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-emerald-900/60 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white">COUNTERFACTUAL FORK RUN</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-300 text-[10px] font-bold">
                  VERIFIED: PASS ✓
                </span>
              </div>

              {/* Dynamic Step Sequence Breakdown based on divergence */}
              <div className="py-5 space-y-2.5 text-xs">
                {[
                  { id: 0, name: 'INPUT: Task Dispatch' },
                  { id: 1, name: 'RETRIEVAL: Vector Search' },
                  { id: 2, name: 'LLM: Execution Planner' },
                  { id: 3, name: "TOOL: Patched Query Execution (Fix)" },
                  { id: 4, name: 'LLM: Parse Ledger & Calc' },
                  { id: 5, name: 'FINAL: Schedule Generation' },
                ].map((s) => {
                  const isReused = s.id < divergeStep;
                  const isPatched = s.id === divergeStep;

                  return (
                    <motion.div
                      key={s.id}
                      animate={{
                        backgroundColor: isReused
                          ? 'rgba(8, 51, 68, 0.25)'
                          : isPatched
                          ? 'rgba(6, 78, 59, 0.6)'
                          : 'rgba(6, 78, 59, 0.2)',
                      }}
                      className={`flex items-center justify-between p-2 rounded border transition-colors ${
                        isReused
                          ? 'border-cyan-900/60 text-cyan-300'
                          : isPatched
                          ? 'border-emerald-500 text-emerald-200 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500'
                          : 'border-emerald-800/60 text-emerald-300'
                      }`}
                    >
                      <span className={isPatched ? 'font-bold' : ''}>
                        #{s.id} {s.name}
                      </span>
                      {isReused ? (
                        <span className="text-cyan-400 text-[10px] font-bold">
                          REUSED SAVE-POINT (0ms)
                        </span>
                      ) : isPatched ? (
                        <span className="text-emerald-300 text-[10px] font-bold animate-pulse">
                          DIVERGE & PATCH (142ms)
                        </span>
                      ) : (
                        <span className="text-emerald-400 text-[10px]">
                          RE-EXECUTED (Clean)
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-emerald-900/60 flex items-center justify-between text-[11px] text-emerald-400 font-bold">
              <span>REUSED STEPS: {divergeStep} / 6</span>
              <span>TOKENS SAVED: {reusedTokens} ({savingsPct}%)</span>
            </div>
          </motion.div>
        </div>

        {/* Causal Verification KPI Strip */}
        <div className="mt-8 p-6 rounded-lg bg-[#070a10] border border-[#1f2937] grid grid-cols-2 md:grid-cols-4 gap-6 font-mono text-center">
          <motion.div whileHover={{ scale: 1.03 }} className="p-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">SAVINGS RATIO</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{savingsPct}% Tokens</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Unchanged prefix reused</p>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} className="p-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">WALL CLOCK SPEEDUP</p>
            <p className="text-2xl font-bold text-white mt-1">2.4x Faster</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Cached state resume</p>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} className="p-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">CAUSAL NECESSITY</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">Proven</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Flipping #{divergeStep} fixes run</p>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} className="p-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">FLAKINESS TEST</p>
            <p className="text-2xl font-bold text-white mt-1">3/3 Repeats</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Zero stochastic noise</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
