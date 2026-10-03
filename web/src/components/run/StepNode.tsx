import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { StepKind } from '../../types/api';
import { AlertCircle, Bug, ShieldAlert, Cpu, Wrench, Search, CheckCircle, Database } from 'lucide-react';

interface StepNodeData {
  idx: number;
  kind: StepKind;
  name: string;
  node: string;
  label: string;
  preview: string;
  error?: string | null;
  reused?: boolean;
  latency_ms?: number;
  tokens?: number;
  suspect_rank?: number | null;
  suspect_p?: number | null;
  is_guilty?: boolean;
  is_planted?: boolean;
  is_contaminated?: boolean;
  checker?: {
    on_track?: number;
    consistent?: number;
    alarm?: boolean;
    tier?: string;
  } | null;
}

const kindIcons: Record<StepKind, React.ComponentType<{ className?: string }>> = {
  llm: Cpu,
  tool: Wrench,
  retrieval: Search,
  final: CheckCircle,
  state: Database,
};

const kindStyles: Record<StepKind, { bg: string; text: string; border: string }> = {
  llm: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  tool: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  retrieval: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  final: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  state: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' },
};

export const StepNode = memo(({ data, selected }: { data: StepNodeData; selected?: boolean }) => {
  const Icon = kindIcons[data.kind] || Cpu;
  const style = kindStyles[data.kind] || kindStyles.llm;

  let cardStyle = 'border-white/[0.08] bg-[#101216]/90 hover:border-white/[0.18] shadow-lg';
  let banner = null;

  if (data.is_guilty) {
    cardStyle = 'border-rose-500/80 bg-gradient-to-b from-rose-950/40 via-zinc-900/90 to-zinc-950 shadow-2xl shadow-rose-950/80 ring-2 ring-rose-500/40';
    banner = (
      <span className="px-2 py-0.5 rounded-full text-[9px] font-sans font-bold bg-rose-500 text-white uppercase tracking-wider shadow-sm flex items-center gap-1 animate-pulse">
        <AlertCircle className="w-2.5 h-2.5" />
        Root Cause
      </span>
    );
  } else if (data.is_contaminated) {
    cardStyle = 'border-amber-500/60 bg-gradient-to-b from-amber-950/30 via-zinc-900/90 to-zinc-950 shadow-xl shadow-amber-950/50 ring-1 ring-amber-500/30';
    banner = (
      <span className="px-2 py-0.5 rounded-full text-[9px] font-sans font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
        Contaminated
      </span>
    );
  } else if (data.suspect_rank) {
    banner = (
      <span className="px-2 py-0.5 rounded-full text-[9px] font-sans font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase tracking-wider">
        Suspect #{data.suspect_rank}
      </span>
    );
  } else if (data.is_planted) {
    banner = (
      <span className="px-2 py-0.5 rounded-full text-[9px] font-sans font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
        Planted
      </span>
    );
  }

  if (selected) {
    cardStyle += ' ring-2 ring-white shadow-2xl';
  }

  return (
    <div
      className={`w-72 rounded-2xl border text-zinc-100 p-4 transition-all duration-200 cursor-pointer backdrop-blur-xl ${cardStyle}`}
    >
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-zinc-500 !border-2 !border-zinc-950" />

      {/* Top badges */}
      <div className="flex items-center justify-between gap-1 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-xs font-mono font-bold text-zinc-300">
            #{data.idx}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-sans font-semibold uppercase tracking-wider border ${style.bg} ${style.text} ${style.border}`}>
            <Icon className="w-3 h-3" />
            {data.kind}
          </span>
        </div>

        {banner}
      </div>

      {/* Step name / node */}
      <div className="font-sans font-bold text-xs text-white truncate flex items-center justify-between">
        <span className="truncate">{data.name || data.node}</span>
        <span className="text-[10px] text-zinc-500 font-mono font-normal ml-1 shrink-0">:{data.node}</span>
      </div>

      {/* Output preview */}
      <div className="mt-2.5 p-2.5 rounded-xl bg-black/40 border border-white/[0.04] text-[11px] font-mono text-zinc-300 line-clamp-2 break-all leading-relaxed">
        {data.preview || '(empty)'}
      </div>

      {/* Footer stats */}
      <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-zinc-400 font-sans">
        <div>
          {data.latency_ms !== undefined && data.latency_ms !== null ? (
            <span className="font-mono text-zinc-400">{data.latency_ms.toFixed(0)}ms</span>
          ) : (
            <span className="text-emerald-400/90 font-medium">Replayed (0 tokens)</span>
          )}
        </div>
        {data.checker && (
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-zinc-500">Track:</span>
            <span className={`font-mono font-semibold ${(data.checker.on_track ?? 1) < 0.6 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {((data.checker.on_track ?? 0) * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-zinc-500 !border-2 !border-zinc-950" />
    </div>
  );
});
