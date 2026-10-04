import React from 'react';
import { ShieldCheck, Flame, Lock, Terminal, Star } from 'lucide-react';

export const BentoCapabilities: React.FC = () => {
  return (
    <section id="capabilities" className="py-28 sm:py-36 bg-[#08090c] border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="max-w-3xl mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 backdrop-blur-md mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest text-purple-300 uppercase">
              05 / Deep Capabilities
            </span>
          </div>

          <h2 className="font-serif text-4xl sm:text-6xl md:text-7xl font-light tracking-tight text-white leading-[1.05] mb-6">
            Engineered for missions{' '}
            <span className="italic font-normal text-zinc-400">
              where autonomous failure is not an option.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 font-light leading-relaxed">
            From financial trading swarms to autonomous database migrations, Black Box equips your engineering team
            with automated safety barriers, red-teaming, and fleet-wide verification.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Card 1: Fleet Regression Firewall */}
          <div className="md:col-span-7 rounded-3xl apple-glass-card p-8 border border-white/10 flex flex-col justify-between group hover:border-purple-500/40 transition-all duration-300 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
                  Regression Barrier
                </span>
              </div>

              <h3 className="text-2xl font-semibold text-white tracking-tight mb-2">
                Fleet-Wide Regression Firewall
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed max-w-lg mb-6">
                When you repair an agent for one customer failure, will that patch break 20 others?
                Black Box automatically executes your fix across hundreds of past passing and failing runs.
                It grants production approval only if regressions are strictly zero.
              </p>
            </div>

            {/* Visual Mini Telemetry Graph */}
            <div className="relative z-10 p-4 rounded-2xl bg-black/60 border border-white/[0.08] font-mono text-xs">
              <div className="flex items-center justify-between text-zinc-400 mb-3 text-[11px]">
                <span>Fleet Verification (40 Historical Runs)</span>
                <span className="text-emerald-400 font-bold">0 Regressions</span>
              </div>
              <div className="grid grid-cols-10 gap-1.5 h-12 items-end">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div
                    key={i}
                    style={{ height: `${60 + (i % 5) * 8}%` }}
                    className="w-full rounded-sm bg-gradient-to-t from-emerald-600 to-emerald-400 opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Crash-Test & Red Teamer */}
          <div className="md:col-span-5 rounded-3xl apple-glass-card p-8 border border-white/10 flex flex-col justify-between group hover:border-amber-500/40 transition-all duration-300 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Flame className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                  ))}
                </div>
              </div>

              <h3 className="text-2xl font-semibold text-white tracking-tight mb-2">
                Crash-Test Red Teamer
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed mb-6">
                Stress-test passing agent code by synthetically injecting corrupted tools, network timeouts,
                schema shifts, and prompt adversarial attacks. Grades your agent's fault tolerance from 1 to 5 stars.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-black/60 border border-white/[0.08] font-mono text-xs flex items-center justify-between">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase">Survivability Grade</div>
                <div className="text-base font-bold text-white mt-0.5">5.0 / 5.0 Elite</div>
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                12 Fault Mutations Handled
              </span>
            </div>
          </div>

          {/* Card 3: Guardian Money-Safe Interceptor */}
          <div className="md:col-span-5 rounded-3xl apple-glass-card p-8 border border-white/10 flex flex-col justify-between group hover:border-red-500/40 transition-all duration-300 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400">
                  <Lock className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/30">
                  Execution Safety
                </span>
              </div>

              <h3 className="text-2xl font-semibold text-white tracking-tight mb-2">
                Guardian Money-Safe Interceptor
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed mb-6">
                Hardware-grade protection: tools marked with financial movement, database deletion, or external
                email dispatch are strictly locked from re-executing during forensic tests without human cryptographic sign-off.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-black/60 border border-white/[0.08] font-mono text-xs flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-zinc-300 text-[11px]">
                Unauthorized tool dispatch quarantined (Alert sent)
              </span>
            </div>
          </div>

          {/* Card 4: 28 MCP Tools */}
          <div className="md:col-span-7 rounded-3xl apple-glass-card p-8 border border-white/10 flex flex-col justify-between group hover:border-cyan-500/40 transition-all duration-300 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Terminal className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  Model Context Protocol
                </span>
              </div>

              <h3 className="text-2xl font-semibold text-white tracking-tight mb-2">
                28 MCP Tools for Claude & Cursor
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed max-w-lg mb-6">
                Connect your IDE directly into Black Box. Ask Claude Code or Cursor:
                <em className="text-white"> "Why did Run #42 crash?"</em> and let the LLM execute forensic step ranking,
                counterfactual replay, and regression checks autonomously.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-black/60 border border-white/[0.08] font-mono text-xs flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded bg-white/[0.04] text-zinc-300 border border-white/[0.08]">
                blackbox_diagnose
              </span>
              <span className="px-2.5 py-1 rounded bg-white/[0.04] text-cyan-400 border border-cyan-500/30">
                blackbox_replay
              </span>
              <span className="px-2.5 py-1 rounded bg-white/[0.04] text-zinc-300 border border-white/[0.08]">
                blackbox_causal_report
              </span>
              <span className="px-2.5 py-1 rounded bg-white/[0.04] text-emerald-400 border border-emerald-500/30">
                blackbox_fleet_check
              </span>
              <span className="px-2.5 py-1 rounded bg-white/[0.04] text-zinc-300 border border-white/[0.08]">
                blackbox_crash_test
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
