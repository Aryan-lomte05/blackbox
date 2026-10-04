import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, RotateCcw, AlertTriangle, CheckCircle2, ArrowRight, Database } from 'lucide-react';

interface Scenario {
  id: string;
  name: string;
  category: string;
  symptom: string;
  guiltyStep: number;
  steps: {
    index: number;
    title: string;
    type: 'tool' | 'llm' | 'memory' | 'output';
    detail: string;
    isGuilty?: boolean;
    brokenValue: string;
    fixedValue: string;
  }[];
  verdict: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'financial',
    name: 'Arbitrage Swarm',
    category: 'FinTech',
    symptom: 'Agent executed an unauthorized $42,500 limit order with zero margin.',
    guiltyStep: 2,
    steps: [
      {
        index: 0,
        title: 'Fetch FX Spot Rates',
        type: 'tool',
        detail: 'EUR/USD spot retrieved from market gateway',
        brokenValue: '{"rate": 1.0842, "status": 200}',
        fixedValue: '{"rate": 1.0842, "status": 200}',
      },
      {
        index: 1,
        title: 'Compute Cross-Arb Spread',
        type: 'llm',
        detail: 'LLM reasoning on currency pair differential',
        brokenValue: '{"spread_bps": 14.2, "confidence": 0.99}',
        fixedValue: '{"spread_bps": 14.2, "confidence": 0.99}',
      },
      {
        index: 2,
        title: 'Currency Decimal Parser',
        type: 'tool',
        detail: 'Truncated exponent caused 100x multiplier scale distortion',
        isGuilty: true,
        brokenValue: '{"leverage": "100x", "nominal_units": 4250000}',
        fixedValue: '{"leverage": "1x", "nominal_units": 42500}',
      },
      {
        index: 3,
        title: 'Submit Exchange Execution',
        type: 'output',
        detail: 'Catastrophic over-leverage order dispatch to clearinghouse',
        brokenValue: 'Rejected: Order exceeds exchange margin requirement',
        fixedValue: 'Approved: Margin requirement satisfied ($42,500 executed cleanly)',
      },
    ],
    verdict: 'Step 02 (Decimal Parser) was the sole necessary and sufficient cause. Replaying with repaired multiplier succeeded with zero model calls.',
  },
  {
    id: 'sql',
    name: 'Autonomous SQL Agent',
    category: 'Enterprise Data',
    symptom: 'Cross-tenant leak: Agent dumped production customer records without tenant boundary.',
    guiltyStep: 1,
    steps: [
      {
        index: 0,
        title: 'Parse User Query',
        type: 'llm',
        detail: 'Analyze prompt: "Show latest enterprise billing invoices"',
        brokenValue: '{"intent": "fetch_invoices", "org_id": "tenant_91"}',
        fixedValue: '{"intent": "fetch_invoices", "org_id": "tenant_91"}',
      },
      {
        index: 1,
        title: 'Synthesize SQL Query',
        type: 'llm',
        detail: 'Synthesizer dropped WHERE tenant_id clause during schema join',
        isGuilty: true,
        brokenValue: 'SELECT * FROM invoices ORDER BY created_at DESC;',
        fixedValue: 'SELECT * FROM invoices WHERE tenant_id = 91 ORDER BY created_at DESC;',
      },
      {
        index: 2,
        title: 'Execute Query Against Database',
        type: 'tool',
        detail: 'PostgreSQL client executes raw SQL statement',
        brokenValue: 'Returned 45,000 rows across all enterprise tenants (Data Leak)',
        fixedValue: 'Returned 12 rows strictly matching tenant_91 (Compliant)',
      },
      {
        index: 3,
        title: 'Format Customer Response',
        type: 'output',
        detail: 'Markdown table containing confidential data from other companies',
        brokenValue: 'Quarantined: Security firewall caught unauthorized cross-tenant data',
        fixedValue: 'Delivered: Formatted table rendered for authenticated tenant cleanly',
      },
    ],
    verdict: 'Step 01 prompt synthesis caused the data spill. Replacing with scoped SQL verified clean output in 11ms.',
  },
  {
    id: 'swarm',
    name: 'Multi-Agent Consensus Deadlock',
    category: 'Agent Swarms',
    symptom: 'Planner and Reviewer agents spun in an 18-turn infinite billable loop.',
    guiltyStep: 2,
    steps: [
      {
        index: 0,
        title: 'Planner: Decompose Task',
        type: 'llm',
        detail: 'Break user goal into 3 sub-agent assignments',
        brokenValue: '{"tasks": ["schema", "auth", "validation"]}',
        fixedValue: '{"tasks": ["schema", "auth", "validation"]}',
      },
      {
        index: 1,
        title: 'Coder: Generate Schema PR',
        type: 'tool',
        detail: 'Draft Prisma schema for user table',
        brokenValue: 'model User { id String @id, role String }',
        fixedValue: 'model User { id String @id, role String }',
      },
      {
        index: 2,
        title: 'Reviewer: Ambiguous Rejection Criteria',
        type: 'llm',
        detail: 'Reviewer hallucinated conflicting linter rules with no exit criteria',
        isGuilty: true,
        brokenValue: '{"status": "RETRY", "reason": "Style does not conform"}',
        fixedValue: '{"status": "APPROVE", "reason": "All checks validated"}',
      },
      {
        index: 3,
        title: 'Orchestrator Termination Check',
        type: 'output',
        detail: 'Check whether workflow met threshold',
        brokenValue: 'Terminated: Maximum recursion limit reached (18 iterations • $14 wasted)',
        fixedValue: 'Completed: Pipeline finished in 1 iteration (100% token savings)',
      },
    ],
    verdict: 'Step 02 lacked deterministic exit bounds. Counterfactual fork validated termination at Turn 1 without re-generating schema.',
  },
];

export const InteractiveFlightSimulator: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(SCENARIOS[0]);
  const [isReplayed, setIsReplayed] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [selectedStepIdx, setSelectedStepIdx] = useState<number>(2);

  const handleSelectScenario = (sc: Scenario) => {
    setSelectedScenario(sc);
    setIsReplayed(false);
    setIsReplaying(false);
    setSelectedStepIdx(sc.guiltyStep);
  };

  const handleExecuteReplay = () => {
    setIsReplaying(true);
    setTimeout(() => {
      setIsReplaying(false);
      setIsReplayed(true);
    }, 700);
  };

  const handleReset = () => {
    setIsReplayed(false);
    setIsReplaying(false);
  };

  const activeStep = selectedScenario.steps[selectedStepIdx];

  return (
    <section id="simulator" className="py-28 sm:py-36 bg-[#030407] border-t border-white/[0.06] font-sans">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="max-w-3xl mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 backdrop-blur-md mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest text-amber-300 uppercase">
              03 / Flight Simulator
            </span>
          </div>

          <h2 className="font-serif text-4xl sm:text-6xl md:text-7xl font-light tracking-tight text-white leading-[1.05] mb-6">
            Witness the proof.{' '}
            <span className="italic font-normal text-zinc-400">
              Interactive counterfactual replay in real time.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 font-light leading-relaxed">
            Select an autonomous failure below. Watch Black Box trace the execution DAG, isolate the
            poisoned step, and execute a counterfactual replay with zero model calls.
          </p>
        </div>

        {/* Scenario Switcher Tabs */}
        <div className="flex flex-wrap gap-3 mb-8">
          {SCENARIOS.map((sc) => {
            const isCurrent = sc.id === selectedScenario.id;
            return (
              <button
                key={sc.id}
                onClick={() => handleSelectScenario(sc)}
                className={`px-5 py-2.5 rounded-xl font-mono text-xs tracking-wider transition-all cursor-pointer flex items-center gap-2.5 ${
                  isCurrent
                    ? 'bg-white text-black font-semibold shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                    : 'bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-amber-500' : 'bg-zinc-600'}`} />
                <span>{sc.name}</span>
                <span className="text-[10px] opacity-70 hidden sm:inline">
                  [{sc.category}]
                </span>
              </button>
            );
          })}
        </div>

        {/* Simulator Chassis */}
        <div className="rounded-3xl border border-white/10 apple-glass-card p-6 sm:p-8 shadow-[0_30px_90px_rgba(0,0,0,0.8)] relative overflow-hidden">
          {/* Top Status Telemetry Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/[0.08] gap-4">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
              <div>
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  Incident: {selectedScenario.name}
                </span>
                <p className="text-xs text-red-400 font-mono mt-0.5">
                  Symptom: {selectedScenario.symptom}
                </p>
              </div>
            </div>

            {/* Replay Trigger Action */}
            <div className="flex items-center gap-3">
              {isReplayed ? (
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Simulator</span>
                </button>
              ) : (
                <button
                  onClick={handleExecuteReplay}
                  disabled={isReplaying}
                  className="px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-semibold font-mono text-xs tracking-wider flex items-center gap-2 transition-all shadow-[0_0_25px_rgba(52,211,153,0.4)] active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isReplaying ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                      <span>Replaying from Cache (14ms)...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-black" />
                      <span>Execute Counterfactual Replay</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Step Sequence Visualizer */}
          <div className="py-8">
            <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Execution Timeline (Click any step to inspect)</span>
              <span>4 Steps Recorded • Fault Isolated</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {selectedScenario.steps.map((st, idx) => {
                const isSelected = selectedStepIdx === idx;
                const isFault = st.isGuilty;

                let cardBorder = 'border-white/10';
                let statusBadge = 'bg-white/[0.04] text-zinc-400';

                if (isFault) {
                  if (isReplayed) {
                    cardBorder = 'border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.2)]';
                    statusBadge = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
                  } else {
                    cardBorder = 'border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.2)] animate-pulse';
                    statusBadge = 'bg-amber-500/20 text-amber-400 border border-amber-500/40';
                  }
                } else if (idx === 3) {
                  if (isReplayed) {
                    cardBorder = 'border-emerald-500/40';
                    statusBadge = 'bg-emerald-500/10 text-emerald-400';
                  } else {
                    cardBorder = 'border-red-500/40';
                    statusBadge = 'bg-red-500/10 text-red-400';
                  }
                }

                return (
                  <div
                    key={st.index}
                    onClick={() => setSelectedStepIdx(idx)}
                    className={`p-4 rounded-2xl transition-all duration-300 cursor-pointer border relative ${cardBorder} ${
                      isSelected ? 'bg-white/[0.08] ring-1 ring-white/20' : 'bg-black/40 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-zinc-400">
                        Step 0{st.index + 1}
                      </span>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${statusBadge}`}>
                        {isFault ? (isReplayed ? 'Repaired' : 'Guilty Seed') : idx === 3 ? (isReplayed ? 'Passed' : 'Crashed') : 'Passed'}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-white tracking-tight line-clamp-1 mb-1">
                      {st.title}
                    </h4>

                    <p className="text-[11px] text-zinc-400 font-light line-clamp-2">
                      {st.detail}
                    </p>

                    {idx < 3 && (
                      <div className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-zinc-600">
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inspector Panel for Selected Step */}
          <div className="bg-black/60 rounded-2xl border border-white/[0.08] p-5 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
              <div className="flex items-center gap-2 text-zinc-300">
                <Database className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white">Step 0{activeStep.index + 1} Inspector:</span>
                <span className="text-zinc-400">{activeStep.title}</span>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase">
                Type: {activeStep.type}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Recorded Failure State */}
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20">
                <div className="flex items-center gap-2 text-red-400 text-[11px] font-bold mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Recorded Execution State:</span>
                </div>
                <pre className="text-[11px] text-zinc-300 overflow-x-auto whitespace-pre-wrap font-mono">
                  {activeStep.brokenValue}
                </pre>
              </div>

              {/* Counterfactual Replay State */}
              <div className={`p-4 rounded-xl transition-colors border ${
                isReplayed
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : 'bg-zinc-900/40 border-white/[0.06] opacity-60'
              }`}>
                <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-bold mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Counterfactual Repair (Zero Model Calls):</span>
                </div>
                <pre className="text-[11px] text-zinc-300 overflow-x-auto whitespace-pre-wrap font-mono">
                  {isReplayed ? activeStep.fixedValue : 'Awaiting counterfactual replay execution...'}
                </pre>
              </div>
            </div>

            {/* Verdict Callout Banner */}
            {isReplayed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  <p className="text-xs text-emerald-300 font-sans leading-relaxed">
                    <strong className="font-semibold text-white">Proven Root Cause: </strong>
                    {selectedScenario.verdict}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[11px] font-mono text-zinc-400 shrink-0">
                  <span>Replay: <strong className="text-white">14ms</strong></span>
                  <span>Tokens: <strong className="text-emerald-400">0</strong></span>
                  <span>Cost: <strong className="text-emerald-400">$0.00</strong></span>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
