import React from 'react';
import { CausalDag3D } from '../3d/CausalDag3D';

export const CausalConstellationStage: React.FC = () => {
  return (
    <section id="causal-dag" className="py-28 sm:py-36 bg-[#08090c] border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="max-w-3xl mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 backdrop-blur-md mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest text-cyan-300 uppercase">
              04 / Mathematical Causality
            </span>
          </div>

          <h2 className="font-serif text-4xl sm:text-6xl md:text-7xl font-light tracking-tight text-white leading-[1.05] mb-6">
            Beyond correlation.{' '}
            <span className="italic font-normal text-zinc-400">
              The execution DAG deconstructed.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 font-light leading-relaxed">
            Autonomous agent graphs form complex webs of non-linear data dependencies. When a downstream task
            crashes, Black Box traces the causal lineage backward to compute exact Shapley values for every step.
          </p>
        </div>

        {/* Real Interactive Three.js 3D DAG Canvas */}
        <CausalDag3D />

        {/* Architectural Comparison Matrix */}
        <div className="rounded-3xl border border-white/10 apple-glass-card p-6 sm:p-10 shadow-2xl">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h3 className="text-xl sm:text-2xl font-semibold text-white tracking-tight mb-2">
              Why Traditional Observability Fails AI Agents
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 font-light">
              Autonomous agents are non-deterministic, multi-step state machines. Logs and metrics alone cannot debug them.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* The Old Way */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-2 text-zinc-400 font-mono text-xs font-bold uppercase">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span>Traditional Observability (Logs & Traces)</span>
              </div>
              <ul className="space-y-3 text-xs text-zinc-400 font-light leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="text-red-400 font-mono">✕</span>
                  <span>Shows you only symptoms at the output, leaving you to guess which prior step caused the error.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-400 font-mono">✕</span>
                  <span>Forces you to re-run expensive models repeatedly to reproduce transient nondeterministic bugs.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-400 font-mono">✕</span>
                  <span>No concept of causal necessity or sufficiency — correlations often lead developers to fix the wrong tool.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-400 font-mono">✕</span>
                  <span>Zero regression testing: fixing one edge case silently breaks five other agent personas.</span>
                </li>
              </ul>
            </div>

            {/* The Black Box Flight Recorder Way */}
            <div className="p-6 rounded-2xl bg-emerald-950/10 border border-emerald-500/30 space-y-4 shadow-lg shadow-emerald-950/30">
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Black Box Flight Recorder</span>
              </div>
              <ul className="space-y-3 text-xs text-zinc-300 font-light leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-mono">✓</span>
                  <span>Cryptographically records every token, tool dispatch, and memory transition with zero overhead.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-mono">✓</span>
                  <span>Counterfactual replay costs $0.00: re-uses recorded cache so you never burn API tokens to test fixes.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-mono">✓</span>
                  <span>Mathematically proves cause: if replaying with step X repaired passes, step X was the guaranteed cause.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-mono">✓</span>
                  <span>Automated Fleet Regression Firewall re-verifies your fix across 10,000 runs before PR merge.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
