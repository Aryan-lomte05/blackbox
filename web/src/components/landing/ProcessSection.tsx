import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll } from 'framer-motion';
import { Database, Search, GitFork, ShieldCheck, ArrowRight, Check, Code, Cpu, HardDrive, Wrench, RotateCcw } from 'lucide-react';

interface ProcessStage {
  num: string;
  tag: string;
  title: string;
  summary: string;
  details: string[];
  codeSnippet: string;
  metadata: { label: string; value: string }[];
}

const STAGES: ProcessStage[] = [
  {
    num: '01',
    tag: 'RECORD',
    title: 'Deterministic flight recording with zero divergence.',
    summary:
      'Every LLM prompt, tool payload, retrieval chunk, memory mutation, and random seed is captured through RunContext into an immutable save-point. No unrecorded side-effects.',
    details: [
      'Resumable state machines: any step can be resumed identically',
      'Zero in-loop overhead: non-blocking background serialization',
      'OpenTelemetry and Langfuse trace importer compatibility',
    ],
    codeSnippet: `with ctx.step(kind="tool", name="sql_query") as step:
    result = db.execute(query)
    step.record(inputs={"query": query}, output=result)
# Save-point serialized to SQLite store (hash: #sp_9bf2a)`,
    metadata: [
      { label: 'RECORDING OVERHEAD', value: '0.0ms' },
      { label: 'SAVE-POINT FIDELITY', value: '100% BIT-EXACT' },
      { label: 'DATA LAYER', value: 'SQLITE + SHARDS' },
    ],
  },
  {
    num: '02',
    tag: 'DIAGNOSE',
    title: 'Isolate the guilty step with GNN & SHAP attribution.',
    summary:
      'A trained Graph Neural Network and LightGBM step ranker evaluate the execution DAG, token anomalies, and three-tier step-checker alarms to compute exact suspect probabilities.',
    details: [
      'Top-3 suspect ranking with mathematical attribution scores',
      'Step-checker cascade: local Laya (fast) → Jev → LLM fallback',
      'Attribution explanations grounded in concrete step inputs & outputs',
    ],
    codeSnippet: `diagnosis = diagnoser.rank(trace)
# Output:
# Suspect #1: Step 3 (Tool: sql_query) — P = 0.942
# Suspect #2: Step 1 (Retrieval)       — P = 0.041
# Suspect #3: Step 4 (LLM Planner)     — P = 0.017`,
    metadata: [
      { label: 'DIAGNOSIS ENGINE', value: 'GRAPH RANKER' },
      { label: 'CASCADE TIERS', value: 'LAYA → JEV → LLM' },
      { label: 'SUSPECT ACCURACY', value: 'TOP-3 RANKED' },
    ],
  },
  {
    num: '03',
    tag: 'PROVE',
    title: 'Prove the cause via counterfactual replay forks.',
    summary:
      'Black Box branches a counterfactual execution from the suspect step, substitutes the corrected input or tool response, and re-executes only downstream dependencies.',
    details: [
      'Zero redundant calls: reuses 70–90% of unchanged upstream steps',
      'Proves mathematical necessity: if changing step 3 flips fail → pass, step 3 is proven cause',
      'Massive token & cost savings compared to brute-force rerunning',
    ],
    codeSnippet: `forked_trace = replay.fork(
    trace_id="run_481",
    diverge_at_step=3,
    patch=Change(kind="output", value=corrected_data)
)
# Reused steps: 1..2 (100% token savings)
# Re-executed: 3..5 (Verified: PASS)`,
    metadata: [
      { label: 'CAUSAL PROOF', value: 'COUNTERFACTUAL' },
      { label: 'TOKEN SAVINGS', value: 'UP TO 82%' },
      { label: 'FLAKINESS CHECK', value: '3-REPEAT VERIFY' },
    ],
  },
  {
    num: '04',
    tag: 'FIX',
    title: 'Verify repairs fleet-wide with regression firewalls.',
    summary:
      'Candidate fixes are validated across historical test shards. Proves that the fix resolves the diagnosed failure while confirming zero regressions on existing passing tasks.',
    details: [
      'Automated fleet-wide regression matrix across hundreds of runs',
      'Binary decision engine: APPROVE / BLOCK based on pass rate change',
      'Automatic generation of reproducible pytest regression files',
    ],
    codeSnippet: `fleet_result = firewall.verify_rule(
    rule="Always validate currency key before arithmetic",
    target_family="financial_ops",
    sample_failures=20, sample_passes=20
)
# Fixed: 19/20 | Regressions: 0 | Verdict: APPROVE`,
    metadata: [
      { label: 'FIREWALL VERDICT', value: 'APPROVE / BLOCK' },
      { label: 'REGRESSION CHECK', value: 'HISTORICAL SHARDS' },
      { label: 'EXPORT FORMAT', value: 'PYTEST SUITE' },
    ],
  },
];

export const ProcessSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(0);

  const handleTabClick = (idx: number) => {
    setActiveTab(idx);
  };

  const current = STAGES[activeTab];

  return (
    <section id="process" className="relative py-20 md:py-32 border-t border-[#1f2937]/80 bg-[#070a10] overflow-hidden">
      {/* Background ambient beam */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-cyan-500/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-[1400px] mx-auto px-6 font-sans relative z-10">
        {/* Section Eyebrow */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 mb-3 font-mono text-xs text-cyan-400"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="tracking-widest uppercase font-semibold">03 // THE FOUR PILLARS</span>
        </motion.div>

        {/* Section Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mb-8"
        >
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1] uppercase">
            RECORD. DIAGNOSE.
            <br />
            <span className="text-zinc-400">PROVE. FIX.</span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 mt-4 leading-relaxed">
            The complete flight recorder lifecycle. From bit-exact execution capture to causal mathematical
            proof and fleet-wide regression firewalls.
          </p>
        </motion.div>

        {/* Interactive Scroll Progress Rail */}
        <div className="mb-6 p-3 rounded-lg bg-[#0b0f17] border border-[#1f2937] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-zinc-400">PILLAR LIFECYCLE PROGRESS:</span>
            <span className="text-cyan-300 font-bold uppercase">
              STAGE {current.num} // {current.tag}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-bold tracking-wider">
              {activeTab + 1} OF {STAGES.length}
            </span>
          </div>
        </div>

        {/* Dynamic Progress Beam along Tabs */}
        <div className="w-full h-1 bg-zinc-900 rounded-full mb-4 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-teal-300 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
            style={{ width: `${((activeTab + 1) / STAGES.length) * 100}%` }}
            transition={{ ease: 'easeOut', duration: 0.2 }}
          />
        </div>

        {/* Tabs Row with Scroll Stagger & Animated Pill */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {STAGES.map((s, idx) => {
            const isActive = idx === activeTab;
            return (
              <motion.button
                key={s.num}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleTabClick(idx)}
                className={`relative p-4 rounded border text-left transition-all cursor-pointer font-sans overflow-hidden ${
                  isActive
                    ? 'border-cyan-500 bg-[#0b1626] shadow-lg shadow-cyan-950/30'
                    : 'border-[#1f2937] hover:border-zinc-700 bg-[#0b0f17]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabOutline"
                    className="absolute inset-0 border-2 border-cyan-400 rounded pointer-events-none"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <div className="flex items-center justify-between text-xs font-mono mb-1 relative z-10">
                  <span className={isActive ? 'text-cyan-400 font-bold' : 'text-zinc-500'}>
                    {s.num}
                  </span>
                  <span
                    className={`text-[10px] tracking-wider uppercase font-semibold ${
                      isActive ? 'text-white' : 'text-zinc-500'
                    }`}
                  >
                    {s.tag}
                  </span>
                </div>
                <p className="text-xs font-semibold text-zinc-200 truncate mt-1 relative z-10">
                  {s.title.split('.')[0]}
                </p>
              </motion.button>
            );
          })}
        </div>

        {/* Active Stage Editorial + Terminal Visual Panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current.num}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch bg-[#0b0f17] border border-[#1f2937] rounded-lg p-6 md:p-8 shadow-2xl"
          >
            {/* Left Column: Editorial Content */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-cyan-300">
                  <span>STAGE {current.num}</span>
                  <span className="text-zinc-600">//</span>
                  <span className="text-zinc-400">{current.tag}</span>
                </div>

                <h3 className="text-2xl font-bold text-white tracking-tight leading-snug">
                  {current.title}
                </h3>

                <p className="text-sm text-zinc-400 leading-relaxed font-sans">
                  {current.summary}
                </p>

                <div className="space-y-2 pt-2">
                  {current.details.map((detail, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-start gap-2.5 text-xs text-zinc-300"
                    >
                      <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{detail}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Bottom Metadata Badges */}
              <div className="grid grid-cols-3 gap-3 pt-6 border-t border-[#1f2937] font-mono">
                {current.metadata.map((m, i) => (
                  <div key={i}>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest">{m.label}</p>
                    <p className="text-xs font-bold text-white mt-0.5">{m.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Technical Code & Trace Panel */}
            <div className="lg:col-span-6 flex flex-col justify-between rounded bg-[#05070b] border border-[#1f2937] p-5 font-mono shadow-inner">
              {/* Window title bar */}
              <div className="flex items-center justify-between pb-3 border-b border-[#1f2937] text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400/80 animate-pulse" />
                  <span className="text-[11px] text-zinc-300">blackbox.{current.tag.toLowerCase()}.py</span>
                </div>
                <span className="text-[10px] text-zinc-600 font-mono">PYTHON 3.11 // LINUX x86_64</span>
              </div>

              {/* Code Body */}
              <pre className="py-4 text-xs text-zinc-300 leading-relaxed overflow-x-auto whitespace-pre font-mono">
                <code>{current.codeSnippet}</code>
              </pre>

              {/* Visual execution status footer */}
              <div className="pt-3 border-t border-[#1f2937] flex items-center justify-between text-[11px] text-zinc-400">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> STAGE VERIFIED
                </span>
                <button
                  onClick={() => setActiveTab((activeTab + 1) % STAGES.length)}
                  className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer font-bold"
                >
                  <span>NEXT STAGE</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};
