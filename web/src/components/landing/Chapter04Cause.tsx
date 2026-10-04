import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, ShieldAlert, GitFork, ArrowRight, CornerDownRight, CheckCircle2 } from 'lucide-react';

export const Chapter04Cause: React.FC = () => {
  const [selectedAttribute, setSelectedAttribute] = useState<string>('schema_drift');

  const SHAP_FEATURES = [
    { id: 'schema_drift', name: 'schema_drift_detected', impact: 0.48, desc: 'Output payload dropped required "currency" key from query result schema.' },
    { id: 'unhandled_null', name: 'unhandled_null_fallback', impact: 0.32, desc: 'Downstream node silently substituted 0.0 fallback instead of raising an alarm.' },
    { id: 'checker_divergence', name: 'step_checker_divergence', impact: 0.14, desc: 'State assertion failed comparison against historical valid execution baselines.' },
    { id: 'latency_spike', name: 'latency_distribution_delta', impact: 0.06, desc: 'Database execution took +140ms longer than normal tier shard baselines.' },
  ];

  return (
    <section
      id="ch-04"
      className="relative py-28 px-6 sm:px-12 md:px-20 font-sans border-b border-[#1f2937]/50 bg-[#070a10]"
    >
      <div className="max-w-6xl mx-auto">
        {/* Chapter Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 mb-3 text-xs font-mono text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="uppercase">CHAPTER 04 // THE CAUSE</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">GNN GRAPH ISOLATION</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-light text-white uppercase tracking-tight mb-4">
            Black Box did not just find an error. <br />
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-white">
              It isolated the cause.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 font-normal max-w-2xl leading-relaxed">
            Irrelevant execution noise fades away. Causal graph inference isolates the exact step whose state modification
            mathematically flips the outcome from failure to success.
          </p>
        </div>

        {/* Forensic Causal Dossier Panel */}
        <div className="bg-[#090d16] border border-[#1f2937] rounded-lg p-6 font-mono shadow-2xl space-y-6">
          {/* Panel Header */}
          <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#1f2937] gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Crosshair className="w-4 h-4 text-amber-400" />
              <span className="text-white font-bold text-sm">
                ISOLATED ROOT CAUSE // STEP 04: TOOL (SQL_EXEC)
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-zinc-500">ATTRIBUTION CONFIDENCE:</span>
              <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold border border-amber-800">
                P(ROOT) = 0.962 (TOP-1 HIT)
              </span>
            </div>
          </div>

          {/* 3-Column Forensic Evidence Architecture */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {/* Column 1: SHAP Mathematical Feature Attribution */}
            <div className="p-4 rounded bg-[#06080d] border border-[#1a2333] space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800">
                <span className="text-zinc-400 font-bold">1. SHAP ATTRIBUTION</span>
                <span className="text-cyan-400 text-[10px]">GRADIENT DRIVERS</span>
              </div>

              <div className="space-y-2">
                {SHAP_FEATURES.map((feat) => {
                  const isSelected = feat.id === selectedAttribute;
                  return (
                    <div
                      key={feat.id}
                      onClick={() => setSelectedAttribute(feat.id)}
                      className={`p-2 rounded cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#0f172a] border border-cyan-500/60'
                          : 'bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={isSelected ? 'text-cyan-300 font-bold' : 'text-zinc-300'}>
                          {feat.name}
                        </span>
                        <span className="text-amber-400 font-bold">+{feat.impact}</span>
                      </div>
                      {isSelected && (
                        <p className="text-[10px] text-zinc-400 mt-1 leading-normal font-sans">
                          {feat.desc}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Column 2: Blast Radius & Symptom Classification */}
            <div className="p-4 rounded bg-[#06080d] border border-[#1a2333] space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800">
                <span className="text-zinc-400 font-bold">2. BLAST RADIUS</span>
                <span className="text-red-400 text-[10px]">2 NODES TAINTED</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800">
                  <div className="flex items-center justify-between text-zinc-300 text-[11px]">
                    <span>STEP 05: LLM SYNTHESIS</span>
                    <span className="text-amber-400 text-[10px]">CONTAMINATED</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                    Ingested missing currency key, calculating zeroes into customer margin sheet.
                  </p>
                </div>

                <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800">
                  <div className="flex items-center justify-between text-zinc-300 text-[11px]">
                    <span>STEP 06: FINAL EMIT</span>
                    <span className="text-red-400 text-[10px]">SYMPTOM CRASH</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                    Crashed with ZeroRevenueThresholdException. Modifying this step fixes zero root bugs.
                  </p>
                </div>
              </div>
            </div>

            {/* Column 3: Recovery Strategy & Token Preservation */}
            <div className="p-4 rounded bg-[#06080d] border border-[#1a2333] space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800">
                <span className="text-zinc-400 font-bold">3. RECOVERY TARGET</span>
                <span className="text-emerald-400 text-[10px]">SAVE-POINT #2</span>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-zinc-400 font-sans">
                <p>
                  Because Black Box saved complete bit-exact SQLite snapshots at Step 01, 02, and 03,
                  the agent does not need to re-fetch vectors or re-execute the task prompt.
                </p>

                <div className="p-3 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 font-mono text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-bold">ELIGIBLE FOR FORK:</span>
                  </div>
                  <p className="text-[11px] text-emerald-200">
                    Steps 01..03 Reusable (82% Tokens Saved)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
