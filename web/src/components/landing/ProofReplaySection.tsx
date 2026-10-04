import React, { useState } from 'react';
import { GitFork, CheckCircle2, XCircle, ArrowRight, Zap, Clock, Coins, ShieldCheck, Repeat } from 'lucide-react';

export const ProofReplaySection: React.FC = () => {
  const [viewMode, setViewMode] = useState<'comparison' | 'savings'>('comparison');

  return (
    <section id="replay" className="relative py-20 md:py-32 border-t border-[#1f2937]/80 bg-[#05070b]">
      <div className="max-w-[1400px] mx-auto px-6 font-sans">
        {/* Section Eyebrow */}
        <div className="flex items-center gap-2 mb-3 font-mono text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="tracking-widest uppercase font-semibold">06 // COUNTERFACTUAL FORK ENGINE</span>
        </div>

        {/* Section Headline */}
        <div className="max-w-3xl mb-12">
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
        </div>

        {/* Interactive Before & After Visual Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Original Failed Run (6 cols) */}
          <div className="lg:col-span-6 bg-[#0b0f17] border border-[#1f2937] rounded-lg p-6 flex flex-col justify-between font-mono">
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
              <span>TOTAL TOKENS: 1,830</span>
            </div>
          </div>

          {/* Forked Replay with Proven Fix (6 cols) */}
          <div className="lg:col-span-6 bg-[#0b0f17] border border-emerald-900/80 rounded-lg p-6 flex flex-col justify-between font-mono ring-1 ring-emerald-500/20">
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

              {/* Step Sequence Breakdown */}
              <div className="py-5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-cyan-950/20 border border-cyan-900/60 text-cyan-300">
                  <span>#0 INPUT: Task Dispatch</span>
                  <span className="text-cyan-400 text-[10px] font-bold">REUSED SAVE-POINT (0ms)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-cyan-950/20 border border-cyan-900/60 text-cyan-300">
                  <span>#1 RETRIEVAL: Vector Search</span>
                  <span className="text-cyan-400 text-[10px] font-bold">REUSED SAVE-POINT (0ms)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-cyan-950/20 border border-cyan-900/60 text-cyan-300">
                  <span>#2 LLM: Execution Planner</span>
                  <span className="text-cyan-400 text-[10px] font-bold">REUSED SAVE-POINT (0ms)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-emerald-950/80 border border-emerald-600 text-emerald-200">
                  <span className="font-bold">#3' TOOL: Patched Query Execution</span>
                  <span className="text-emerald-300 font-bold">REPAIRED (142ms)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-emerald-950/40 border border-emerald-800/80 text-emerald-200">
                  <span>#4' LLM: Parse Ledger & Calc</span>
                  <span className="text-emerald-400">RE-EXECUTED (Clean)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-emerald-950/40 border border-emerald-800/80 text-emerald-200">
                  <span>#5' FINAL: Schedule Generation</span>
                  <span className="text-emerald-400 font-bold">PASSED (200 OK)</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-emerald-900/60 flex items-center justify-between text-[11px] text-emerald-400 font-bold">
              <span>REUSED STEPS: 3 / 6 (50%)</span>
              <span>TOKENS REUSED: 942 (51.5%)</span>
            </div>
          </div>
        </div>

        {/* Causal Verification KPI Strip */}
        <div className="mt-8 p-6 rounded-lg bg-[#070a10] border border-[#1f2937] grid grid-cols-2 md:grid-cols-4 gap-6 font-mono text-center">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">SAVINGS RATIO</p>
            <p className="text-xl font-bold text-cyan-400 mt-1">51.5% Tokens</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Unchanged prefix reused</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">WALL CLOCK SPEEDUP</p>
            <p className="text-xl font-bold text-white mt-1">2.4x Faster</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Cached state resume</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">CAUSAL NECESSITY</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">Proven</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Flipping #3 fixes run</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">FLAKINESS TEST</p>
            <p className="text-xl font-bold text-white mt-1">3/3 Repeats</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Zero stochastic noise</p>
          </div>
        </div>
      </div>
    </section>
  );
};
