import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, Play, CheckCircle2, AlertTriangle, ArrowRight, Terminal } from 'lucide-react';

interface LabStage {
  num: number;
  title: string;
  category: 'clean' | 'fault' | 'diagnose' | 'repair' | 'scorecard';
  description: string;
  terminalLog: string;
}

const LAB_STAGES: LabStage[] = [
  {
    num: 1,
    title: 'Understand Task',
    category: 'clean',
    description: 'Deconstruct user question into sub-queries and ontology lookup.',
    terminalLog: '[STAGE 01] Parsing task query: "What is the total APAC revenue for Q3?"',
  },
  {
    num: 2,
    title: 'Knowledge Retrieval',
    category: 'clean',
    description: 'BM25 + Dense vector search loads relevant database tables.',
    terminalLog: '[STAGE 02] Vector search hit doc_id_891 (score: 0.94). Schema context loaded.',
  },
  {
    num: 3,
    title: 'Run Agent Live',
    category: 'clean',
    description: 'Agent executes full reasoning loop with zero errors.',
    terminalLog: '[STAGE 03] Agent executed 5 steps cleanly on local 7B model. Latency: 1.1s.',
  },
  {
    num: 4,
    title: 'Clean Answer Check',
    category: 'clean',
    description: 'Evaluator confirms the unpoisoned baseline answers correctly.',
    terminalLog: '[STAGE 04] Baseline verified: Ground truth matches output ($14.2M). PASS.',
  },
  {
    num: 5,
    title: 'Choose Mistake (F1–F10)',
    category: 'fault',
    description: 'Selects planted mistake F1 (Tool Schema Drift: drop currency key).',
    terminalLog: '[STAGE 05] Injecting fault F1 (Tool Schema Drift) into candidate pool.',
  },
  {
    num: 6,
    title: 'Plant Mistake in Step 3',
    category: 'fault',
    description: 'Intercepts tool execution save-point and deletes currency key.',
    terminalLog: '[STAGE 06] Mutating Step #3 payload: {"currency": "JPY"} -> {} (dropped).',
  },
  {
    num: 7,
    title: 'Observe Broken Output',
    category: 'fault',
    description: 'Downstream steps execute with poisoned state, crashing at final stage.',
    terminalLog: '[STAGE 07] Step #5 crashed with ZeroRevenueException. Run marked FAILED.',
  },
  {
    num: 8,
    title: 'Live Checker Cascade',
    category: 'diagnose',
    description: 'Laya (local) -> Jev -> LLM evaluate step consistency live.',
    terminalLog: '[STAGE 08] Checker cascade triggered. Step #3 flagged (Alarm: 0.96, Tier: Laya).',
  },
  {
    num: 9,
    title: 'GNN Root Cause Diagnosis',
    category: 'diagnose',
    description: 'Trained graph ranker names Step #3 as guilty root cause (P=0.96).',
    terminalLog: '[STAGE 09] Diagnosis ranked suspect #1: Step 3 (score: 0.962). Ground truth match: HIT.',
  },
  {
    num: 10,
    title: 'Counterfactual Verify',
    category: 'repair',
    description: 'Re-runs step 3 with patch; reuses steps 1..2. Verifies pass outcome.',
    terminalLog: '[STAGE 10] Fork replay executed. Steps 1-2 reused (100% token savings). Run PASSED.',
  },
  {
    num: 11,
    title: 'Propose Code Fix',
    category: 'repair',
    description: 'Generates concrete Python patch to enforce schema validation at tool gate.',
    terminalLog: '[STAGE 11] GenAI patch proposed: @validate_schema(required=["currency"]).',
  },
  {
    num: 12,
    title: 'Diff & Compare',
    category: 'repair',
    description: 'Side-by-side alignment highlights exact point of divergence.',
    terminalLog: '[STAGE 12] Trace divergence isolated to step 3. Output diff: +1 key added.',
  },
  {
    num: 13,
    title: 'Guardian Incident Page',
    category: 'diagnose',
    description: 'Dispatches incident payload to email, Slack, and Twilio channels.',
    terminalLog: '[STAGE 13] Incident INC-8821 dispatched. Status: PAUSED. Awaiting operator.',
  },
  {
    num: 14,
    title: 'Export Test & Scorecard',
    category: 'scorecard',
    description: 'Exports reproducible pytest regression file and performance scorecard.',
    terminalLog: '[STAGE 14] Test file exported: tests/regression/test_run_8821.py. SCORECARD: 100%.',
  },
];

export const LiveLabPreviewSection: React.FC = () => {
  const [currentStageNum, setCurrentStageNum] = useState<number>(9);

  const activeStage = LAB_STAGES.find((s) => s.num === currentStageNum) || LAB_STAGES[8];

  return (
    <section id="lab" className="relative py-20 md:py-32 border-t border-[#1f2937]/80 bg-[#070a10]">
      <div className="max-w-[1400px] mx-auto px-6 font-sans">
        {/* Section Eyebrow */}
        <div className="flex items-center gap-2 mb-3 font-mono text-xs text-cyan-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span className="tracking-widest uppercase font-semibold">09 // BENCHMARKING LAB</span>
        </div>

        {/* Section Headline */}
        <div className="max-w-3xl mb-12">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1] uppercase">
            THE LIVE LAB.
            <br />
            <span className="text-zinc-400">14-STAGE FORENSIC BENCHMARK.</span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 mt-4 leading-relaxed">
            Watch an agent execute, inject synthetic faults, watch the step checker flag anomalies live,
            and inspect the final causal scorecard in real time.
          </p>
        </div>

        {/* 14-Stage Progress Stepper Bar */}
        <div className="mb-6 overflow-x-auto pb-2">
          <div className="flex items-center gap-1.5 min-w-[720px]">
            {LAB_STAGES.map((s) => {
              const isSelected = s.num === currentStageNum;
              const isPast = s.num < currentStageNum;
              return (
                <button
                  key={s.num}
                  onClick={() => setCurrentStageNum(s.num)}
                  className={`flex-1 py-2 px-1 rounded text-center transition-all cursor-pointer font-mono text-[10px] ${
                    isSelected
                      ? 'bg-cyan-500 text-black font-bold ring-2 ring-cyan-400 shadow-md shadow-cyan-500/20'
                      : isPast
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-[#0b0f17] text-zinc-600 border border-[#1f2937] hover:border-zinc-700'
                  }`}
                >
                  <span className="block truncate font-mono">#{s.num}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Lab Console & Details */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStage.num}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#0b0f17] border border-[#1f2937] rounded-lg p-6 shadow-2xl font-mono text-xs"
          >
            {/* Stage Details (5 cols) */}
            <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-cyan-300 font-bold text-[10px]">
                    STAGE {activeStage.num} OF 14
                  </span>
                  <span className="text-xs text-zinc-500 uppercase">{activeStage.category}</span>
                </div>

                <h3 className="text-xl font-bold text-white tracking-tight font-sans">
                  {activeStage.title}
                </h3>

                <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                  {activeStage.description}
                </p>
              </div>

              <div className="pt-4 border-t border-[#1f2937] flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">SSE STREAMING PIPELINE</span>
                <button
                  onClick={() => setCurrentStageNum((currentStageNum % 14) + 1)}
                  className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer font-bold"
                >
                  <span>NEXT STAGE</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Terminal Console Output (7 cols) */}
            <div className="lg:col-span-7 bg-[#05070b] border border-zinc-800 rounded p-4 flex flex-col justify-between shadow-inner">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-900 text-[10px] text-zinc-500">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3 h-3 text-cyan-400" />
                  <span>SERVER-SENT EVENTS (SSE) STREAM</span>
                </div>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  ● LIVE BUFFER
                </span>
              </div>

              <div className="py-4 space-y-2 text-[11px] leading-relaxed">
                <p className="text-zinc-500">[t=0.00s] POST /api/lab (notify=true, mistake=F1)</p>
                <p className="text-cyan-300 font-mono flex items-center gap-1">
                  <span>{activeStage.terminalLog}</span>
                  <span className="w-2 h-4 bg-cyan-400 inline-block animate-pulse" />
                </p>
                <p className="text-zinc-600 text-[10px]">[seq: {activeStage.num}, checksum: 0x8f19b2, status: ok]</p>
              </div>

              <div className="pt-3 border-t border-zinc-900 text-[10px] text-zinc-600 flex items-center justify-between">
                <span>MODEL: AGENT-LOCAL-7B</span>
                <span>CHECKER: LAYA (LOCAL)</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};
