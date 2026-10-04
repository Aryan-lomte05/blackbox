import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GitFork, CheckCircle2, XCircle, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export const Chapter05Proof: React.FC = () => {
  const [activeLane, setActiveLane] = useState<'both' | 'repaired'>('both');

  return (
    <section
      id="ch-05"
      className="relative py-28 px-6 sm:px-12 md:px-20 font-sans border-b border-[#1f2937]/50 bg-[#05070b] overflow-hidden"
    >
      <div className="max-w-6xl mx-auto">
        {/* Chapter Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 mb-3 text-xs font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="uppercase">CHAPTER 05 // THE PROOF</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">COUNTERFACTUAL VERIFICATION</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-light text-white uppercase tracking-tight mb-4">
            Prove the fix. <br />
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300">
              Never guess in production.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 font-normal max-w-2xl leading-relaxed">
            Black Box rewinds the run to Save-Point #2. Upstream steps are reused with zero re-computation.
            A patched schema validation rule is injected at Step 04&apos;. Only downstream steps re-execute,
            proving mathematical causality before code ever touches production.
          </p>
        </div>

        {/* Counterfactual Timeline Visual Matrix */}
        <div className="bg-[#080d16] border border-[#1f2937] rounded-lg p-6 font-mono shadow-2xl relative">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#1f2937] gap-3 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <GitFork className="w-4 h-4 text-emerald-400" />
              <span className="text-white font-bold">REPLAY DIVERGENCE: FROM SAVE-POINT #2</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-zinc-500">UPSTREAM SAVINGS:</span>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-800">
                82% TOKENS SAVED (902 / 1,097)
              </span>
            </div>
          </div>

          {/* Dual-Lane Execution Canvas */}
          <div className="py-8 space-y-6 overflow-x-auto">
            {/* Upper Lane: Original Failed Run */}
            <div className="relative min-w-[700px] p-4 rounded bg-[#06090e] border border-red-950/60">
              <div className="flex items-center justify-between text-[11px] mb-3 text-zinc-500">
                <span className="text-red-400 font-bold flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" /> ORIGINAL TIMELINE: FAILED RUN
                </span>
                <span>STATUS: CRASHED AT STEP 06</span>
              </div>

              <div className="grid grid-cols-6 gap-2 text-center text-xs">
                <div className="p-2.5 rounded bg-[#0a1422] border border-cyan-800/60 text-cyan-300">
                  <p className="text-[9px] text-zinc-500">01 DISPATCH</p>
                  <p className="text-[10px] font-bold text-white mt-1">42 TOKENS</p>
                  <span className="text-[8px] text-cyan-400">REUSED</span>
                </div>

                <div className="p-2.5 rounded bg-[#0a1422] border border-cyan-800/60 text-cyan-300">
                  <p className="text-[9px] text-zinc-500">02 RETRIEVAL</p>
                  <p className="text-[10px] font-bold text-white mt-1">340 TOKENS</p>
                  <span className="text-[8px] text-cyan-400">REUSED</span>
                </div>

                <div className="p-2.5 rounded bg-[#0a1422] border border-cyan-800/60 text-cyan-300">
                  <p className="text-[9px] text-zinc-500">03 PLANNER</p>
                  <p className="text-[10px] font-bold text-white mt-1">520 TOKENS</p>
                  <span className="text-[8px] text-cyan-400">REUSED</span>
                </div>

                <div className="p-2.5 rounded bg-red-950/70 border border-red-600 text-red-300">
                  <p className="text-[9px] text-red-400 font-bold">04 TOOL_EXEC</p>
                  <p className="text-[10px] font-bold text-white mt-1">180 TOKENS</p>
                  <span className="text-[8px] text-red-400 font-black">DROPPED COL</span>
                </div>

                <div className="p-2.5 rounded bg-amber-950/50 border border-amber-800 text-amber-300">
                  <p className="text-[9px] text-zinc-500">05 SYNTHESIZE</p>
                  <p className="text-[10px] font-bold text-zinc-400 mt-1">680 TOKENS</p>
                  <span className="text-[8px] text-amber-400">TAINTED</span>
                </div>

                <div className="p-2.5 rounded bg-red-950/80 border border-red-700 text-red-300">
                  <p className="text-[9px] text-zinc-500">06 EMIT</p>
                  <p className="text-[10px] font-bold text-red-300 mt-1">CRASH</p>
                  <span className="text-[8px] text-red-400">DIV/0</span>
                </div>
              </div>
            </div>

            {/* Lower Lane: Counterfactual Repaired Run */}
            <div className="relative min-w-[700px] p-4 rounded bg-[#07130d] border border-emerald-500/70 shadow-lg shadow-emerald-950/50">
              <div className="flex items-center justify-between text-[11px] mb-3 text-zinc-400">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> COUNTERFACTUAL FORK: REPAIRED RUN
                </span>
                <span className="text-emerald-300 font-bold">VERIFIED: PASS (100%)</span>
              </div>

              <div className="grid grid-cols-6 gap-2 text-center text-xs">
                {/* 01..03 are reused identically */}
                <div className="p-2.5 rounded bg-[#081b11] border border-emerald-900/60 text-emerald-300">
                  <p className="text-[9px] text-zinc-500">01 DISPATCH</p>
                  <p className="text-[10px] font-bold text-emerald-200 mt-1">0 TOKENS</p>
                  <span className="text-[8px] text-emerald-400">REHYDRATED</span>
                </div>

                <div className="p-2.5 rounded bg-[#081b11] border border-emerald-900/60 text-emerald-300">
                  <p className="text-[9px] text-zinc-500">02 RETRIEVAL</p>
                  <p className="text-[10px] font-bold text-emerald-200 mt-1">0 TOKENS</p>
                  <span className="text-[8px] text-emerald-400">REHYDRATED</span>
                </div>

                <div className="p-2.5 rounded bg-[#081b11] border border-emerald-900/60 text-emerald-300">
                  <p className="text-[9px] text-zinc-500">03 PLANNER</p>
                  <p className="text-[10px] font-bold text-emerald-200 mt-1">0 TOKENS</p>
                  <span className="text-[8px] text-emerald-400">REHYDRATED</span>
                </div>

                {/* 04' is repaired */}
                <div className="p-2.5 rounded bg-emerald-950 border-2 border-emerald-400 text-emerald-200 shadow-md shadow-emerald-950">
                  <p className="text-[9px] text-emerald-300 font-bold">04&apos; REPAIR</p>
                  <p className="text-[10px] font-bold text-white mt-1">185 TOKENS</p>
                  <span className="px-1 py-0.2 rounded bg-emerald-400 text-black text-[8px] font-black uppercase">
                    PATCHED
                  </span>
                </div>

                {/* 05' resynthesizes cleanly */}
                <div className="p-2.5 rounded bg-[#081e13] border border-emerald-600 text-emerald-200">
                  <p className="text-[9px] text-zinc-400">05&apos; CLEAN</p>
                  <p className="text-[10px] font-bold text-white mt-1">640 TOKENS</p>
                  <span className="text-[8px] text-emerald-400">CLEAN DATA</span>
                </div>

                {/* 06' emits verified pass */}
                <div className="p-2.5 rounded bg-emerald-500 text-black font-bold">
                  <p className="text-[9px] text-emerald-950">06&apos; VERIFIED</p>
                  <p className="text-[10px] font-black mt-1">PASS</p>
                  <span className="text-[8px] uppercase tracking-wider">0 REGRESSIONS</span>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Verdict Footer */}
          <div className="mt-4 pt-4 border-t border-[#1f2937] flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-zinc-300">
                REGRESSION FIREWALL: Approved across 40 historical shards. Zero side-effects detected.
              </span>
            </div>

            <div className="text-[10px] text-zinc-500">
              PROOF HASH: <code className="text-emerald-400">sha256:4bf92a18...</code>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
