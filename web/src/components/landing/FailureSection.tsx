import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ArrowRight, Eye, ShieldAlert, Bug, Check, HelpCircle } from 'lucide-react';

interface StepStory {
  idx: number;
  kind: 'retrieval' | 'llm' | 'tool' | 'state' | 'final';
  name: string;
  isGuilty?: boolean;
  isContaminated?: boolean;
  isCrash?: boolean;
  standardViewText: string;
  blackboxViewText: string;
  alarmScore: number;
}

const STEPS_DATA: StepStory[] = [
  {
    idx: 1,
    kind: 'retrieval',
    name: 'vector_search_client_profile',
    standardViewText: '200 OK — 14ms (Healthy)',
    blackboxViewText: 'Clean retrieval. Client record #4982 fetched with standard schema.',
    alarmScore: 0.05,
  },
  {
    idx: 2,
    kind: 'tool',
    name: 'extract_account_ledger',
    isGuilty: true,
    standardViewText: '200 OK — 128ms (Reported Success by Provider)',
    blackboxViewText: 'GUILTY ROOT CAUSE: Tool dropped currency exchange column silently due to unhandled JSON structure drift.',
    alarmScore: 0.96,
  },
  {
    idx: 3,
    kind: 'llm',
    name: 'calculate_fx_hedging',
    isContaminated: true,
    standardViewText: '200 OK — 420ms (Output parsed)',
    blackboxViewText: 'CONTAMINATED: LLM received null currency key, defaulted to USD without alerting operator.',
    alarmScore: 0.72,
  },
  {
    idx: 4,
    kind: 'tool',
    name: 'order_placement_precheck',
    isContaminated: true,
    standardViewText: '200 OK — 85ms (Simulation Passed)',
    blackboxViewText: 'CONTAMINATED: Ledger calculations off by 3.2x magnitude due to poisoned step #2 input.',
    alarmScore: 0.88,
  },
  {
    idx: 5,
    kind: 'final',
    name: 'dispatch_clearinghouse_wire',
    isCrash: true,
    standardViewText: 'CRASH: 500 Internal Error — ZeroDivisionError: denominator is zero in margin calculation',
    blackboxViewText: 'SYMPTOM ONLY: Terminal collapse. Debugging this exception fixes nothing—the error is at Step #2.',
    alarmScore: 1.0,
  },
];

export const FailureSection: React.FC = () => {
  const [selectedIdx, setSelectedIdx] = useState<number>(2);

  const selectedStep = STEPS_DATA.find((s) => s.idx === selectedIdx) || STEPS_DATA[1];

  return (
    <section id="story" className="relative py-20 md:py-32 border-t border-[#1f2937]/80 bg-[#05070b]">
      <div className="max-w-[1400px] mx-auto px-6 font-sans">
        {/* Section Eyebrow */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 mb-3 font-mono text-xs text-red-400"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="tracking-widest uppercase font-semibold">02 // ROOT CAUSE VS SYMPTOM</span>
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
            WHEN AN AGENT FAILS,
            <br />
            <span className="text-zinc-400">THE ERROR ISN'T THE WHOLE STORY.</span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 mt-4 leading-relaxed">
            Standard loggers only report where an agent finally crashed. But in multi-step AI reasoning loops,
            the final exception is almost never the bug. The true root cause occurs steps earlier, silently
            contaminating downstream context.
          </p>
        </motion.div>

        {/* Interactive Dual-View Comparison Instrument */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Interactive Step Chain */}
          <motion.div
            initial={{ opacity: 0, x: -25 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-5 space-y-2.5"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#1f2937] text-xs font-mono text-zinc-500">
              <span>EXECUTION SEQUENCE</span>
              <span>SELECT STEP TO INSPECT</span>
            </div>

            {STEPS_DATA.map((step, idx) => {
              const isSelected = step.idx === selectedIdx;
              return (
                <motion.div
                  key={step.idx}
                  whileHover={{ scale: 1.01, x: 3 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedIdx(step.idx)}
                  className={`p-3.5 rounded border transition-all cursor-pointer font-sans relative ${
                    isSelected
                      ? step.isGuilty
                        ? 'border-red-500 bg-red-950/30 shadow-lg shadow-red-950/30 ring-1 ring-red-500'
                        : step.isCrash
                        ? 'border-zinc-400 bg-zinc-900/60 ring-1 ring-zinc-500'
                        : 'border-cyan-500/80 bg-cyan-950/20 ring-1 ring-cyan-500'
                      : 'border-[#1f2937] hover:border-zinc-700 bg-[#0b0f17]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-zinc-500">#{step.idx}</span>
                      <span className="font-bold text-white text-xs">{step.name}</span>
                    </div>

                    {step.isGuilty && (
                      <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-mono text-[9px] font-bold tracking-wider animate-pulse">
                        GUILTY CAUSE
                      </span>
                    )}
                    {step.isContaminated && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-600/30 border border-amber-600/40 text-amber-300 font-mono text-[9px]">
                        CONTAMINATED
                      </span>
                    )}
                    {step.isCrash && (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 font-mono text-[9px]">
                        CRASH POINT
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-zinc-400 mt-1 truncate">
                    {step.isGuilty ? 'Silent data drop — hallucinated field deletion' : step.standardViewText}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Right Column: Comparative Forensic Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: 25 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 bg-[#0b0f17] border border-[#1f2937] rounded-lg p-6 space-y-6 shadow-2xl"
          >
            {/* Header with step metadata */}
            <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#1f2937] text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                  INSPECTING STEP #{selectedStep.idx}
                </span>
                <span className="font-bold text-white font-mono">{selectedStep.name}</span>
              </div>
              <div className="font-mono text-[11px] text-zinc-500">
                CASCADE ALARM:{' '}
                <span className={selectedStep.alarmScore > 0.5 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                  {(selectedStep.alarmScore * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Side-by-Side Analysis Boxes */}
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedStep.idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {/* Conventional Logs */}
                <div className="p-4 rounded border border-zinc-800/80 bg-black/40 space-y-2">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-mono font-medium">
                    <Eye className="w-3.5 h-3.5 text-zinc-500" />
                    <span>CONVENTIONAL TRACING</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                    {selectedStep.standardViewText}
                  </p>
                  <div className="text-[10px] text-zinc-600 font-sans italic pt-2 border-t border-zinc-900">
                    {selectedStep.isCrash
                      ? 'Engineers spend hours analyzing this trace line, finding no solution.'
                      : 'Reported as normal execution. Silent bug passes unnoticed.'}
                  </div>
                </div>

                {/* Black Box Flight Recorder */}
                <div
                  className={`p-4 rounded border space-y-2 ${
                    selectedStep.isGuilty
                      ? 'border-red-800/80 bg-red-950/20 shadow-lg shadow-red-950/20'
                      : selectedStep.isContaminated
                      ? 'border-amber-800/60 bg-amber-950/15'
                      : 'border-cyan-800/60 bg-cyan-950/15'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
                    {selectedStep.isGuilty ? (
                      <span className="text-red-400 flex items-center gap-1">
                        <Bug className="w-3.5 h-3.5" /> BLACK BOX DIAGNOSIS
                      </span>
                    ) : (
                      <span className="text-cyan-400 flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" /> CAUSAL GRAPH ANALYSIS
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed">
                    {selectedStep.blackboxViewText}
                  </p>
                  <div className="text-[10px] text-zinc-400 font-mono pt-2 border-t border-white/[0.05]">
                    {selectedStep.isGuilty && '✓ Confirmed via counterfactual substitution'}
                    {selectedStep.isContaminated && '⚠ Poisoned by upstream output from #2'}
                    {selectedStep.isCrash && '✗ Downstream effect. No code error at this node.'}
                    {!selectedStep.isGuilty && !selectedStep.isContaminated && !selectedStep.isCrash && '✓ Clean step. Reusable in replay.'}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Verdict Callout Footer */}
            <div className="p-4 rounded bg-[#070a10] border border-[#1f2937] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <span className="text-zinc-400">
                LESSON: <strong className="text-white">ERROR ≠ CAUSE</strong>
              </span>
              <span className="text-cyan-400 font-semibold">
                ROOT CAUSE AT STEP #2 → CRASH AT STEP #5
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
