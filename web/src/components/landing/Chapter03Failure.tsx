import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, ShieldAlert, ArrowRight, CornerDownRight } from 'lucide-react';

export const Chapter03Failure: React.FC = () => {
  const [viewMode, setViewMode] = useState<'traditional' | 'blackbox'>('blackbox');

  return (
    <section
      id="ch-03"
      className="relative py-28 px-6 sm:px-12 md:px-20 font-sans border-b border-[#1f2937]/50 bg-[#05070b] overflow-hidden"
    >
      <div className="max-w-6xl mx-auto">
        {/* Chapter Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 mb-3 text-xs font-mono text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="uppercase">CHAPTER 03 // THE FAILURE</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">SILENT CORRUPTION & CONTAMINATION</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-light text-white uppercase tracking-tight mb-4">
            The error is not <br />
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-rose-300 to-amber-400">
              the cause.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 font-normal max-w-2xl leading-relaxed">
            Multi-step agents fail silently. Step 04 silently dropped the currency exchange column while reporting 200 OK.
            The crash only materialized two steps later at Step 06 with a division error. Traditional loggers blame Step 06.
            Black Box isolates the true culprit.
          </p>
        </div>

        {/* View Mode Switcher: Traditional Blind Logger vs Black Box Causal Graph */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1f2937] mb-8 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 uppercase">OBSERVABILITY LENS:</span>
            <div className="flex items-center bg-[#090d16] p-1 rounded border border-[#1f2937]">
              <button
                onClick={() => setViewMode('traditional')}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  viewMode === 'traditional'
                    ? 'bg-zinc-800 text-white font-bold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                TRADITIONAL LOGS (BLIND)
              </button>
              <button
                onClick={() => setViewMode('blackbox')}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  viewMode === 'blackbox'
                    ? 'bg-red-950 text-red-300 font-bold border border-red-700 shadow-sm shadow-red-950'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                BLACK BOX CAUSAL PROPAGATION
              </button>
            </div>
          </div>

          <span className="text-[11px] text-zinc-500 hidden sm:inline">
            {viewMode === 'traditional' ? 'MISATTRIBUTED TO STEP 06' : 'TRUE ROOT CAUSE: STEP 04'}
          </span>
        </div>

        {/* Topological Demonstration Canvas */}
        <div className="bg-[#080d16] border border-[#1f2937] rounded-lg p-6 font-mono shadow-2xl relative overflow-hidden">
          {viewMode === 'traditional' ? (
            /* Traditional Logs Blind View */
            <div className="py-8 space-y-6">
              <div className="flex items-center justify-between text-xs text-zinc-500 border-b border-zinc-800 pb-3">
                <span>DATADOG / CLOUDWATCH RAW STREAM</span>
                <span className="text-red-400 font-bold">1 UNCAUGHT EXCEPTION</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                {['STEP 01: 200 OK', 'STEP 02: 200 OK', 'STEP 03: 200 OK', 'STEP 04: 200 OK', 'STEP 05: 200 OK'].map((s, idx) => (
                  <div key={idx} className="p-3 rounded bg-zinc-900/60 border border-zinc-800 text-center">
                    <p className="text-[10px] text-zinc-500">{s.split(':')[0]}</p>
                    <p className="text-xs text-emerald-400 font-bold mt-1">200 OK</p>
                  </div>
                ))}
                <div className="p-3 rounded bg-red-950/60 border border-red-600 text-center">
                  <p className="text-[10px] text-red-300 font-bold">STEP 06: CRASH</p>
                  <p className="text-xs text-red-400 font-bold mt-1">500 ERROR</p>
                </div>
              </div>

              <div className="p-4 rounded bg-black/60 border border-red-900/60 text-xs text-red-300 leading-relaxed">
                <span className="text-red-500 font-bold">[CRASH 12:44:03]</span> ZeroRevenueThresholdException: total calculated 0.0 USD in Step 06.
                <p className="text-zinc-500 text-[11px] mt-1">
                  Engineers spend hours debugging Step 06 division logic. The patch fails because the data was poisoned upstream!
                </p>
              </div>
            </div>
          ) : (
            /* Black Box Causal Graph Breakdown */
            <div className="py-4">
              {/* Connected Wire Harness */}
              <div className="relative py-12 my-2 overflow-x-auto">
                <svg className="w-full h-24 min-w-[700px] overflow-visible">
                  {/* Healthy Upstream Wire (01 -> 04) */}
                  <line x1="8%" y1="50%" x2="58%" y2="50%" stroke="#38bdf8" strokeWidth="2.5" />

                  {/* Poisoned Downstream Wire (04 -> 06) */}
                  <line
                    x1="58%"
                    y1="50%"
                    x2="92%"
                    y2="50%"
                    stroke="#ef4444"
                    strokeWidth="3"
                    strokeDasharray="6 6"
                    className="animate-pulse"
                  />
                </svg>

                {/* Nodes positioned horizontally */}
                <div className="absolute inset-0 flex justify-between items-center px-4 min-w-[700px]">
                  {/* Step 01 */}
                  <div className="text-center w-24">
                    <div className="w-8 h-8 rounded-full bg-[#08121f] border-2 border-cyan-500 mx-auto flex items-center justify-center text-cyan-300 text-xs">
                      01
                    </div>
                    <p className="text-[9px] text-zinc-400 mt-2">INPUT: TASK</p>
                    <span className="text-[8px] text-cyan-400">HEALTHY</span>
                  </div>

                  {/* Step 02 */}
                  <div className="text-center w-24">
                    <div className="w-8 h-8 rounded-full bg-[#08121f] border-2 border-cyan-500 mx-auto flex items-center justify-center text-cyan-300 text-xs">
                      02
                    </div>
                    <p className="text-[9px] text-zinc-400 mt-2">RETRIEVAL</p>
                    <span className="text-[8px] text-cyan-400">HEALTHY</span>
                  </div>

                  {/* Step 03 */}
                  <div className="text-center w-24">
                    <div className="w-8 h-8 rounded-full bg-[#08121f] border-2 border-cyan-500 mx-auto flex items-center justify-center text-cyan-300 text-xs">
                      03
                    </div>
                    <p className="text-[9px] text-zinc-400 mt-2">LLM: PLANNER</p>
                    <span className="text-[8px] text-cyan-400">SAVE-POINT #2</span>
                  </div>

                  {/* Step 04 — GUILTY ROOT CAUSE */}
                  <div className="text-center w-28 relative">
                    {/* Pulsing shockwave ring */}
                    <div className="absolute -inset-2 rounded-full border-2 border-red-500 animate-ping pointer-events-none" />
                    <div className="w-10 h-10 rounded-full bg-red-950 border-2 border-red-500 mx-auto flex items-center justify-center text-red-200 text-sm font-bold shadow-lg shadow-red-900">
                      04
                    </div>
                    <p className="text-[10px] text-red-300 font-bold mt-2">TOOL: SQL_EXEC</p>
                    <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-black text-[8px] tracking-wider uppercase inline-block mt-0.5">
                      GUILTY CAUSE
                    </span>
                  </div>

                  {/* Step 05 — CONTAMINATED */}
                  <div className="text-center w-28">
                    <div className="w-8 h-8 rounded-full bg-amber-950/80 border-2 border-amber-500 mx-auto flex items-center justify-center text-amber-200 text-xs">
                      05
                    </div>
                    <p className="text-[9px] text-amber-300 font-semibold mt-2">SYNTHESIZE</p>
                    <span className="text-[8px] text-amber-400">POISONED CONTEXT</span>
                  </div>

                  {/* Step 06 — SYMPTOM CRASH */}
                  <div className="text-center w-24">
                    <div className="w-8 h-8 rounded-full bg-zinc-900 border-2 border-red-700 mx-auto flex items-center justify-center text-red-400 text-xs opacity-80">
                      06
                    </div>
                    <p className="text-[9px] text-zinc-400 mt-2">FINAL: EMIT</p>
                    <span className="text-[8px] text-zinc-500">SYMPTOM CRASH</span>
                  </div>
                </div>
              </div>

              {/* Forensic Anomaly Analysis Box */}
              <div className="mt-8 p-4 rounded bg-red-950/30 border border-red-900/60 text-xs text-zinc-300 leading-relaxed flex flex-col md:flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase">
                    <AlertTriangle className="w-4 h-4" />
                    <span>CAUSAL CONTAMINATION ISOLATED</span>
                  </div>
                  <p className="text-zinc-400 text-xs">
                    Tool execution dropped required column <code className="text-red-300 bg-red-950 px-1 py-0.5 rounded">&apos;currency&apos;</code>.
                    Downstream LLM defaulted to 0.0 USD without raising an alarm, leading to division by zero at Step 06.
                  </p>
                </div>

                <div className="text-right text-[10px] text-zinc-500 font-mono whitespace-nowrap self-end md:self-center">
                  <p>CONFIDENCE: <strong className="text-red-400 font-bold">P=0.962</strong></p>
                  <p>RECOVERY TARGET: <strong className="text-cyan-400">SAVE-POINT #2</strong></p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
