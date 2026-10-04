import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll } from 'framer-motion';
import { Database, Cpu, Wrench, Sparkles, Terminal, CheckCircle2 } from 'lucide-react';

interface RunStep {
  idx: number;
  label: string;
  kind: 'input' | 'retrieval' | 'llm' | 'tool' | 'synthesis';
  latencyMs: number;
  tokens: number;
  desc: string;
  payload: string;
}

const RUN_STEPS: RunStep[] = [
  {
    idx: 1,
    label: 'INPUT: TASK DISPATCH',
    kind: 'input',
    latencyMs: 12,
    tokens: 42,
    desc: 'Multi-table settlement inquiry dispatched to autonomous runtime. Immutable SQLite shard initialized.',
    payload: '{"task": "Calculate Q3 APAC settlements across customer margin tiers"}',
  },
  {
    idx: 2,
    label: 'RETRIEVAL: SCHEMAS & RULES',
    kind: 'retrieval',
    latencyMs: 84,
    tokens: 340,
    desc: '4 vector chunks fetched. Schema validated against active database ontology with 0.0ms overhead.',
    payload: '{"query": "APAC FX rates & tier rules", "chunks_returned": 4, "top_k_score": 0.94}',
  },
  {
    idx: 3,
    label: 'LLM: PLANNER & QUERY BUILDER',
    kind: 'llm',
    latencyMs: 410,
    tokens: 520,
    desc: 'Planner synthesizes SQL query strategy and parameter bindings. Creates Save-Point #2 anchor.',
    payload: '{"plan": "query_warehouse(sql=SELECT account, currency, amount)", "model": "claude-3-5-sonnet"}',
  },
  {
    idx: 4,
    label: 'TOOL: SQL WAREHOUSE QUERY',
    kind: 'tool',
    latencyMs: 290,
    tokens: 180,
    desc: 'Query executes against warehouse shard. Provider logs report 200 OK. State snapshot captured.',
    payload: '{"sql": "SELECT account, amount FROM apac_ledger", "returned_rows": 142, "status": "200_OK"}',
  },
  {
    idx: 5,
    label: 'LLM: SYNTHESIZE & AGGREGATE',
    kind: 'synthesis',
    latencyMs: 512,
    tokens: 680,
    desc: 'Downstream LLM aggregates financial numbers into final reporting structure.',
    payload: '{"parsed_records": 142, "calculation": "sum(amount * fx_rate)"}',
  },
];

export const Chapter02Run: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStepIdx, setActiveStepIdx] = useState<number>(1);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start center', 'end center'],
  });

  useEffect(() => {
    return scrollYProgress.on('change', (v) => {
      const step = Math.min(5, Math.max(1, Math.floor(v * 5) + 1));
      setActiveStepIdx(step);
    });
  }, [scrollYProgress]);

  const activeStep = RUN_STEPS.find((s) => s.idx === activeStepIdx) || RUN_STEPS[0];

  return (
    <section
      ref={containerRef}
      id="ch-02"
      className="relative min-h-[150vh] py-24 px-6 sm:px-12 md:px-20 font-sans border-b border-[#1f2937]/50 bg-[#05070b]"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 mb-3 text-xs font-mono text-cyan-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="uppercase">CHAPTER 02 // THE RUN</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">EXECUTION TRAVERSAL</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-light text-white uppercase tracking-tight">
            Immutable <br />
            <span className="font-extrabold text-white">execution recording.</span>
          </h2>
        </div>

        {/* Architectural Split: Editorial on Left, Live Transforming Visualization on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Editorial Progression Milestones (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {RUN_STEPS.map((step) => {
              const isActive = step.idx === activeStepIdx;
              const isPast = step.idx < activeStepIdx;

              return (
                <div
                  key={step.idx}
                  onClick={() => setActiveStepIdx(step.idx)}
                  className={`p-4 rounded border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#090e17] border-cyan-500/80 shadow-lg shadow-cyan-950/40'
                      : isPast
                      ? 'bg-[#06090e] border-[#1f2937]/80 text-zinc-400'
                      : 'bg-transparent border-[#1f2937]/40 text-zinc-600 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                    <span className={isActive ? 'text-cyan-400 font-bold' : isPast ? 'text-zinc-300' : 'text-zinc-600'}>
                      STEP 0{step.idx} // {step.label}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {step.latencyMs}ms · {step.tokens}t
                    </span>
                  </div>

                  <p className={`text-xs leading-relaxed ${isActive ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Right Column: Pinned Living Execution Visual (7 cols) */}
          <div className="lg:col-span-7 sticky top-24 bg-[#080d16] border border-[#1f2937] rounded-lg p-6 font-mono shadow-2xl">
            {/* Visual Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#1f2937] text-xs text-zinc-400 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-white font-bold">RUN: APAC-SETTLEMENT-09</span>
              </div>
              <div className="text-[10px] text-zinc-500">
                TOTAL: 1,326ms · 1,762 TOKENS
              </div>
            </div>

            {/* Continuous SVG Wire connecting 5 steps horizontally */}
            <div className="relative py-6 my-2">
              <svg className="w-full h-16 overflow-visible">
                {/* Background Wire */}
                <line x1="8%" y1="50%" x2="92%" y2="50%" stroke="#1f2937" strokeWidth="2" />

                {/* Active Execution Laser Wire */}
                <line
                  x1="8%"
                  y1="50%"
                  x2={`${8 + ((activeStepIdx - 1) / 4) * 84}%`}
                  y2="50%"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  className="transition-all duration-300"
                />

                {/* Traveling packet */}
                <circle
                  cx={`${8 + ((activeStepIdx - 1) / 4) * 84}%`}
                  cy="50%"
                  r="4"
                  fill="#38bdf8"
                  className="shadow-sm shadow-cyan-400"
                />
              </svg>

              {/* Step Node Circles positioned on top of the wire */}
              <div className="absolute inset-0 flex justify-between items-center px-4 sm:px-6">
                {RUN_STEPS.map((s) => {
                  const isCurrent = s.idx === activeStepIdx;
                  const isCompleted = s.idx <= activeStepIdx;

                  return (
                    <button
                      key={s.idx}
                      onClick={() => setActiveStepIdx(s.idx)}
                      className={`relative w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-cyan-950 border-cyan-400 scale-125 shadow-lg shadow-cyan-500/50'
                          : isCompleted
                          ? 'bg-[#091522] border-cyan-600 text-cyan-300'
                          : 'bg-[#06090e] border-[#1f2937] text-zinc-600'
                      }`}
                    >
                      {s.kind === 'input' && <Sparkles className="w-3.5 h-3.5" />}
                      {s.kind === 'retrieval' && <Database className="w-3.5 h-3.5" />}
                      {s.kind === 'llm' && <Cpu className="w-3.5 h-3.5" />}
                      {s.kind === 'tool' && <Wrench className="w-3.5 h-3.5" />}
                      {s.kind === 'synthesis' && <CheckCircle2 className="w-3.5 h-3.5" />}

                      <span className="absolute -bottom-5 text-[8px] font-mono text-zinc-500 whitespace-nowrap">
                        0{s.idx}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Save-Point Telemetry Payload Display */}
            <div className="mt-8 pt-4 border-t border-[#1f2937] bg-[#05070a] p-4 rounded border border-[#1a2333]">
              <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-2">
                <span className="text-cyan-400 font-bold">
                  STEP 0{activeStep.idx} SNAPSHOT STATE
                </span>
                <span>STATUS: RECORDED (ZERO LATENCY OVERHEAD)</span>
              </div>

              <div className="text-xs text-zinc-300 font-mono overflow-x-auto p-2 rounded bg-black/60 border border-zinc-800">
                <code>{activeStep.payload}</code>
              </div>

              <div className="flex items-center justify-between text-[9px] text-zinc-500 mt-3">
                <span>HASH: #shard_apac_09_sp_{activeStep.idx}a2f</span>
                <span>LATENCY: {activeStep.latencyMs}ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
