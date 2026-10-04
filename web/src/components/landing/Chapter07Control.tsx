import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Pause, Play, CheckCircle, RotateCcw, AlertTriangle, ArrowRight } from 'lucide-react';

export const Chapter07Control: React.FC = () => {
  const [operatorChoice, setOperatorChoice] = useState<'fork' | 'rollback' | 'approve'>('fork');

  const STAGES = [
    { num: '01', title: 'ANOMALY DETECTED', status: 'IN-FLIGHT DRIFT', desc: 'Tool dropped currency key; schema validator triggered deviation score 0.88.' },
    { num: '02', title: 'EXECUTION PAUSED', status: 'SAVE-POINT FROZEN', desc: 'Agent frozen at Step 04 before executing external database writes.' },
    { num: '03', title: 'CAUSE PRESENTED', status: 'EVIDENCE ASSEMBLED', desc: 'Causal engine isolates root step and calculates 2 poisoned downstream symptoms.' },
    { num: '04', title: 'OPERATOR DECISION', status: 'AWAITING DISPATCH', desc: 'Human-in-the-loop chooses verified counterfactual repair path.' },
  ];

  return (
    <section
      id="ch-07"
      className="relative py-28 px-6 sm:px-12 md:px-20 font-sans border-b border-[#1f2937]/50 bg-[#05070b]"
    >
      <div className="max-w-6xl mx-auto">
        {/* Chapter Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 mb-3 text-xs font-mono text-cyan-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="uppercase">CHAPTER 07 // THE CONTROL</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">GUARDIAN AUTONOMOUS INTERCEPT</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-light text-white uppercase tracking-tight mb-4">
            Context and control <br />
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-white">
              before damage occurs.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 font-normal max-w-2xl leading-relaxed">
            Black Box does not just diagnose past failures. Guardian acts as an autonomous safety brake in-flight.
            When an agent begins drifting into toxic state, execution is paused at the save-point before
            irreversible mutations reach external services.
          </p>
        </div>

        {/* Calm Architectural Control Console */}
        <div className="bg-[#080d16] border border-[#1f2937] rounded-lg p-6 font-mono shadow-2xl space-y-8">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#1f2937] gap-3 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-bold">GUARDIAN AUTONOMOUS BRAKE // ACTIVE MONITORING</span>
            </div>

            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-cyan-300">INTERCEPT LATENCY: 0.0MS</span>
            </div>
          </div>

          {/* 4-Stage Controlled Progression */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {STAGES.map((s, idx) => (
              <div
                key={s.num}
                className="p-4 rounded bg-[#06080e] border border-[#1a2333] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-cyan-400 font-bold">{s.num}</span>
                    <span className="text-[9px] text-zinc-500 uppercase">{s.status}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1.5">{s.title}</h4>
                  <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                    {s.desc}
                  </p>
                </div>

                <div className="mt-4 pt-2 border-t border-zinc-900 text-[9px] text-zinc-600">
                  STAGE VERIFIED
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Operator Decision Bar */}
          <div className="p-4 rounded bg-[#060a12] border border-[#1a2333] flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs">
              <span className="text-zinc-500 uppercase block text-[10px] mb-0.5">PENDING OPERATOR DISPATCH:</span>
              <p className="text-zinc-300 font-sans">
                Run #apac_09 paused at Save-Point #2. Choose recovery protocol:
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setOperatorChoice('fork')}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer font-bold ${
                  operatorChoice === 'fork'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-600 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                FORK WITH PATCHED VALIDATOR
              </button>

              <button
                onClick={() => setOperatorChoice('rollback')}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  operatorChoice === 'rollback'
                    ? 'bg-amber-950 text-amber-300 border border-amber-600'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                ROLLBACK TO PRE-TASK STATE
              </button>

              <button
                onClick={() => setOperatorChoice('approve')}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  operatorChoice === 'approve'
                    ? 'bg-zinc-800 text-white border border-zinc-700'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                TERMINATE
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
