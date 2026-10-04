import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll } from 'framer-motion';
import { ShieldAlert, BarChart3, CheckCircle, FileText, ArrowRight, CornerDownRight, RotateCcw } from 'lucide-react';

interface Suspect {
  rank: number;
  stepIdx: number;
  name: string;
  kind: string;
  probability: number;
  isGuilty: boolean;
  verdict: string;
  shapFeatures: { name: string; weight: number }[];
}

const SUSPECTS: Suspect[] = [
  {
    rank: 1,
    stepIdx: 3,
    name: 'tool_warehouse_sql',
    kind: 'tool',
    probability: 0.942,
    isGuilty: true,
    verdict: 'PROVEN ROOT CAUSE: SQL query dropped required currency column, poisoning downstream arithmetic.',
    shapFeatures: [
      { name: 'schema_drift_detected', weight: 0.48 },
      { name: 'step_checker_alarm_fired', weight: 0.32 },
      { name: 'data_flow_outdegree', weight: 0.14 },
      { name: 'latency_anomaly', weight: 0.06 },
    ],
  },
  {
    rank: 2,
    stepIdx: 4,
    name: 'llm_synthesize_fx',
    kind: 'llm',
    probability: 0.041,
    isGuilty: false,
    verdict: 'CONTAMINATED SYMPTOM: Handled missing column by assuming 0.0 rate without raising an exception.',
    shapFeatures: [
      { name: 'context_inconsistency', weight: 0.22 },
      { name: 'token_divergence', weight: 0.15 },
      { name: 'step_checker_alarm_fired', weight: 0.12 },
    ],
  },
  {
    rank: 3,
    stepIdx: 1,
    name: 'retrieval_vector_pegs',
    kind: 'retrieval',
    probability: 0.017,
    isGuilty: false,
    verdict: 'CLEAN: Retrieved legitimate documentation. Zero contribution to failure.',
    shapFeatures: [
      { name: 'retrieval_latency', weight: 0.08 },
      { name: 'bm25_score_variance', weight: 0.04 },
    ],
  },
];

export const DiagnosisSection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeRank, setActiveRank] = useState<number>(1);
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

      if (v < 0.5) setActiveRank(1);
      else if (v < 0.8) setActiveRank(2);
      else setActiveRank(3);
    });
  }, [scrollYProgress, isManual]);

  const handleRankClick = (rank: number) => {
    setIsManual(true);
    setActiveRank(rank);
  };

  const handleResume = () => {
    setIsManual(false);
    const v = scrollYProgress.get();
    if (v < 0.5) setActiveRank(1);
    else if (v < 0.8) setActiveRank(2);
    else setActiveRank(3);
  };

  const currentSuspect = SUSPECTS.find((s) => s.rank === activeRank) || SUSPECTS[0];

  return (
    <section ref={sectionRef} id="diagnosis" className="relative py-20 md:py-32 border-t border-[#1f2937]/80 bg-[#070a10]">
      <div className="max-w-[1400px] mx-auto px-6 font-sans">
        {/* Section Eyebrow */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 mb-3 font-mono text-xs text-red-400"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          <span className="tracking-widest uppercase font-semibold">05 // MATHEMATICAL ATTRIBUTION</span>
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
            FORENSIC DIAGNOSIS.
            <br />
            <span className="text-zinc-400">RANKED BY CAUSAL EVIDENCE.</span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 mt-4 leading-relaxed">
            Black Box does not hallucinate reasons for failure. Our trained GNN and LightGBM model
            evaluate structural graph features, token anomalies, and step-checker alarms to compute
            exact attribution scores.
          </p>
        </motion.div>

        {/* Interactive Scrub Status Bar */}
        <div className="mb-8 p-3 rounded-lg bg-[#0b0f17] border border-[#1f2937] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-zinc-400">GNN DIAGNOSIS MATRIX:</span>
            <span className="text-white font-bold">
              SUSPECT #{currentSuspect.rank}: {currentSuspect.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isManual ? (
              <button
                onClick={handleResume}
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors text-[11px]"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Resume Scroll Scrub</span>
              </button>
            ) : (
              <span className="text-zinc-500 text-[11px]">
                SCROLL SCRUBBER: <span className="text-cyan-400 font-bold">{scrubPercent}%</span>
              </span>
            )}
          </div>
        </div>

        {/* Four-Stage Narrative Pipeline Ticker */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10 text-xs font-mono">
          <div className="p-3 rounded bg-[#0b0f17] border border-[#1f2937] flex items-center gap-2">
            <span className="text-red-400 font-bold">01</span>
            <span className="text-zinc-300">RUN FAILED</span>
          </div>
          <div className="p-3 rounded bg-[#0b0f17] border border-[#1f2937] flex items-center gap-2">
            <span className="text-amber-400 font-bold">02</span>
            <span className="text-zinc-300">TOP SUSPECT #1</span>
          </div>
          <div className="p-3 rounded bg-[#0b0f17] border border-[#1f2937] flex items-center gap-2">
            <span className="text-cyan-400 font-bold">03</span>
            <span className="text-zinc-300">EVIDENCE ASSEMBLED</span>
          </div>
          <div className="p-3 rounded bg-[#0b1626] border border-cyan-800 flex items-center gap-2">
            <span className="text-emerald-400 font-bold">04</span>
            <span className="text-white font-semibold">CAUSE IDENTIFIED</span>
          </div>
        </div>

        {/* Diagnostic Instrument Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Suspect Ranking Board (5 cols) */}
          <div className="lg:col-span-5 space-y-3 font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-[#1f2937] text-xs text-zinc-500">
              <span>SUSPECT RANKING</span>
              <span>CONFIDENCE P(CAUSE)</span>
            </div>

            {SUSPECTS.map((suspect) => {
              const isSelected = suspect.rank === activeRank;
              return (
                <div
                  key={suspect.rank}
                  onClick={() => setActiveRank(suspect.rank)}
                  className={`p-4 rounded border text-left cursor-pointer transition-all ${
                    isSelected
                      ? suspect.isGuilty
                        ? 'border-red-500 bg-red-950/30 ring-1 ring-red-400'
                        : 'border-cyan-500 bg-cyan-950/20 ring-1 ring-cyan-400'
                      : 'border-[#1f2937] hover:border-zinc-700 bg-[#0b0f17]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <span className={suspect.isGuilty ? 'text-red-400 font-bold' : 'text-zinc-400'}>
                        #{suspect.rank} SUSPECT
                      </span>
                      <span className="text-zinc-500">//</span>
                      <span className="text-zinc-300 font-bold">STEP {suspect.stepIdx}</span>
                    </div>

                    <span className={`font-bold ${suspect.isGuilty ? 'text-red-400' : 'text-zinc-400'}`}>
                      {(suspect.probability * 100).toFixed(1)}%
                    </span>
                  </div>

                  <p className="text-xs text-zinc-200 font-sans mt-1">{suspect.name}</p>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 mt-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        suspect.isGuilty ? 'bg-red-500' : 'bg-cyan-500'
                      }`}
                      style={{ width: `${suspect.probability * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="pt-2 text-[10px] text-zinc-500 text-right">
              DIAGNOSER: GRAPH FEATURE GNN (AUDIT MEASURED)
            </div>
          </div>

          {/* Right Column: Forensic Evidence & SHAP Attribution (7 cols) */}
          <div className="lg:col-span-7 bg-[#0b0f17] border border-[#1f2937] rounded-lg p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#1f2937] text-xs font-mono">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white uppercase">
                  FORENSIC CASE FILE: STEP #{currentSuspect.stepIdx}
                </span>
              </div>
              <span className={currentSuspect.isGuilty ? 'text-red-400 font-bold' : 'text-zinc-400'}>
                {currentSuspect.isGuilty ? 'CONFIRMED GUILTY' : 'CLEARED'}
              </span>
            </div>

            {/* Verdict Explanation Box */}
            <div className="p-4 rounded bg-[#070a10] border border-[#1f2937] text-xs leading-relaxed font-sans text-zinc-300">
              <p className="text-[10px] font-mono text-zinc-500 uppercase mb-1 font-bold">
                ATTRIBUTION VERDICT:
              </p>
              {currentSuspect.verdict}
            </div>

            {/* SHAP Feature Contribution Bars */}
            <div className="space-y-3 font-mono text-xs">
              <p className="text-[11px] text-zinc-400 uppercase font-semibold">
                SHAP ATTRIBUTION FEATURE WEIGHTS:
              </p>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSuspect.rank}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  {currentSuspect.shapFeatures.map((feat, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-300">{feat.name}</span>
                        <span className="text-cyan-400 font-bold">+{feat.weight.toFixed(2)}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${feat.weight * 100}%` }}
                          transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                          className={`h-full rounded-full ${
                            currentSuspect.isGuilty ? 'bg-gradient-to-r from-red-500 to-amber-500' : 'bg-cyan-500'
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Audit Grounding Note */}
            <div className="pt-4 border-t border-[#1f2937] flex items-center justify-between text-[10px] font-mono text-zinc-500">
              <span>ZERO SPECULATION · EVIDENCE CITATIONS VERIFIED</span>
              <span className="text-zinc-400">[step {currentSuspect.stepIdx}]</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
