import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Pause, Check, Ban, AlertCircle, PhoneCall, Mail, MessageSquare, ArrowRight } from 'lucide-react';

export const GuardianSection: React.FC = () => {
  const [decision, setDecision] = useState<'pending' | 'approved' | 'blocked'>('pending');

  return (
    <section id="guardian" className="relative py-20 md:py-32 border-t border-[#1f2937]/80 bg-[#05070b] overflow-hidden">
      {/* Background alarm pulse beam */}
      <div className="absolute top-1/2 left-1/4 w-[450px] h-[300px] bg-amber-500/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-[1400px] mx-auto px-6 font-sans relative z-10">
        {/* Section Eyebrow */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 mb-3 font-mono text-xs text-amber-400"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="tracking-widest uppercase font-semibold">08 // SAFETY INTERVENTION</span>
        </motion.div>

        {/* Section Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mb-12"
        >
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1] uppercase">
            AUTONOMOUS AGENTS NEED
            <br />
            <span className="text-zinc-400">AN AUTONOMOUS BRAKE.</span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 mt-4 leading-relaxed">
            When agents execute wire transfers, deploy code, or modify customer records, hallucinations
            cannot wait for post-mortem reviews. Guardian monitors step safety live, freezing execution
            instantly before unauthorized high-stakes actions fire.
          </p>
        </motion.div>

        {/* Narrative Stages Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-10 text-xs font-mono">
          <div className="p-3 rounded bg-[#0b0f17] border border-[#1f2937] flex items-center gap-2">
            <span className="text-red-400 font-bold">01</span>
            <span className="text-zinc-300">ANOMALY DETECTED</span>
          </div>
          <div className="p-3 rounded bg-amber-950/40 border border-amber-800 flex items-center gap-2">
            <span className="text-amber-400 font-bold">02</span>
            <span className="text-amber-200">AGENT PAUSED</span>
          </div>
          <div className="p-3 rounded bg-[#0b0f17] border border-[#1f2937] flex items-center gap-2">
            <span className="text-cyan-400 font-bold">03</span>
            <span className="text-zinc-300">CAUSE ISOLATED</span>
          </div>
          <div className="p-3 rounded bg-[#0b0f17] border border-[#1f2937] flex items-center gap-2">
            <span className="text-white font-bold">04</span>
            <span className="text-zinc-300">OPERATOR NOTIFIED</span>
          </div>
          <div className="p-3 rounded bg-[#0b1626] border border-cyan-800 flex items-center gap-2">
            <span className="text-emerald-400 font-bold">05</span>
            <span className="text-emerald-300 font-semibold">VERDICT ENFORCED</span>
          </div>
        </div>

        {/* Guardian Control Panel Simulation */}
        <div className="bg-[#0b0f17] border border-[#1f2937] rounded-lg p-6 md:p-8 shadow-2xl font-mono text-xs">
          {/* Incident Title Bar */}
          <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#1f2937] gap-3">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-sm font-bold text-white tracking-wider">
                INCIDENT INC-2026-9810 // HIGH SEVERITY
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-zinc-500">STATE:</span>
              <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-700 text-amber-300 font-bold">
                AUTOPILOT FROZEN AT STEP #4
              </span>
            </div>
          </div>

          {/* Incident Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-6">
            {/* Left 7 cols: Incident Report */}
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">TRIGGER REASON:</span>
                <p className="text-xs text-zinc-200 font-sans leading-relaxed">
                  Agent attempted execution of <code className="text-amber-400 bg-black/40 px-1 py-0.5 rounded">dispatch_wire_transfer</code> ($42,500 USD)
                  while upstream currency key was missing, resulting in an unvalidated rate calculation.
                </p>
              </div>

              {/* Notification Channels Audit */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">CHANNELS DISPATCHED:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2.5 rounded bg-[#070a10] border border-[#1f2937] flex items-center gap-2 text-zinc-300">
                    <Mail className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Email Alert (Owner)</span>
                  </div>
                  <div className="p-2.5 rounded bg-[#070a10] border border-[#1f2937] flex items-center gap-2 text-zinc-300">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Slack #incidents</span>
                  </div>
                  <div className="p-2.5 rounded bg-[#070a10] border border-[#1f2937] flex items-center gap-2 text-zinc-300">
                    <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                    <span>Twilio Voice / SMS</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 5 cols: Live Operator Decision Controls */}
            <div className="lg:col-span-5 p-5 rounded-lg bg-[#070a10] border border-[#1f2937] flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400 font-bold uppercase">OPERATOR DECISION:</span>
                  <span className="text-zinc-500">REQUIRE_HUMAN_IN_THE_LOOP</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans">
                  The agent is safely suspended in memory. Choose whether to permit a counterfactual retry with patched inputs or abort the run.
                </p>
              </div>

              {/* Decision Action Buttons */}
              <div className="space-y-2">
                {decision === 'pending' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDecision('approved')}
                      className="py-2.5 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>APPROVE RETRY</span>
                    </button>
                    <button
                      onClick={() => setDecision('blocked')}
                      className="py-2.5 px-3 rounded bg-red-950 hover:bg-red-900 border border-red-800 text-red-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>BLOCK & ABORT</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded border text-center space-y-1">
                    {decision === 'approved' && (
                      <div className="text-emerald-400 font-bold flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" />
                        <span>RETRY APPROVED BY OPERATOR ADVAY</span>
                      </div>
                    )}
                    {decision === 'blocked' && (
                      <div className="text-red-400 font-bold flex items-center justify-center gap-2">
                        <Ban className="w-4 h-4" />
                        <span>AGENT BLOCKED: RUN TERMINATED</span>
                      </div>
                    )}
                    <button
                      onClick={() => setDecision('pending')}
                      className="text-[10px] text-zinc-500 hover:text-white underline cursor-pointer"
                    >
                      Reset Decision Simulation
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Footnote */}
          <div className="pt-3 border-t border-[#1f2937] flex items-center justify-between text-[10px] text-zinc-500">
            <span>RESUMABLE STATE HASH: #ctx_state_4992_sp4</span>
            <span>GUARDIAN v0.1.0</span>
          </div>
        </div>
      </div>
    </section>
  );
};
