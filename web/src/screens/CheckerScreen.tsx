import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CheckCircle2, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

export const CheckerScreen: React.FC = () => {
  const { data: status, isLoading } = useQuery<any>({
    queryKey: ['system-status'],
    queryFn: () => api.get<any>('/api/status'),
  });

  const counts = status?.counts || {};
  const stepsCount = counts.steps !== undefined ? counts.steps.toLocaleString() : (isLoading ? '—' : '0');
  const runsCount = counts.runs !== undefined ? counts.runs.toLocaleString() : (isLoading ? '—' : '0');
  const alarmsCount = counts.labelled_failures !== undefined ? counts.labelled_failures.toLocaleString() : (isLoading ? '—' : '0');
  const passRatio = (counts.passed && counts.runs) ? `${Math.round((counts.passed / counts.runs) * 100)}%` : '—';
  const dedupRatio = counts.save_point_dedup !== undefined ? `${Math.round(counts.save_point_dedup * 100)}%` : '—';

  const checkerStats = [
    { label: 'Checked Steps', value: stepsCount, note: `${runsCount} recorded runs audited` },
    { label: 'Fleet Pass Rate', value: passRatio, note: `${counts.passed?.toLocaleString() || 0} passing traces verified` },
    { label: 'Alarms Raised', value: alarmsCount, note: 'Ground-truth divergences flagged' },
    { label: 'Dedup Invariant', value: dedupRatio, note: 'State cache deduplication ratio' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            AUTONOMOUS STEP CHECKER
          </span>
          <span className="text-xs text-zinc-500 font-mono">Live Step Verification Engine</span>
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight font-heading flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>Step Checker & Fact Monitor</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Continuous invariant checking for intermediate agent reasoning steps, facts, and arithmetic.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {checkerStats.map((item, idx) => (
          <div key={idx} className="p-4 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-1 shadow-lg">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{item.label}</span>
            <div className="text-2xl font-bold font-mono text-white">{item.value}</div>
            <div className="text-[11px] text-zinc-400">{item.note}</div>
          </div>
        ))}
      </div>

      {/* Invariants & Checker Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-3 shadow-lg">
          <div className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Tier-1 Exact Checker</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Deterministic verifiers for arithmetic, mathematical equations, JSON schema conformance, and tool invocation contracts.
          </p>
          <div className="p-3 rounded-lg bg-[#08090a] border border-white/[0.04] text-xs font-mono text-zinc-300 space-y-1">
            <div className="text-emerald-400">✓ math_exact: Evaluates ground truth equations</div>
            <div className="text-emerald-400">✓ tool_contract: Enforces expected tool argument types</div>
            <div className="text-emerald-400">✓ memory_integrity: Guards against state overwrites</div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0c0d10] border border-white/[0.06] space-y-3 shadow-lg">
          <div className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Tier-2 Semantic Consistency Monitor</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Evaluates contextual contradiction between retrieved passages and LLM assertions before answer generation.
          </p>
          <div className="p-3 rounded-lg bg-[#08090a] border border-white/[0.04] text-xs font-mono text-zinc-300 space-y-1">
            <div className="text-cyan-400">● on_track_prob: Probability that step stays within goal trajectory</div>
            <div className="text-cyan-400">● consistent_prob: Document entailment against retrieval docs</div>
            <div className="text-cyan-400">● alarm_threshold: Triggers suspect flag if consistency &lt; 0.65</div>
          </div>
        </div>
      </div>
    </div>
  );
};
